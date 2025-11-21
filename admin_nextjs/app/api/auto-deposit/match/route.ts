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
  // Ищем заявки на пополнение со статусом pending за последние 24 часа
  // Увеличено до 24 часов, чтобы охватить заявки которые могут прийти с задержкой
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  
  console.log(`🔍 [Auto-Deposit] Matching payment ${paymentId}: looking for requests with amount ${amount} created after ${twentyFourHoursAgo.toISOString()}`)
  console.log(`🔍 [Auto-Deposit] Payment amount: ${amount}, type: ${typeof amount}`)

  // Ищем заявки с точным совпадением суммы (с точностью до копеек)
  // ВАЖНО: Исключаем заявки, которые уже имеют связанный обработанный платеж
  // Также исключаем заявки которые уже не в статусе pending (на случай race condition)
  const matchingRequests = await prisma.request.findMany({
    where: {
      requestType: 'deposit',
      status: 'pending', // Только ожидающие заявки
      createdAt: {
        gte: twentyFourHoursAgo,
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
    select: {
      id: true,
      userId: true,
      accountId: true,
      bookmaker: true,
      amount: true,
      status: true,
      createdAt: true,
      incomingPayments: {
        // Включаем ВСЕ платежи для проверки
        select: {
          id: true,
          isProcessed: true,
          requestId: true,
        },
      },
    },
  })

  console.log(`📋 [Auto-Deposit] Found ${matchingRequests.length} pending deposit requests in the last 24 hours (without processed payments)`)
  
  // Логируем детали найденных заявок для отладки
  if (matchingRequests.length > 0) {
    console.log(`📋 [Auto-Deposit] Request details:`, matchingRequests.map(r => ({
      id: r.id,
      amount: r.amount?.toString(),
      accountId: r.accountId,
      bookmaker: r.bookmaker,
      createdAt: r.createdAt,
      hasProcessedPayments: r.incomingPayments?.length > 0
    })))
  }

  // Фильтруем вручную, т.к. Prisma может иметь проблемы с точным сравнением Decimal
  // И дополнительно проверяем, что у заявки нет обработанных платежей
  const exactMatches = matchingRequests.filter((req) => {
    // Дополнительная проверка: убеждаемся что заявка все еще в статусе pending
    // (на случай race condition если другой процесс уже обновил статус)
    if (req.status !== 'pending') {
      console.log(`⚠️ [Auto-Deposit] Request ${req.id} is no longer pending (status: ${req.status}), skipping`)
      return false
    }
    
    // Пропускаем заявки, у которых уже есть обработанный платеж
    const hasProcessedPayment = req.incomingPayments?.some(p => p.isProcessed === true)
    if (hasProcessedPayment) {
      console.log(`⚠️ [Auto-Deposit] Request ${req.id} already has processed payment, skipping`)
      return false
    }
    
    // Проверяем что у заявки есть связанный платеж но он еще не обработан
    // Это нормально, мы можем продолжить обработку
    const hasUnprocessedPayment = req.incomingPayments?.some(p => p.isProcessed === false && p.requestId === req.id)
    if (hasUnprocessedPayment) {
      console.log(`ℹ️ [Auto-Deposit] Request ${req.id} has unprocessed payment linked, will continue`)
    }
    
    if (!req.amount) {
      console.log(`⚠️ [Auto-Deposit] Request ${req.id} has no amount`)
      return false
    }
    
    const reqAmount = parseFloat(req.amount.toString())
    const diff = Math.abs(reqAmount - amount)
    const matches = diff < 0.01 // Точность до 1 копейки
    
    console.log(`🔍 [Auto-Deposit] Checking request ${req.id}: reqAmount=${reqAmount}, paymentAmount=${amount}, diff=${diff.toFixed(4)}, matches=${matches}`)
    
    if (matches) {
      console.log(`✅ [Auto-Deposit] Exact match found: Request ${req.id}, amount ${reqAmount} ≈ payment ${amount} (diff: ${diff})`)
    }
    return matches
  })

  console.log(`🎯 [Auto-Deposit] Found ${exactMatches.length} exact match(es) for payment ${paymentId}`)

  if (exactMatches.length === 0) {
    console.log(`ℹ️ [Auto-Deposit] No matching request found for payment ${paymentId} (amount: ${amount})`)
    console.log(`   [Auto-Deposit] Searched ${matchingRequests.length} requests. Amounts found: ${matchingRequests.map(r => r.amount?.toString() || 'N/A').join(', ')}`)
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
    console.log(`⚠️ [Auto-Deposit] Payment ${paymentId} is already processed, skipping`)
    return null
  }
  
  // Дополнительная проверка: убеждаемся что заявка все еще в статусе pending
  // (на случай если другой процесс уже обновил статус между запросами)
  const currentRequest = await prisma.request.findUnique({
    where: { id: request.id },
    select: { status: true, accountId: true, bookmaker: true, amount: true, userId: true },
  })
  
  if (!currentRequest || currentRequest.status !== 'pending') {
    console.log(`⚠️ [Auto-Deposit] Request ${request.id} is no longer pending (current status: ${currentRequest?.status}), skipping`)
    return null
  }

  if (!currentRequest.accountId || !currentRequest.bookmaker) {
    console.warn(`⚠️ [Auto-Deposit] Request ${request.id} missing accountId or bookmaker`)
    console.warn(`   [Auto-Deposit] accountId: ${currentRequest.accountId}, bookmaker: ${currentRequest.bookmaker}`)
    return null
  }
  
  // Используем актуальные данные заявки
  request.accountId = currentRequest.accountId
  request.bookmaker = currentRequest.bookmaker
  request.amount = currentRequest.amount
  request.userId = currentRequest.userId

  // Сначала связываем платеж с заявкой (но не помечаем как обработанный)
  await prisma.incomingPayment.update({
    where: { id: paymentId },
    data: {
      requestId: request.id,
      // НЕ устанавливаем isProcessed=true пока не пополним баланс
    },
  })

  console.log(`🔗 [Auto-Deposit] Payment ${paymentId} linked to request ${request.id}, attempting deposit...`)
  console.log(`   [Auto-Deposit] Request: ID ${request.id}, Account: ${request.accountId}, Bookmaker: ${request.bookmaker}`)
  console.log(`   [Auto-Deposit] Request amount: ${request.amount}, Payment amount: ${amount}`)
  console.log(`   [Auto-Deposit] Request created at: ${request.createdAt}`)

  // Пополняем баланс через казино API
  try {
    const { depositToCasino } = await import('@/lib/deposit-balance')
    console.log(`💸 [Auto-Deposit] Attempting deposit: Bookmaker=${request.bookmaker}, AccountId=${request.accountId}, Amount=${request.amount}`)
    
    const depositResult = await depositToCasino(
      request.bookmaker!,
      request.accountId,
      parseFloat(request.amount?.toString() || '0'),
      request.id // Передаем requestId чтобы исключить текущую заявку из проверки на дублирование
    )

    console.log(`📊 [Auto-Deposit] Deposit result:`, depositResult)

    if (!depositResult.success) {
      console.error(`❌ [Auto-Deposit] Deposit failed: ${depositResult.message}`)
      throw new Error(depositResult.message || 'Deposit failed')
    }
    
    console.log(`✅ [Auto-Deposit] Deposit to casino successful, updating request status...`)

    // Успешное пополнение - обновляем статус заявки и помечаем платеж как обработанный
    // processedBy = "автопополнение" означает что заявка закрыта автоматически
    // Используем статус 'autodeposit_success' для автопополнения
    // ВАЖНО: Используем транзакцию чтобы гарантировать атомарность обновлений
    const updateResult = await prisma.$transaction(async (tx) => {
      // Сначала проверяем что заявка все еще в статусе pending
      const currentRequest = await tx.request.findUnique({
        where: { id: request.id },
        select: { status: true },
      })
      
      if (!currentRequest || currentRequest.status !== 'pending') {
        throw new Error(`Request ${request.id} is no longer pending (status: ${currentRequest?.status})`)
      }
      
      // Обновляем заявку и платеж атомарно
      const [updatedRequest, updatedPayment] = await Promise.all([
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
            isProcessed: true,
          },
        }),
      ])
      
      return { updatedRequest, updatedPayment }
    })
    
    console.log(`✅ [Auto-Deposit] Transaction completed: Request ${request.id} status updated, Payment ${paymentId} marked as processed`)
    
    console.log(`✅ [Auto-Deposit] SUCCESS: Request ${request.id} updated to autodeposit_success`)
    console.log(`   [Auto-Deposit] Account: ${request.accountId}, Bookmaker: ${request.bookmaker}`)
    console.log(`   [Auto-Deposit] Payment ${paymentId} marked as processed`)
    console.log(`   [Auto-Deposit] Request should now disappear from pending list`)

    return {
      requestId: request.id,
      success: true,
    }
  } catch (error: any) {
    // В случае ошибки API казино:
    // 1. Откатываем связь платежа с заявкой (убираем requestId и isProcessed)
    // 2. Оставляем статус заявки pending для ручной обработки
    console.error(`❌ [Auto-Deposit] FAILED for request ${request.id}:`, error)
    console.error(`   [Auto-Deposit] Error message:`, error.message)
    console.error(`   [Auto-Deposit] Error stack:`, error.stack)
    
    try {
      await prisma.incomingPayment.update({
        where: { id: paymentId },
        data: {
          requestId: null,
          isProcessed: false,
        },
      })
      console.log(`🔄 [Auto-Deposit] Payment ${paymentId} unlinked from request ${request.id} due to deposit failure`)
    } catch (rollbackError) {
      console.error(`❌ Failed to rollback payment ${paymentId}:`, rollbackError)
    }
    
    throw error
  }
}

