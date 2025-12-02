import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { createApiResponse } from '../../../../lib/api-helpers'
import { matchAndProcessPayment } from '../../../../lib/auto-deposit'

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
 * API endpoint для сохранения входящих платежей из email watcher или Android приложения
 * POST /api/incoming-payment
 * Body: { amount, bank, paymentDate, notificationText }
 */

// CORS handler
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { amount, bank, paymentDate, notificationText } = body

    if (!amount) {
      return NextResponse.json(
        createApiResponse(null, 'Amount is required'),
        { status: 400 }
      )
    }

    // Создаем запись о входящем платеже
    const incomingPayment = await prisma.incomingPayment.create({
      data: {
        amount: parseFloat(amount),
        bank: bank || null,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        notificationText: notificationText || null,
        isProcessed: false,
      },
    })

    console.log(`✅ IncomingPayment saved: ID ${incomingPayment.id}, Amount: ${amount} ${bank || ''}`)
    console.log(`🔍 [Incoming Payment] Starting auto-match for payment ${incomingPayment.id}, amount: ${amount}`)

    // Пытаемся найти совпадение по сумме и автоматически пополнить баланс
    // Ищем только заявки созданные за последние 5 минут чтобы избежать случайного пополнения
    // Вызываем СИНХРОННО для мгновенного автопополнения (секунда в секунду)
    // Используем await чтобы гарантировать что автопополнение произошло до ответа
    try {
      const result = await matchAndProcessPayment(incomingPayment.id, parseFloat(amount))
      if (result && result.success) {
        console.log(`✅ [Incoming Payment] Auto-deposit completed instantly for payment ${incomingPayment.id}, request ${result.requestId}`)
      } else {
        console.log(`ℹ️ [Incoming Payment] No matching request (last 5 min) for payment ${incomingPayment.id} (amount: ${amount})`)
      }
    } catch (error: any) {
      console.error(`❌ [Incoming Payment] Auto-match failed for payment ${incomingPayment.id}:`, error.message)
      // Не возвращаем ошибку, т.к. платеж уже сохранен и может быть обработан вручную
    }

    const response = NextResponse.json(
      createApiResponse(
        {
          id: incomingPayment.id,
          amount: incomingPayment.amount.toString(),
          bank: incomingPayment.bank,
          paymentDate: incomingPayment.paymentDate.toISOString(),
        },
        'Incoming payment saved'
      )
    )
    
    // Добавляем CORS заголовки
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    return response
  } catch (error: any) {
    console.error('❌ Error saving incoming payment:', error)
    const errorResponse = NextResponse.json(
      createApiResponse(null, `Error: ${error.message}`),
      { status: 500 }
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}
