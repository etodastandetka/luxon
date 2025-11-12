/**
 * API клиент для работы с мобильными кассами (mob-cash.com)
 * Использует JSON-RPC 2.0 протокол
 */

import fetchCookie from 'fetch-cookie'
import { CookieJar } from 'tough-cookie'

// Создаем cookie jar для автоматического управления cookies
const cookieJar = new CookieJar()
const fetchWithCookies = fetchCookie(fetch, cookieJar)

interface MobCashConfig {
  login: string
  password: string
  cashdesk_id: string | number
  default_lat?: number
  default_lon?: number
  // Опциональные параметры для прямого использования токена
  bearer_token?: string
  user_id?: string
  session_id?: string
}

interface MobCashSession {
  token: string
  userID: string
  sessionID: string
  expiresAt: number // timestamp в миллисекундах
}

interface JsonRpcRequest {
  jsonrpc: string
  id: number
  method: string
  params: any
}

interface JsonRpcResponse {
  id: number
  jsonrpc: string
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

// Кеш сессий (в памяти)
const sessionCache = new Map<string, MobCashSession>()

// TTL сессии: 1 час
const SESSION_TTL = 60 * 60 * 1000

/**
 * Класс для работы с API мобильных касс
 */
export class MobCashClient {
  private config: MobCashConfig
  private baseUrl = 'https://admin.mob-cash.com/api/'
  private requestIdCounter = 1
  // Используем fetch с автоматическим управлением cookies
  private fetch = fetchWithCookies

  constructor(config: MobCashConfig) {
    this.config = {
      ...config,
      default_lat: config.default_lat || 34.6805775,
      default_lon: config.default_lon || 33.0458273,
    }
  }

  /**
   * Получить или обновить сессию
   */
  private async getSession(): Promise<MobCashSession> {
    const cacheKey = `${this.config.login}_${this.config.cashdesk_id}`
    const cached = sessionCache.get(cacheKey)

    // Проверяем, не истекла ли сессия
    if (cached && cached.expiresAt > Date.now()) {
      return cached
    }

    // Получаем новую сессию через авторизацию
    // Примечание: в документации не указан endpoint для авторизации
    // Предполагаем, что токен предоставляется отдельно или через другой механизм
    // Для начала используем логин/пароль для получения токена
    const session = await this.authenticate()

    // Сохраняем в кеш
    sessionCache.set(cacheKey, session)

    return session
  }

  /**
   * Авторизация через OAuth2 flow (получение токена, userID, sessionID)
   * Если токен предоставлен в конфигурации, используем его
   * Иначе выполняем полный OAuth2 flow
   */
  private async authenticate(): Promise<MobCashSession> {
    // Если токен, userID и sessionID предоставлены в конфигурации, используем их
    if (this.config.bearer_token && this.config.user_id && this.config.session_id) {
      return {
        token: this.config.bearer_token,
        userID: this.config.user_id,
        sessionID: this.config.session_id,
        expiresAt: Date.now() + SESSION_TTL,
      }
    }

    // Иначе выполняем полный OAuth2 flow
    try {
      // Шаг 1.1: Начало авторизации - получение LoginChallenge (cookies сохраняются в this.cookies)
      const { loginChallenge } = await this.getLoginChallenge()
      
      // Шаг 1.2: Получение ConsentChallenge (используем сохраненные cookies)
      const consentChallenge = await this.getConsentChallenge(loginChallenge)
      
      // Шаг 1.3: Получение токена авторизации
      const token = await this.getAccessToken(consentChallenge)
      
      // Шаг 1.4: Получение профиля пользователя (userID)
      const userID = await this.getUserProfile(token)
      
      // Шаг 1.5: Логин на кассу (sessionID)
      const sessionID = await this.loginToCashbox(token, userID)
      
      return {
        token,
        userID,
        sessionID,
        expiresAt: Date.now() + SESSION_TTL,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[MobCash Auth] Authentication error:', errorMessage)
      throw new Error(`Failed to authenticate: ${errorMessage}`)
    }
  }

  /**
   * Шаг 1.0: Получение cookies с CSRF токеном (предварительный GET запрос)
   */
  private async getInitialCookies(): Promise<void> {
    console.log('[MobCash Auth] Getting initial cookies from login page...')
    // Сначала делаем GET запрос на страницу логина, чтобы получить cookies
    // fetch-cookie автоматически сохранит cookies в cookie jar
    const response = await this.fetch('https://app.mob-cash.com/login', {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    })

    // Извлекаем cookies из ответа
    console.log('[MobCash Auth] Login page response status:', response.status)
    console.log('[MobCash Auth] Login page response headers:', Object.fromEntries(response.headers.entries()))
    
    const setCookieHeader = response.headers.get('set-cookie')
    console.log('[MobCash Auth] Set-Cookie from login page:', setCookieHeader)
    
    // fetch-cookie автоматически сохранит cookies, просто проверяем что они есть
    if (setCookieHeader) {
      console.log('[MobCash Auth] Initial cookies получены и сохранены автоматически')
    } else {
      console.warn('[MobCash Auth] No set-cookie header from login page')
    }
  }

  /**
   * Шаг 1.1: Начало авторизации - получение LoginChallenge
   */
  private async getLoginChallenge(): Promise<{ loginChallenge: string }> {
    // Получаем начальные cookies (fetch-cookie автоматически сохранит их)
    await this.getInitialCookies()

    // Согласно документации, используем POST с form-data
    const formData = new URLSearchParams()
    formData.append('response_type', 'code')
    formData.append('grant_type', 'refresh_token')
    formData.append('scope', 'offline')
    formData.append('client_id', '4e779103-d67b-42ef-bc9d-ab5ecdec40f8')
    formData.append('prompt', 'consent')
    formData.append('state', 'Qm2WdqqCf0sUyqaiCOWWDrGOOKcYdvOV')

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
      'Connection': 'keep-alive',
      'Origin': 'https://app.mob-cash.com/',
      'Referer': 'https://app.mob-cash.com/login',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    // fetch-cookie автоматически добавит cookies

    // Используем redirect: 'manual' чтобы получить cookies из промежуточных ответов
    // Используем fetch с cookies - они автоматически сохраняются и передаются
    const response = await this.fetch('https://admin.mob-cash.com/hydra/oauth2/auth', {
      method: 'POST',
      headers,
      body: formData,
      redirect: 'manual', // Не следуем редиректам автоматически, чтобы получить cookies
    })

    // Если редирект, пробуем извлечь login_challenge из URL или ответа
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location')
      if (location) {
        const urlParams = new URLSearchParams(location.split('?')[1] || '')
        const loginChallenge = urlParams.get('login_challenge')
        if (loginChallenge) {
          // fetch-cookie автоматически сохранит cookies из редиректа
          console.log('[MobCash Auth] LoginChallenge from redirect:', loginChallenge)
          return { loginChallenge }
        }
      }
    }

    if (!response.ok && response.status !== 302) {
      const errorText = await response.text()
      console.error('[MobCash Auth] LoginChallenge error:', response.status, errorText)
      throw new Error(`Failed to get login challenge: ${response.status} ${response.statusText}`)
    }

    // fetch-cookie автоматически сохраняет cookies, просто проверяем что они есть
    const setCookieHeader = response.headers.get('set-cookie')
    if (setCookieHeader) {
      console.log('[MobCash Auth] Cookies получены и сохранены автоматически')
    }

    // Пробуем получить LoginChallenge из JSON ответа
    const responseText = await response.text()
    let data: any
    
    try {
      data = JSON.parse(responseText)
      if (data.LoginChallenge) {
        console.log('[MobCash Auth] LoginChallenge from JSON:', data.LoginChallenge)
        return { loginChallenge: data.LoginChallenge }
      }
    } catch (e) {
      // Не JSON ответ - возможно HTML или редирект
      console.log('[MobCash Auth] Response is not JSON, trying to extract from URL or HTML')
    }
    
    // Если не нашли в JSON, пробуем из URL редиректа
    const finalUrl = response.url
    if (finalUrl) {
      const urlParams = new URLSearchParams(finalUrl.split('?')[1] || '')
      const loginChallenge = urlParams.get('login_challenge')
      if (loginChallenge) {
        console.log('[MobCash Auth] LoginChallenge from final URL:', loginChallenge)
        return { loginChallenge }
      }
    }
    
    console.error('[MobCash Auth] LoginChallenge not found in response or URL')
    console.error('[MobCash Auth] Response status:', response.status)
    console.error('[MobCash Auth] Response URL:', response.url)
    console.error('[MobCash Auth] Response text (first 500 chars):', responseText.substring(0, 500))
    throw new Error('LoginChallenge not found in response')
  }

  /**
   * Шаг 1.2: Получение ConsentChallenge
   */
  private async getConsentChallenge(loginChallenge: string): Promise<string> {
    const formData = new URLSearchParams()
    formData.append('nickname', this.config.login)
    formData.append('password', this.config.password)
    formData.append('state', '547f6922-61ec-47f8-8718-c7928dd8f6eb')
    formData.append('remember_me', 'true')

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Origin': 'https://app.mob-cash.com/',
      'Referer': 'https://app.mob-cash.com//login',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    // fetch-cookie автоматически добавит cookies из cookie jar
    console.log('[MobCash Auth] Cookies будут отправлены автоматически через fetch-cookie')

    console.log('[MobCash Auth] Sending login request with:')
    console.log('[MobCash Auth]   URL:', `https://admin.mob-cash.com/authentication/login?login_challenge=${loginChallenge}`)
    console.log('[MobCash Auth]   Nickname:', this.config.login)

    // fetch-cookie автоматически сохранит cookies из ответа
    const response = await this.fetch(
      `https://admin.mob-cash.com/authentication/login?login_challenge=${loginChallenge}`,
      {
        method: 'POST',
        headers,
        body: formData,
        redirect: 'follow', // Следуем редиректам
      }
    )

    // Проверяем что cookies сохранены
    const responseCookies = response.headers.get('set-cookie')
    if (responseCookies) {
      console.log('[MobCash Auth] Cookies обновлены автоматически')
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[MobCash Auth] ConsentChallenge error:', response.status)
      console.error('[MobCash Auth] Error response:', errorText)
      console.error('[MobCash Auth] Response URL:', response.url)
      console.error('[MobCash Auth] Login:', this.config.login)
      
      // Если 302, возможно это редирект с consent_challenge в URL
      if (response.status === 302 || response.status === 301) {
        const location = response.headers.get('location') || response.url
        if (location) {
          const urlParams = new URLSearchParams(location.split('?')[1] || '')
          const consentChallenge = urlParams.get('consent_challenge')
          if (consentChallenge) {
            console.log('[MobCash Auth] ConsentChallenge from redirect URL:', consentChallenge)
            return consentChallenge
          }
        }
      }
      
      throw new Error(`Failed to get consent challenge: ${response.status} ${response.statusText}. Check login and password.`)
    }

    // Пробуем получить из JSON
    let data: any
    try {
      const responseText = await response.text()
      data = JSON.parse(responseText)
      if (data.ConsentChallenge) {
        console.log('[MobCash Auth] ConsentChallenge from JSON:', data.ConsentChallenge)
        return data.ConsentChallenge
      }
    } catch (e) {
      // Не JSON
    }

    // Пробуем из URL
    const finalUrl = response.url
    if (finalUrl) {
      const urlParams = new URLSearchParams(finalUrl.split('?')[1] || '')
      const consentChallenge = urlParams.get('consent_challenge')
      if (consentChallenge) {
        console.log('[MobCash Auth] ConsentChallenge from final URL:', consentChallenge)
        return consentChallenge
      }
    }

    console.error('[MobCash Auth] ConsentChallenge not found in response')
    console.error('[MobCash Auth] Response status:', response.status)
    console.error('[MobCash Auth] Response URL:', response.url)
    throw new Error('ConsentChallenge not found in response. Check login and password.')
  }

  /**
   * Шаг 1.3: Получение токена авторизации
   */
  private async getAccessToken(consentChallenge: string): Promise<string> {
    const formData = new URLSearchParams()
    formData.append('client_id', '4e779103-d67b-42ef-bc9d-ab5ecdec40f8')
    formData.append('grant_scope', 'offline')
    formData.append('state', '547f6922-61ec-47f8-8718-c7928dd8f6eb')

    const response = await this.fetch(
      `https://admin.mob-cash.com/authentication/consent?consent_challenge=${consentChallenge}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Origin': 'https://app.mob-cash.com',
          'Referer': 'https://app.mob-cash.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        redirect: 'follow', // Следуем редиректам для получения кода авторизации
      }
    )

    // Проверяем редирект - должен быть код авторизации в финальном URL
    const finalUrl = response.url
    console.log('[MobCash Auth] Final URL after consent:', finalUrl)
    
    if (finalUrl && finalUrl.includes('code=')) {
      const urlParams = new URLSearchParams(finalUrl.split('?')[1] || '')
      const authCode = urlParams.get('code')
      
      if (authCode) {
        console.log('[MobCash Auth] Authorization code found in URL:', authCode.substring(0, 20))
        
        // Обмениваем код на токен через OAuth2 token endpoint
        const tokenFormData = new URLSearchParams()
        tokenFormData.append('grant_type', 'authorization_code')
        tokenFormData.append('code', authCode)
        tokenFormData.append('client_id', '4e779103-d67b-42ef-bc9d-ab5ecdec40f8')
        tokenFormData.append('redirect_uri', 'https://app.mob-cash.com')
        
        const tokenResponse = await this.fetch('https://admin.mob-cash.com/hydra/oauth2/token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenFormData,
        })
        
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json()
          if (tokenData.access_token) {
            console.log('[MobCash Auth] Access token получен через OAuth2 token endpoint')
            return tokenData.access_token
          }
        } else {
          const errorText = await tokenResponse.text()
          console.error('[MobCash Auth] Ошибка обмена кода на токен:', errorText)
        }
      }
    }

    // Если не получили через редирект, пробуем из JSON ответа
    if (response.ok) {
      try {
        const data = await response.json()
        if (data.access_token) {
          console.log('[MobCash Auth] Access token получен из JSON ответа')
          return data.access_token
        }
      } catch (e) {
        // Не JSON
      }
    }

    const errorText = response.ok ? '' : await response.text()
    console.error('[MobCash Auth] Не удалось получить access_token')
    console.error('[MobCash Auth] Статус:', response.status)
    if (errorText) {
      console.error('[MobCash Auth] Ответ:', errorText)
    }
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`)
  }

  /**
   * Шаг 1.4: Получение профиля пользователя (userID)
   */
  private async getUserProfile(token: string): Promise<string> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.requestIdCounter++,
      method: 'user.profile',
      params: {},
    }

    const response = await this.fetch('https://admin.mob-cash.com/api/', {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'authorization': `Bearer ${token}`,
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'origin': 'https://app.mob-cash.com',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'referer': 'https://app.mob-cash.com/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
        'x-request-source': 'pwa',
      },
      body: JSON.stringify([request]),
    })

    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.status} ${response.statusText}`)
    }

    const data: JsonRpcResponse[] = await response.json()
    const result = data[0]

    console.log('[MobCash Auth] Profile response:', JSON.stringify(result, null, 2))

    if (result.error) {
      throw new Error(`API error: ${result.error.message} (code: ${result.error.code})`)
    }

    // Проверяем разные возможные форматы ответа
    // userID может быть в result.result.id или result.result.user.id
    const userID = result.result?.id || result.result?.user?.id || result.result?.userID || result.result?.userId
    
    if (!userID) {
      console.error('[MobCash Auth] User ID not found in profile response')
      console.error('[MobCash Auth] Full response:', JSON.stringify(result, null, 2))
      throw new Error('User ID not found in profile response')
    }

    console.log('[MobCash Auth] User ID extracted:', userID)
    return String(userID)
  }

  /**
   * Шаг 1.5: Логин на кассу (sessionID)
   */
  private async loginToCashbox(token: string, userID: string): Promise<string> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.requestIdCounter++,
      method: 'mobile.login',
      params: {
        location: {
          lat: this.config.default_lat,
          lon: this.config.default_lon,
        },
        cashboxCode: parseInt(String(this.config.cashdesk_id)),
        userID,
      },
    }

    const response = await this.fetch('https://admin.mob-cash.com/api/', {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'authorization': `Bearer ${token}`,
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'origin': 'https://app.mob-cash.com',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'referer': 'https://app.mob-cash.com/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
        'x-request-source': 'pwa',
      },
      body: JSON.stringify([request]),
    })

    if (!response.ok) {
      throw new Error(`Failed to login to cashbox: ${response.status} ${response.statusText}`)
    }

    const data: JsonRpcResponse[] = await response.json()
    const result = data[0]

    console.log('[MobCash Auth] Login to cashbox response:', JSON.stringify(result, null, 2))

    // Проверяем, есть ли sessionID в ответе, даже если есть ошибка
    const sessionID = result.result?.sessionID || result.result?.session_id || result.result?.id

    if (result.error) {
      // Если есть sessionID, используем его, даже если есть ошибка
      if (sessionID) {
        console.warn('[MobCash Auth] Warning:', result.error.message, 'but sessionID found')
        return String(sessionID)
      }
      throw new Error(`API error: ${result.error.message} (code: ${result.error.code})`)
    }

    // SessionID обычно возвращается в результате
    // В документации не указано точно, где находится sessionID, возможно нужно извлечь из ответа
    // Пока используем временное значение, которое будет обновляться при каждом запросе
    return result.result?.sessionID || result.result?.session_id || `${Date.now()}${Math.random().toString(36).substring(7)}`
  }

  /**
   * Выполнить JSON-RPC запрос
   */
  private async makeRequest(method: string, params: any): Promise<any> {
    const session = await this.getSession()
    const requestId = this.requestIdCounter++

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params: {
        ...params,
        location: {
          lat: this.config.default_lat,
          lon: this.config.default_lon,
        },
        userID: session.userID,
        sessionID: session.sessionID,
      },
    }

    const headers: Record<string, string> = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'authorization': `Bearer ${session.token}`,
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      'origin': 'https://app.mob-cash.com',
      'pragma': 'no-cache',
      'priority': 'u=1, i',
      'referer': 'https://app.mob-cash.com/',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      'x-request-source': 'pwa',
    }

    try {
      const response = await this.fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify([request]),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: JsonRpcResponse[] = await response.json()
      const result = data[0]

      if (result.error) {
        throw new Error(`API error: ${result.error.message} (code: ${result.error.code})`)
      }

      return result.result
    } catch (error) {
      console.error(`[MobCash API] Error in ${method}:`, error)
      throw error
    }
  }

  /**
   * Проверка аккаунта игрока (mobile.payerNickname)
   */
  async checkPayerNickname(payerID: string): Promise<{ nickname?: string }> {
    try {
      const result = await this.makeRequest('mobile.payerNickname', {
        payerID,
      })

      return {
        nickname: result?.nickname || result?.nickName,
      }
    } catch (error) {
      console.error('[MobCash API] Error checking payer nickname:', error)
      throw error
    }
  }

  /**
   * Пополнение аккаунта (mobile.deposit)
   * ВАЖНО: Перед пополнением необходимо вызвать checkPayerNickname
   */
  async deposit(payerID: string, amount: string | number): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      // Сначала проверяем аккаунт (обязательный шаг)
      await this.checkPayerNickname(payerID)

      // Затем выполняем пополнение
      const result = await this.makeRequest('mobile.deposit', {
        deposit: {
          amount: String(amount),
          payerID,
        },
      })

      return {
        success: true,
        message: 'Deposit successful',
        data: result,
      }
    } catch (error) {
      console.error('[MobCash API] Error depositing:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Deposit failed',
      }
    }
  }

  /**
   * Запрос ордера на вывод (mobile.getWithdrawalAmount)
   */
  async getWithdrawalAmount(payerID: string, withdrawalCode: string): Promise<{ amount: string; success: boolean; message?: string }> {
    try {
      const result = await this.makeRequest('mobile.getWithdrawalAmount', {
        withdraw: {
          payerID,
          withdrawalCode,
        },
      })

      return {
        amount: result?.amount || '0',
        success: true,
        message: 'Withdrawal amount retrieved',
      }
    } catch (error) {
      console.error('[MobCash API] Error getting withdrawal amount:', error)
      return {
        amount: '0',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get withdrawal amount',
      }
    }
  }

  /**
   * Исполнение ордера на вывод (mobile.withdrawal)
   */
  async withdrawal(payerID: string, amount: string | number, withdrawalCode: string): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const result = await this.makeRequest('mobile.withdrawal', {
        withdraw: {
          amount: String(amount),
          payerID,
          withdrawalCode,
        },
      })

      return {
        success: true,
        message: 'Withdrawal successful',
        data: result,
      }
    } catch (error) {
      console.error('[MobCash API] Error processing withdrawal:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Withdrawal failed',
      }
    }
  }

  /**
   * Очистка кеша сессий
   */
  static clearSessionCache(): void {
    sessionCache.clear()
  }
}

