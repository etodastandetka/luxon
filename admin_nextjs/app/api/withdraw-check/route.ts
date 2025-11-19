import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import { processWithdraw, checkWithdrawAmountMobCash } from '@/lib/casino-withdraw'
import { getMobCashConfig } from '@/lib/deposit-balance'

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
    const body = await request.json()

    const { bookmaker, playerId, code } = body

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

    // Для 1xbet используем mob-cash API (новый API в 2 шага)
    if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet') {
      const mobCashConfig = await getMobCashConfig(bookmaker)
      
      if (!mobCashConfig || !mobCashConfig.login || !mobCashConfig.password || !mobCashConfig.cashdesk_id) {
        return NextResponse.json(
          createApiResponse(null, '1xbet mob-cash API configuration not found. Please configure 1xbet_mobcash_config in database or set MOBCASH_* environment variables.'),
          { 
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      // Только проверяем код и получаем сумму ордера (mobile.getWithdrawalAmount)
      // Выполнение вывода (mobile.withdrawal) будет в confirm странице
      console.log(`[Withdraw Check] Calling checkWithdrawAmountMobCash with:`)
      console.log(`  - playerId: ${playerId} (type: ${typeof playerId})`)
      console.log(`  - code: ${code} (type: ${typeof code})`)
      console.log(`  - mobCashConfig:`, {
        login: mobCashConfig.login,
        cashdesk_id: mobCashConfig.cashdesk_id,
        has_bearer_token: !!mobCashConfig.bearer_token,
        has_user_id: !!mobCashConfig.user_id,
        has_session_id: !!mobCashConfig.session_id,
        default_lat: mobCashConfig.default_lat,
        default_lon: mobCashConfig.default_lon,
      })
      
      const checkResult = await checkWithdrawAmountMobCash(playerId, code, mobCashConfig)
      
      console.log(`[Withdraw Check] checkWithdrawAmountMobCash result:`, {
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
      if (!checkResult.amount || checkResult.amount <= 0) {
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

      // Возвращаем только сумму ордера (без выполнения вывода)
      return NextResponse.json(
        createApiResponse(
          {
            amount: checkResult.amount,
            message: 'Сумма ордера получена. Подтвердите вывод для выполнения операции.',
          },
          'Withdrawal amount retrieved'
        ),
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // 888starz использует Cashdesk API
    if (normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888') || normalizedBookmaker === '888starz') {
      const setting = await prisma.botConfiguration.findFirst({
        where: { key: '888starz_api_config' },
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

      if (!config) {
        config = {
          hash: process.env['888STARZ_HASH'] || '6e978b90d2e3d7010390c680cf036b49e521bf91e32839021db8c3637f1cbc56',
          cashierpass: process.env['888STARZ_CASHIERPASS'] || 'ydsuHiK^',
          login: process.env['888STARZ_LOGIN'] || 'burgoevka',
          cashdeskid: process.env['888STARZ_CASHDESKID'] || '1416358',
        }
      }

      // Для 888starz метод Payout сразу выполняет вывод и возвращает summa
      // Вызываем checkWithdrawAmountCashdesk, который выполнит вывод и вернет сумму
      const { checkWithdrawAmountCashdesk } = await import('@/lib/casino-withdraw')
      const checkResult = await checkWithdrawAmountCashdesk(bookmaker, playerId, code, config)
      
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
      if (!checkResult.amount || checkResult.amount <= 0) {
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

      // Для 888starz вывод уже выполнен на этом этапе (Payout сразу выполняет вывод)
      // Возвращаем сумму для создания заявки
      return NextResponse.json(
        createApiResponse(
          {
            amount: checkResult.amount,
            message: 'Вывод выполнен успешно. Создайте заявку для подтверждения.',
            alreadyExecuted: true, // Флаг, что вывод уже выполнен
          },
          undefined, // error
          'Withdrawal executed successfully' // message
        ),
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    if (normalizedBookmaker.includes('melbet') || normalizedBookmaker === 'melbet') {
      const setting = await prisma.botConfiguration.findFirst({
        where: { key: 'melbet_api_config' },
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

      if (!config) {
        config = {
          hash: process.env.MELBET_HASH || 'f788cc308d9de930b292873b2cf79526da363cb24a85883575426cc7f3c4553d',
          cashierpass: process.env.MELBET_CASHIERPASS || '3nKS3!b7',
          login: process.env.MELBET_LOGIN || 'burgoevk',
          cashdeskid: process.env.MELBET_CASHDESKID || '1415842',
        }
      }
    }

    if (normalizedBookmaker.includes('winwin') || normalizedBookmaker === 'winwin') {
      const setting = await prisma.botConfiguration.findFirst({
        where: { key: 'winwin_api_config' },
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

      if (!config) {
        config = {
          hash: process.env.WINWIN_HASH || 'ca4c49cea830e2fbebf7e3894659df1cd74abb2e0e79d58b17ecf82ea148cf2d',
          cashierpass: process.env.WINWIN_CASHIERPASS || 'yYRbyQeX',
          login: process.env.WINWIN_LOGIN || 'burgoevkan',
          cashdeskid: process.env.WINWIN_CASHDESKID || '1416579',
        }
      }
    }

    // Для Mostbet
    if (normalizedBookmaker.includes('mostbet') || normalizedBookmaker === 'mostbet') {
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
        }
      }

      if (!config) {
        config = {
          api_key: process.env.MOSTBET_API_KEY || 'api-key:62e9da4c-52e3-4d0f-b579-c9e7805f711d',
          secret: process.env.MOSTBET_SECRET || '94f63f7e-b7ff-4ef9-bccc-d05efa22301d',
          cashpoint_id: process.env.MOSTBET_CASHPOINT_ID || 'C131864',
        }
      }
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
    const result = await processWithdraw(bookmaker, playerId, code, config)

    if (!result.success) {
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

    return NextResponse.json(
      createApiResponse(
        {
          amount: result.amount,
          transactionId: result.transactionId,
          message: result.message,
        },
        'Withdrawal checked successfully'
      ),
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

