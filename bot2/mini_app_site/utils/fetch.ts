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
    console.log(`🔄 safeFetch: попытка ${attempt + 1}/${retries + 1} для ${url}`)
    
    try {
      // Создаем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn(`⏱️ Таймаут запроса ${url} после ${timeout}ms`)
        controller.abort()
      }, timeout)

      try {
        console.log(`📤 Отправка fetch запроса: ${url}`, {
          method: fetchOptions.method || 'GET',
          hasBody: !!fetchOptions.body,
          bodySize: fetchOptions.body ? String(fetchOptions.body).length : 0
        })
        
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        console.log(`✅ Получен response от ${url}:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        })
        return response
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        console.error(`❌ Ошибка fetch для ${url}:`, {
          name: fetchError.name,
          message: fetchError.message,
          attempt: attempt + 1
        })
        
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
      
      console.error(`❌ Ошибка в safeFetch (попытка ${attempt + 1}/${retries + 1}):`, {
        url,
        errorMessage,
        isNetworkError,
        errorName: error.name
      })
      
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

