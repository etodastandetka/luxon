import crypto from 'crypto'

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

// Генерация confirm для 1xbet/Melbet
export function generateConfirm(userId: string, hash: string, isMelbet: boolean = false): string {
  const userIdForConfirm = isMelbet ? userId.toLowerCase() : userId
  const confirmString = `${userIdForConfirm}:${hash}`
  return crypto.createHash('md5').update(confirmString).digest('hex')
}

// Генерация подписи для пополнения 1xbet
export function generateSignForDeposit1xbet(
  userId: string,
  amount: number,
  hash: string,
  cashierpass: string,
  cashdeskid: string | number
): string {
  // a) SHA256(hash={hash}&lng=ru&userid={user_id})
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
  // a) SHA256(hash={hash}&lng=ru&userid={user_id.lower()})
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

// Пополнение для 1xbet/Melbet через Cashdesk API
export async function depositCashdeskAPI(
  bookmaker: string,
  userId: string,
  amount: number,
  config: CasinoConfig
): Promise<{ success: boolean; message: string; data?: any }> {
  const baseUrl = 'https://partners.servcul.com/CashdeskBotAPI/'
  const isMelbet = bookmaker.toLowerCase().includes('melbet')

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
    const confirm = generateConfirm(userId, hash, isMelbet)
    const sign = isMelbet
      ? generateSignForDepositMelbet(userId, amount, hash, cashierpass, cashdeskid)
      : generateSignForDeposit1xbet(userId, amount, hash, cashierpass, cashdeskid)

    const url = `${baseUrl}Deposit/${userId}/Add`
    const authHeader = generateBasicAuth(login, cashierpass)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'sign': sign,
      },
      body: JSON.stringify({
        cashdeskId: String(cashdeskid),
        lng: 'ru',
        summa: amount,
        confirm: confirm,
      }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      return {
        success: true,
        message: 'Balance deposited successfully',
        data,
      }
    }

    return {
      success: false,
      message: data.message || data.error || 'Failed to deposit balance',
      data,
    }
  } catch (error: any) {
    console.error(`Deposit error for ${bookmaker}:`, error)
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
    // Получаем timestamp
    const now = new Date()
    const timestamp = now.toISOString().slice(0, 19).replace('T', ' ')

    // Формируем путь и тело запроса
    const cashpointIdStr = String(cashpointId)
    const path = `/mbc/gateway/v1/api/cashpoint/${cashpointIdStr}/player/deposit`
    const requestBody = JSON.stringify({
      brandId: 1,
      playerId: String(userId),
      amount: amount,
      currency: 'KGS',
    })

    // API key может быть с префиксом или без
    const apiKeyFormatted = apiKey.startsWith('api-key:') 
      ? apiKey
      : `api-key:${apiKey}`

    // Генерируем подпись: HMAC SHA3-256 от <API_KEY><PATH><REQUEST_BODY><TIMESTAMP>
    const signatureString = `${apiKeyFormatted}${path}${requestBody}${timestamp}`
    const signature = crypto
      .createHmac('sha3-256', secret)
      .update(signatureString)
      .digest('hex')

    const url = `${baseUrl}${path}`
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

    const data = await response.json()

    if (response.ok) {
      return {
        success: true,
        message: 'Balance deposited successfully',
        data,
      }
    }

    return {
      success: false,
      message: data.message || data.error || 'Failed to deposit balance',
      data,
    }
  } catch (error: any) {
    console.error('Mostbet deposit error:', error)
    return {
      success: false,
      message: error.message || 'Failed to deposit balance',
    }
  }
}

