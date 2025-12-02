import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import { processWithdraw, checkWithdrawAmountCashdesk } from '@/lib/casino-withdraw'
import { getCasinoConfig } from '@/lib/deposit-balance'
import { rateLimit, sanitizeInput, containsSQLInjection, getClientIP } from '@/lib/security'

/**
 * API для выполнения вывода средств (mobile.withdrawal)
 * POST /api/withdraw-execute
 * Body: { bookmaker, playerId, code, amount }
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
    // 🛡️ Rate limiting для withdraw-execute (критичный endpoint)
    const rateLimitResult = rateLimit({ 
      maxRequests: 20, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `withdraw:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) {
      return NextResponse.json(
        createApiResponse(null, 'Rate limit exceeded'),
        { 
          status: 429,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    const body = await request.json()

    // 🛡️ Валидация и очистка входных данных
    const sanitizedBody = sanitizeInput(body)
    const { bookmaker, playerId, code, amount } = sanitizedBody

    // 🛡️ Проверка на SQL инъекции
    const stringFields = [bookmaker, playerId, code].filter(Boolean)
    for (const field of stringFields) {
      if (typeof field === 'string' && containsSQLInjection(field)) {
        console.warn(`🚫 SQL injection attempt from ${getClientIP(request)}`)
        return NextResponse.json(
          createApiResponse(null, 'Invalid input detected'),
          { 
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }
    }

    if (!bookmaker || !playerId || !code || !amount) {
      return NextResponse.json(
        createApiResponse(null, 'Missing required fields: bookmaker, playerId, code, amount'),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    console.log(`[Withdraw Execute] Bookmaker: ${bookmaker}, Player ID: ${playerId}, Code: ${code}, Amount: ${amount}`)

    const normalizedBookmaker = bookmaker.toLowerCase()

    // 1xbet, Melbet, Winwin, 888starz используют Cashdesk API
    // Для Cashdesk API метод Payout уже выполнил вывод на этапе check
    // Этот endpoint используется только для других казино, которые требуют отдельного выполнения
    if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet' ||
        normalizedBookmaker.includes('melbet') || normalizedBookmaker === 'melbet' ||
        normalizedBookmaker.includes('winwin') || normalizedBookmaker === 'winwin' ||
        normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888') || normalizedBookmaker === '888starz') {
      
      // Для Cashdesk API вывод уже выполнен на этапе check
      return NextResponse.json(
        createApiResponse(
          {
            amount: parseFloat(amount),
            alreadyExecuted: true,
          },
          undefined, // no error
          'Withdrawal already executed'
        ),
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Для других казино (Mostbet, 1win и т.д.) может потребоваться отдельное выполнение
    const config = await getCasinoConfig(bookmaker)
    
    if (!config) {
      return NextResponse.json(
        createApiResponse(null, `${bookmaker} API configuration not found`),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    const withdrawResult = await processWithdraw(bookmaker, playerId, code, config)

    if (!withdrawResult.success) {
      return NextResponse.json(
        createApiResponse(null, withdrawResult.message || 'Ошибка выполнения вывода'),
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
          amount: withdrawResult.amount,
          message: withdrawResult.message || 'Вывод выполнен успешно',
        },
        'Withdrawal executed successfully'
      ),
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  } catch (error: any) {
    console.error('❌ Error executing withdrawal:', error)
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

