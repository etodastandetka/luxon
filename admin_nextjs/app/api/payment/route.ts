import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import { sendTelegramGroupMessage } from '@/lib/telegram-group'

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
    const body = await request.json()

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
      receipt_photo, // base64 строка фото чека
      payment_method, // 'bank' или 'crypto'
      crypto_invoice_id, // ID крипто invoice
    } = body

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

    // Проверяем обязательные поля
    // Для error_log type и amount не требуются
    if (!type) {
      console.error('❌ Payment API: Missing required field: type', { 
        body: JSON.stringify(body).substring(0, 500)
      })
      return NextResponse.json(
        createApiResponse(null, 'Missing required field: type'),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Для error_log не требуем amount
    if (type !== 'error_log' && !amount) {
      console.error('❌ Payment API: Missing required field: amount', { 
        userId, 
        user_id, 
        telegram_user_id, 
        playerId, 
        finalUserId,
        type, 
        amount,
        body: JSON.stringify(body).substring(0, 500)
      })
      return NextResponse.json(
        createApiResponse(null, 'Missing required field: amount'),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Для error_log просто логируем и возвращаем успех
    if (type === 'error_log') {
      console.log('📝 Error log received:', {
        error: body.error,
        telegram_user_id: body.telegram_user_id,
        url: body.error?.url,
        message: body.error?.message
      })
      return NextResponse.json(
        createApiResponse({ logged: true }, 'Error logged successfully'),
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
      amount: parseFloat(amount),
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

    // Для криптоплатежей сохраняем amount_usd в statusDetail
    let statusDetail: string | null = null
    if (payment_method === 'crypto' && amount_usd) {
      statusDetail = JSON.stringify({
        amount_usd: parseFloat(amount_usd),
        amount_kgs: parseFloat(amount)
      })
    }

    const newRequest = await prisma.request.create({
      data: {
        userId: userIdBigInt,
        username: telegram_username,
        firstName: telegram_first_name,
        lastName: telegram_last_name,
        bookmaker,
        accountId: finalAccountId?.toString(),
        amount: parseFloat(amount), // В сомах (для пополнения в казино)
        requestType: type,
        bank,
        phone,
        status: 'pending',
        statusDetail: statusDetail, // Для крипты содержит JSON с amount_usd и amount_kgs
        photoFileUrl: receipt_photo || null, // Сохраняем base64 фото чека
        paymentMethod: payment_method || 'bank', // 'bank' или 'crypto'
        cryptoPaymentId: cryptoPaymentId,
      },
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

    // Если это вывод, отправляем уведомление в группу
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
    }

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

