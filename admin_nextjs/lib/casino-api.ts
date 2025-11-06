/**
 * API клиенты для получения балансов и лимитов платформ
 */

interface CashdeskConfig {
  hash: string
  cashierpass: string
  login: string
  cashdeskid: number
}

interface MostbetConfig {
  api_key: string
  secret: string
  cashpoint_id: string
}

interface BalanceResult {
  balance: number
  limit: number
}

// Конфигурация для API (из переменных окружения или дефолтные значения)
const CASHDESK_CONFIG: Record<string, CashdeskConfig> = {
  '1xbet': {
    hash: process.env.XBET_HASH || '97f471a9db92debbda38201af67e15f64d086e94ae4b919d8a6a4f64958912cf',
    cashierpass: process.env.XBET_CASHIERPASS || 'wiaWAfE9',
    login: process.env.XBET_LOGIN || 'zhenishbAd',
    cashdeskid: parseInt(process.env.XBET_CASHDESKID || '1388580'),
  },
  melbet: {
    hash: process.env.MELBET_HASH || 'f788cc308d9de930b292873b2cf79526da363cb24a85883575426cc7f3c4553d',
    cashierpass: process.env.MELBET_CASHIERPASS || '3nKS3!b7',
    login: process.env.MELBET_LOGIN || 'burgoevk',
    cashdeskid: parseInt(process.env.MELBET_CASHDESKID || '1415842'),
  },
}

const MOSTBET_CONFIG: MostbetConfig = {
  api_key: process.env.MOSTBET_API_KEY || 'api-key:62e9da4c-52e3-4d0f-b579-c9e7805f711d',
  secret: process.env.MOSTBET_SECRET || 'Kana312',
  cashpoint_id: process.env.MOSTBET_CASHPOINT_ID || 'F125160',
}

/**
 * Получение баланса и лимита через Cashdesk API (1xbet, Melbet)
 */
async function getCashdeskBalance(
  casino: '1xbet' | 'melbet',
  cfg: CashdeskConfig
): Promise<BalanceResult> {
  try {
    const crypto = require('crypto')
    
    // Формируем дату в UTC в формате 'YYYY.MM.DD HH:MM:SS'
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const hours = String(now.getUTCHours()).padStart(2, '0')
    const minutes = String(now.getUTCMinutes()).padStart(2, '0')
    const seconds = String(now.getUTCSeconds()).padStart(2, '0')
    const formattedDt = `${year}.${month}.${day} ${hours}:${minutes}:${seconds}`

    // confirm = MD5(cashdeskid:hash)
    const confirmStr = `${cfg.cashdeskid}:${cfg.hash}`
    const confirm = crypto.createHash('md5').update(confirmStr).digest('hex')

    // Подпись для баланса:
    // a. SHA256(hash={hash}&cashierpass={cashierpass}&dt={dt})
    const step1 = `hash=${cfg.hash}&cashierpass=${cfg.cashierpass}&dt=${formattedDt}`
    const sha1 = crypto.createHash('sha256').update(step1).digest('hex')

    // b. MD5(dt={dt}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
    const step2 = `dt=${formattedDt}&cashierpass=${cfg.cashierpass}&cashdeskid=${cfg.cashdeskid}`
    const md5Hash = crypto.createHash('md5').update(step2).digest('hex')

    // c. SHA256(результаты a и b объединены)
    const combined = sha1 + md5Hash
    const sign = crypto.createHash('sha256').update(combined).digest('hex')

    const url = `https://partners.servcul.com/CashdeskBotAPI/Cashdesk/${cfg.cashdeskid}/Balance?confirm=${confirm}&dt=${formattedDt}`
    
    // Добавляем Basic Auth (как в melbet_client.py)
    const authString = `${cfg.login}:${cfg.cashierpass}`
    const authBase64 = Buffer.from(authString).toString('base64')
    const authHeader = `Basic ${authBase64}`
    
    const headers = {
      sign,
      Authorization: authHeader
    }

    const response = await fetch(url, { headers, method: 'GET' })

    if (response.ok) {
      const data = await response.json()
      console.log(`📊 ${casino} API response:`, JSON.stringify(data))
      
      // Проверяем, что данные есть и правильно парсим
      if (data) {
        // Парсим Balance (может быть строкой или числом)
        const balanceValue = data.Balance ?? data.balance ?? 0
        const balance = typeof balanceValue === 'string' ? parseFloat(balanceValue) : (typeof balanceValue === 'number' ? balanceValue : 0)
        
        // Парсим Limit (может быть строкой или числом)
        const limitValue = data.Limit ?? data.limit ?? 0
        const limit = typeof limitValue === 'string' ? parseFloat(limitValue) : (typeof limitValue === 'number' ? limitValue : 0)
        
        console.log(`✅ ${casino}: Balance=${balance}, Limit=${limit} (raw: Balance=${data.Balance}, Limit=${data.Limit})`)
        return {
          balance: isNaN(balance) ? 0 : balance,
          limit: isNaN(limit) ? 0 : limit,
        }
      }
    } else {
      console.error(`❌ ${casino} API error: ${response.status} ${response.statusText}`)
      const text = await response.text()
      console.error(`Response:`, text)
    }
  } catch (error) {
    console.error(`❌ Error getting ${casino} balance:`, error)
  }

  return { balance: 0, limit: 0 }
}

/**
 * Получение баланса через Mostbet API (лимит недоступен)
 */
async function getMostbetBalance(cfg: MostbetConfig): Promise<BalanceResult> {
  try {
    const crypto = require('crypto')

    // Получаем timestamp в UTC в формате YYYY-MM-DD HH:MM:SS (UTC+0)
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const hours = String(now.getUTCHours()).padStart(2, '0')
    const minutes = String(now.getUTCMinutes()).padStart(2, '0')
    const seconds = String(now.getUTCSeconds()).padStart(2, '0')
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

    // Убеждаемся, что cashpoint_id - строка (как в Django)
    // Если cashpoint_id содержит буквы (например "F125160"), используем как есть
    // Если это число, преобразуем в строку
    let cashpointIdStr = String(cfg.cashpoint_id)
    
    // Если cashpoint_id начинается с буквы (например "F125160"), возможно API ожидает только числовую часть
    // Но в Django используется как есть, так что оставляем как есть
    // Если проблема сохранится, можно попробовать извлечь числовую часть:
    // const numericMatch = cashpointIdStr.match(/\d+/)
    // if (numericMatch) cashpointIdStr = numericMatch[0]
    
    // Путь для подписи (как в Django: path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/balance")
    const path = `/mbc/gateway/v1/api/cashpoint/${cashpointIdStr}/balance`
    // URL для запроса (как в Django: url = f"{self.base_url}/cashpoint/{self.cashpoint_id}/balance")
    // где base_url = "https://apimb.com/mbc/gateway/v1/api"
    const url = `https://apimb.com/mbc/gateway/v1/api/cashpoint/${cashpointIdStr}/balance`

    // Подпись: HMAC SHA3-256 от <API_KEY><PATH><REQUEST_BODY><TIMESTAMP>
    // Для GET запросов REQUEST_BODY пустой
    const signString = `${cfg.api_key}${path}${timestamp}`
    
    // Используем SHA3-256 согласно документации Mostbet API
    // В Node.js 18+ поддерживается sha3-256, но может называться по-разному
    let signature: string
    try {
      // Пробуем разные варианты названия алгоритма
      const algorithms = ['sha3-256', 'SHA3-256', 'sha3_256']
      let hmac: any = null
      
      for (const algo of algorithms) {
        try {
          hmac = crypto.createHmac(algo, cfg.secret)
          break
        } catch (e) {
          // Пробуем следующий вариант
          continue
        }
      }
      
      if (!hmac) {
        throw new Error('SHA3-256 not supported')
      }
      
      signature = hmac.update(signString).digest('hex')
      console.log(`[Mostbet Balance] Using SHA3-256 for signature`)
    } catch (e: any) {
      // Если SHA3-256 не поддерживается, используем библиотеку crypto-js или выводим ошибку
      console.error(`❌ SHA3-256 not available: ${e.message}`)
      console.error(`❌ Mostbet API requires SHA3-256. Please use Node.js 18+ or install crypto-js library.`)
      // Не используем SHA256 fallback - это не будет работать с реальным API
      throw new Error('SHA3-256 is required for Mostbet API but not available')
    }

    const headers = {
      'X-Api-Key': cfg.api_key,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
      'Content-Type': 'application/json',
      'Accept': '*/*',
    }

    console.log(`[Mostbet Balance] Request details:`, {
      cashpoint_id_original: cfg.cashpoint_id,
      cashpoint_id_type: typeof cfg.cashpoint_id,
      cashpoint_id_string: cashpointIdStr,
      url,
      path,
      timestamp,
      signString: `${signString.substring(0, 80)}...`,
      signature: `${signature.substring(0, 20)}...`,
      headers: {
        'X-Api-Key': cfg.api_key.substring(0, 30) + '...',
        'X-Timestamp': timestamp,
        'X-Signature': signature.substring(0, 20) + '...',
      }
    })

    const response = await fetch(url, { headers, method: 'GET' })

    console.log(`[Mostbet Balance] Response status: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const data = await response.json()
      console.log(`📊 Mostbet API response:`, JSON.stringify(data))
      
      if (data) {
        // Парсим balance (может быть строкой или числом)
        // Согласно Django коду, API возвращает {'balance': float, 'currency': str}
        const balanceValue = data.balance ?? data.Balance ?? 0
        const balance = typeof balanceValue === 'string' ? parseFloat(balanceValue) : (typeof balanceValue === 'number' ? balanceValue : 0)
        
        // Лимит недоступен в Mostbet Cash API (согласно Django коду)
        const limit = 0
        
        console.log(`✅ Mostbet: Balance=${balance}, Currency=${data.currency || 'N/A'} (raw: ${JSON.stringify(data)})`)
        return {
          balance: isNaN(balance) ? 0 : balance,
          limit: 0, // Лимит недоступен в Mostbet Cash API
        }
      }
    } else {
      const text = await response.text()
      console.error(`❌ Mostbet API error: ${response.status} ${response.statusText}`)
      console.error(`Response body:`, text)
      
      // Пытаемся распарсить ошибку
      try {
        const errorData = JSON.parse(text)
        console.error(`Error details:`, errorData)
      } catch (e) {
        // Не JSON ответ
      }
    }
  } catch (error) {
    console.error('❌ Error getting Mostbet balance:', error)
  }

  return { balance: 0, limit: 0 }
}

/**
 * Получение лимитов всех платформ
 */
export async function getPlatformLimits(): Promise<
  Array<{ key: string; name: string; limit: number }>
> {
  const limits: Array<{ key: string; name: string; limit: number }> = []

  try {
    // 1xbet
    const xbetCfg = CASHDESK_CONFIG['1xbet']
    if (xbetCfg.cashdeskid > 0) {
      const xbetBal = await getCashdeskBalance('1xbet', xbetCfg)
      console.log(`📊 1xbet result: balance=${xbetBal.balance}, limit=${xbetBal.limit}`)
      limits.push({ key: '1xbet', name: '1xbet', limit: xbetBal.limit })
    } else {
      limits.push({ key: '1xbet', name: '1xbet', limit: 0 })
    }

    // Melbet
    const melbetCfg = CASHDESK_CONFIG.melbet
    if (melbetCfg.cashdeskid > 0) {
      const melbetBal = await getCashdeskBalance('melbet', melbetCfg)
      console.log(`📊 Melbet result: balance=${melbetBal.balance}, limit=${melbetBal.limit}`)
      limits.push({ key: 'melbet', name: 'Melbet', limit: melbetBal.limit })
    } else {
      limits.push({ key: 'melbet', name: 'Melbet', limit: 0 })
    }

    // 1WIN (пока нет API)
    limits.push({ key: '1win', name: '1WIN', limit: 0 })

    // Mostbet
    const mostbetCfg = MOSTBET_CONFIG
    if (mostbetCfg.cashpoint_id && mostbetCfg.cashpoint_id.length > 0) {
      const mostbetBal = await getMostbetBalance(mostbetCfg)
      // Для Mostbet лимит недоступен в API, показываем 0
      limits.push({ key: 'mostbet', name: 'Mostbet', limit: mostbetBal.limit })
    } else {
      limits.push({ key: 'mostbet', name: 'Mostbet', limit: 0 })
    }
  } catch (error) {
    console.error('Error getting platform limits:', error)
    // Возвращаем нули если ошибка
    return [
      { key: '1xbet', name: '1xbet', limit: 0 },
      { key: 'melbet', name: 'Melbet', limit: 0 },
      { key: '1win', name: '1WIN', limit: 0 },
      { key: 'mostbet', name: 'Mostbet', limit: 0 },
    ]
  }

  return limits
}

