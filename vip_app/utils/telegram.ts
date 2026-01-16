// Утилиты для работы с Telegram WebApp
import { getApiBase } from './fetch'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    chat?: any
    auth_date?: number
    hash?: string
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: any
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  isClosingConfirmationEnabled: boolean
  isVerticalSwipesEnabled: boolean
  ready(): void
  expand(): void
  close(): void
  enableClosingConfirmation(): void
  disableClosingConfirmation(): void
  enableVerticalSwipes(): void
  disableVerticalSwipes(): void
  onEvent(eventType: string, eventHandler: () => void): void
  offEvent(eventType: string, eventHandler: () => void): void
  sendData(data: string): void
  switchInlineQuery(query: string, choose_chat_types?: string[]): void
  openLink(url: string, options?: { try_instant_view?: boolean }): void
  openTelegramLink(url: string): void
  openInvoice(url: string, callback?: (status: string) => void): void
  showPopup(params: any, callback?: (button_id: string) => void): void
  showAlert(message: string, callback?: () => void): void
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void
  showScanQrPopup(params: any, callback?: (text: string) => void): void
  closeScanQrPopup(): void
  readTextFromClipboard(callback?: (text: string) => void): void
  requestWriteAccess(callback?: (granted: boolean) => void): void
  requestContact(callback?: (granted: boolean) => void): void
  mainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    setText(text: string): void
    onClick(callback: () => void): void
    offClick(callback: () => void): void
    show(): void
    hide(): void
    enable(): void
    disable(): void
    showProgress(leaveActive?: boolean): void
    hideProgress(): void
    setParams(params: {
      text?: string
      color?: string
      text_color?: string
      is_active?: boolean
      is_visible?: boolean
    }): void
  }
  backButton: {
    isVisible: boolean
    onClick(callback: () => void): void
    offClick(callback: () => void): void
    show(): void
    hide(): void
  }
  hapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }
  cloudStorage: {
    setItem(key: string, value: string, callback?: (error: string | null, result?: boolean) => void): void
    getItem(key: string, callback: (error: string | null, result?: string) => void): void
    getItems(keys: string[], callback: (error: string | null, result?: Record<string, string>) => void): void
    removeItem(key: string, callback?: (error: string | null, result?: boolean) => void): void
    removeItems(keys: string[], callback?: (error: string | null, result?: boolean) => void): void
    getKeys(callback: (error: string | null, result?: string[]) => void): void
  }
  biometricManager: {
    isInited: boolean
    isBiometricAvailable: boolean
    biometricType: 'finger' | 'face' | 'unknown'
    isAccessRequested: boolean
    isAccessGranted: boolean
    isBiometricTokenSaved: boolean
    deviceId: string
    init(callback?: (error: string | null) => void): void
    requestAccess(params: any, callback?: (error: string | null, granted?: boolean) => void): void
    authenticate(params: any, callback?: (error: string | null, token?: string) => void): void
    updateBiometricToken(token: string, callback?: (error: string | null) => void): void
    openSettings(): void
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

// Получение экземпляра Telegram WebApp (с проверкой совместимости)
export const getTelegramWebApp = (): TelegramWebApp | null => {
  if (typeof window === 'undefined') {
    return null
  }
  
  // Безопасный доступ для старых браузеров
  try {
    const telegram = (window as any).Telegram
    if (telegram && telegram.WebApp) {
      return telegram.WebApp
    }
  } catch (e) {
    // Игнорируем ошибки доступа
  }
  
  return null
}

// Кэш для данных пользователя (для производительности)
let cachedUser: TelegramUser | null = null
let cachedUserId: string | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 минут

// Оптимизированное получение данных пользователя (без лишних проверок и логирования)
export const getTelegramUser = (useCache: boolean = true): TelegramUser | null => {
  // Проверяем кэш
  if (useCache && cachedUser && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedUser
  }
  
  const tg = getTelegramWebApp()
  if (!tg) {
    return null
  }
  
  // Приоритет 1: initDataUnsafe (самый быстрый способ)
  // Безопасный доступ для старых браузеров
  try {
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      cachedUser = tg.initDataUnsafe.user
      cachedUserId = String(cachedUser.id)
      cacheTimestamp = Date.now()
      return cachedUser
    }
  } catch (e) {
    // Игнорируем ошибки доступа
  }
  
  // Приоритет 2: парсинг initData (только если initDataUnsafe недоступен)
  if (tg.initData) {
    try {
      const params = new URLSearchParams(tg.initData)
      const userParam = params.get('user')
      if (userParam) {
        const userData = JSON.parse(decodeURIComponent(userParam))
        cachedUser = userData
        cachedUserId = String(userData.id)
        cacheTimestamp = Date.now()
        return userData
      }
    } catch (e) {
      // Тихая ошибка - не логируем для производительности
    }
  }
  
  // Приоритет 3: localStorage (быстрый fallback)
  if (typeof window !== 'undefined') {
    try {
      const savedUser = localStorage.getItem('telegram_user')
      if (savedUser) {
        const userData = JSON.parse(savedUser)
        cachedUser = userData
        cachedUserId = String(userData.id)
        cacheTimestamp = Date.now()
        return userData
      }
    } catch (e) {
      // Тихая ошибка
    }
  }
  
  return null
}

// Оптимизированное получение user ID (самый быстрый способ)
export const getTelegramUserId = (useCache: boolean = true): string | null => {
  // Проверяем кэш ID
  if (useCache && cachedUserId && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedUserId
  }
  
  // Приоритет 1: Telegram WebApp (если доступен)
  const tg = getTelegramWebApp()
  if (tg) {
    // Приоритет 1.1: initDataUnsafe (самый быстрый)
    // Безопасный доступ для старых браузеров
    try {
      if (tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) {
        cachedUserId = String(tg.initDataUnsafe.user.id)
        cachedUser = tg.initDataUnsafe.user
        cacheTimestamp = Date.now()
        return cachedUserId
      }
    } catch (e) {
      // Игнорируем ошибки доступа
    }
    
    // Приоритет 1.2: парсинг initData
    if (tg.initData) {
      try {
        const params = new URLSearchParams(tg.initData)
        const userParam = params.get('user')
        if (userParam) {
          const userData = JSON.parse(decodeURIComponent(userParam))
          if (userData.id) {
            cachedUserId = String(userData.id)
            cachedUser = userData
            cacheTimestamp = Date.now()
            return cachedUserId
          }
        }
      } catch (e) {
        // Тихая ошибка
      }
    }
  }
  
  // Приоритет 2: localStorage (работает и для Telegram Login Widget)
  if (typeof window !== 'undefined') {
    try {
      const savedUser = localStorage.getItem('telegram_user')
      if (savedUser) {
        const userData = JSON.parse(savedUser)
        if (userData.id) {
          cachedUserId = String(userData.id)
          cachedUser = userData
          cacheTimestamp = Date.now()
          return cachedUserId
        }
      }
    } catch (e) {
      // Тихая ошибка
    }
  }
  
  return null
}

// Очистка кэша (для принудительного обновления)
export const clearTelegramUserCache = (): void => {
  cachedUser = null
  cachedUserId = null
  cacheTimestamp = 0
}

// Получение initData для отправки на сервер
export const getInitData = (): string => {
  const tg = getTelegramWebApp()
  return tg?.initData || ''
}

// Сохранение данных пользователя в localStorage и cookies
export const saveUserData = (user: TelegramUser) => {
  // Сохраняем в localStorage
  localStorage.setItem('telegram_user', JSON.stringify(user))
  
  // Сохраняем в cookies на 30 дней
  const expires = new Date()
  expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000))
  
  document.cookie = `telegram_user_id=${user.id}; expires=${expires.toUTCString()}; path=/`
  document.cookie = `telegram_username=${user.username || ''}; expires=${expires.toUTCString()}; path=/`
  document.cookie = `telegram_first_name=${user.first_name}; expires=${expires.toUTCString()}; path=/`
  document.cookie = `telegram_last_name=${user.last_name || ''}; expires=${expires.toUTCString()}; path=/`
}

// Загрузка данных пользователя
export const loadUserData = (): TelegramUser | null => {
  try {
    const saved = localStorage.getItem('telegram_user')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('Error loading user data:', error)
  }
  return null
}

// Отправка данных на сервер для синхронизации с ботом
export const syncWithBot = async (userData: TelegramUser, action: string, data?: any) => {
  try {
    const response = await fetch('/api/sync-bot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: userData,
        action,
        data,
        initData: getInitData()
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to sync with bot')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error syncing with bot:', error)
    return null
  }
}

// Уведомление пользователя через Telegram
export const notifyUser = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const tg = getTelegramWebApp()
  if (tg) {
    switch (type) {
      case 'success':
        tg.showAlert(message)
        break
      case 'error':
        tg.showAlert(message)
        break
      case 'info':
        tg.showAlert(message)
        break
    }
  } else {
    // Fallback для браузера
    alert(message)
  }
}

// Инициализация Telegram WebApp
export const initTelegramWebApp = () => {
  const tg = getTelegramWebApp()
  if (tg) {
    tg.ready()
    tg.expand()
    
    // Получаем данные пользователя
    const user = getTelegramUser()
    if (user) {
      saveUserData(user)
    }
    
    return user
  }
  return null
}

// Проверка блокировки пользователя
export const checkUserBlocked = async (userId: string | number | null): Promise<boolean> => {
  if (!userId) {
    return false // Если нет ID, не считаем заблокированным
  }

  try {
    const apiUrl = getApiBase()
    
    const response = await fetch(`${apiUrl}/api/public/check-user-status?user_id=${userId}`)
    const data = await response.json()
    
    if (data.success && data.data.isBlocked) {
      return true // Пользователь заблокирован
    }
    
    return false // Пользователь не заблокирован
  } catch (error) {
    console.error('Error checking user blocked status:', error)
    // В случае ошибки не блокируем пользователя (разрешаем доступ)
    return false
  }
}





