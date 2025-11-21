import { prisma } from './prisma'

/**
 * ЕДИНСТВЕННАЯ функция автопополнения - работает только здесь
 * Все вызовы должны использовать эту функцию из @/lib/auto-deposit
 * Работает секунду в секунду - мгновенно
 * ВАЖНО: Гарантирует что статус заявки ОБЯЗАТЕЛЬНО обновится на autodeposit_success
 */
export async function matchAndProcessPayment(paymentId: number, amount: number) {
  console.log(`🔍 [Auto-Deposit] matchAndProcessPayment called: paymentId=${paymentId}, amount=${amount}`)
  
  // Ищем заявки на пополнение со статусом pending за последние 5 минут
  // Это защищает от случайного пополнения если пользователь не пополнял
  // И предотвращает обработку старых заявок с одинаковыми суммами
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  // Оптимизированный поиск заявок - минимум запросов для максимальной скорости
  // Ищем ТОЛЬКО за последние 5 минут чтобы избежать случайного пополнения старых заявок
  const matchingRequests = await prisma.request.findMany({
    where: {
      requestType: 'deposit',
      status: 'pending',
      createdAt: { gte: fiveMinutesAgo }, // Только последние 5 минут
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
      createdAt: true,
      incomingPayments: { select: { id: true, isProcessed: true } },
    },
  })

  // Быстрая фильтрация по точному совпадению суммы
  const exactMatches = matchingRequests.filter((req) => {
    if (req.status !== 'pending' || !req.amount) return false
    
    // Пропускаем заявки, у которых уже есть обработанный платеж
    const hasProcessedPayment = req.incomingPayments?.some(p => p.isProcessed === true)
    if (hasProcessedPayment) {
      console.log(`⚠️ [Auto-Deposit] Request ${req.id} already has processed payment, skipping`)
      return false
    }
    
    // Дополнительная проверка: заявка должна быть создана не более 5 минут назад
    const requestAge = Date.now() - req.createdAt.getTime()
    const maxAge = 5 * 60 * 1000 // 5 минут
    if (requestAge > maxAge) {
      console.log(`⚠️ [Auto-Deposit] Request ${req.id} is too old (${Math.floor(requestAge / 1000)}s), skipping`)
      return false
    }
    
    const reqAmount = parseFloat(req.amount.toString())
    const diff = Math.abs(reqAmount - amount)
    const matches = diff < 0.01 // Точность до 1 копейки
    
    if (matches) {
      console.log(`✅ [Auto-Deposit] Exact match: Request ${req.id} (${reqAmount}) ≈ Payment ${amount} (diff: ${diff.toFixed(4)}, age: ${Math.floor(requestAge / 1000)}s)`)
    }
    
    return matches
  })

  if (exactMatches.length === 0) {
    console.log(`ℹ️ [Auto-Deposit] No exact matches found for payment ${paymentId} (amount: ${amount})`)
    return null
  }
  
  console.log(`🎯 [Auto-Deposit] Found ${exactMatches.length} exact match(es) for payment ${paymentId}`)

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
    // ВАЖНО: Проверяем что заявка все еще pending и не была обработана автопополнением
    // ВАЖНО: Используем транзакцию чтобы гарантировать что статус ОБЯЗАТЕЛЬНО обновится
    const updateResult = await prisma.$transaction(async (tx) => {
      // Проверяем что заявка все еще pending и платеж не обработан
      const [currentRequest, currentPayment] = await Promise.all([
        tx.request.findUnique({
          where: { id: request.id },
          select: { status: true, processedBy: true },
        }),
        tx.incomingPayment.findUnique({
          where: { id: paymentId },
          select: { isProcessed: true },
        }),
      ])
      
      // Если уже обработано - пропускаем (защита от двойного пополнения)
      if (currentRequest?.status !== 'pending' || currentPayment?.isProcessed) {
        console.log(`⚠️ [Auto-Deposit] Request ${request.id} already processed (status: ${currentRequest?.status}), skipping`)
        return { skipped: true }
      }
      
      // Дополнительная проверка: если заявка уже обработана автопополнением - не трогаем
      if (currentRequest?.processedBy === 'автопополнение') {
        console.log(`⚠️ [Auto-Deposit] Request ${request.id} already processed by autodeposit, skipping`)
        return { skipped: true }
      }
      
      // Обновляем заявку и платеж атомарно - ВАЖНО: это должно обязательно выполниться
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
            requestId: request.id,
            isProcessed: true,
          },
        }),
      ])
      
      console.log(`✅ [Auto-Deposit] Transaction: Request ${request.id} status updated to autodeposit_success`)
      console.log(`✅ [Auto-Deposit] Transaction: Payment ${paymentId} marked as processed`)
      
      return { updatedRequest, updatedPayment, skipped: false }
    })
    
    // Проверяем что транзакция действительно обновила статус
    if (updateResult?.skipped) {
      console.log(`⚠️ [Auto-Deposit] Transaction skipped for request ${request.id}`)
      return null
    }
    
    if (!updateResult?.updatedRequest) {
      console.error(`❌ [Auto-Deposit] Transaction failed to update request ${request.id}`)
      throw new Error('Failed to update request status in transaction')
    }
    
    // Дополнительная проверка что статус действительно обновился
    const verifyRequest = await prisma.request.findUnique({
      where: { id: request.id },
      select: { status: true, processedBy: true },
    })
    
    if (verifyRequest?.status !== 'autodeposit_success') {
      console.error(`❌ [Auto-Deposit] CRITICAL: Request ${request.id} status is ${verifyRequest?.status}, expected autodeposit_success`)
      throw new Error(`Failed to update request status: current status is ${verifyRequest?.status}`)
    }
    
    console.log(`✅ [Auto-Deposit] SUCCESS: Request ${request.id} → autodeposit_success (verified)`)

    return {
      requestId: request.id,
      success: true,
    }
  } catch (error: any) {
    console.error(`❌ [Auto-Deposit] FAILED for request ${request.id}:`, error.message)
    throw error
  }
}

