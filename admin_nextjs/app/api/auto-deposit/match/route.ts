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
 * API endpoint для ручного запуска сопоставления платежей
 * POST /api/auto-deposit/match
 * Body: { paymentId } или пустой для проверки всех необработанных платежей
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

/**
 * Функция для сопоставления входящего платежа с заявкой и автоматического пополнения
 */
async function matchAndProcessPayment(paymentId: number, amount: number) {
  // Ищем заявки на пополнение со статусом pending за последние 5 минут
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  // Ищем заявки с точным совпадением суммы (с точностью до копеек)
  // ВАЖНО: Исключаем заявки, которые уже имеют связанный платеж (requestId в IncomingPayment)
  const matchingRequests = await prisma.request.findMany({
    where: {
      requestType: 'deposit',
      status: 'pending',
      createdAt: {
        gte: fiveMinutesAgo,
      },
      // Исключаем заявки, которые уже имеют связанный обработанный платеж
      incomingPayments: {
        none: {
          isProcessed: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc', // Берем самую старую заявку (первую по времени)
    },
    include: {
      incomingPayments: {
        where: {
          isProcessed: true,
        },
      },
    },
  })

  // Фильтруем вручную, т.к. Prisma может иметь проблемы с точным сравнением Decimal
  // И дополнительно проверяем, что у заявки нет обработанных платежей
  const exactMatches = matchingRequests.filter((req) => {
    // Пропускаем заявки, у которых уже есть обработанный платеж
    if (req.incomingPayments && req.incomingPayments.length > 0) {
      return false
    }
    
    if (!req.amount) return false
    const reqAmount = parseFloat(req.amount.toString())
    return Math.abs(reqAmount - amount) < 0.01 // Точность до 1 копейки
  })

  if (exactMatches.length === 0) {
    return null
  }

  // Берем самую первую заявку (самую старую по времени создания)
  const request = exactMatches[0]
  
  // Дополнительная проверка: убеждаемся, что платеж еще не обработан
  const existingProcessedPayment = await prisma.incomingPayment.findFirst({
    where: {
      id: paymentId,
      isProcessed: true,
    },
  })
  
  if (existingProcessedPayment) {
    console.log(`⚠️ Payment ${paymentId} is already processed, skipping`)
    return null
  }

  if (!request.accountId || !request.bookmaker) {
    return null
  }

  // Обновляем статус платежа - связываем с заявкой
  await prisma.incomingPayment.update({
    where: { id: paymentId },
    data: {
      requestId: request.id,
      isProcessed: true,
    },
  })

  // Пополняем баланс через казино API
  try {
    const { depositToCasino } = await import('@/lib/deposit-balance')
    const depositResult = await depositToCasino(
      request.bookmaker!,
      request.accountId,
      parseFloat(request.amount?.toString() || '0')
    )

    if (!depositResult.success) {
      throw new Error(depositResult.message || 'Deposit failed')
    }

    // Успешное пополнение - обновляем статус заявки
    // processedBy = "автопополнение" означает что заявка закрыта автоматически
    const updatedRequest = await prisma.request.update({
      where: { id: request.id },
      data: {
        status: 'completed',
        statusDetail: null,
        processedBy: 'автопополнение' as any,
        processedAt: new Date(),
        updatedAt: new Date(),
      } as any,
    })

    // Отправляем уведомление пользователю о успешном автопополнении
    const amount = updatedRequest.amount ? parseFloat(updatedRequest.amount.toString()).toFixed(2) : '0.00'
    const bookmaker = updatedRequest.bookmaker || 'казино'
    const notificationMessage = `✅ <b>Ваша заявка успешно обработана!</b>\n\n` +
      `💰 Сумма: ${amount} сом\n` +
      `🎰 Казино: ${bookmaker}\n\n` +
      `Ваш баланс пополнен. Спасибо за использование нашего сервиса!`
    
    sendTelegramNotification(updatedRequest.userId, notificationMessage).catch(err => {
      console.error('Failed to send notification:', err)
    })

    return {
      requestId: request.id,
      success: true,
    }
  } catch (error: any) {
    // В случае ошибки API казино, оставляем статус pending для ручной обработки
    // processedBy не устанавливаем, т.к. заявка не закрыта
    console.error(`❌ Auto-deposit failed for request ${request.id}:`, error)
    throw error
  }
}

