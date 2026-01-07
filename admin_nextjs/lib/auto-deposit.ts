import { prisma } from './prisma'
import { AUTO_DEPOSIT_CONFIG } from '@/config/app'

/**
 * ЕДИНСТВЕННАЯ функция автопополнения - работает только здесь
 * Все вызовы должны использовать эту функцию из ./auto-deposit
 * Работает секунду в секунду - мгновенно
 * ВАЖНО: Гарантирует что статус заявки ОБЯЗАТЕЛЬНО обновится на autodeposit_success
 */
export async function matchAndProcessPayment(paymentId: number, amount: number) {
  console.log(`🔍 [Auto-Deposit] matchAndProcessPayment called: paymentId=${paymentId}, amount=${amount}`)
  
  // ВАЖНО: Получаем информацию о платеже, чтобы проверить время поступления
  const payment = await prisma.incomingPayment.findUnique({
    where: { id: paymentId },
    select: { paymentDate: true, isProcessed: true },
  })
  
  if (!payment) {
    console.error(`❌ [Auto-Deposit] Payment ${paymentId} not found`)
    return null
  }
  
  if (payment.isProcessed) {
    console.log(`⚠️ [Auto-Deposit] Payment ${paymentId} already processed, skipping`)
    return null
  }
  
  const paymentDate = payment.paymentDate
  console.log(`📅 [Auto-Deposit] Payment ${paymentId} date: ${paymentDate.toISOString()} (UTC)`)
  console.log(`📅 [Auto-Deposit] Payment ${paymentId} date (local): ${paymentDate.toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek' })}`)
  
  // Ищем заявки на пополнение со статусом pending за последние N минут (из конфигурации)
  // Это защищает от случайного пополнения если пользователь не пополнял
  // И предотвращает обработку старых заявок с одинаковыми суммами
  const searchWindowAgo = new Date(Date.now() - AUTO_DEPOSIT_CONFIG.REQUEST_SEARCH_WINDOW_MS)

  // Оптимизированный поиск заявок - минимум запросов для максимальной скорости
  // Ищем ТОЛЬКО за последние 5 минут чтобы избежать случайного пополнения старых заявок
  // ВАЖНО: Заявка должна быть создана ДО поступления платежа
  const matchingRequests = await prisma.request.findMany({
    where: {
      requestType: 'deposit',
      status: 'pending',
      createdAt: { 
        gte: searchWindowAgo, // Только последние N минут (из конфигурации)
        lte: paymentDate, // ВАЖНО: Заявка должна быть создана ДО поступления платежа
      },
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

  // Быстрая фильтрация по точному совпадению суммы и времени
  const exactMatches = matchingRequests.filter((req) => {
    if (req.status !== 'pending' || !req.amount) return false
    
    // Пропускаем заявки, у которых уже есть обработанный платеж
    const hasProcessedPayment = req.incomingPayments?.some(p => p.isProcessed === true)
    if (hasProcessedPayment) {
      console.log(`⚠️ [Auto-Deposit] Request ${req.id} already has processed payment, skipping`)
      return false
    }
    
    // КРИТИЧЕСКИ ВАЖНО: Платеж должен поступить ПОСЛЕ создания заявки
    // Если платеж пришел раньше заявки - это старый платеж, не привязываем его
    if (paymentDate < req.createdAt) {
      const timeDiff = req.createdAt.getTime() - paymentDate.getTime()
      const minutesDiff = Math.floor(timeDiff / 60000)
      console.log(`⚠️ [Auto-Deposit] Request ${req.id} created ${minutesDiff} minutes AFTER payment ${paymentId} (payment too old), skipping`)
      return false
    }
    
    // Дополнительная проверка: заявка должна быть создана не более 5 минут назад
    const requestAge = Date.now() - req.createdAt.getTime()
    const maxAge = AUTO_DEPOSIT_CONFIG.MAX_REQUEST_AGE_MS
    if (requestAge > maxAge) {
      console.log(`⚠️ [Auto-Deposit] Request ${req.id} is too old (${Math.floor(requestAge / 1000)}s), skipping`)
      return false
    }
    
    // Проверяем, что платеж поступил не слишком давно (максимум 10 минут после создания заявки)
    const paymentDelay = paymentDate.getTime() - req.createdAt.getTime()
    const maxPaymentDelay = AUTO_DEPOSIT_CONFIG.PAYMENT_DATE_MAX_DELAY_MS
    if (paymentDelay > maxPaymentDelay) {
      const minutesDelay = Math.floor(paymentDelay / 60000)
      console.log(`⚠️ [Auto-Deposit] Payment ${paymentId} arrived ${minutesDelay} minutes after request ${req.id} (too late), skipping`)
      return false
    }
    
    const reqAmount = parseFloat(req.amount.toString())
    const diff = Math.abs(reqAmount - amount)
    const matches = diff < 0.01 // Точность до 1 копейки
    
    if (matches) {
      const timeDiff = paymentDate.getTime() - req.createdAt.getTime()
      const secondsDiff = Math.floor(timeDiff / 1000)
      const hoursDiff = (timeDiff / (1000 * 60 * 60)).toFixed(2)
      console.log(`✅ [Auto-Deposit] Exact match: Request ${req.id} (${reqAmount}) ≈ Payment ${amount} (diff: ${diff.toFixed(4)})`)
      console.log(`   ⏰ Time diff: ${secondsDiff}s (${hoursDiff}h) - Request: ${req.createdAt.toISOString()}, Payment: ${paymentDate.toISOString()}`)
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
    const { depositToCasino } = await import('./deposit-balance')
    
    // Сразу пополняем баланс через казино API (самое важное - делаем мгновенно)
    const depositResult = await depositToCasino(
      request.bookmaker,
      request.accountId,
      requestAmount,
      request.id
    )

    if (!depositResult.success) {
      const errorMessage = depositResult.message || 'Deposit failed'
      console.error(`❌ [Auto-Deposit] Deposit failed: ${errorMessage}`)
      
      // Сохраняем ошибку в БД для отображения в админке
      try {
        await prisma.request.update({
          where: { id: request.id },
          data: {
            status: 'api_error',
            statusDetail: errorMessage.length > 50 ? errorMessage.substring(0, 50) : errorMessage,
            processedAt: new Date(),
            updatedAt: new Date(),
          } as any,
        })
        console.log(`⚠️ [Auto-Deposit] Saved error to request ${request.id}: ${errorMessage}`)
      } catch (dbError: any) {
        console.error(`❌ [Auto-Deposit] Failed to save error to DB:`, dbError.message)
      }
      
      throw new Error(errorMessage)
    }
    
    // После успешного пополнения - атомарно обновляем все в одной транзакции
    // ВАЖНО: Если пополнение успешно, статус ОБЯЗАТЕЛЬНО должен обновиться на autodeposit_success
    // ВАЖНО: Используем транзакцию чтобы гарантировать что статус ОБЯЗАТЕЛЬНО обновится
    const updateResult = await prisma.$transaction(async (tx) => {
      // Проверяем текущее состояние заявки и платежа
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
      
      // КРИТИЧЕСКИ ВАЖНО: Если платеж уже обработан - пропускаем (защита от двойного пополнения)
      if (currentPayment?.isProcessed) {
        console.log(`⚠️ [Auto-Deposit] Payment ${paymentId} already processed, skipping`)
        return { skipped: true }
      }
      
      // Если заявка уже обработана автопополнением - пропускаем (защита от двойного пополнения)
      if (currentRequest?.processedBy === 'автопополнение' || currentRequest?.status === 'autodeposit_success') {
        console.log(`⚠️ [Auto-Deposit] Request ${request.id} already processed by autodeposit (status: ${currentRequest?.status}), skipping`)
        // Но все равно помечаем платеж как обработанный
        await tx.incomingPayment.update({
          where: { id: paymentId },
          data: {
            requestId: request.id,
            isProcessed: true,
          },
        })
        return { skipped: true }
      }
      
      // ВАЖНО: Если пополнение уже выполнено успешно, но статус еще не обновлен - ОБЯЗАТЕЛЬНО обновляем
      // Даже если заявка уже не pending (например, была изменена вручную), но пополнение успешно - обновляем статус
      // Исключение: если заявка уже completed/approved - не трогаем (возможно, обработана вручную)
      const shouldUpdateStatus = 
        currentRequest?.status === 'pending' || 
        currentRequest?.status === 'api_error' ||
        currentRequest?.status === 'deposit_failed' ||
        !currentRequest?.processedBy // Если нет processedBy, значит не обработана
      
      if (!shouldUpdateStatus && (currentRequest?.status === 'completed' || currentRequest?.status === 'approved')) {
        console.log(`⚠️ [Auto-Deposit] Request ${request.id} already completed/approved (status: ${currentRequest?.status}), but deposit was successful. Marking payment as processed.`)
        // Помечаем платеж как обработанный, но не меняем статус заявки
        await tx.incomingPayment.update({
          where: { id: paymentId },
          data: {
            requestId: request.id,
            isProcessed: true,
          },
        })
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
      
      console.log(`✅ [Auto-Deposit] Transaction: Request ${request.id} status updated to autodeposit_success (was: ${currentRequest?.status})`)
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
    let verifyRequest = await prisma.request.findUnique({
      where: { id: request.id },
      select: { status: true, processedBy: true },
    })
    
    // КРИТИЧЕСКАЯ ЗАЩИТА: Если статус не обновился, пытаемся обновить вручную
    if (verifyRequest?.status !== 'autodeposit_success') {
      console.error(`❌ [Auto-Deposit] CRITICAL: Request ${request.id} status is ${verifyRequest?.status}, expected autodeposit_success`)
      console.log(`🔄 [Auto-Deposit] Attempting manual status update for request ${request.id}...`)
      
      try {
        // Пытаемся обновить статус вручную как последнюю попытку
        const manualUpdate = await prisma.request.update({
          where: { id: request.id },
          data: {
            status: 'autodeposit_success',
            statusDetail: null,
            processedBy: 'автопополнение' as any,
            processedAt: new Date(),
            updatedAt: new Date(),
          } as any,
        })
        
        // Проверяем еще раз
        verifyRequest = await prisma.request.findUnique({
          where: { id: request.id },
          select: { status: true, processedBy: true },
        })
        
        if (verifyRequest?.status === 'autodeposit_success') {
          console.log(`✅ [Auto-Deposit] Manual update successful: Request ${request.id} → autodeposit_success`)
        } else {
          console.error(`❌ [Auto-Deposit] Manual update failed: Request ${request.id} status is still ${verifyRequest?.status}`)
          throw new Error(`Failed to update request status: current status is ${verifyRequest?.status}`)
        }
      } catch (manualUpdateError: any) {
        console.error(`❌ [Auto-Deposit] Manual update error:`, manualUpdateError.message)
        throw new Error(`Failed to update request status: ${manualUpdateError.message}`)
      }
    } else {
      console.log(`✅ [Auto-Deposit] SUCCESS: Request ${request.id} → autodeposit_success (verified)`)
    }

    // Отправляем уведомление пользователю в бот, если заявка создана через бот
    try {
      const fullRequest = await prisma.request.findUnique({
        where: { id: request.id },
        select: {
          userId: true,
          source: true,
          amount: true,
          bookmaker: true,
        },
      })
      
      if (fullRequest) {
        const source = (fullRequest as any).source
        const isFromBot = source === 'bot' || !source
        
        if (isFromBot && fullRequest.userId) {
          const notificationMessage = `✅ <b>Ваш баланс пополнен!</b>\n\n` +
            `💰 Сумма: ${fullRequest.amount} сом\n` +
            `🎰 Казино: ${fullRequest.bookmaker?.toUpperCase() || 'N/A'}\n` +
            `🆔 ID заявки: #${request.id}`
          
          // Импортируем функцию отправки уведомления
          const botToken = process.env.BOT_TOKEN
          if (botToken) {
            const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
            fetch(sendMessageUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: fullRequest.userId.toString(),
                text: notificationMessage,
                parse_mode: 'HTML',
              }),
            }).catch(error => {
              console.error(`❌ Failed to send notification for request ${request.id}:`, error)
            })
          }
        }
      }
    } catch (notificationError: any) {
      // Не блокируем выполнение если уведомление не отправилось
      console.error(`❌ Error sending notification for request ${request.id}:`, notificationError)
    }

    return {
      requestId: request.id,
      success: true,
    }
  } catch (error: any) {
    console.error(`❌ [Auto-Deposit] FAILED for request ${request.id}:`, error.message)
    throw error
  }
}

