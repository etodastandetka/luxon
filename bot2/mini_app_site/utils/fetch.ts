// Утилита для безопасного fetch с таймаутом и обработкой ошибок для мобильных браузеров

interface FetchOptions extends RequestInit {
  timeout?: number // Таймаут в миллисекундах
  retries?: number // Количество попыток при ошибке
  retryDelay?: number // Задержка между попытками в миллисекундах
}

/**
 * Безопасный fetch с таймаутом и retry для мобильных браузеров
 */
export async function safeFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 30000, // 30 секунд по умолчанию
    retries = 1, // 1 попытка по умолчанию (итого 2 попытки)
    retryDelay = 1000, // 1 секунда между попытками
    ...fetchOptions
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Создаем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        return response
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        // Если это AbortError (таймаут), пробуем еще раз
        if (fetchError.name === 'AbortError') {
          lastError = new Error(`Таймаут запроса (${timeout}ms). Проверьте интернет-соединение.`)
          if (attempt < retries) {
            console.warn(`⏱️ Таймаут запроса, попытка ${attempt + 1}/${retries + 1}`)
            await new Promise(resolve => setTimeout(resolve, retryDelay))
            continue
          }
          throw lastError
        }
        
        throw fetchError
      }
    } catch (error: any) {
      lastError = error
      
      // Определяем тип ошибки для понятного сообщения
      const errorMessage = error?.message || String(error)
      const isNetworkError = 
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
        errorMessage.includes('ERR_NETWORK_CHANGED') ||
        error.name === 'TypeError' && errorMessage.includes('fetch')
      
      if (isNetworkError) {
        // Для сетевых ошибок пробуем еще раз
        if (attempt < retries) {
          console.warn(`🌐 Сетевая ошибка, попытка ${attempt + 1}/${retries + 1}:`, errorMessage)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        throw new Error('Нет подключения к интернету. Проверьте соединение и попробуйте снова.')
      }
      
      // Для других ошибок не повторяем
      throw error
    }
  }

  throw lastError || new Error('Неизвестная ошибка при выполнении запроса')
}

/**
 * Безопасный fetch с автоматическим парсингом JSON
 */
export async function safeFetchJson<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await safeFetch(url, options)
  
  if (!response.ok) {
    let errorText = ''
    try {
      errorText = await response.text()
    } catch (e) {
      errorText = `HTTP ${response.status} ${response.statusText}`
    }
    
    let errorData: any
    try {
      errorData = JSON.parse(errorText)
    } catch (e) {
      errorData = { error: errorText || `HTTP ${response.status}` }
    }
    
    const error = new Error(errorData.error || errorData.message || `HTTP ${response.status}`)
    ;(error as any).status = response.status
    ;(error as any).data = errorData
    throw error
  }
  
  try {
    const text = await response.text()
    if (!text) {
      return {} as T
    }
    return JSON.parse(text) as T
  } catch (e) {
    throw new Error('Не удалось распарсить ответ сервера')
  }
}

