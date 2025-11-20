import crypto from 'crypto'
import { MobCashClient } from './mob-cash-api'

// Конфигурация API казино
interface CasinoConfig {
  hash?: string
  cashierpass?: string
  login?: string
  cashdeskid?: string | number
  api_key?: string
  secret?: string
  cashpoint_id?: string | number
}

// Конфигурация mob-cash API
interface MobCashConfig {
  login: string
  password: string
  cashdesk_id: string | number
  default_lat?: number
  default_lon?: number
  bearer_token?: string
  user_id?: string
  session_id?: string
}

// Генерация confirm для 1xbet/Melbet
export function generateConfirm(userId: string, hash: string, isMelbet: boolean = false): string {
  const userIdForConfirm = isMelbet ? userId.toLowerCase() : userId
  const confirmString = `${userIdForConfirm}:${hash}`
  return crypto.createHash('md5').update(confirmString).digest('hex')
}

// Генерация подписи для пополнения 1xbet/Winwin
export function generateSignForDeposit1xbet(
  userId: string,
  amount: number,
  hash: string,
  cashierpass: string,
  cashdeskid: string | number
): string {
  // a) SHA256(hash={hash}&lng=ru&userid={user_id}) - согласно примеру в документации (пункт 3.5) используется userid с маленькой буквы
  // В описании (пункт 3.1) указано UserId с большой, но в примере (пункт 3.5) используется userid с маленькой
  const step1String = `hash=${hash}&lng=ru&userid=${userId}`
  const step1Hash = crypto.createHash('sha256').update(step1String).digest('hex')

  // b) MD5(summa={amount}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
  const step2String = `summa=${amount}&cashierpass=${cashierpass}&cashdeskid=${cashdeskid}`
  const step2Hash = crypto.createHash('md5').update(step2String).digest('hex')

  // c) SHA256(step1 + step2)
  const combined = step1Hash + step2Hash
  return crypto.createHash('sha256').update(combined).digest('hex')
}

// Генерация подписи для пополнения Melbet (userid в lower-case)
export function generateSignForDepositMelbet(
  userId: string,
  amount: number,
  hash: string,
  cashierpass: string,
  cashdeskid: string | number
): string {
  // a) SHA256(hash={hash}&lng=ru&userid={user_id.lower()}) - согласно примеру в документации используется userid с маленькой буквы
  const step1String = `hash=${hash}&lng=ru&userid=${userId.toLowerCase()}`
  const step1Hash = crypto.createHash('sha256').update(step1String).digest('hex')

  // b) MD5(summa={amount}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
  const step2String = `summa=${amount}&cashierpass=${cashierpass}&cashdeskid=${cashdeskid}`
  const step2Hash = crypto.createHash('md5').update(step2String).digest('hex')

  // c) SHA256(step1 + step2)
  const combined = step1Hash + step2Hash
  return crypto.createHash('sha256').update(combined).digest('hex')
}

// Генерация Basic Auth header
export function generateBasicAuth(login: string, cashierpass: string): string {
  const authString = `${login}:${cashierpass}`
  const authBase64 = Buffer.from(authString).toString('base64')
  return `Basic ${authBase64}`
}

// Пополнение для 1xbet/Melbet/888starz через Cashdesk API
export async function depositCashdeskAPI(
  bookmaker: string,
  userId: string,
  amount: number,
  config: CasinoConfig
): Promise<{ success: boolean; message: string; data?: any }> {
  const baseUrl = 'https://partners.servcul.com/CashdeskBotAPI/'
  const normalizedBookmaker = bookmaker.toLowerCase()
  const isMelbet = normalizedBookmaker.includes('melbet')
  const isWinwin = normalizedBookmaker.includes('winwin')
  const is888starz = normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888')

  // Проверяем, что все обязательные поля заполнены и не пустые
  const hash = config.hash
  const cashierpass = config.cashierpass
  const login = config.login
  const cashdeskid = config.cashdeskid

  if (!hash || !cashierpass || !login || !cashdeskid || 
      hash.trim() === '' || cashierpass.trim() === '' || 
      login.trim() === '' || String(cashdeskid).trim() === '' || String(cashdeskid).trim() === '0') {
    return {
      success: false,
      message: `Missing required API credentials for ${bookmaker}. Please configure API settings in database or environment variables.`,
    }
  }

  try {
    // userId здесь - это ID казино (accountId), не Telegram ID
    console.log(`[Cashdesk Deposit] Bookmaker: ${bookmaker}, Casino User ID: ${userId}, Amount: ${amount}`)
    
    // Для Melbet и Winwin userId должен быть в нижнем регистре для API URL и confirm
    // Для 888starz используем стандартную логику (как 1xbet), но без lowercase для userId
    // Преобразуем userId в строку перед toLowerCase, так как для чисел toLowerCase не работает
    const userIdStr = String(userId)
    const userIdForApi = (isMelbet || isWinwin) ? userIdStr.toLowerCase() : userIdStr
    const confirm = generateConfirm(userIdForApi, hash, isMelbet)
    // Для подписи: для Melbet используем userId (оригинальный, но функция сама сделает lowercase)
    // Для Winwin в подписи используем userIdForApi (в нижнем регистре), так как в URL тоже используется lowercase
    // В строке подписи используется userid с маленькой буквы согласно примеру в документации (пункт 3.5)
    const sign = isMelbet
      ? generateSignForDepositMelbet(userIdStr, amount, hash, cashierpass, cashdeskid)
      : generateSignForDeposit1xbet(userIdForApi, amount, hash, cashierpass, cashdeskid)
    
    // Дополнительное логирование для отладки
    console.log(`[Cashdesk Deposit] Signature calculation details:`)
    console.log(`  - userId (original): ${userId} (type: ${typeof userId})`)
    console.log(`  - userIdStr (string): ${userIdStr}`)
    console.log(`  - userIdForApi (for URL and confirm): ${userIdForApi}`)
    console.log(`  - userId used in signature: ${isMelbet ? userIdStr : userIdForApi}`)
    console.log(`  - Step 1 string would be: hash=${hash}&lng=ru&userid=${isMelbet ? userIdStr.toLowerCase() : userIdForApi}`)

    const url = `${baseUrl}Deposit/${userIdForApi}/Add`
    const authHeader = generateBasicAuth(login, cashierpass)

    // Согласно документации: для Deposit/Add используется cashdeskId (camelCase) в JSON
    const requestBody = {
      cashdeskId: parseInt(String(cashdeskid)), // Используем camelCase согласно документации
      lng: 'ru',
      summa: amount,
      confirm: confirm,
    }

    console.log(`[Cashdesk Deposit] URL: ${url}`)
    console.log(`[Cashdesk Deposit] Request body:`, requestBody)
    console.log(`[Cashdesk Deposit] Sign: ${sign}`)
    console.log(`[Cashdesk Deposit] Confirm: ${confirm}`)
    console.log(`[Cashdesk Deposit] Authorization header: ${authHeader.substring(0, 20)}...`)
    console.log(`[Cashdesk Deposit] UserId for API: ${userIdForApi}, Original userId: ${userId}`)
    console.log(`[Cashdesk Deposit] Bookmaker flags: isMelbet=${isMelbet}, isWinwin=${isWinwin}, is888starz=${is888starz}`)

    // Для Winwin и Melbet может не требоваться Basic Auth (как в Python скриптах)
    // Но для Winwin попробуем с Basic Auth, так как ошибка 401 обычно означает проблему с авторизацией
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'sign': sign,
    }
    
    // Для 1xbet, 888starz и Winwin используем Basic Auth, для Melbet - без него
    if (!isMelbet) {
      headers['Authorization'] = authHeader
      console.log(`[Cashdesk Deposit] Using Basic Auth for ${bookmaker}`)
    } else {
      console.log(`[Cashdesk Deposit] NOT using Basic Auth for ${bookmaker} (Melbet)`)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error(`[Cashdesk Deposit] Failed to parse response: ${responseText}`)
      return {
        success: false,
        message: `Invalid response from ${bookmaker} API: ${responseText.substring(0, 100)}`,
        data: { rawResponse: responseText, status: response.status },
      }
    }

    console.log(`[Cashdesk Deposit] Response status: ${response.status}, Response ok: ${response.ok}, Data:`, data)

    // API может возвращать success (маленькая) или Success (большая)
    const isSuccess = data.success === true || data.Success === true
    
    console.log(`[Cashdesk Deposit] isSuccess: ${isSuccess}, data.success: ${data.success}, data.Success: ${data.Success}`)
    
    // Если API вернул Success: true, считаем операцию успешной, даже если response.ok = false
    // (некоторые API могут возвращать 200 с Success: true, но response.ok может быть false из-за других причин)
    if (isSuccess) {
      console.log(`[Cashdesk Deposit] Operation successful, returning success`)
      return {
        success: true,
        message: data.Message || data.message || 'Balance deposited successfully',
        data,
      }
    }

    console.log(`[Cashdesk Deposit] Operation failed, isSuccess: ${isSuccess}, response.ok: ${response.ok}`)
    return {
      success: false,
      message: data.Message || data.message || data.error || `Failed to deposit balance (Status: ${response.status})`,
      data,
    }
  } catch (error: any) {
    console.error(`[Cashdesk Deposit] Error for ${bookmaker}, userId: ${userId}:`, error)
    return {
      success: false,
      message: error.message || 'Failed to deposit balance',
    }
  }
}

// Пополнение для Mostbet
export async function depositMostbetAPI(
  userId: string,
  amount: number,
  config: CasinoConfig
): Promise<{ success: boolean; message: string; data?: any }> {
  const baseUrl = 'https://apimb.com'

  // Проверяем, что все обязательные поля заполнены и не пустые
  const apiKey = config.api_key
  const secret = config.secret
  const cashpointId = config.cashpoint_id

  if (!apiKey || !secret || !cashpointId ||
      apiKey.trim() === '' || secret.trim() === '' || 
      String(cashpointId).trim() === '' || String(cashpointId).trim() === '0') {
    return {
      success: false,
      message: 'Missing required Mostbet API credentials. Please configure API settings in database or environment variables.',
    }
  }

  try {
    // userId здесь - это ID казино (accountId), не Telegram ID
    console.log(`[Mostbet Deposit] Casino Player ID: ${userId}, Amount: ${amount}`)
    
    // Получаем timestamp в UTC в формате YYYY-MM-DD HH:MM:SS (UTC+0)
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const hours = String(now.getUTCHours()).padStart(2, '0')
    const minutes = String(now.getUTCMinutes()).padStart(2, '0')
    const seconds = String(now.getUTCSeconds()).padStart(2, '0')
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

    // Формируем путь и тело запроса
    // В URL всегда должны быть цифры (131864), без буквы C
    // Извлекаем числовую часть из cashpoint_id (например "C131864" -> "131864")
    let cashpointIdForUrl = String(cashpointId)
    const numericMatch = cashpointIdForUrl.match(/\d+/)
    if (numericMatch) {
      cashpointIdForUrl = numericMatch[0]
      console.log(`[Mostbet Deposit] Using numeric cashpoint_id in URL: ${cashpointId} -> ${cashpointIdForUrl}`)
    }
    
    // Path для подписи и URL используем с числовым cashpoint_id (131864)
    const path = `/mbc/gateway/v1/api/cashpoint/${cashpointIdForUrl}/player/deposit`
    const url = `${baseUrl}/mbc/gateway/v1/api/cashpoint/${cashpointIdForUrl}/player/deposit`
    
    const requestBodyData = {
      brandId: 1, // Всегда 1 для Mostbet согласно документации
      playerId: String(userId), // ID игрока в казино
      amount: amount,
      currency: 'KGS', // Можно изменить на RUB если нужно
    }
    // Тело запроса в JSON без пробелов и переводов строк (согласно документации)
    // Используем JSON.stringify с replacer для удаления пробелов (как в Python json.dumps(..., separators=(',', ':')))
    // JSON.stringify по умолчанию добавляет пробелы, поэтому используем replace для их удаления
    const requestBody = JSON.stringify(requestBodyData).replace(/\s+/g, '')

    // API key может быть с префиксом или без
    const apiKeyFormatted = apiKey.startsWith('api-key:') 
      ? apiKey
      : `api-key:${apiKey}`

    // Генерируем подпись: HMAC SHA3-256 от <API_KEY><PATH><REQUEST_BODY><TIMESTAMP>
    // Согласно документации: конкатенируем без разделителей
    const signatureString = `${apiKeyFormatted}${path}${requestBody}${timestamp}`
    
    // Используем SHA3-256 согласно документации Mostbet API
    // В Node.js 18+ поддерживается sha3-256, но может называться по-разному
    let signature: string
    try {
      // Пробуем разные варианты названия алгоритма
      const algorithms = ['sha3-256', 'SHA3-256', 'sha3_256']
      let hmac: any = null
      
      for (const algo of algorithms) {
        try {
          hmac = crypto.createHmac(algo, secret)
          break
        } catch (e) {
          // Пробуем следующий вариант
          continue
        }
      }
      
      if (!hmac) {
        throw new Error('SHA3-256 not supported')
      }
      
      signature = hmac.update(signatureString).digest('hex')
      console.log(`[Mostbet Deposit] Using SHA3-256 for signature`)
    } catch (e: any) {
      // Если SHA3-256 не поддерживается, выводим ошибку
      console.error(`❌ SHA3-256 not available: ${e.message}`)
      console.error(`❌ Mostbet API requires SHA3-256. Please use Node.js 18+ or install crypto-js library.`)
      // Не используем SHA256 fallback - это не будет работать с реальным API
      throw new Error('SHA3-256 is required for Mostbet API but not available')
    }

    console.log(`[Mostbet Deposit] URL: ${url}, Path for signature: ${path}, Request body:`, requestBodyData)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKeyFormatted,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Project': 'MBC',
        'Content-Type': 'application/json',
        'Accept': '*/*',
      },
      body: requestBody,
    })

    const responseText = await response.text()
    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error(`[Mostbet Deposit] Failed to parse response: ${responseText}`)
      return {
        success: false,
        message: `Invalid response from Mostbet API: ${responseText.substring(0, 100)}`,
        data: { rawResponse: responseText, status: response.status },
      }
    }

    console.log(`[Mostbet Deposit] Response status: ${response.status}, Data:`, data)

    if (response.ok) {
      // Согласно документации, статус может быть "NEW", "ACCEPTED", "PROCESSING", "COMPLETED" и т.д.
      // Если статус "NEW_ERROR" или "PROCESSING_ERROR", это ошибка
      if (data.status === 'NEW_ERROR' || data.status === 'PROCESSING_ERROR') {
        return {
          success: false,
          message: data.message || data.error || data.Message || 'Transaction creation failed',
          data,
        }
      }
      
      // Если статус "COMPLETED", операция успешно завершена
      // Если статус "NEW", "ACCEPTED", "PROCESSING" - транзакция создана и обрабатывается
      return {
        success: true,
        message: data.status === 'COMPLETED' 
          ? 'Balance deposited successfully' 
          : `Transaction created (status: ${data.status})`,
        data,
      }
    }

    return {
      success: false,
      message: data.message || data.error || data.Message || `Failed to deposit balance (Status: ${response.status})`,
      data,
    }
  } catch (error: any) {
    console.error(`[Mostbet Deposit] Error for playerId: ${userId}:`, error)
    return {
      success: false,
      message: error.message || 'Failed to deposit balance',
    }
  }
}

// Пополнение через mob-cash API
export async function depositMobCashAPI(
  payerID: string,
  amount: number,
  config: MobCashConfig
): Promise<{ success: boolean; message: string; data?: any }> {
  // Проверяем, что все обязательные поля заполнены
  if (!config.login || !config.password || !config.cashdesk_id ||
      config.login.trim() === '' || config.password.trim() === '' ||
      String(config.cashdesk_id).trim() === '' || String(config.cashdesk_id).trim() === '0') {
    return {
      success: false,
      message: 'Missing required mob-cash API credentials. Please configure API settings in database or environment variables.',
    }
  }

  try {
    // payerID здесь - это ID игрока в казино (accountId), не Telegram ID
    console.log(`[MobCash Deposit] Payer ID: ${payerID}, Amount: ${amount}`)

    // Создаем клиент mob-cash
    const client = new MobCashClient(config)

    // Выполняем пополнение (внутри метода deposit уже вызывается checkPayerNickname)
    const result = await client.deposit(payerID, amount)

    console.log(`[MobCash Deposit] Result:`, result)

    return {
      success: result.success,
      message: result.message || (result.success ? 'Deposit successful' : 'Deposit failed'),
      data: result.data,
    }
  } catch (error: any) {
    console.error(`[MobCash Deposit] Error for payerID: ${payerID}:`, error)
    return {
      success: false,
      message: error.message || 'Failed to deposit balance',
    }
  }
}

/**
 * Проверка баланса кассы для 888starz/1xbet/Melbet (Cashdesk API)
 * GET Cashdesk/{cashdeskId}/Balance?confirm=&dt=
 */
export async function checkCashdeskBalance(
  bookmaker: string,
  config: CasinoConfig
): Promise<{ success: boolean; balance?: number; limit?: number; message?: string }> {
  try {
    const baseUrl = 'https://partners.servcul.com/CashdeskBotAPI'
    const hash = config.hash!
    const cashierpass = config.cashierpass!
    const cashdeskid = String(config.cashdeskid!)

    // Формируем дату в формате yyyy.MM.dd HH:mm:ss (UTC+0)
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const hours = String(now.getUTCHours()).padStart(2, '0')
    const minutes = String(now.getUTCMinutes()).padStart(2, '0')
    const seconds = String(now.getUTCSeconds()).padStart(2, '0')
    const dt = `${year}.${month}.${day} ${hours}:${minutes}:${seconds}`

    // confirm: MD5(cashdeskid:hash)
    const confirm = crypto.createHash('md5').update(`${cashdeskid}:${hash}`).digest('hex')

    // Signature generation согласно документации:
    // Step 1: SHA256(hash={hash}&cashierpass={cashierpass}&dt={dt})
    const step1String = `hash=${hash}&cashierpass=${cashierpass}&dt=${dt}`
    const step1Hash = crypto.createHash('sha256').update(step1String).digest('hex')

    // Step 2: MD5(dt={dt}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
    const step2String = `dt=${dt}&cashierpass=${cashierpass}&cashdeskid=${cashdeskid}`
    const step2Hash = crypto.createHash('md5').update(step2String).digest('hex')

    // Step 3: SHA256(step1 + step2)
    const combined = step1Hash + step2Hash
    const sign = crypto.createHash('sha256').update(combined).digest('hex')

    const url = `${baseUrl}/Cashdesk/${cashdeskid}/Balance?confirm=${confirm}&dt=${encodeURIComponent(dt)}`

    console.log(`[Cashdesk Balance] Bookmaker: ${bookmaker}, URL: ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'sign': sign,
      },
    })

    const data = await response.json()
    console.log(`[Cashdesk Balance] Response status: ${response.status}, Data:`, data)

    if (!response.ok) {
      return {
        success: false,
        message: data.message || data.error || `Failed to check balance: ${response.status}`,
      }
    }

    return {
      success: true,
      balance: data.Balance || data.balance || 0,
      limit: data.Limit || data.limit || 0,
      message: 'Balance retrieved successfully',
    }
  } catch (error: any) {
    console.error(`[Cashdesk Balance] Error:`, error)
    return {
      success: false,
      message: `Error checking balance: ${error.message}`,
    }
  }
}

/**
 * Поиск игрока для 888starz/1xbet/Melbet (Cashdesk API)
 * GET /Users/{userId}?confirm=&cashdeskid=
 */
export async function searchCashdeskPlayer(
  bookmaker: string,
  userId: string,
  config: CasinoConfig
): Promise<{ success: boolean; userId?: number; name?: string; currencyId?: number; message?: string }> {
  try {
    const baseUrl = 'https://partners.servcul.com/CashdeskBotAPI'
    const normalizedBookmaker = bookmaker.toLowerCase()
    const hash = config.hash!
    const cashierpass = config.cashierpass!
    const cashdeskid = String(config.cashdeskid!)

    // Для Melbet и Winwin userid должен быть в нижнем регистре
    // Для 888starz используем userId как есть (без lowercase)
    const userIdForApi = (normalizedBookmaker.includes('melbet') || normalizedBookmaker.includes('winwin'))
      ? userId.toLowerCase()
      : userId

    // confirm: MD5(userId:hash)
    const confirm = crypto.createHash('md5').update(`${userIdForApi}:${hash}`).digest('hex')

    // Signature generation:
    // Step 1: SHA256(hash={hash}&userid={userid}&cashdeskid={cashdeskid})
    const step1String = `hash=${hash}&userid=${userIdForApi}&cashdeskid=${cashdeskid}`
    const step1Hash = crypto.createHash('sha256').update(step1String).digest('hex')

    // Step 2: MD5(userid={userid}&cashierpass={cashierpass}&hash={hash})
    const step2String = `userid=${userIdForApi}&cashierpass=${cashierpass}&hash=${hash}`
    const step2Hash = crypto.createHash('md5').update(step2String).digest('hex')

    // Step 3: SHA256(step1 + step2)
    const combined = step1Hash + step2Hash
    const sign = crypto.createHash('sha256').update(combined).digest('hex')

    const url = `${baseUrl}/Users/${userIdForApi}?confirm=${confirm}&cashdeskid=${cashdeskid}`

    console.log(`[Cashdesk Player Search] Bookmaker: ${bookmaker}, User ID: ${userIdForApi}, URL: ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'sign': sign,
      },
    })

    const data = await response.json()
    console.log(`[Cashdesk Player Search] Response status: ${response.status}, Data:`, data)

    if (!response.ok) {
      return {
        success: false,
        message: data.message || data.error || `Failed to search player: ${response.status}`,
      }
    }

    return {
      success: true,
      userId: data.userId || data.user_id || 0,
      name: data.name || '',
      currencyId: data.currencyId || data.currency_id || 0,
      message: 'Player found',
    }
  } catch (error: any) {
    console.error(`[Cashdesk Player Search] Error:`, error)
    return {
      success: false,
      message: `Error searching player: ${error.message}`,
    }
  }
}

