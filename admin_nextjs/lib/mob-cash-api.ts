/**
 * API клиент для работы с мобильными кассами (mob-cash.com)
 * Использует JSON-RPC 2.0 протокол
 */

// OAuth2 flow использует обычный fetch с ручным управлением cookies
// fetch-cookie больше не требуется

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
  // Ручное управление cookies для OAuth2 flow
  private cookies: string = ''

  constructor(config: MobCashConfig) {
    this.config = {
      ...config,
      default_lat: config.default_lat || 42.845778,
      default_lon: config.default_lon || 74.568778,
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
    // Проверяем, что все три токена предоставлены и не пустые
    const hasAllTokens = 
      this.config.bearer_token && 
      this.config.bearer_token.trim() !== '' &&
      this.config.user_id && 
      this.config.user_id.trim() !== '' &&
      this.config.session_id && 
      this.config.session_id.trim() !== ''
    
    if (hasAllTokens && this.config.bearer_token && this.config.user_id && this.config.session_id) {
      console.log('[MobCash Auth] ✅ Using provided tokens from config (skipping OAuth2 flow)')
      console.log('[MobCash Auth] Bearer token:', this.config.bearer_token.substring(0, 30) + '...')
      console.log('[MobCash Auth] User ID:', this.config.user_id)
      console.log('[MobCash Auth] Session ID:', this.config.session_id)
      console.log('[MobCash Auth] Location:', {
        lat: this.config.default_lat || 42.845778,
        lon: this.config.default_lon || 74.568778,
      })
      return {
        token: this.config.bearer_token,
        userID: this.config.user_id,
        sessionID: this.config.session_id,
        expiresAt: Date.now() + SESSION_TTL,
      }
    }

    // Если токены не предоставлены, выбрасываем понятную ошибку
    console.error('[MobCash Auth] ❌ Tokens not provided in config')
    console.error('[MobCash Auth] Config check:', {
      has_bearer_token: !!(this.config.bearer_token && this.config.bearer_token.trim() !== ''),
      has_user_id: !!(this.config.user_id && this.config.user_id.trim() !== ''),
      has_session_id: !!(this.config.session_id && this.config.session_id.trim() !== ''),
      bearer_token_preview: this.config.bearer_token ? this.config.bearer_token.substring(0, 20) + '...' : 'undefined',
      user_id_value: this.config.user_id || 'undefined',
      session_id_value: this.config.session_id || 'undefined',
    })
    
    throw new Error(
      'Mob-cash tokens not configured. OAuth2 flow requires client_secret which is not available. ' +
      'Please add MOBCASH_BEARER_TOKEN, MOBCASH_USER_ID, and MOBCASH_SESSION_ID to your .env file. ' +
      'See MOBCASH_SETUP.md for instructions on how to obtain these tokens from browser DevTools.'
    )

  }

  /**
   * Вспомогательная функция для обновления cookies из set-cookie заголовка
   */
  private updateCookies(setCookieHeader: string | null): void {
    if (!setCookieHeader) return
    
    const cookieParts = setCookieHeader.split(',').map(c => c.trim())
    const cookieValues = cookieParts.map(cookie => cookie.split(';')[0].trim()).filter(c => c)
    
    if (cookieValues.length > 0) {
      const existingCookies = this.cookies ? this.cookies.split('; ') : []
      const allCookies = [...existingCookies, ...cookieValues]
      const uniqueCookies = new Map<string, string>()
      
      allCookies.forEach(cookie => {
        const [name] = cookie.split('=')
        if (name) uniqueCookies.set(name, cookie)
      })
      
      this.cookies = Array.from(uniqueCookies.values()).join('; ')
      console.log('[MobCash Auth] Cookies обновлены:', this.cookies.substring(0, 80) + '...')
    }
  }

  /**
   * Шаг 1.1: Начало авторизации - получение LoginChallenge
   */
  private async getLoginChallenge(): Promise<{ loginChallenge: string }> {
    console.log('[MobCash Auth] Шаг 1.1: Получение LoginChallenge...')
    
    // Сбрасываем cookies для новой сессии
    this.cookies = ''

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

    // Используем обычный fetch с ручным управлением cookies
    const response = await fetch('https://admin.mob-cash.com/hydra/oauth2/auth', {
      method: 'POST',
      headers,
      body: formData,
      redirect: 'manual', // Не следуем редиректам автоматически
    })

    // Обновляем cookies из ответа
    this.updateCookies(response.headers.get('set-cookie'))

    // Если редирект, пробуем извлечь login_challenge из URL
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location')
      if (location) {
        const urlParams = new URLSearchParams(location.split('?')[1] || '')
        const loginChallenge = urlParams.get('login_challenge')
        if (loginChallenge) {
          console.log('[MobCash Auth] ✅ LoginChallenge получен из redirect:', loginChallenge)
          return { loginChallenge }
        }
      }
    }

    if (!response.ok && response.status !== 302) {
      const errorText = await response.text()
      console.error('[MobCash Auth] ❌ LoginChallenge error:', response.status, errorText)
      throw new Error(`Failed to get login challenge: ${response.status} ${response.statusText}`)
    }

    // Пробуем получить LoginChallenge из JSON ответа
    const responseText = await response.text()
    let data: any
    
    try {
      data = JSON.parse(responseText)
      if (data.LoginChallenge) {
        console.log('[MobCash Auth] ✅ LoginChallenge из JSON:', data.LoginChallenge)
        return { loginChallenge: data.LoginChallenge }
      }
    } catch (e) {
      // Не JSON ответ
    }
    
    console.error('[MobCash Auth] ❌ LoginChallenge not found')
    console.error('[MobCash Auth] Response status:', response.status)
    console.error('[MobCash Auth] Response text (first 500 chars):', responseText.substring(0, 500))
    throw new Error('LoginChallenge not found in response')
  }

  /**
   * Шаг 1.2: Получение ConsentChallenge
   */
  private async getConsentChallenge(loginChallenge: string): Promise<string> {
    console.log('[MobCash Auth] Шаг 1.2: Получение ConsentChallenge...')
    
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

    // Добавляем cookies вручную
    if (this.cookies) {
      headers['Cookie'] = this.cookies
      console.log('[MobCash Auth] Отправляем cookies:', this.cookies.substring(0, 80) + '...')
    } else {
      console.warn('[MobCash Auth] ⚠️ Cookies отсутствуют')
    }

    console.log('[MobCash Auth] Отправляем запрос на:', `https://admin.mob-cash.com/authentication/login?login_challenge=${loginChallenge}`)
    console.log('[MobCash Auth] Nickname:', this.config.login)

    // Используем обычный fetch с ручным управлением cookies
    const response = await fetch(
      `https://admin.mob-cash.com/authentication/login?login_challenge=${loginChallenge}`,
      {
        method: 'POST',
        headers,
        body: formData,
        redirect: 'manual', // Не следуем редиректам автоматически
      }
    )

    // Обновляем cookies из ответа
    this.updateCookies(response.headers.get('set-cookie'))

    // Проверяем редирект - после логина должен быть редирект с login_verifier
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location')
      if (location) {
        console.log('[MobCash Auth] Redirect location:', location)
        
        // Извлекаем login_verifier из URL
        const urlParams = new URLSearchParams(location.split('?')[1] || '')
        const loginVerifier = urlParams.get('login_verifier')
        
        if (loginVerifier) {
          console.log('[MobCash Auth] ✅ Login verifier получен:', loginVerifier)
          
          // Делаем GET запрос по редиректу, чтобы получить consent_challenge
          const redirectResponse = await fetch(location, {
            method: 'GET',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36',
              'Cookie': this.cookies,
            },
            redirect: 'manual',
          })
          
          this.updateCookies(redirectResponse.headers.get('set-cookie'))
          
          // Проверяем следующий редирект
          if (redirectResponse.status === 302 || redirectResponse.status === 301) {
            const nextLocation = redirectResponse.headers.get('location')
            if (nextLocation) {
              const nextUrlParams = new URLSearchParams(nextLocation.split('?')[1] || '')
              const consentChallenge = nextUrlParams.get('consent_challenge')
              if (consentChallenge) {
                console.log('[MobCash Auth] ✅ ConsentChallenge получен:', consentChallenge)
                return consentChallenge
              }
            }
          }
        }
        
        // Пробуем извлечь consent_challenge напрямую из первого редиректа
        const consentChallenge = urlParams.get('consent_challenge')
        if (consentChallenge) {
          console.log('[MobCash Auth] ✅ ConsentChallenge из первого редиректа:', consentChallenge)
          return consentChallenge
        }
      }
    }

    if (!response.ok && response.status !== 302) {
      const errorText = await response.text()
      console.error('[MobCash Auth] ❌ ConsentChallenge error:', response.status)
      console.error('[MobCash Auth] Error response:', errorText)
      throw new Error(`Failed to get consent challenge: ${response.status} ${response.statusText}. Check login and password.`)
    }

    // Пробуем получить из JSON
    const responseText = await response.text()
    try {
      const data = JSON.parse(responseText)
      if (data.ConsentChallenge) {
        console.log('[MobCash Auth] ✅ ConsentChallenge из JSON:', data.ConsentChallenge)
        return data.ConsentChallenge
      }
    } catch (e) {
      // Не JSON
    }

    console.error('[MobCash Auth] ❌ ConsentChallenge not found')
    console.error('[MobCash Auth] Response status:', response.status)
    throw new Error('ConsentChallenge not found in response. Check login and password.')
  }

  /**
   * Шаг 1.3: Получение токена авторизации
   */
  private async getAccessToken(consentChallenge: string): Promise<string> {
    console.log('[MobCash Auth] Шаг 1.3: Получение Access Token...')
    
    const formData = new URLSearchParams()
    formData.append('client_id', '4e779103-d67b-42ef-bc9d-ab5ecdec40f8')
    formData.append('grant_scope', 'offline')
    formData.append('state', '547f6922-61ec-47f8-8718-c7928dd8f6eb')

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Origin': 'https://app.mob-cash.com',
      'Referer': 'https://app.mob-cash.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    // Добавляем cookies
    if (this.cookies) {
      headers['Cookie'] = this.cookies
      console.log('[MobCash Auth] Отправляем cookies:', this.cookies.substring(0, 80) + '...')
    }

    // Используем обычный fetch с ручным управлением cookies
    const response = await fetch(
      `https://admin.mob-cash.com/authentication/consent?consent_challenge=${consentChallenge}`,
      {
        method: 'POST',
        headers,
        body: formData,
        redirect: 'manual', // Не следуем редиректам автоматически
      }
    )

    // Обновляем cookies
    this.updateCookies(response.headers.get('set-cookie'))

    console.log('[MobCash Auth] Consent response status:', response.status)
    
    // Проверяем редирект - должен быть код авторизации в URL
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location')
      console.log('[MobCash Auth] Redirect location:', location)
      
      if (location) {
        // Следуем редиректу автоматически, чтобы получить код авторизации
        const redirectResponse = await fetch(location, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Cookie': this.cookies,
          },
          redirect: 'follow', // Следуем всем редиректам автоматически
        })
        
        this.updateCookies(redirectResponse.headers.get('set-cookie'))
        
        // Проверяем финальный URL на наличие кода
        const finalUrl = redirectResponse.url
        console.log('[MobCash Auth] Final URL after redirects:', finalUrl)
        
        // Проверяем, есть ли ошибка в URL
        if (finalUrl && finalUrl.includes('error=')) {
          const urlParams = new URLSearchParams(finalUrl.split('?')[1] || '')
          const error = urlParams.get('error')
          const errorDesc = urlParams.get('error_description')
          console.error('[MobCash Auth] ❌ Ошибка в редиректе:', error)
          console.error('[MobCash Auth] Описание:', errorDesc)
          throw new Error(`OAuth2 error: ${error} - ${errorDesc}`)
        }
        
        let authCode = ''
        
        if (finalUrl) {
          const urlParams = new URLSearchParams(finalUrl.split('?')[1] || '')
          authCode = urlParams.get('code') || ''
          
          // Если код не в URL, проверяем тело ответа
          if (!authCode) {
            try {
              const redirectText = await redirectResponse.text()
              const redirectData = JSON.parse(redirectText)
              if (redirectData.code) {
                authCode = redirectData.code
              }
            } catch (e) {
              // Не JSON
            }
          }
        }
        
        if (authCode && typeof authCode === 'string') {
          console.log('[MobCash Auth] ✅ Authorization code получен:', authCode.substring(0, 20) + '...')
          
          // Обмениваем код на токен через OAuth2 token endpoint
          // Делаем точно так же, как в test-mobcash-auth.ts, но добавляем cookies
          const tokenFormData = new URLSearchParams()
          tokenFormData.append('grant_type', 'authorization_code')
          tokenFormData.append('code', authCode)
          tokenFormData.append('client_id', '4e779103-d67b-42ef-bc9d-ab5ecdec40f8')
          tokenFormData.append('redirect_uri', 'https://app.mob-cash.com')
          
          console.log('[MobCash Auth] Обмениваем код на токен (как в тесте)...')
          
          const tokenHeaders: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          }
          
          // Добавляем cookies, если они есть
          if (this.cookies) {
            tokenHeaders['Cookie'] = this.cookies
            console.log('[MobCash Auth] Отправляем cookies с запросом на обмен токена:', this.cookies.substring(0, 80) + '...')
          }
          
          const tokenResponse = await fetch('https://admin.mob-cash.com/hydra/oauth2/token', {
            method: 'POST',
            headers: tokenHeaders,
            body: tokenFormData,
          })
          
          console.log('[MobCash Auth] Token response status:', tokenResponse.status)
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json()
            if (tokenData.access_token) {
              console.log('[MobCash Auth] ✅ Access token получен через OAuth2 token endpoint')
              return tokenData.access_token
            } else {
              console.error('[MobCash Auth] ❌ access_token не найден в ответе token endpoint:', tokenData)
            }
          } else {
            const errorText = await tokenResponse.text()
            console.error('[MobCash Auth] ❌ Ошибка обмена кода на токен:', tokenResponse.status)
            console.error('[MobCash Auth] Ответ:', errorText)
            
            // Если не сработало с cookies, пробуем без них
            if (this.cookies) {
              console.log('[MobCash Auth] Пробуем без cookies...')
              const tokenResponse2 = await fetch('https://admin.mob-cash.com/hydra/oauth2/token', {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: tokenFormData,
              })
              
              if (tokenResponse2.ok) {
                const tokenData = await tokenResponse2.json()
                if (tokenData.access_token) {
                  console.log('[MobCash Auth] ✅ Access token получен без cookies')
                  return tokenData.access_token
                }
              } else {
                const errorText2 = await tokenResponse2.text()
                console.error('[MobCash Auth] ❌ Ошибка без cookies:', tokenResponse2.status, errorText2)
              }
            }
            
            // Если все варианты не сработали, выбрасываем ошибку
            throw new Error(`Failed to exchange authorization code for access token: ${tokenResponse.status}. Client authentication failed. Please use ready tokens from browser (see MOBCASH_SETUP.md) or contact API provider for client_secret.`)
          }
        } else {
          console.warn('[MobCash Auth] ⚠️ Код авторизации не найден в редиректах')
          console.warn('[MobCash Auth] Final URL:', finalUrl)
          throw new Error('Authorization code not found in redirects')
        }
      }
    }

    if (!response.ok && response.status !== 302) {
      const errorText = await response.text()
      console.error('[MobCash Auth] ❌ Ошибка получения access token:', response.status)
      console.error('[MobCash Auth] Error response:', errorText)
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`)
    }

    // Пробуем из JSON ответа
    const responseText = await response.text()
    console.log('[MobCash Auth] Response text (first 500 chars):', responseText.substring(0, 500))
    
    try {
      const data = JSON.parse(responseText)
      if (data.access_token) {
        console.log('[MobCash Auth] ✅ Access token из JSON')
        return data.access_token
      } else {
        console.error('[MobCash Auth] ❌ access_token не найден в JSON ответе:', data)
      }
    } catch (e) {
      // Не JSON
      console.log('[MobCash Auth] Response is not JSON')
    }

    console.error('[MobCash Auth] ❌ Access token not found')
    console.error('[MobCash Auth] Response status:', response.status)
    console.error('[MobCash Auth] Response URL:', response.url)
    throw new Error('Access token not found in response. Please use ready tokens from browser (see MOBCASH_SETUP.md) or contact API provider for client_secret.')
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

    const response = await fetch('https://admin.mob-cash.com/api/', {
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

    const response = await fetch('https://admin.mob-cash.com/api/', {
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

    if (result.error) {
      throw new Error(`API error: ${result.error.message} (code: ${result.error.code})`)
    }

    // SessionID находится в result.result.session.id
    const sessionID = result.result?.session?.id || result.result?.sessionID || result.result?.session_id || result.result?.id

    if (!sessionID) {
      console.error('[MobCash Auth] SessionID not found in response')
      console.error('[MobCash Auth] Full response:', JSON.stringify(result, null, 2))
      throw new Error('SessionID not found in cashbox login response')
    }

    console.log('[MobCash Auth] SessionID extracted:', sessionID)
    return String(sessionID)
  }

  /**
   * Выполнить JSON-RPC запрос
   */
  private async makeRequest(method: string, params: any): Promise<any> {
    const session = await this.getSession()
    const requestId = this.requestIdCounter++

    // Используем координаты из конфига (должны совпадать с теми, что использовались при создании сессии)
    const location = {
      lat: this.config.default_lat || 42.845778,
      lon: this.config.default_lon || 74.568778,
    }

    console.log(`[MobCash API] Making request: ${method} with location:`, location)

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params: {
        ...params,
        location,
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

    console.log(`[MobCash API] Request body for ${method}:`, JSON.stringify([request], null, 2))

    try {
      const response = await fetch(this.baseUrl, {
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

