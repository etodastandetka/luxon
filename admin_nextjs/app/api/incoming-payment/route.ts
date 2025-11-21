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
    // Вызываем асинхронно, но не блокируем ответ
    // ВАЖНО: Не используем await, чтобы не блокировать ответ клиенту
    matchAndProcessPayment(incomingPayment.id, parseFloat(amount))
      .then((result) => {
        if (result && result.success) {
          console.log(`✅ [Incoming Payment] Auto-deposit completed for payment ${incomingPayment.id}, request ${result.requestId}`)
        } else {
          console.log(`ℹ️ [Incoming Payment] No matching request found for payment ${incomingPayment.id} (amount: ${amount})`)
          if (result) {
            console.log(`   [Incoming Payment] Match result:`, result)
          }
        }
      })
      .catch((error) => {
        console.error(`❌ [Incoming Payment] Auto-match failed for payment ${incomingPayment.id}:`, error.message || error)
        console.error(`   [Incoming Payment] Error stack:`, error.stack)
        // Не возвращаем ошибку, т.к. платеж уже сохранен и может быть обработан вручную
      })
    
    // Не ждем результата matchAndProcessPayment, чтобы быстро ответить клиенту

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

  console.log(`🔍 [Auto-Deposit] ===== STARTING MATCH PROCESS =====`)
  console.log(`🔍 [Auto-Deposit] Matching payment ${paymentId}: looking for requests with amount ${amount} created after ${twentyFourHoursAgo.toISOString()}`)
  console.log(`🔍 [Auto-Deposit] Payment amount: ${amount}, type: ${typeof amount}`)
  console.log(`🔍 [Auto-Deposit] Time window: last 24 hours (from ${twentyFourHoursAgo.toISOString()})`)

  // Ищем заявки с точным совпадением суммы (с точностью до копеек)
  // ВАЖНО: Исключаем заявки, которые уже имеют связанный обработанный платеж
  // Также исключаем заявки которые уже не в статусе pending (на случай race condition)
  const whereClause = {
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
  }
  
  console.log(`🔍 [Auto-Deposit] Query where clause:`, JSON.stringify(whereClause, null, 2))
  
  const matchingRequests = await prisma.request.findMany({
    where: whereClause,
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
  
  console.log(`🔍 [Auto-Deposit] Database query completed, found ${matchingRequests.length} requests`)

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

  if (exactMatches.length === 0) {
    console.log(`ℹ️ [Auto-Deposit] ===== NO MATCH FOUND =====`)
    console.log(`ℹ️ [Auto-Deposit] No matching request found for payment ${paymentId} (amount: ${amount})`)
    console.log(`   [Auto-Deposit] Searched ${matchingRequests.length} requests.`)
    if (matchingRequests.length > 0) {
      console.log(`   [Auto-Deposit] Request details:`)
      matchingRequests.forEach(r => {
        console.log(`     - Request ${r.id}: amount=${r.amount?.toString() || 'N/A'}, accountId=${r.accountId || 'N/A'}, bookmaker=${r.bookmaker || 'N/A'}, status=${r.status}, createdAt=${r.createdAt.toISOString()}`)
        console.log(`       Payments: ${r.incomingPayments?.length || 0} (processed: ${r.incomingPayments?.filter(p => p.isProcessed).length || 0})`)
      })
    } else {
      console.log(`   [Auto-Deposit] No pending deposit requests found in the last 24 hours`)
    }
    return null
  }

  console.log(`🎯 [Auto-Deposit] Found ${exactMatches.length} exact match(es) for payment ${paymentId}`)

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
    console.log(`   [Auto-Deposit] This might indicate the request was already processed by another process`)
    return null
  }

  if (!currentRequest.accountId || !currentRequest.bookmaker) {
    console.error(`❌ [Auto-Deposit] Request ${request.id} missing accountId or bookmaker - CANNOT PROCESS`)
    console.error(`   [Auto-Deposit] accountId: ${currentRequest.accountId || 'MISSING'}, bookmaker: ${currentRequest.bookmaker || 'MISSING'}`)
    console.error(`   [Auto-Deposit] Request details:`, {
      id: request.id,
      userId: currentRequest.userId?.toString(),
      amount: currentRequest.amount?.toString(),
      status: currentRequest.status
    })
    return null
  }
  
  // Используем актуальные данные заявки
  request.accountId = currentRequest.accountId
  request.bookmaker = currentRequest.bookmaker
  request.amount = currentRequest.amount
  request.userId = currentRequest.userId

  console.log(`🔍 [Auto-Deposit] Found matching request: ID ${request.id}, Account: ${request.accountId}, Bookmaker: ${request.bookmaker}`)
  console.log(`   [Auto-Deposit] Request amount: ${request.amount}, Payment amount: ${amount}`)
  console.log(`   [Auto-Deposit] Request created at: ${request.createdAt}, Payment date: ${new Date()}`)

  // Сначала связываем платеж с заявкой (но не помечаем как обработанный)
  await prisma.incomingPayment.update({
    where: { id: paymentId },
    data: {
      requestId: request.id,
      // НЕ устанавливаем isProcessed=true пока не пополним баланс
    },
  })
  
  console.log(`🔗 [Auto-Deposit] Payment ${paymentId} linked to request ${request.id}, attempting deposit...`)

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

    console.log(`✅ [Auto-Deposit] ===== SUCCESS =====`)
    console.log(`✅ [Auto-Deposit] SUCCESS: Request ${request.id} updated to autodeposit_success`)
    console.log(`   [Auto-Deposit] Account: ${request.accountId}, Bookmaker: ${request.bookmaker}`)
    console.log(`   [Auto-Deposit] Amount: ${request.amount?.toString()}, Payment: ${amount}`)
    console.log(`   [Auto-Deposit] Payment ${paymentId} marked as processed`)
    console.log(`   [Auto-Deposit] Request should now disappear from pending list`)
    console.log(`✅ [Auto-Deposit] ===== END MATCH PROCESS =====`)

    return {
      requestId: request.id,
      success: true,
    }
  } catch (error: any) {
    console.error(`❌ [Auto-Deposit] ===== FAILED =====`)
    console.error(`❌ [Auto-Deposit] FAILED for request ${request.id}:`, error)
    console.error(`   [Auto-Deposit] Error message:`, error.message)
    console.error(`   [Auto-Deposit] Error stack:`, error.stack)
    console.error(`   [Auto-Deposit] Payment ID: ${paymentId}, Amount: ${amount}`)
    console.error(`   [Auto-Deposit] Request ID: ${request.id}, Account: ${request.accountId}, Bookmaker: ${request.bookmaker}`)

    // В случае ошибки API казино:
    // 1. Откатываем связь платежа с заявкой (убираем requestId и isProcessed)
    // 2. Оставляем статус заявки pending для ручной обработки
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
      console.error(`❌ [Auto-Deposit] Failed to rollback payment ${paymentId}:`, rollbackError)
    }
    
    console.error(`❌ [Auto-Deposit] ===== END MATCH PROCESS (EXCEPTION) =====`)
    throw error
  }
}

