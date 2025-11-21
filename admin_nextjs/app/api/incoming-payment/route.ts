import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

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
    // Вызываем СИНХРОННО для мгновенного автопополнения (секунда в секунду)
    // Используем await чтобы гарантировать что автопополнение произошло до ответа
    try {
      const result = await matchAndProcessPayment(incomingPayment.id, parseFloat(amount))
      if (result && result.success) {
        console.log(`✅ [Incoming Payment] Auto-deposit completed instantly for payment ${incomingPayment.id}, request ${result.requestId}`)
      } else {
        console.log(`ℹ️ [Incoming Payment] No matching request for payment ${incomingPayment.id} (amount: ${amount})`)
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

/**
 * Функция для сопоставления входящего платежа с заявкой и автоматического пополнения
 */
async function matchAndProcessPayment(paymentId: number, amount: number) {
  try {
    console.log(`🔍 [Auto-Deposit] matchAndProcessPayment called: paymentId=${paymentId}, amount=${amount}`)
  } catch (err) {
    console.error(`❌ [Auto-Deposit] Error in matchAndProcessPayment start:`, err)
  }
  
  // Ищем заявки на пополнение со статусом pending за последние 24 часа
  // Увеличено до 24 часов, чтобы охватить заявки которые могут прийти с задержкой
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Оптимизированный поиск заявок - минимум запросов для максимальной скорости
  const matchingRequests = await prisma.request.findMany({
    where: {
      requestType: 'deposit',
      status: 'pending',
      createdAt: { gte: twentyFourHoursAgo },
      incomingPayments: { none: { isProcessed: true } },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      accountId: true,
      bookmaker: true,
      amount: true,
      status: true,
      incomingPayments: { select: { id: true, isProcessed: true } },
    },
  })

  // Быстрая фильтрация по точному совпадению суммы
  const exactMatches = matchingRequests.filter((req) => {
    if (req.status !== 'pending' || !req.amount) return false
    const reqAmount = parseFloat(req.amount.toString())
    return Math.abs(reqAmount - amount) < 0.01 // Точность до 1 копейки
  })

  if (exactMatches.length === 0) {
    return null
  }


  // Берем самую первую заявку (самую старую по времени создания)
  const request = exactMatches[0]
  
  // Быстрая проверка обязательных полей
  if (!request.accountId || !request.bookmaker || !request.amount) {
    console.error(`❌ [Auto-Deposit] Request ${request.id} missing required fields`)
    return null
  }

  const requestAmount = parseFloat(request.amount.toString())
  
  console.log(`💸 [Auto-Deposit] Processing: Request ${request.id}, ${request.bookmaker}, Account ${request.accountId}, Amount ${requestAmount}`)

  // Оптимизированная обработка: все в одной транзакции для максимальной скорости
  try {
    const { depositToCasino } = await import('@/lib/deposit-balance')
    
    // Сразу пополняем баланс через казино API (самое важное - делаем мгновенно)
    const depositResult = await depositToCasino(
      request.bookmaker,
      request.accountId,
      requestAmount,
      request.id
    )

    if (!depositResult.success) {
      console.error(`❌ [Auto-Deposit] Deposit failed: ${depositResult.message}`)
      throw new Error(depositResult.message || 'Deposit failed')
    }
    
    // После успешного пополнения - атомарно обновляем все в одной транзакции
    await prisma.$transaction(async (tx) => {
      // Проверяем что заявка все еще pending и платеж не обработан
      const [currentRequest, currentPayment] = await Promise.all([
        tx.request.findUnique({
          where: { id: request.id },
          select: { status: true },
        }),
        tx.incomingPayment.findUnique({
          where: { id: paymentId },
          select: { isProcessed: true },
        }),
      ])
      
      // Если уже обработано - пропускаем
      if (currentRequest?.status !== 'pending' || currentPayment?.isProcessed) {
        return
      }
      
      // Обновляем заявку и платеж атомарно
      await Promise.all([
        tx.request.update({
          where: { id: request.id },
          data: {
            status: 'autodeposit_success',
            statusDetail: null,
            processedBy: 'автопополнение' as any,
            processedAt: new Date(),
            updatedAt: new Date(),
          } as any,
        }),
        tx.incomingPayment.update({
          where: { id: paymentId },
          data: {
            requestId: request.id,
            isProcessed: true,
          },
        }),
      ])
    })
    
    console.log(`✅ [Auto-Deposit] SUCCESS: Request ${request.id} → autodeposit_success`)

    return {
      requestId: request.id,
      success: true,
    }
  } catch (error: any) {
    console.error(`❌ [Auto-Deposit] FAILED for request ${request.id}:`, error.message)
    throw error
  }
}

