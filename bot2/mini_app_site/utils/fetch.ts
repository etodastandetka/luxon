// Утилита для безопасного fetch с таймаутом и обработкой ошибок для мобильных браузеров

import { getApiBase as getApiBaseFromConfig } from '../config/api'

/**
 * Получить базовый URL для API
 * Использует единую конфигурацию из config/api.ts
 */
export function getApiBase(): string {
  return getApiBaseFromConfig()
}

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

  // Проверяем поддержку AbortController (может быть проблема на старых iOS)
  const hasAbortController = typeof AbortController !== 'undefined'
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent || '')
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let controller: AbortController | null = null
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      
      // Создаем AbortController только если поддерживается
      if (hasAbortController) {
        try {
          controller = new AbortController()
          timeoutId = setTimeout(() => {
            if (controller) {
              controller.abort()
            }
          }, timeout)
        } catch (controllerError) {
          // Продолжаем без таймаута на старых устройствах
        }
      }

      try {
        const fetchOptionsWithSignal = controller && controller.signal
          ? Object.assign({}, fetchOptions, { signal: controller.signal })
          : fetchOptions
        
        const response = await fetch(url, fetchOptionsWithSignal)

        if (timeoutId !== null) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        return response
      } catch (fetchError: any) {
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        
        // Если это AbortError (таймаут), пробуем еще раз только если не iOS
        if (fetchError.name === 'AbortError') {
          lastError = new Error(`Таймаут запроса (${timeout}ms). Проверьте интернет-соединение.`)
          // На iOS не делаем retry при AbortError
          if (isIOS) {
            throw lastError
          }
          if (attempt < retries) {
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
      const errorMessage = error && error.message ? error.message : String(error)
      const isNetworkError = 
        errorMessage.indexOf('Failed to fetch') !== -1 ||
        errorMessage.indexOf('NetworkError') !== -1 ||
        errorMessage.indexOf('Network request failed') !== -1 ||
        errorMessage.indexOf('ERR_INTERNET_DISCONNECTED') !== -1 ||
        errorMessage.indexOf('ERR_NETWORK_CHANGED') !== -1 ||
        (error && error.name === 'TypeError' && errorMessage.indexOf('fetch') !== -1)
      
      // Проверяем если это ошибка 413 (Request Entity Too Large)
      const is413Error = errorMessage.indexOf('413') !== -1 || 
                        errorMessage.indexOf('Request Entity Too Large') !== -1 ||
                        errorMessage.indexOf('Entity Too Large') !== -1
      if (is413Error) {
        throw new Error('Размер данных слишком большой. Пожалуйста, уменьшите размер фото или попробуйте без фото.')
      }
      
      if (isNetworkError) {
        // Для сетевых ошибок пробуем еще раз
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        // Только если это действительно сетевая ошибка
        const isRealNetworkIssue = 
          errorMessage.indexOf('HTTP') === -1 && 
          errorMessage.indexOf('Status:') === -1 &&
          errorMessage.indexOf('Ошибка') === -1 &&
          errorMessage.indexOf('Error') === -1 &&
          (error && (error.name === 'TypeError' || error.name === 'NetworkError'))
        
        if (isRealNetworkIssue) {
          throw new Error('Нет подключения к интернету. Проверьте соединение и попробуйте снова.')
        }
        throw error
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

