import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import { processWithdrawMobCash } from '@/lib/casino-withdraw'
import { getMobCashConfig } from '@/lib/deposit-balance'

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
    const body = await request.json()

    const { bookmaker, playerId, code, amount } = body

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

    // Для 1xbet используем mob-cash API
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

      // Выполняем вывод (mobile.withdrawal)
      const withdrawResult = await processWithdrawMobCash(
        playerId,
        parseFloat(amount),
        code,
        mobCashConfig
      )

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

      // Вывод выполнен успешно
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
    }

    // Для других казино возвращаем ошибку (пока не поддерживается)
    return NextResponse.json(
      createApiResponse(null, `Withdrawal execution for ${bookmaker} is not supported via this endpoint`),
      { 
        status: 400,
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

