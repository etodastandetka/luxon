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

    // Для 1xbet и 888starz используем mob-cash API
    if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet' ||
        normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888') || normalizedBookmaker === '888starz') {
      const mobCashConfig = await getMobCashConfig(bookmaker)
      
      if (!mobCashConfig || !mobCashConfig.login || !mobCashConfig.password || !mobCashConfig.cashdesk_id) {
        return NextResponse.json(
          createApiResponse(null, `${bookmaker} mob-cash API configuration not found. Please configure ${normalizedBookmaker.includes('888') ? '888starz' : '1xbet'}_mobcash_config in database or set MOBCASH_* environment variables.`),
          { 
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      // Используем mob-cash API для проверки суммы вывода
      const result = await checkWithdrawAmountMobCash(playerId, code, mobCashConfig)
      
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

