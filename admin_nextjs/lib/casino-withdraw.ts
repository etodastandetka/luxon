/**
 * Функции для работы с API вывода средств из казино
 * Поддерживаются: 1xbet, Melbet, Mostbet, 1win
 */
import crypto from 'crypto'
import { MobCashClient } from './mob-cash-api'

// Функции для работы с таймаутами (как в пополнении)
const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs = 10_000
): Promise<Response> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const readTextWithTimeout = async (
  response: Response,
  timeoutMs = 6_000
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Read timeout')), timeoutMs)
    response.text().then(
      (text) => {
        clearTimeout(timeout)
        resolve(text)
      },
      (error) => {
        clearTimeout(timeout)
        reject(error)
      }
    )
  })
}

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

/**
 * Генерация confirm для вывода
 * Согласно документации CashdeskBotAPI пункт 4.2: confirm = MD5(userId:hash)
 * Для Melbet и Winwin userId должен быть в lowercase
 */
function generateConfirm(userId: string, hash: string, isMelbet: boolean = false, isWinwin: boolean = false): string {
  // Для Melbet и Winwin userId должен быть в lowercase для confirm
  const userIdForConfirm = (isMelbet || isWinwin) ? userId.toLowerCase() : userId
  const confirmString = `${userIdForConfirm}:${hash}`
  return crypto.createHash('md5').update(confirmString).digest('hex')
}

/**
 * Генерация подписи для вывода 1xbet/Melbet/888starz/Winwin
 * Согласно документации CashdeskBotAPI пункт 4.1:
 * a. SHA256(hash={hash}&lng={lng}&UserId={UserId}) - в описании UserId с большой, в примере используется userid с маленькой
 * b. MD5(code={code}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
 * c. SHA256(step1 + step2)
 */
function generateSignForWithdraw(
  userId: string,
  code: string,
  hash: string,
  cashierpass: string,
  cashdeskid: string | number
): string {
  // a) SHA256(hash={hash}&lng=ru&userid={user_id})
  // Согласно документации используется userid с маленькой буквы
  const step1String = `hash=${hash}&lng=ru&userid=${userId}`
  const step1Hash = crypto.createHash('sha256').update(step1String).digest('hex')

  // b) MD5(code={code}&cashierpass={cashierpass}&cashdeskid={cashdeskid}) для Payout
  const step2String = `code=${code}&cashierpass=${cashierpass}&cashdeskid=${cashdeskid}`
  const step2Hash = crypto.createHash('md5').update(step2String).digest('hex')

  // c) SHA256(step1 + step2)
  const combined = step1Hash + step2Hash
  return crypto.createHash('sha256').update(combined).digest('hex')
}

/**
 * Проверка суммы вывода через API 1xbet/Melbet/888starz (Cashdesk API)
 * ВАЖНО: Метод Payout сразу выполняет вывод и возвращает summa в ответе
 * Согласно документации: POST Deposit/{userId}/Payout
 * Request Body: { "cashdeskId": int, "lng": "string", "code": "string", "confirm": "string" }
 * Response: { "summa": decimal, "success": bool, "messageId": int, "message": "string" }
 */
export async function checkWithdrawAmountCashdesk(
  bookmaker: string,
  userId: string,
  code: string,
  config: CasinoConfig
): Promise<{ success: boolean; amount?: number; message?: string; transactionId?: number }> {
  try {
    const normalizedBookmaker = bookmaker.toLowerCase()
    const baseUrl = 'https://partners.servcul.com/CashdeskBotAPI'
    const is1xbet = normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet' || normalizedBookmaker.includes('xbet')
    const isMelbet = normalizedBookmaker.includes('melbet')
    const isWinwin = normalizedBookmaker.includes('winwin')
    const is888starz = normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888')
    
    // Для Melbet и Winwin userid должен быть в нижнем регистре для URL и confirm
    // Для 1xbet и 888starz используем userId как есть (без lowercase)
    const userIdForApi = (isMelbet || isWinwin)
      ? userId.toLowerCase() 
      : userId

    // Генерируем confirm: MD5(userId:hash)
    // Передаем оригинальный userId и флаги, generateConfirm сам обработает lowercase
    const confirm = generateConfirm(userId, config.hash!, isMelbet, isWinwin)
    
    // Генерируем подпись согласно документации:
    // 1. SHA256(hash={hash}&lng=ru&userid={user_id})
    // 2. MD5(code={code}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
    // 3. SHA256(step1 + step2)
    const sign = generateSignForWithdraw(
      userIdForApi,
      code,
      config.hash!,
      config.cashierpass!,
      config.cashdeskid!
    )

    const url = `${baseUrl}/Deposit/${userIdForApi}/Payout`
    
    // Согласно документации: для Payout используется cashdeskId (camelCase)
    const requestBody = {
      cashdeskId: parseInt(String(config.cashdeskid)),
      lng: 'ru',
      code: code,
      confirm: confirm,
    }

    // Генерируем Basic Auth для 1xbet и 888starz
    const generateBasicAuth = (login: string, cashierpass: string): string => {
      const authString = `${login}:${cashierpass}`
      const authBase64 = Buffer.from(authString).toString('base64')
      return `Basic ${authBase64}`
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'sign': sign,
    }

    // Для 1xbet и 888starz используем Basic Auth, для Winwin и Melbet - без него
    if (is1xbet || is888starz) {
      const authHeader = generateBasicAuth(config.login!, config.cashierpass!)
      headers['Authorization'] = authHeader
      console.log(`[Cashdesk Withdraw] Using Basic Auth for ${bookmaker}`)
    } else {
      console.log(`[Cashdesk Withdraw] NOT using Basic Auth for ${bookmaker} (Winwin/Melbet)`)
    }

    console.log(`[Cashdesk Withdraw] Bookmaker: ${bookmaker}, User ID: ${userIdForApi}, Code: ${code}`)
    console.log(`[Cashdesk Withdraw] URL: ${url}`)
    console.log(`[Cashdesk Withdraw] Request body:`, JSON.stringify(requestBody, null, 2))
    console.log(`[Cashdesk Withdraw] Sign: ${sign}`)
    console.log(`[Cashdesk Withdraw] Confirm: ${confirm}`)
    console.log(`[Cashdesk Withdraw] Bookmaker flags: is1xbet=${is1xbet}, isMelbet=${isMelbet}, isWinwin=${isWinwin}, is888starz=${is888starz}`)

    // ВАЖНО: Этот запрос ВЫПОЛНЯЕТ вывод и возвращает summa в ответе
    // Если код верный - вывод будет выполнен и вернется сумма
    // Если код неверный - вернется ошибка
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()
    console.log(`[Cashdesk Withdraw] Response status: ${response.status}`)
    console.log(`[Cashdesk Withdraw] Response data:`, JSON.stringify(data, null, 2))

    // API может возвращать success (маленькая) или Success (большая)
    // Также проверяем наличие summa/Summa - если есть сумма, значит операция успешна
    const hasSuccessFlag = data.success === true || data.Success === true
    const hasAmount = (data.summa !== undefined && data.summa !== null) || (data.Summa !== undefined && data.Summa !== null)
    
    // Если есть сумма и HTTP статус OK, считаем операцию успешной
    // Это важно, так как некоторые API могут не возвращать флаг success, но возвращать сумму
    const isSuccess = hasSuccessFlag || (hasAmount && response.ok)

    console.log(`[Cashdesk Withdraw] Success check:`, {
      responseOk: response.ok,
      responseStatus: response.status,
      hasSuccessFlag,
      hasAmount,
      isSuccess,
      summa: data.summa,
      Summa: data.Summa,
      success: data.success,
      Success: data.Success
    })

    // Если HTTP статус не OK, это ошибка
    if (!response.ok) {
      console.error(`[Cashdesk Withdraw] HTTP error: status=${response.status}`)
      return {
        success: false,
        message: data.Message || data.message || `HTTP error: ${response.status}`,
      }
    }

    // Если нет суммы и нет флага успеха, это ошибка
    if (!hasAmount && !hasSuccessFlag) {
      console.error(`[Cashdesk Withdraw] No amount and no success flag`)
      return {
        success: false,
        message: data.Message || data.message || 'Не удалось получить сумму вывода',
      }
    }

    // Если успешно - возвращаем сумму из ответа (summa или Summa)
    // ВАЖНО: Вывод уже выполнен! Нужно это учесть при создании заявки
    // Для вывода сумма может быть отрицательной (например, -150)
    // Проверяем оба варианта: summa (lowercase) и Summa (capitalized)
    let amount: number = 0
    
    if (data.summa !== undefined && data.summa !== null) {
      amount = parseFloat(String(data.summa))
      console.log(`[Cashdesk Withdraw] Found summa (lowercase):`, data.summa, '->', amount)
    } else if (data.Summa !== undefined && data.Summa !== null) {
      amount = parseFloat(String(data.Summa))
      console.log(`[Cashdesk Withdraw] Found Summa (capitalized):`, data.Summa, '->', amount)
    } else {
      console.error(`[Cashdesk Withdraw] No summa/Summa field found in response:`, Object.keys(data))
      return {
        success: false,
        message: 'Сумма вывода не получена из ответа API',
      }
    }
    
    console.log(`[Cashdesk Withdraw] Extracted amount:`, {
      raw_summa: data.summa,
      raw_Summa: data.Summa,
      parsed_amount: amount,
      is_zero: amount === 0,
      absolute_amount: Math.abs(amount)
    })
    
    // Для вывода сумма может быть отрицательной, поэтому проверяем на !== 0
    if (amount === 0 || isNaN(amount)) {
      console.error(`[Cashdesk Withdraw] Amount is 0 or NaN:`, amount)
      return {
        success: false,
        message: 'Сумма вывода не получена из ответа API (сумма равна 0 или не является числом)',
      }
    }

    // Берем абсолютное значение суммы для вывода (API может вернуть отрицательное)
    const absoluteAmount = Math.abs(amount)

    console.log(`[Cashdesk Withdraw] Returning success with amount:`, absoluteAmount)

    return {
      success: true,
      amount: absoluteAmount,
      message: data.Message || data.message || 'Withdrawal processed successfully',
    }
  } catch (error: any) {
    console.error(`[Cashdesk Withdraw] Error:`, error)
    return {
      success: false,
      message: `Error processing withdrawal: ${error.message}`,
    }
  }
}

/**
 * Проверка наличия выводов для игрока (Mostbet) - без кода
 */
export async function checkWithdrawsExistMostbet(
  playerId: string,
  config: CasinoConfig
): Promise<{ success: boolean; hasWithdrawals: boolean; message?: string }> {
  try {
    console.log(`[Mostbet Check Withdrawals] 🚀 FUNCTION CALLED - playerId: ${playerId}`)
    console.log(`[Mostbet Check Withdrawals] Config:`, {
      hasApiKey: !!config.api_key,
      hasSecret: !!config.secret,
      cashpointId: config.cashpoint_id,
      apiKeyPrefix: config.api_key?.substring(0, 20) + '...',
      secretPrefix: config.secret?.substring(0, 10) + '...',
    })
    
    const baseUrl = 'https://apimb.com'
    const cashpointId = String(config.cashpoint_id)
    
    // Получаем timestamp в UTC в формате YYYY-MM-DD HH:MM:SS (UTC+0)
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const hours = String(now.getUTCHours()).padStart(2, '0')
    const minutes = String(now.getUTCMinutes()).padStart(2, '0')
    const seconds = String(now.getUTCSeconds()).padStart(2, '0')
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

    const apiKey = config.api_key!
    const apiKeyFormatted = apiKey.startsWith('api-key:') 
      ? apiKey
      : `api-key:${apiKey}`

    // Извлекаем числовую часть из cashpoint_id (например "C131864" -> "131864")
    let cashpointIdForUrl = cashpointId
    const numericMatch = cashpointIdForUrl.match(/\d+/)
    if (numericMatch) {
      cashpointIdForUrl = numericMatch[0]
    }

    // ВАЖНО: Для подписи PATH должен быть БЕЗ query параметров, REQUEST_BODY для GET - пустая строка
    const listPath = `/mbc/gateway/v1/api/cashpoint/${cashpointIdForUrl}/player/cashout/list/page`
    const listQueryParams = `?page=1&size=10&searchString=${playerId}`
    const listUrl = `${baseUrl}${listPath}${listQueryParams}`
    
    // Проверяем наличие secret перед созданием подписи
    if (!config.secret || config.secret.trim() === '') {
      return {
        success: false,
        hasWithdrawals: false,
        message: 'Mostbet API secret is missing or empty',
      }
    }
    
    // Формируем строку для подписи: <API_KEY><PATH><REQUEST_BODY><TIMESTAMP>
    // Для GET запросов REQUEST_BODY - пустая строка, но она должна быть явно указана в формуле
    // Согласно документации: конкатенируем без разделителей: <API_KEY><PATH><REQUEST_BODY><TIMESTAMP>
    const requestBody = '' // Для GET запросов REQUEST_BODY - пустая строка
    const listString = `${apiKeyFormatted}${listPath}${requestBody}${timestamp}`
    
    console.log(`[Mostbet Check Withdrawals] 🔍 DETAILED SIGNATURE DEBUG:`, {
      apiKeyFull: apiKeyFormatted,
      apiKeyLength: apiKeyFormatted.length,
      path: listPath,
      pathLength: listPath.length,
      requestBody: requestBody || '(empty)',
      requestBodyLength: requestBody.length,
      timestamp: timestamp,
      timestampLength: timestamp.length,
      fullString: listString,
      fullStringLength: listString.length,
      secretPrefix: config.secret ? config.secret.substring(0, 10) + '...' : 'MISSING',
      secretLength: config.secret ? config.secret.length : 0,
    })
    
    // Используем SHA3-256 согласно документации Mostbet API
    // В Node.js 18+ поддерживается sha3-256, но может называться по-разному
    let listSignature: string
    try {
      // Пробуем разные варианты названия алгоритма (как в пополнении)
      const algorithms = ['sha3-256', 'SHA3-256', 'sha3_256']
      let listHmac: any = null
      
      for (const algo of algorithms) {
        try {
          listHmac = crypto.createHmac(algo, config.secret)
          break
        } catch (e) {
          // Пробуем следующий вариант
          continue
        }
      }
      
      if (!listHmac) {
        throw new Error('SHA3-256 not supported')
      }
      
      listSignature = listHmac.update(listString).digest('hex')
      console.log(`[Mostbet Check Withdrawals] Using SHA3-256 for signature`)
    } catch (e: any) {
      console.error(`❌ SHA3-256 not available: ${e.message}`)
      return {
        success: false,
        hasWithdrawals: false,
        message: 'SHA3-256 is required for Mostbet API but not available',
      }
    }
    
    console.log(`[Mostbet Check Withdrawals] ✅ Generated signature:`, listSignature)
    console.log(`[Mostbet Check Withdrawals] 📤 Request URL:`, listUrl)
    console.log(`[Mostbet Check Withdrawals] 📤 Request headers:`, {
      'X-Timestamp': timestamp,
      'X-Signature': listSignature,
      'X-Api-Key': apiKeyFormatted,
      'Accept': '*/*',
    })

    const listResponse = await fetchWithTimeout(
      listUrl,
      {
        method: 'GET',
        headers: {
          'X-Timestamp': timestamp,
          'X-Signature': listSignature,
          'X-Api-Key': apiKeyFormatted,
          'Accept': '*/*',
        },
      },
      10_000 // Таймаут 10 секунд
    )

    // Используем readTextWithTimeout как в пополнении
    const listResponseText = await readTextWithTimeout(listResponse, 6_000)
    let listData: any
    try {
      listData = JSON.parse(listResponseText)
    } catch (e) {
      console.error(`[Mostbet Check Withdrawals] Failed to parse list response:`, {
        status: listResponse.status,
        statusText: listResponse.statusText,
        body: listResponseText.substring(0, 500)
      })
      return {
        success: false,
        hasWithdrawals: false,
        message: `API error: ${listResponse.status} ${listResponse.statusText}`,
      }
    }
    
    console.log(`[Mostbet Check Withdrawals] 📥 Response status: ${listResponse.status}`, {
      ok: listResponse.ok,
      statusText: listResponse.statusText,
      data: listData,
    })
    
    if (!listResponse.ok) {
      console.error(`[Mostbet Check Withdrawals] ❌ API Error Response:`, {
        status: listResponse.status,
        statusText: listResponse.statusText,
        responseData: listData,
        requestUrl: listUrl,
        requestHeaders: {
          'X-Timestamp': timestamp,
          'X-Signature': listSignature?.substring(0, 20) + '...',
          'X-Api-Key': apiKeyFormatted?.substring(0, 30) + '...',
        },
      })
      return {
        success: false,
        hasWithdrawals: false,
        message: listData.message || listData.code || `API error: ${listResponse.status} ${listResponse.statusText}`,
      }
    }

    const hasWithdrawals = listData.items && listData.items.length > 0 && 
      listData.items.some((item: any) => item.playerId === String(playerId))

    return {
      success: true,
      hasWithdrawals,
      message: hasWithdrawals ? 'Withdrawals found' : 'No withdrawals found for this player',
    }
  } catch (error: any) {
    console.error(`[Mostbet Check Withdrawals] Error:`, error)
    return {
      success: false,
      hasWithdrawals: false,
      message: `Error: ${error.message}`,
    }
  }
}

/**
 * Проверка суммы вывода через API Mostbet
 */
export async function checkWithdrawAmountMostbet(
  playerId: string,
  code: string,
  config: CasinoConfig
): Promise<{ success: boolean; amount?: number; transactionId?: number; message?: string }> {
  try {
    const baseUrl = 'https://apimb.com'
    const cashpointId = String(config.cashpoint_id)
    
    // Получаем timestamp в UTC в формате YYYY-MM-DD HH:MM:SS (UTC+0)
    // Согласно документации: "Дату и время необходимо передавать для часового пояса UTC+0"
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const hours = String(now.getUTCHours()).padStart(2, '0')
    const minutes = String(now.getUTCMinutes()).padStart(2, '0')
    const seconds = String(now.getUTCSeconds()).padStart(2, '0')
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    
    // Проверяем, что timestamp в правильном формате UTC+0
    console.log(`[Mostbet Withdraw Check] List Timestamp (UTC+0):`, {
      timestamp,
      localTime: now.toISOString(),
      utcTime: now.toUTCString(),
      utcHours: now.getUTCHours(),
      localHours: now.getHours(),
      timezoneOffset: now.getTimezoneOffset(),
    })

    // API key может быть с префиксом или без
    const apiKey = config.api_key!
    const apiKeyFormatted = apiKey.startsWith('api-key:') 
      ? apiKey
      : `api-key:${apiKey}`

    // Извлекаем числовую часть из cashpoint_id (например "C131864" -> "131864")
    let cashpointIdForUrl = cashpointId
    const numericMatch = cashpointIdForUrl.match(/\d+/)
    if (numericMatch) {
      cashpointIdForUrl = numericMatch[0]
    }

    // Сначала получаем список запросов на вывод
    // ВАЖНО: Для подписи PATH должен быть БЕЗ query параметров, REQUEST_BODY для GET - пустая строка
    const listPath = `/mbc/gateway/v1/api/cashpoint/${cashpointIdForUrl}/player/cashout/list/page`
    const listQueryParams = `?page=1&size=10&searchString=${playerId}`
    const listUrl = `${baseUrl}${listPath}${listQueryParams}`
    
    // Проверяем наличие secret перед созданием подписи
    if (!config.secret || config.secret.trim() === '') {
      return {
        success: false,
        message: 'Mostbet API secret is missing or empty',
      }
    }
    
    // Формируем строку для подписи: <API_KEY><PATH><REQUEST_BODY><TIMESTAMP>
    // Для GET запросов REQUEST_BODY - пустая строка, но она должна быть явно указана в формуле
    // Согласно документации: конкатенируем без разделителей: <API_KEY><PATH><REQUEST_BODY><TIMESTAMP>
    const requestBody = '' // Для GET запросов REQUEST_BODY - пустая строка
    const listString = `${apiKeyFormatted}${listPath}${requestBody}${timestamp}`
    
    console.log(`[Mostbet Withdraw Check] 🔍 DETAILED LIST SIGNATURE DEBUG:`, {
      apiKeyFull: apiKeyFormatted,
      apiKeyLength: apiKeyFormatted.length,
      path: listPath,
      pathLength: listPath.length,
      requestBody: requestBody || '(empty)',
      requestBodyLength: requestBody.length,
      timestamp: timestamp,
      timestampLength: timestamp.length,
      fullString: listString,
      fullStringLength: listString.length,
      secretPrefix: config.secret ? config.secret.substring(0, 10) + '...' : 'MISSING',
      secretLength: config.secret ? config.secret.length : 0,
    })
    
    // Используем SHA3-256 согласно документации Mostbet API
    // В Node.js 18+ поддерживается sha3-256, но может называться по-разному
    let listSignature: string
    try {
      // Пробуем разные варианты названия алгоритма (как в пополнении)
      const algorithms = ['sha3-256', 'SHA3-256', 'sha3_256']
      let listHmac: any = null
      
      for (const algo of algorithms) {
        try {
          listHmac = crypto.createHmac(algo, config.secret)
          break
        } catch (e) {
          // Пробуем следующий вариант
          continue
        }
      }
      
      if (!listHmac) {
        throw new Error('SHA3-256 not supported')
      }
      
      listSignature = listHmac.update(listString).digest('hex')
      console.log(`[Mostbet Withdraw Check] Using SHA3-256 for list signature`)
    } catch (e: any) {
      console.error(`❌ SHA3-256 not available: ${e.message}`)
      return {
        success: false,
        message: 'SHA3-256 is required for Mostbet API but not available',
      }
    }
    
    console.log(`[Mostbet Withdraw Check] ✅ Generated list signature:`, listSignature)
    console.log(`[Mostbet Withdraw Check] 📤 List URL:`, listUrl)
    console.log(`[Mostbet Withdraw Check] 📤 List headers:`, {
      'X-Timestamp': timestamp,
      'X-Signature': listSignature,
      'X-Api-Key': apiKeyFormatted,
      'Accept': '*/*',
    })
    
    console.log(`[Mostbet Withdraw Check] List signature:`, listSignature.substring(0, 20) + '...')

    // Используем fetchWithTimeout и правильный порядок заголовков (как в пополнении)
    const listResponse = await fetchWithTimeout(
      listUrl,
      {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKeyFormatted,
          'X-Timestamp': timestamp,
          'X-Signature': listSignature,
          'Accept': '*/*',
        },
      },
      10_000
    )

    // Используем readTextWithTimeout как в пополнении
    const listResponseText = await readTextWithTimeout(listResponse, 6_000)
    let listData: any
    try {
      listData = JSON.parse(listResponseText)
    } catch (e) {
      console.error(`[Mostbet Withdraw Check] Failed to parse list response:`, {
        status: listResponse.status,
        statusText: listResponse.statusText,
        body: listResponseText.substring(0, 500)
      })
      return {
        success: false,
        message: `API error: ${listResponse.status} ${listResponse.statusText}`,
      }
    }
    
    console.log(`[Mostbet Withdraw Check] List response status: ${listResponse.status}`, listData)

    if (!listResponse.ok) {
      return {
        success: false,
        message: listData.message || listData.code || `API error: ${listResponse.status} ${listResponse.statusText}`,
      }
    }

    if (!listData.items || listData.items.length === 0) {
      return {
        success: false,
        message: 'No withdrawal request found for this player',
      }
    }

    // Ищем запрос для этого игрока
    let withdrawal = listData.items.find((item: any) => 
      item.playerId === String(playerId)
    )

    if (!withdrawal) {
      // Если не нашли точно по ID, берем первый (может быть новый запрос)
      withdrawal = listData.items[0]
    }

    // Подтверждаем вывод кодом, чтобы получить сумму
    // ВАЖНО: Для каждого запроса нужен СВОЙ timestamp (согласно документации)
    // Согласно документации: "Дату и время необходимо передавать для часового пояса UTC+0"
    const confirmNow = new Date()
    const confirmYear = confirmNow.getUTCFullYear()
    const confirmMonth = String(confirmNow.getUTCMonth() + 1).padStart(2, '0')
    const confirmDay = String(confirmNow.getUTCDate()).padStart(2, '0')
    const confirmHours = String(confirmNow.getUTCHours()).padStart(2, '0')
    const confirmMinutes = String(confirmNow.getUTCMinutes()).padStart(2, '0')
    const confirmSeconds = String(confirmNow.getUTCSeconds()).padStart(2, '0')
    const confirmTimestamp = `${confirmYear}-${confirmMonth}-${confirmDay} ${confirmHours}:${confirmMinutes}:${confirmSeconds}`
    
    // Проверяем, что timestamp в правильном формате UTC+0
    console.log(`[Mostbet Withdraw Check] Confirm Timestamp (UTC+0):`, {
      timestamp: confirmTimestamp,
      localTime: confirmNow.toISOString(),
      utcTime: confirmNow.toUTCString(),
      utcHours: confirmNow.getUTCHours(),
      localHours: confirmNow.getHours(),
    })
    
    const confirmPath = `/mbc/gateway/v1/api/cashpoint/${cashpointIdForUrl}/player/cashout/confirmation`
    
    // ВАЖНО: transactionId должен быть числом согласно документации
    const transactionIdNum = typeof withdrawal.transactionId === 'number' 
      ? withdrawal.transactionId 
      : parseInt(String(withdrawal.transactionId))
    
    if (isNaN(transactionIdNum)) {
      return {
        success: false,
        message: `Invalid transactionId: ${withdrawal.transactionId}`,
      }
    }
    
    // ВАЖНО: Порядок полей важен! Согласно документации: сначала code, потом transactionId
    const confirmBody = {
      code: String(code),
      transactionId: transactionIdNum,
    }
    // ВАЖНО: Согласно коду пополнения, используется JSON без пробелов и для подписи, и для отправки
    // В пополнении: body: requestBody (где requestBody = JSON.stringify(...).replace(/\s+/g, ''))
    // Поэтому используем тот же подход - JSON без пробелов
    const confirmBodyString = JSON.stringify(confirmBody).replace(/\s+/g, '')
    
    console.log(`[Mostbet Withdraw Check] Confirm body:`, {
      original: confirmBody,
      stringified: JSON.stringify(confirmBody),
      withoutSpaces: confirmBodyString,
      note: 'Using JSON without spaces for both signature and request body (same as deposit)',
    })
    
    // Проверяем наличие secret перед созданием подписи
    if (!config.secret || config.secret.trim() === '') {
      return {
        success: false,
        message: 'Mostbet API secret is missing or empty',
      }
    }
    
    // Формируем строку для подписи: <API_KEY><PATH><REQUEST_BODY><TIMESTAMP>
    // Используем НОВЫЙ timestamp для подтверждения
    const confirmString = `${apiKeyFormatted}${confirmPath}${confirmBodyString}${confirmTimestamp}`
    
    console.log(`[Mostbet Withdraw Check] 🔍 DETAILED CONFIRM SIGNATURE DEBUG:`, {
      apiKeyFull: apiKeyFormatted,
      apiKeyLength: apiKeyFormatted.length,
      path: confirmPath,
      pathLength: confirmPath.length,
      body: confirmBodyString,
      bodyLength: confirmBodyString.length,
      timestamp: confirmTimestamp,
      timestampLength: confirmTimestamp.length,
      fullString: confirmString,
      fullStringLength: confirmString.length,
      secretPrefix: config.secret ? config.secret.substring(0, 10) + '...' : 'MISSING',
      secretLength: config.secret ? config.secret.length : 0,
    })
    
    // Используем SHA3-256 согласно документации Mostbet API
    // В Node.js 18+ поддерживается sha3-256, но может называться по-разному
    let confirmSignature: string
    try {
      // Пробуем разные варианты названия алгоритма (как в пополнении)
      const algorithms = ['sha3-256', 'SHA3-256', 'sha3_256']
      let confirmHmac: any = null
      
      for (const algo of algorithms) {
        try {
          confirmHmac = crypto.createHmac(algo, config.secret)
          break
        } catch (e) {
          // Пробуем следующий вариант
          continue
        }
      }
      
      if (!confirmHmac) {
        throw new Error('SHA3-256 not supported')
      }
      
      confirmSignature = confirmHmac.update(confirmString).digest('hex')
      console.log(`[Mostbet Withdraw Check] Using SHA3-256 for confirm signature`)
    } catch (e: any) {
      console.error(`❌ SHA3-256 not available: ${e.message}`)
      return {
        success: false,
        message: 'SHA3-256 is required for Mostbet API but not available',
      }
    }
    
    console.log(`[Mostbet Withdraw Check] ✅ Generated confirm signature:`, confirmSignature)
    console.log(`[Mostbet Withdraw Check] 📤 Confirm URL:`, `${baseUrl}${confirmPath}`)
    console.log(`[Mostbet Withdraw Check] 📤 Confirm headers:`, {
      'Content-Type': 'application/json',
      'X-Timestamp': confirmTimestamp,
      'X-Signature': confirmSignature,
      'X-Api-Key': apiKeyFormatted,
      'X-Project': 'MBC',
      'Accept': '*/*',
    })
    console.log(`[Mostbet Withdraw Check] 📤 Confirm body:`, confirmBodyString)

    // ВАЖНО: Используем тот же подход, что и в пополнении - fetchWithTimeout и тот же порядок заголовков
    // В пополнении порядок: X-Api-Key, X-Timestamp, X-Signature, X-Project, Content-Type, Accept
    // И используется JSON без пробелов для отправки (как requestBody в пополнении)
    const confirmResponse = await fetchWithTimeout(
      `${baseUrl}${confirmPath}`,
      {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKeyFormatted,
          'X-Timestamp': confirmTimestamp, // Используем новый timestamp
          'X-Signature': confirmSignature,
          'X-Project': 'MBC', // Обязательно согласно документации
          'Content-Type': 'application/json',
          'Accept': '*/*',
        },
        body: confirmBodyString, // Используем JSON без пробелов, как в пополнении
      },
      10_000
    )
    
    console.log(`[Mostbet Withdraw Check] Confirm request:`, {
      path: confirmPath,
      body: confirmBody,
      bodyString: confirmBodyString,
      timestamp: confirmTimestamp,
      signature: confirmSignature.substring(0, 20) + '...',
    })

    // Используем readTextWithTimeout как в пополнении
    const confirmResponseText = await readTextWithTimeout(confirmResponse, 6_000)
    let confirmData: any
    try {
      confirmData = JSON.parse(confirmResponseText)
    } catch (e) {
      console.error(`[Mostbet Withdraw Check] Failed to parse confirm response:`, {
        status: confirmResponse.status,
        statusText: confirmResponse.statusText,
        body: confirmResponseText.substring(0, 500)
      })
      return {
        success: false,
        message: `API error: ${confirmResponse.status} ${confirmResponse.statusText}`,
      }
    }
    
    console.log(`[Mostbet Withdraw Check] Confirm response status: ${confirmResponse.status}`, confirmData)

    // Проверяем статус ответа согласно документации
    if (!confirmResponse.ok) {
      const errorMessage = confirmData.message || confirmData.code || `API error: ${confirmResponse.status} ${confirmResponse.statusText}`
      console.error(`[Mostbet Withdraw Check] Confirm failed:`, {
        status: confirmResponse.status,
        statusText: confirmResponse.statusText,
        error: errorMessage,
        confirmData
      })
      return {
        success: false,
        message: errorMessage,
      }
    }

    // Проверяем статусы транзакции согласно документации
    // NEW_ERROR, PROCESSING_ERROR, CANCELED, EXPIRED - это ошибки
    const errorStatuses = ['NEW_ERROR', 'PROCESSING_ERROR', 'CANCELED', 'EXPIRED']
    if (confirmData.status && errorStatuses.includes(confirmData.status)) {
      return {
        success: false,
        message: confirmData.message || `Transaction status: ${confirmData.status}`,
      }
    }

    // Успешные статусы: NEW, ACCEPTED, PROCESSING, COMPLETED
    // COMPLETED означает что транзакция завершена успешно
    // NEW/ACCEPTED/PROCESSING означает что транзакция в процессе
    
    // Возвращаем сумму подтвержденного вывода
    // Сумма должна быть из списка заявок (withdrawal.amount), так как в ответе confirmation может не быть amount
    // Согласно документации API, в списке заявок поле amount - это число с плавающей запятой
    let amount: number | undefined
    
    // Сначала пытаемся получить сумму из списка заявок (это основной источник)
    if (withdrawal.amount !== undefined && withdrawal.amount !== null) {
      amount = parseFloat(String(withdrawal.amount))
    } 
    // Если нет в списке, пытаемся из ответа подтверждения
    else if (confirmData.amount !== undefined && confirmData.amount !== null) {
      amount = parseFloat(String(confirmData.amount))
    }
    
    // Проверяем, что сумма валидна
    if (amount === undefined || amount === null || isNaN(amount) || amount <= 0) {
      console.error(`[Mostbet Withdraw Check] Invalid amount:`, {
        withdrawalAmount: withdrawal.amount,
        confirmAmount: confirmData.amount,
        parsedAmount: amount,
        withdrawal: withdrawal,
        confirmData: confirmData
      })
      return {
        success: false,
        message: 'Amount not found or invalid in withdrawal data',
      }
    }

    return {
      success: true,
      amount: amount,
      transactionId: withdrawal.transactionId || confirmData.transactionId,
      message: `Withdrawal confirmed. Status: ${confirmData.status || 'NEW'}`,
    }
  } catch (error: any) {
    console.error(`[Mostbet Withdraw Check] Error:`, error)
    return {
      success: false,
      message: `Error checking withdrawal: ${error.message}`,
    }
  }
}

/**
 * Проверка суммы вывода через API 1win
 * Согласно документации: POST /v1/client/withdrawal
 * Параметры: userId (number), code (number)
 * Ответ: id, cashId, amount, userId
 */
export async function checkWithdrawAmount1win(
  userId: string,
  code: string,
  config: CasinoConfig
): Promise<{ success: boolean; amount?: number; message?: string; data?: any }> {
  try {
    const baseUrl = 'https://api.1win.win/v1/client'
    
    // Проверяем наличие API ключа
    if (!config.api_key || config.api_key.trim() === '') {
      return {
        success: false,
        message: 'Missing required 1win API key',
      }
    }

    // Парсим userId и code в числа
    const userIdNum = parseInt(userId)
    const codeNum = parseInt(code)

    if (isNaN(userIdNum) || isNaN(codeNum)) {
      return {
        success: false,
        message: 'Invalid userId or code format',
      }
    }

    const requestBody = {
      userId: userIdNum,
      code: codeNum,
    }

    console.log(`[1win Withdraw Check] User ID: ${userIdNum}, Code: ${codeNum}`)
    console.log(`[1win Withdraw Check] URL: ${baseUrl}/withdrawal`)
    console.log(`[1win Withdraw Check] Request body:`, requestBody)
    console.log(`[1win Withdraw Check] API Key: ${config.api_key.substring(0, 20)}...`)

    const response = await fetch(`${baseUrl}/withdrawal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.api_key,
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error(`[1win Withdraw Check] Failed to parse response: ${responseText}`)
      return {
        success: false,
        message: `Invalid response from 1win API: ${responseText.substring(0, 100)}`,
        data: { rawResponse: responseText, status: response.status },
      }
    }

    console.log(`[1win Withdraw Check] Response status: ${response.status}, Response ok: ${response.ok}, Data:`, data)

    if (!response.ok) {
      // Обрабатываем ошибки согласно документации
      let errorMessage = 'Failed to process withdrawal'
      if (response.status === 400) {
        if (data.message) {
          errorMessage = data.message
        } else if (responseText.includes('процесс обработки')) {
          errorMessage = 'Вывод находится в процессе обработки'
        } else if (responseText.includes('лимиты')) {
          errorMessage = 'Сумма превышает лимиты'
        } else if (responseText.includes('неверный идентификатор кассы')) {
          errorMessage = 'Передан неверный идентификатор кассы'
        } else if (responseText.includes('Не корректный код')) {
          errorMessage = 'Не корректный код'
        } else if (responseText.includes('превышает доступный баланс')) {
          errorMessage = 'Сумма вывода превышает доступный баланс в кассе'
        } else if (responseText.includes('Не корректный идентификатор кассы')) {
          errorMessage = 'Не корректный идентификатор кассы'
        }
      } else if (response.status === 403) {
        errorMessage = 'Не допускается'
      } else if (response.status === 404) {
        if (responseText.includes('Вывод не найден')) {
          errorMessage = 'Вывод не найден'
        } else if (responseText.includes('Пользователь не найден')) {
          errorMessage = 'Пользователь не найден'
        } else {
          errorMessage = 'Вывод или пользователь не найден'
        }
      }

      return {
        success: false,
        message: errorMessage,
        data,
      }
    }

    // Успешный ответ содержит: id, cashId, amount, userId
    const amount = data.amount || 0
    if (amount === 0 || isNaN(amount)) {
      return {
        success: false,
        message: 'Сумма вывода не получена из ответа API',
        data,
      }
    }

    return {
      success: true,
      amount: parseFloat(String(amount)),
      message: 'Withdrawal confirmed',
    }
  } catch (error: any) {
    console.error(`[1win Withdraw Check] Error:`, error)
    return {
      success: false,
      message: `Error checking withdrawal: ${error.message}`,
    }
  }
}

/**
 * Проверка суммы вывода через mob-cash API
 */
export async function checkWithdrawAmountMobCash(
  payerID: string,
  withdrawalCode: string,
  config: MobCashConfig
): Promise<{ success: boolean; amount?: number; message?: string }> {
  try {
    // Проверяем, что все обязательные поля заполнены
    if (!config.login || !config.password || !config.cashdesk_id ||
        config.login.trim() === '' || config.password.trim() === '' ||
        String(config.cashdesk_id).trim() === '' || String(config.cashdesk_id).trim() === '0') {
      return {
        success: false,
        message: 'Missing required mob-cash API credentials',
      }
    }

    console.log(`[MobCash Withdraw Check] Payer ID: ${payerID}, Code: ${withdrawalCode}`)

    // Создаем клиент mob-cash
    const client = new MobCashClient(config)

    // Запрашиваем сумму ордера
    const result = await client.getWithdrawalAmount(payerID, withdrawalCode)

    if (!result.success) {
      return {
        success: false,
        message: result.message || 'Failed to get withdrawal amount',
      }
    }

    return {
      success: true,
      amount: parseFloat(result.amount) || 0,
      message: result.message || 'Withdrawal amount retrieved',
    }
  } catch (error: any) {
    console.error(`[MobCash Withdraw Check] Error:`, error)
    return {
      success: false,
      message: error.message || 'Error checking withdrawal amount',
    }
  }
}

/**
 * Исполнение ордера на вывод через mob-cash API
 */
export async function processWithdrawMobCash(
  payerID: string,
  amount: number,
  withdrawalCode: string,
  config: MobCashConfig
): Promise<{ success: boolean; amount?: number; message?: string; data?: any }> {
  try {
    // Проверяем, что все обязательные поля заполнены
    if (!config.login || !config.password || !config.cashdesk_id ||
        config.login.trim() === '' || config.password.trim() === '' ||
        String(config.cashdesk_id).trim() === '' || String(config.cashdesk_id).trim() === '0') {
      return {
        success: false,
        message: 'Missing required mob-cash API credentials',
      }
    }

    console.log(`[MobCash Withdraw] Payer ID: ${payerID}, Amount: ${amount}, Code: ${withdrawalCode}`)

    // Создаем клиент mob-cash
    const client = new MobCashClient(config)

    // Выполняем вывод
    const result = await client.withdrawal(payerID, amount, withdrawalCode)

    if (!result.success) {
      return {
        success: false,
        message: result.message || 'Withdrawal failed',
      }
    }

    return {
      success: true,
      amount: amount,
      message: result.message || 'Withdrawal successful',
      data: result.data,
    }
  } catch (error: any) {
    console.error(`[MobCash Withdraw] Error:`, error)
    return {
      success: false,
      message: error.message || 'Error processing withdrawal',
    }
  }
}

/**
 * Выполнение вывода средств через API казино
 */
export async function processWithdraw(
  bookmaker: string,
  userId: string,
  code: string,
  config: CasinoConfig
): Promise<{ success: boolean; amount?: number; message?: string; transactionId?: number }> {
  const normalizedBookmaker = bookmaker.toLowerCase()

  // Melbet, Winwin и 888starz используют Cashdesk API
  if (normalizedBookmaker.includes('melbet') || normalizedBookmaker.includes('winwin') ||
      normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888') || normalizedBookmaker === '888starz') {
    return await checkWithdrawAmountCashdesk(bookmaker, userId, code, config)
  }

  // Mostbet использует свой API
  if (normalizedBookmaker.includes('mostbet')) {
    return await checkWithdrawAmountMostbet(userId, code, config)
  }

  // 1win использует свой API
  if (normalizedBookmaker.includes('1win')) {
    return await checkWithdrawAmount1win(userId, code, config)
  }

  return {
    success: false,
    message: `Unsupported bookmaker: ${bookmaker}`,
  }
}

