import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import { matchAndProcessPayment } from '@/lib/auto-deposit'

// Функция для отправки уведомления пользователю в Telegram
async function sendTelegramNotification(userId: bigint, message: string) {
  try {
    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      console.warn('⚠️ BOT_TOKEN not configured, skipping Telegram notification')
      return
    }

    const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    const response = await fetch(sendMessageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId.toString(),
        text: message,
        parse_mode: 'HTML',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Failed to send Telegram notification:', errorData)
      return
    }

    const data = await response.json()
    if (data.ok) {
      console.log(`✅ Telegram notification sent to user ${userId}`)
    }
  } catch (error) {
    console.error('❌ Error sending Telegram notification:', error)
  }
}

/**
 * API endpoint для ручного запуска сопоставления платежей
 * POST /api/auto-deposit/match
 * Body: { paymentId } или пустой для проверки всех необработанных платежей
 * 
 * ВАЖНО: Использует функцию matchAndProcessPayment из ../../lib/auto-deposit
 * Это гарантирует что автопополнение работает только в одном месте
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentId } = body

    if (paymentId) {
      // Обрабатываем конкретный платеж
      const payment = await prisma.incomingPayment.findUnique({
        where: { id: paymentId },
      })

      if (!payment) {
        return NextResponse.json(
          createApiResponse(null, 'Payment not found'),
          { status: 404 }
        )
      }

      if (payment.isProcessed) {
        return NextResponse.json(
          createApiResponse(null, 'Payment already processed'),
          { status: 400 }
        )
      }

      // Используем функцию из ../../lib/auto-deposit - ЕДИНСТВЕННОЕ место автопополнения
      const result = await matchAndProcessPayment(paymentId, parseFloat(payment.amount.toString()))
      return NextResponse.json(createApiResponse(result, 'Processing completed'))
    } else {
      // Проверяем все необработанные платежи за последний час
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const unprocessedPayments = await prisma.incomingPayment.findMany({
        where: {
          isProcessed: false,
          paymentDate: {
            gte: oneHourAgo,
          },
        },
        orderBy: {
          paymentDate: 'desc',
        },
      })

      const results = []
      for (const payment of unprocessedPayments) {
        try {
          // Используем функцию из ../../lib/auto-deposit - ЕДИНСТВЕННОЕ место автопополнения
          const result = await matchAndProcessPayment(
            payment.id,
            parseFloat(payment.amount.toString())
          )
          results.push({ paymentId: payment.id, result })
        } catch (error: any) {
          results.push({ paymentId: payment.id, error: error.message })
        }
      }

      return NextResponse.json(
        createApiResponse(
          {
            processed: results.filter((r) => !r.error).length,
            failed: results.filter((r) => r.error).length,
            results,
          },
          'Batch processing completed'
        )
      )
    }
  } catch (error: any) {
    console.error('❌ Error in auto-deposit match:', error)
    return NextResponse.json(
      createApiResponse(null, `Error: ${error.message}`),
      { status: 500 }
    )
  }
}
