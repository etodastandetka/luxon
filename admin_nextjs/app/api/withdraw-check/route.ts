import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import { processWithdraw, checkWithdrawAmountCashdesk } from '@/lib/casino-withdraw'
import { getCasinoConfig } from '@/lib/deposit-balance'
import { 
  protectAPI, 
  rateLimit, 
  sanitizeInput, 
  containsSQLInjection,
  getClientIP 
} from '@/lib/security'

/**
 * API для проверки суммы вывода и подтверждения вывода
 * POST /api/withdraw-check
 * Body: { bookmaker, playerId, code }
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    // 🛡️ МАКСИМАЛЬНАЯ ЗАЩИТА
    const protectionResult = protectAPI(request)
    if (protectionResult) {
      const response = NextResponse.json(
        createApiResponse(null, 'Forbidden'),
        { status: 403 }
      )
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    // Rate limiting (строгий для критичного endpoint)
    const rateLimitResult = rateLimit({ 
      maxRequests: 20, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `withdraw_check:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) {
      const response = NextResponse.json(
        createApiResponse(null, 'Rate limit exceeded'),
        { status: 429 }
      )
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    // Проверяем Content-Type
    const contentType = request.headers.get('content-type') || ''
    console.log(`[Withdraw Check] Content-Type: ${contentType}`)
    
    // Парсим тело запроса с обработкой ошибок
    let body: any
    try {
      if (!contentType.includes('application/json')) {
        console.error(`[Withdraw Check] Invalid Content-Type: ${contentType}, expected application/json`)
        return NextResponse.json(
          createApiResponse(null, 'Content-Type must be application/json'),
          { 
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }
      
      body = await request.json()
      console.log(`[Withdraw Check] Request body parsed successfully:`, {
        hasBookmaker: !!body.bookmaker,
        hasPlayerId: !!body.playerId,
        hasCode: !!body.code,
        codeLength: body.code?.length,
      })
    } catch (error: any) {
      console.error(`[Withdraw Check] Failed to parse request body:`, {
        error: error.message,
        contentType,
        errorName: error.name,
      })
      return NextResponse.json(
        createApiResponse(null, `Invalid JSON body: ${error.message}`),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // 🛡️ Валидация и очистка входных данных
    const sanitizedBody = sanitizeInput(body)
    const { bookmaker, playerId, code } = sanitizedBody

    // 🛡️ Проверка на SQL инъекции
    const stringFields = [bookmaker, playerId, code].filter(Boolean)
    for (const field of stringFields) {
      if (typeof field === 'string' && containsSQLInjection(field)) {
        console.warn(`🚫 SQL injection attempt from ${getClientIP(request)}`)
        const response = NextResponse.json(
          createApiResponse(null, 'Invalid input detected'),
          { status: 400 }
        )
        response.headers.set('Access-Control-Allow-Origin', '*')
        return response
      }
    }

    if (!bookmaker || !playerId || !code) {
      return NextResponse.json(
        createApiResponse(null, 'Missing required fields: bookmaker, playerId, code'),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    console.log(`[Withdraw Check] Bookmaker: ${bookmaker}, Player ID: ${playerId}, Code: ${code}`)

    // Получаем конфигурацию казино
    const normalizedBookmaker = bookmaker.toLowerCase()
    
    let config: any = null

    // 1xbet, Melbet, Winwin, 888starz используют Cashdesk API
    if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet' ||
        normalizedBookmaker.includes('melbet') || normalizedBookmaker === 'melbet' ||
        normalizedBookmaker.includes('winwin') || normalizedBookmaker === 'winwin' ||
        normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888') || normalizedBookmaker === '888starz') {
      
      // Определяем ключ конфигурации
      let configKey = ''
      if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet') {
        configKey = '1xbet_api_config'
      } else if (normalizedBookmaker.includes('melbet') || normalizedBookmaker === 'melbet') {
        configKey = 'melbet_api_config'
      } else if (normalizedBookmaker.includes('winwin')) {
        configKey = 'winwin_api_config'
      } else if (normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888') || normalizedBookmaker === '888starz') {
        configKey = '888starz_api_config'
      }

      const setting = await prisma.botConfiguration.findFirst({
        where: { key: configKey },
      })

      if (setting) {
        const settingConfig = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
        if (settingConfig.hash && settingConfig.cashierpass && settingConfig.login && settingConfig.cashdeskid) {
          config = {
            hash: settingConfig.hash,
            cashierpass: settingConfig.cashierpass,
            login: settingConfig.login,
            cashdeskid: String(settingConfig.cashdeskid),
          }
        }
      }

      // Fallback на переменные окружения
      if (!config) {
        config = await getCasinoConfig(bookmaker)
      }

      if (!config || !config.hash || !config.cashierpass || !config.cashdeskid) {
        return NextResponse.json(
          createApiResponse(null, `${bookmaker} API configuration not found. Please configure ${configKey} in database.`),
          { 
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      console.log(`[Withdraw Check] Calling checkWithdrawAmountCashdesk for ${bookmaker}`)
      console.log(`  - playerId: ${playerId}`)
      console.log(`  - code: ${code}`)
      
      const checkResult = await checkWithdrawAmountCashdesk(bookmaker, playerId, code, config)
      
      console.log(`[Withdraw Check] checkWithdrawAmountCashdesk result:`, {
        success: checkResult.success,
        amount: checkResult.amount,
        message: checkResult.message,
      })
      
      if (!checkResult.success) {
        return NextResponse.json(
          createApiResponse(null, checkResult.message || 'Код неверный или вывод не найден'),
          { 
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      // Проверяем, что сумма получена
      if (checkResult.amount === undefined || checkResult.amount === null || isNaN(checkResult.amount)) {
        return NextResponse.json(
          createApiResponse(null, 'Не удалось получить сумму ордера. Проверьте код и попробуйте еще раз.'),
          { 
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      // Для Cashdesk API метод Payout сразу выполняет вывод
      // Возвращаем флаг alreadyExecuted для 1xbet, Winwin, 888starz (как у других Cashdesk казино)
      const amount = Math.abs(checkResult.amount) // Сумма может быть отрицательной
      
      return NextResponse.json(
        createApiResponse(
          {
            amount: amount,
            alreadyExecuted: true, // Cashdesk API Payout сразу выполняет вывод
          },
          undefined, // error - нет ошибки
          'Withdrawal executed' // message - сообщение об успехе
        ),
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }


    // Для Mostbet
    if (normalizedBookmaker.includes('mostbet') || normalizedBookmaker === 'mostbet') {
      console.log(`[Withdraw Check] Mostbet detected, loading configuration...`)
      
      const setting = await prisma.botConfiguration.findFirst({
        where: { key: 'mostbet_api_config' },
      })

      if (setting) {
        const settingConfig = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
        if (settingConfig.api_key && settingConfig.secret && settingConfig.cashpoint_id) {
          config = {
            api_key: settingConfig.api_key,
            secret: settingConfig.secret,
            cashpoint_id: String(settingConfig.cashpoint_id),
          }
          console.log(`[Withdraw Check] Mostbet config loaded from database:`, {
            hasApiKey: !!config.api_key,
            hasSecret: !!config.secret,
            cashpointId: config.cashpoint_id,
            apiKeyPrefix: config.api_key?.substring(0, 20) + '...',
          })
        }
      }

      if (!config) {
        config = {
          api_key: process.env.MOSTBET_API_KEY || 'api-key:1b896249-f0dc-45ff-826e-4175c72d1e0e',
          secret: process.env.MOSTBET_SECRET || '73353b6b-868e-4561-9128-dce1c91bd24e',
          cashpoint_id: process.env.MOSTBET_CASHPOINT_ID || 'C92905',
        }
        console.log(`[Withdraw Check] Mostbet config loaded from environment:`, {
          hasApiKey: !!config.api_key,
          hasSecret: !!config.secret,
          cashpointId: config.cashpoint_id,
          apiKeyPrefix: config.api_key?.substring(0, 20) + '...',
        })
      }

      console.log(`[Withdraw Check] Calling processWithdraw for Mostbet:`, {
        bookmaker,
        playerId,
        codeLength: code?.length,
        hasConfig: !!config,
      })
    }

    // Для 1win
    if (normalizedBookmaker.includes('1win') || normalizedBookmaker === '1win') {
      const setting = await prisma.botConfiguration.findFirst({
        where: { key: '1win_api_config' },
      })

      if (setting) {
        const settingConfig = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
        if (settingConfig.api_key) {
          config = {
            api_key: settingConfig.api_key,
          }
        }
      }

      if (!config) {
        config = {
          api_key: process.env.ONEWIN_API_KEY || 'f69190bced227b4d2ee16f614c64f777d1414435570efb430a6008242da0244c',
        }
      }
    }

    if (!config) {
      return NextResponse.json(
        createApiResponse(null, `Unsupported bookmaker or missing configuration: ${bookmaker}`),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Проверяем вывод через API казино
    console.log(`[Withdraw Check] Calling processWithdraw:`, {
      bookmaker,
      playerId,
      codeLength: code?.length,
      hasConfig: !!config,
      configKeys: config ? Object.keys(config) : [],
    })
    
    const result = await processWithdraw(bookmaker, playerId, code, config)

    console.log(`[Withdraw Check] processWithdraw result:`, {
      success: result.success,
      amount: result.amount,
      transactionId: result.transactionId,
      message: result.message,
      hasError: !!result.message,
    })

    if (!result.success) {
      console.error(`[Withdraw Check] processWithdraw failed:`, {
        message: result.message,
        bookmaker,
        playerId,
        codeLength: code?.length,
      })
      return NextResponse.json(
        createApiResponse(null, result.message || 'Failed to check withdrawal'),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Для 1xbet, 888starz и Winwin вывод уже выполнен на этом этапе (Cashdesk API Payout сразу выполняет вывод)
    // Для остальных казино вывод будет выполнен позже
    const isAlreadyExecuted = normalizedBookmaker.includes('1xbet') || 
                              normalizedBookmaker === '1xbet' ||
                              normalizedBookmaker.includes('888starz') || 
                              normalizedBookmaker.includes('888') || 
                              normalizedBookmaker === '888starz' ||
                              normalizedBookmaker.includes('winwin') ||
                              normalizedBookmaker === 'winwin'

    console.log(`[Withdraw Check] Result:`, {
      success: result.success,
      amount: result.amount,
      transactionId: result.transactionId,
      message: result.message,
      isAlreadyExecuted,
      bookmaker: normalizedBookmaker
    })

    // Проверяем, что amount есть и является валидным числом
    // amount должен быть больше 0 (уже взято абсолютное значение в checkWithdrawAmountCashdesk)
    if (!result.amount || result.amount <= 0 || (typeof result.amount === 'number' && isNaN(result.amount))) {
      console.error(`[Withdraw Check] Amount is missing or invalid:`, {
        amount: result.amount,
        type: typeof result.amount,
        isNaN: typeof result.amount === 'number' ? isNaN(result.amount) : 'N/A (not a number)',
        fullResult: result
      })
      return NextResponse.json(
        createApiResponse(null, 'Не удалось получить сумму вывода. Проверьте код и попробуйте еще раз.'),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    const responseData = createApiResponse(
      {
        amount: result.amount,
        transactionId: result.transactionId,
        message: result.message,
        alreadyExecuted: isAlreadyExecuted, // Флаг, что вывод уже выполнен
      },
      undefined, // error - нет ошибки
      isAlreadyExecuted ? 'Withdrawal executed successfully' : 'Withdrawal checked successfully' // message - сообщение об успехе
    )

    console.log(`[Withdraw Check] Response data:`, JSON.stringify(responseData, null, 2))

    return NextResponse.json(
      responseData,
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  } catch (error: any) {
    console.error('❌ Error checking withdrawal:', error)
    return NextResponse.json(
      createApiResponse(null, `Error: ${error.message}`),
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }
}

