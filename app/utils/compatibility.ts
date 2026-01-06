/**
 * Утилиты для проверки совместимости и работы со старыми устройствами
 */

/**
 * Проверка поддержки критических функций
 */
export function checkCompatibility(): {
  supported: boolean
  missingFeatures: string[]
  isOldDevice: boolean
} {
  const missingFeatures: string[] = []
  let isOldDevice = false

  // Проверяем критические функции
  if (typeof fetch === 'undefined') {
    missingFeatures.push('fetch')
  }

  if (typeof Promise === 'undefined') {
    missingFeatures.push('Promise')
  }

  if (typeof Object.assign === 'undefined') {
    missingFeatures.push('Object.assign')
  }

  if (typeof Array.from === 'undefined') {
    missingFeatures.push('Array.from')
  }

  if (typeof String.prototype.includes === 'undefined') {
    missingFeatures.push('String.includes')
  }

  if (typeof Array.prototype.includes === 'undefined') {
    missingFeatures.push('Array.includes')
  }

  if (typeof URLSearchParams === 'undefined') {
    missingFeatures.push('URLSearchParams')
  }

  // Проверяем поддержку optional chaining (через try-catch)
  try {
    // eslint-disable-next-line no-eval
    eval('const test = {a: {b: 1}}; test?.a?.b')
  } catch {
    missingFeatures.push('optional chaining')
  }

  // Определяем старое устройство по User-Agent
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || ''
    const isOldAndroid = /Android [1-4]\./.test(ua)
    const isOldIOS = /OS [1-9]_/.test(ua) || /OS [1-9]\./.test(ua)
    const isOldBrowser = /MSIE|Trident/.test(ua)
    
    isOldDevice = isOldAndroid || isOldIOS || isOldBrowser
  }

  return {
    supported: missingFeatures.length === 0,
    missingFeatures,
    isOldDevice,
  }
}

/**
 * Безопасный доступ к вложенным свойствам (замена optional chaining)
 */
export function safeGet<T = any>(
  obj: any,
  path: string,
  defaultValue: T | null = null
): T | null {
  if (!obj || typeof obj !== 'object') {
    return defaultValue
  }

  const keys = path.split('.')
  let current: any = obj

  for (let i = 0; i < keys.length; i++) {
    if (current == null || typeof current !== 'object') {
      return defaultValue
    }
    current = current[keys[i]]
  }

  return current !== undefined ? current : defaultValue
}

/**
 * Безопасный вызов функции (если существует)
 */
export function safeCall<T = any>(
  fn: (() => T) | undefined | null,
  defaultValue: T | null = null
): T | null {
  if (typeof fn === 'function') {
    try {
      return fn()
    } catch (e) {
      return defaultValue
    }
  }
  return defaultValue
}

/**
 * Проверка поддержки localStorage
 */
export function hasLocalStorage(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

/**
 * Безопасный доступ к localStorage
 */
export function safeLocalStorage(): Storage | null {
  if (hasLocalStorage()) {
    return localStorage
  }
  return null
}

/**
 * Безопасный доступ к sessionStorage
 */
export function hasSessionStorage(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const test = '__sessionStorage_test__'
    sessionStorage.setItem(test, test)
    sessionStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

/**
 * Получить информацию о устройстве
 */
export function getDeviceInfo(): {
  isMobile: boolean
  isIOS: boolean
  isAndroid: boolean
  isOldDevice: boolean
  userAgent: string
} {
  if (typeof navigator === 'undefined') {
    return {
      isMobile: false,
      isIOS: false,
      isAndroid: false,
      isOldDevice: false,
      userAgent: '',
    }
  }

  const ua = navigator.userAgent || ''
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)
  const isMobile = isIOS || isAndroid || /Mobile/.test(ua)
  const isOldDevice =
    /Android [1-4]\./.test(ua) ||
    /OS [1-9]_/.test(ua) ||
    /OS [1-9]\./.test(ua) ||
    /MSIE|Trident/.test(ua)

  return {
    isMobile,
    isIOS,
    isAndroid,
    isOldDevice,
    userAgent: ua,
  }
}

