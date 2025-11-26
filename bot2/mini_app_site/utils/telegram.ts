// Утилиты для работы с Telegram WebApp
import { getApiBase } from './fetch'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
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

// Получение экземпляра Telegram WebApp
export const getTelegramWebApp = (): TelegramWebApp | null => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp
  }
  return null
}

// Получение данных пользователя
export const getTelegramUser = (): TelegramUser | null => {
  console.log('🔍 getTelegramUser: Начинаем получение данных пользователя')
  
  const tg = getTelegramWebApp()
  console.log('🔍 getTelegramWebApp result:', tg)
  
  if (!tg) {
    console.log('❌ Telegram WebApp не доступен')
    return null
  }
  
  console.log('🔍 Telegram WebApp доступен:', {
    initData: tg.initData,
    initDataUnsafe: tg.initDataUnsafe,
    version: tg.version,
    platform: tg.platform
  })
  
  // Сначала пробуем получить из initDataUnsafe
  if (tg?.initDataUnsafe?.user) {
    console.log('✅ User from initDataUnsafe:', tg.initDataUnsafe.user)
    return tg.initDataUnsafe.user
  }
  
  // Если нет, пробуем парсить initData
  if (tg?.initData) {
    try {
      console.log('🔍 Парсим initData:', tg.initData)
      const params = new URLSearchParams(tg.initData)
      const userParam = params.get('user')
      console.log('🔍 userParam из initData:', userParam)
      
      if (userParam) {
        const userData = JSON.parse(decodeURIComponent(userParam))
        console.log('✅ User from initData:', userData)
        return userData
      }
    } catch (e) {
      console.log('❌ Error parsing initData:', e)
    }
  }
  
  // Пробуем получить из window.Telegram напрямую
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    console.log('✅ User from window.Telegram.WebApp.initDataUnsafe:', window.Telegram.WebApp.initDataUnsafe.user)
    return window.Telegram.WebApp.initDataUnsafe.user
  }
  
  // Пробуем получить из localStorage (если данные были сохранены ранее)
  try {
    const savedUser = localStorage.getItem('telegram_user')
    if (savedUser) {
      const userData = JSON.parse(savedUser)
      console.log('✅ User from localStorage:', userData)
      return userData
    }
  } catch (e) {
    console.log('❌ Error parsing localStorage user:', e)
  }
  
  // Пробуем получить из cookies как последний fallback
  try {
    const cookies = document.cookie.split(';')
    const cookieData: any = {}
    
    cookies.forEach(cookie => {
      const [name, value] = cookie.trim().split('=')
      if (name.startsWith('telegram_')) {
        cookieData[name.replace('telegram_', '')] = decodeURIComponent(value)
      }
    })
    
    if (cookieData.user_id) {
      const userData = {
        id: parseInt(cookieData.user_id),
        username: cookieData.username || '',
        first_name: cookieData.first_name || '',
        last_name: cookieData.last_name || '',
        language_code: cookieData.language_code || 'ru',
        is_premium: false
      }
      console.log('✅ User from cookies:', userData)
      return userData
    }
  } catch (e) {
    console.log('❌ Error parsing cookies:', e)
  }
  
  console.log('❌ No user data found')
  return null
}

// Получение user ID
export const getTelegramUserId = (): number | null => {
  const user = getTelegramUser()
  return user?.id || null
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





