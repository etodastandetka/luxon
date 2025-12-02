import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import { sendTelegramGroupMessage } from '@/lib/telegram-group'
import { 
  rateLimit, 
  sanitizeInput, 
  containsSQLInjection, 
  containsXSS,
  getClientIP 
} from '@/lib/security'

/**
 * Планирует отложенное уведомление о депозите через минуту
 * Вызывается только если автопополнение не сработало
 * ВАЖНО: Использует setTimeout, который работает в контексте сервера
 * Если сервер перезагрузится, уведомление не отправится (но это нормально)
 */
function scheduleDelayedNotification(requestId: number) {
  // Используем setTimeout для вызова endpoint через минуту
  // ВАЖНО: Это работает только если сервер не перезагрузится
  setTimeout(async () => {
    try {
      // Используем внутренний вызов API через абсолютный URL
      // Определяем базовый URL в зависимости от окружения
      const internalBaseUrl = process.env.INTERNAL_API_URL || process.env.ADMIN_INTERNAL_URL
      let baseUrl = internalBaseUrl
        || (process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:3001' : 'http://localhost:3001')
      
      // Если явно указан публичный URL и нет внутреннего - используем его как запасной вариант
      const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://japar.click' : '')
      if (!baseUrl && publicApiUrl) {
        baseUrl = publicApiUrl
      }
      
      console.log(`⏰ [Delayed Notification] Sending notification for request ${requestId} after 1 minute delay`)
      
      const response = await fetch(`${baseUrl}/api/notifications/delayed-deposit?requestId=${requestId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && !data.data?.skipped) {
          console.log(`✅ [Delayed Notification] Notification sent for request ${requestId}`)
        } else {
          console.log(`ℹ️ [Delayed Notification] Notification skipped for request ${requestId}:`, data.data?.reason)
        }
      } else {
        console.error(`❌ [Delayed Notification] Failed to send notification for request ${requestId}:`, response.status)
      }
    } catch (error: any) {
      console.error(`❌ [Delayed Notification] Error sending notification for request ${requestId}:`, error.message)
    }
  }, 60 * 1000) // 1 минута = 60 секунд
}

// API для создания заявок из внешних источников (мини-приложение, бот и т.д.)
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
    // 🛡️ Rate limiting для payment endpoint (критичный)
    const rateLimitResult = rateLimit({ 
      maxRequests: 20, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `payment:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) {
      return rateLimitResult
    }

    const body = await request.json()

    // 🛡️ Валидация и очистка входных данных
    const sanitizedBody = sanitizeInput(body)
    
    const {
      userId,
      user_id,
      telegram_user_id,
      playerId,
      type, // deposit/withdraw
      amount,
      amount_usd, // Сумма в долларах (только для крипты)
      bookmaker,
      bank,
      phone,
      account_id,
      telegram_username,
      telegram_first_name,
      telegram_last_name,
      receipt_photo, // base64 строка фото чека (для deposit)
      qr_photo, // base64 строка фото QR-кода (для withdraw)
      payment_method, // 'bank' или 'crypto'
      crypto_invoice_id, // ID крипто invoice
      site_code, // Код ордера на вывод (для withdraw)
    } = sanitizedBody

    // 🛡️ Проверка на SQL инъекции и XSS в строковых полях
    const stringFields = [
      telegram_username, telegram_first_name, telegram_last_name,
      bookmaker, bank, phone, account_id, site_code
    ].filter(Boolean)
    
    for (const field of stringFields) {
      if (typeof field === 'string') {
        if (containsSQLInjection(field) || containsXSS(field)) {
          console.warn(`🚫 Security threat detected from ${getClientIP(request)}: ${field.substring(0, 50)}`)
          return NextResponse.json(
            { error: 'Invalid input detected' },
            { status: 400 }
          )
        }
      }
    }

    // Определяем user_id (Telegram ID пользователя - обязателен для правильной идентификации)
    // Приоритет: telegram_user_id > userId > user_id
    // НЕ используем playerId как userId, т.к. это ID аккаунта в казино, а не Telegram ID
    let finalUserId = telegram_user_id || userId || user_id
    
    // accountId - это ID аккаунта в казино (может быть одинаковым для разных пользователей)
    // Приоритет: account_id > playerId (но НЕ userId/user_id, т.к. это Telegram ID)
    const finalAccountId = account_id || playerId

    console.log('📝 Payment API - Creating request:', {
      telegram_user_id,
      userId,
      user_id,
      playerId,
      finalUserId,
      type,
      amount,
      bookmaker,
      bank
    })

    // Защита от дублирования: проверяем, нет ли уже такой же заявки за последние 30 секунд
    if (finalUserId && type && amount) {
      const recentRequest = await prisma.request.findFirst({
        where: {
          userId: BigInt(finalUserId),
          requestType: type,
          amount: parseFloat(amount),
          bookmaker: bookmaker || undefined,
          accountId: finalAccountId || undefined,
          createdAt: {
            gte: new Date(Date.now() - 30000) // Последние 30 секунд
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      if (recentRequest) {
        console.log('⚠️ Payment API: Duplicate request detected, returning existing request:', recentRequest.id)
        return NextResponse.json(
          createApiResponse({
            id: recentRequest.id,
            userId: recentRequest.userId.toString(),
            type: recentRequest.requestType,
            status: recentRequest.status,
            amount: recentRequest.amount?.toString()
          }, 'Request already exists'),
          {
            status: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }
    }

    // Проверяем обязательные поля
    // Для error_log не требуется amount
    if (!type) {
      console.error('❌ Payment API: Missing required field: type', { 
        body: JSON.stringify(body).substring(0, 500)
      })
      const errorResponse = NextResponse.json(
        createApiResponse(null, 'Missing required field: type'),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
      return errorResponse
    }

    // Для error_log не требуется amount
    if (type !== 'error_log' && !amount) {
      console.error('❌ Payment API: Missing required field: amount', { 
        userId, 
        user_id, 
        telegram_user_id, 
        playerId, 
        finalUserId,
        type, 
        amount,
        body: JSON.stringify(body).substring(0, 500) // Первые 500 символов для отладки
      })
      const errorResponse = NextResponse.json(
        createApiResponse(null, 'Missing required field: amount'),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
      return errorResponse
    }

    // Валидация минимального депозита в зависимости от казино
    if (type === 'deposit' && amount) {
      const amountNum = parseFloat(amount)
      if (!isNaN(amountNum)) {
        const normalizedBookmaker = (bookmaker || '').toLowerCase()
        let minDeposit = 35 // По умолчанию минимальный депозит 35 сом
        
        // Для 1win минимальный депозит 100 сом
        if (normalizedBookmaker.includes('1win') || normalizedBookmaker === '1win') {
          minDeposit = 100
        }
        
        if (amountNum < minDeposit) {
          const errorResponse = NextResponse.json(
            createApiResponse(null, `Минимальная сумма депозита для ${bookmaker || 'этого казино'}: ${minDeposit} сом`),
            { 
              status: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
              }
            }
          )
          return errorResponse
        }
        
        if (amountNum > 100000) {
          const errorResponse = NextResponse.json(
            createApiResponse(null, 'Максимальная сумма депозита: 100000 сом'),
            { 
              status: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
              }
            }
          )
          return errorResponse
        }
      }
    }

    // Для error_log просто логируем и возвращаем успех
    if (type === 'error_log') {
      const errorData = body.error || {}
      console.error('📝 Error log received:', {
        message: errorData.message,
        name: errorData.name,
        url: errorData.url,
        userAgent: errorData.userAgent,
        timestamp: errorData.timestamp,
        telegram_user_id: body.telegram_user_id
      })
      return NextResponse.json(
        createApiResponse({ logged: true }, undefined, 'Error logged successfully'),
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }
    
    // Если userId не указан, используем accountId или playerId как fallback
    if (!finalUserId) {
      console.warn('⚠️ Payment API: userId not found, using accountId/playerId as fallback')
      finalUserId = finalAccountId || playerId || 'unknown'
    }

    // Преобразуем userId в BigInt (если это строка с числом)
    // Если не удается преобразовать, используем хеш от строки
    let userIdBigInt: bigint
    try {
      if (typeof finalUserId === 'string') {
        // Пробуем преобразовать в число
        const num = parseInt(finalUserId, 10)
        if (!isNaN(num) && num > 0) {
          userIdBigInt = BigInt(num)
        } else {
          // Если не число, создаем хеш от строки
          console.warn('⚠️ userId is not a number, creating hash:', finalUserId)
          const hash = finalUserId.split('').reduce((acc, char) => {
            return ((acc << 5) - acc) + char.charCodeAt(0) | 0
          }, 0)
          userIdBigInt = BigInt(Math.abs(hash))
        }
      } else {
        userIdBigInt = BigInt(finalUserId)
      }
    } catch (e) {
      console.error('❌ Payment API: Invalid userId format, using fallback', finalUserId, e)
      // Используем хеш от строки как fallback
      const hash = String(finalUserId).split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0) | 0
      }, 0)
      userIdBigInt = BigInt(Math.abs(hash))
    }

    console.log('💾 Payment API - Saving to database:', {
      userId: userIdBigInt.toString(),
      username: telegram_username,
      firstName: telegram_first_name,
      type,
      amount: amount ? parseFloat(amount) : null,
      bookmaker,
      bank
    })

    // Если есть crypto_invoice_id, находим крипто-платеж и связываем его
    let cryptoPaymentId: number | null = null
    if (payment_method === 'crypto' && crypto_invoice_id) {
      const cryptoPayment = await prisma.cryptoPayment.findUnique({
        where: { invoice_id: crypto_invoice_id.toString() }
      })
      if (cryptoPayment) {
        cryptoPaymentId = cryptoPayment.id
      }
    }

    // Для error_log сохраняем информацию об ошибке в statusDetail
    // Для криптоплатежей сохраняем amount_usd в statusDetail
    let statusDetail: string | null = null
    if (type === 'error_log' && body.error) {
      // Сохраняем информацию об ошибке
      statusDetail = JSON.stringify({
        error: body.error,
        timestamp: body.error.timestamp || new Date().toISOString(),
        userAgent: body.error.userAgent,
        url: body.error.url
      })
    } else if (payment_method === 'crypto' && amount_usd) {
      statusDetail = JSON.stringify({
        amount_usd: parseFloat(amount_usd),
        amount_kgs: parseFloat(amount)
      })
    }

    // Нормализуем фото чека: убеждаемся что это валидный base64 с префиксом
    let photoUrl = receipt_photo || qr_photo || null
    if (photoUrl) {
      // Если фото не имеет префикса data:image, добавляем его
      if (!photoUrl.startsWith('data:image')) {
        // Пытаемся определить тип изображения по первым байтам base64
        // Обычно base64 начинается с /9j/ для JPEG, iVBORw0KGgo для PNG, R0lGODlh для GIF
        const base64Data = photoUrl.replace(/^data:image\/\w+;base64,/, '')
        let mimeType = 'image/jpeg' // По умолчанию JPEG
        
        if (base64Data.startsWith('iVBORw0KGgo')) {
          mimeType = 'image/png'
        } else if (base64Data.startsWith('R0lGODlh') || base64Data.startsWith('R0lGODdh')) {
          mimeType = 'image/gif'
        } else if (base64Data.startsWith('/9j/')) {
          mimeType = 'image/jpeg'
        } else if (base64Data.startsWith('UklGR')) {
          mimeType = 'image/webp'
        }
        
        photoUrl = `data:${mimeType};base64,${base64Data}`
        console.log('📸 [Payment API] Добавлен префикс к фото:', mimeType)
      }
      
      // Проверяем валидность base64 строки
      const base64Match = photoUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!base64Match || !base64Match[2]) {
        console.error('❌ [Payment API] Неверный формат base64 фото:', {
          photoLength: photoUrl.length,
          startsWithData: photoUrl.startsWith('data:'),
          hasBase64: photoUrl.includes('base64,')
        })
        photoUrl = null // Не сохраняем невалидное фото
      }
    }
    
    console.log('📸 [Payment API] Сохранение фото чека:', {
      hasPhoto: !!photoUrl,
      photoLength: photoUrl?.length || 0,
      isBase64: photoUrl?.startsWith('data:image') || false,
      requestType: type,
      photoPreview: photoUrl ? photoUrl.substring(0, 50) + '...' : null
    })
    
    const newRequest = await prisma.request.create({
      data: {
        userId: userIdBigInt,
        username: telegram_username,
        firstName: telegram_first_name,
        lastName: telegram_last_name,
        bookmaker,
        accountId: finalAccountId?.toString(),
        amount: amount ? parseFloat(amount) : null, // В сомах (для пополнения в казино), null для error_log
        requestType: type,
        bank,
        phone,
        status: 'pending',
        statusDetail: statusDetail, // Для error_log содержит JSON с информацией об ошибке, для крипты - amount_usd и amount_kgs
        photoFileUrl: photoUrl, // Сохраняем base64 фото чека (для deposit) или QR-кода (для withdraw)
        paymentMethod: payment_method || 'bank', // 'bank' или 'crypto'
        cryptoPaymentId: cryptoPaymentId,
        withdrawalCode: site_code || null, // Код ордера на вывод (для 1xbet)
      },
    })
    
    console.log('✅ [Payment API] Заявка создана:', {
      id: newRequest.id,
      hasPhoto: !!newRequest.photoFileUrl,
      photoFileUrlLength: newRequest.photoFileUrl?.length || 0
    })
    
    // Если есть crypto_invoice_id, обновляем крипто-платеж с request_id
    if (payment_method === 'crypto' && crypto_invoice_id) {
      await prisma.cryptoPayment.updateMany({
        where: { invoice_id: crypto_invoice_id.toString() },
        data: { request_id: newRequest.id.toString() }
      })
    }

    console.log('✅ Payment API - Request created successfully:', {
      id: newRequest.id,
      userId: newRequest.userId.toString(),
      type: newRequest.requestType,
      status: newRequest.status,
      amount: newRequest.amount?.toString()
    })

    // Если это заявка на пополнение - СРАЗУ проверяем есть ли входящие платежи с такой суммой
    // Автопополнение должно работать секунду в секунду - мгновенно при создании заявки
    if (type === 'deposit' && newRequest.amount) {
      const requestAmount = parseFloat(newRequest.amount.toString())
      console.log(`🔍 [Auto-Deposit] Instantly checking for incoming payments with amount ${requestAmount} for request ${newRequest.id}`)
      
      // Ищем необработанные входящие платежи с точным совпадением суммы
      // Делаем это СИНХРОННО (await) чтобы автопополнение сработало мгновенно
      try {
        // Ищем входящие платежи только за последние 5 минут
        // Это защищает от случайного пополнения если пользователь не пополнял
        const incomingPayments = await prisma.incomingPayment.findMany({
          where: {
            isProcessed: false,
            amount: requestAmount,
            paymentDate: {
              gte: new Date(Date.now() - 5 * 60 * 1000) // Только последние 5 минут
            }
          },
          orderBy: {
            paymentDate: 'desc' // Берем самый свежий
          },
          take: 1 // Только один
        })

        if (incomingPayments.length > 0) {
          const payment = incomingPayments[0]
          console.log(`✅ [Auto-Deposit] Found matching payment ${payment.id} for NEW request ${newRequest.id}, processing INSTANTLY...`)
          
          // Импортируем функцию автопополнения из отдельного модуля
          const { matchAndProcessPayment } = await import('../../../lib/auto-deposit')
          
          // Вызываем автопополнение СИНХРОННО - ждем результат
          // Это гарантирует что автопополнение произойдет секунду в секунду
          const result = await matchAndProcessPayment(payment.id, requestAmount)
          
          if (result && result.success) {
            console.log(`✅ [Auto-Deposit] INSTANT auto-deposit completed for request ${newRequest.id} with payment ${payment.id}`)
            // Автопополнение сработало - уведомление НЕ отправляем
          } else {
            console.log(`ℹ️ [Auto-Deposit] Auto-deposit check completed for request ${newRequest.id}`)
            // Автопополнение не сработало - отправим уведомление через минуту
            scheduleDelayedNotification(newRequest.id)
          }
        } else {
          console.log(`ℹ️ [Auto-Deposit] No matching incoming payments yet for request ${newRequest.id} (amount: ${requestAmount})`)
          // Автопополнение не сработало - отправим уведомление через минуту
          scheduleDelayedNotification(newRequest.id)
        }
      } catch (error: any) {
        console.error(`❌ [Auto-Deposit] Error checking incoming payments for request ${newRequest.id}:`, error.message)
        // Не блокируем создание заявки если проверка не удалась
        // Отправим уведомление через минуту на всякий случай
        scheduleDelayedNotification(newRequest.id)
      }
    }

    // Если это вывод, отправляем уведомление в группу и browser notification
    if (type === 'withdraw') {
      const amountStr = newRequest.amount ? parseFloat(newRequest.amount.toString()).toFixed(2) : '0.00'
      const bookmakerStr = newRequest.bookmaker || 'не указано'
      const usernameStr = newRequest.username || newRequest.firstName || 'Пользователь'
      const accountIdStr = newRequest.accountId || 'не указан'
      
      const groupMessage = `🔴 <b>Новая заявка на вывод</b>\n\n` +
        `👤 Пользователь: ${usernameStr}\n` +
        `💰 Сумма: ${amountStr} сом\n` +
        `🎰 Казино: ${bookmakerStr}\n` +
        `🆔 ID аккаунта: ${accountIdStr}\n` +
        `📋 ID заявки: #${newRequest.id}\n\n` +
        `Статус: ожидает обработки`
      
      sendTelegramGroupMessage(groupMessage).catch(err => {
        console.error('Failed to send withdrawal notification to group:', err)
      })
      
      // Отправляем browser notification через Service Worker
      // Это будет обработано когда dashboard откроется и обнаружит новую заявку
    }
    
    // Если это пополнение:
    // - Если автопополнение сработало - уведомление НЕ отправляем (уже обработано)
    // - Если автопополнение не сработало - уведомление будет отправлено через минуту через scheduleDelayedNotification

    const response = NextResponse.json(
      createApiResponse({
        id: newRequest.id,
        transactionId: newRequest.id,
        message: 'Заявка успешно создана',
      })
    )
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  } catch (error: any) {
    console.error('❌ Payment API error:', error)
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack?.substring(0, 500)
    })
    
    // Проверяем, является ли это ошибкой уникального ограничения (duplicate key)
    if (error.code === 'P2002') {
      const errorResponse = NextResponse.json(
        createApiResponse(null, 'Заявка с такими данными уже существует. Пожалуйста, подождите обработки предыдущей заявки.'),
        { status: 409 }
      )
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }
    
    // Проверяем, является ли это ошибкой валидации
    if (error.code === 'P2003' || error.code === 'P2011') {
      const errorResponse = NextResponse.json(
        createApiResponse(null, 'Ошибка валидации данных. Проверьте правильность введенных данных.'),
        { status: 400 }
      )
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }
    
    const errorResponse = NextResponse.json(
      createApiResponse(null, error.message || 'Ошибка при создании заявки. Пожалуйста, попробуйте еще раз.'),
      { status: 500 }
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, status_detail } = body

    if (!id || !status) {
      const response = NextResponse.json(
        createApiResponse(null, 'Missing required fields: id, status'),
        { status: 400 }
      )
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    // ЗАЩИТА: Проверяем, что это не попытка автоматически отменить вывод
    const existingRequest = await prisma.request.findUnique({
      where: { id: parseInt(id) },
      select: { requestType: true, status: true }
    })

    if (!existingRequest) {
      const response = NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    // ЗАЩИТА: Выводы НЕ МОГУТ быть отклонены через этот endpoint
    // Отклонение выводов возможно ТОЛЬКО через админку администратором
    if (status === 'rejected' && existingRequest.requestType === 'withdraw') {
      console.log(`[Payment API] ❌ Attempt to reject withdrawal ${id} via PUT /api/payment - BLOCKED`)
      const response = NextResponse.json(
        createApiResponse(null, 'Withdrawals cannot be rejected automatically. Only admin can reject via admin panel.'),
        { status: 403 }
      )
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    const updateData: any = {
      status,
    }

    if (status_detail) {
      updateData.statusDetail = status_detail
    }

    if (['completed', 'rejected', 'approved'].includes(status)) {
      updateData.processedAt = new Date()
    }

    const updatedRequest = await prisma.request.update({
      where: { id: parseInt(id) },
      data: updateData,
    })

    const response = NextResponse.json(
      createApiResponse({
        ...updatedRequest,
        amount: updatedRequest.amount ? updatedRequest.amount.toString() : null,
      })
    )
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  } catch (error: any) {
    console.error('Payment API update error:', error)
    const errorResponse = NextResponse.json(
      createApiResponse(null, error.message || 'Failed to update request'),
      { status: 500 }
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

