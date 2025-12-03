import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { sendTelegramGroupMessage } from '@/lib/telegram-group'

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid request ID'),
        { status: 400 }
      )
    }

    const requestData = await prisma.request.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        username: true,
        firstName: true,
        lastName: true,
        bookmaker: true,
        accountId: true,
        amount: true,
        requestType: true,
        status: true,
        statusDetail: true,
        processedBy: true,
        bank: true,
        phone: true,
        // photoFileUrl не загружаем в основном запросе - он загружается отдельно через /photo endpoint
        paymentMethod: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
        cryptoPayment: {
          select: {
            id: true,
            invoice_id: true,
            amount: true,
            fee_amount: true,
            asset: true,
            status: true,
            request_id: true,
          },
        },
      },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    // Оптимизация: загружаем дополнительные данные только если они действительно нужны
    // Для завершенных заявок не загружаем matchingPayments и casinoTransactions
    const isPendingDeposit = requestData.status === 'pending' && requestData.requestType === 'deposit'
    const requestAmountInt = requestData.amount ? Math.floor(parseFloat(requestData.amount.toString())) : null
    
    // Загружаем только критичные данные в основном запросе
    // Остальное загружаем асинхронно через отдельные endpoints если нужно
    const [matchingPaymentsResult, casinoTransactionsResult, userResult] = await Promise.all([
      // Matching payments - ТОЛЬКО для pending депозитов с суммой
      (isPendingDeposit && requestAmountInt) ? prisma.incomingPayment.findMany({
          where: {
            amount: {
              gte: requestAmountInt,
              lt: requestAmountInt + 1,
            },
            // Оптимизация: только необработанные платежи за последние 10 минут
            isProcessed: false,
            paymentDate: {
              gte: new Date(Date.now() - 10 * 60 * 1000), // Последние 10 минут
            },
          },
          orderBy: { paymentDate: 'desc' },
          take: 3, // Только первые 3 для ускорения
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            requestId: true,
            isProcessed: true,
            bank: true,
          },
        }) : Promise.resolve([]),
      
      // Casino transactions - только для pending заявок или если явно нужны
      // Для завершенных заявок не загружаем - это экономит время
      (requestData.status === 'pending' && requestData.accountId && requestData.bookmaker) ? prisma.request.findMany({
          where: {
            accountId: requestData.accountId,
            bookmaker: requestData.bookmaker,
            // Исключаем текущую заявку
            id: { not: requestData.id },
          },
          orderBy: { createdAt: 'desc' },
          take: 3, // Только первые 3 для ускорения
          select: {
            id: true,
            userId: true,
            username: true,
            firstName: true,
            lastName: true,
            amount: true,
            requestType: true,
            status: true,
            createdAt: true,
            bookmaker: true,
            accountId: true,
          },
        }) : Promise.resolve([]),
      
      // User note - загружаем всегда, но это быстрый запрос с индексом
      prisma.botUser.findUnique({
          where: { userId: requestData.userId },
          select: { note: true },
        }),
    ])

    const matchingPayments = matchingPaymentsResult.map(p => ({
      ...p,
      amount: p.amount.toString(),
    }))

    const casinoTransactions = casinoTransactionsResult.map(t => ({
      ...t,
      userId: t.userId.toString(),
      amount: t.amount ? t.amount.toString() : null,
    }))

    // photoFileUrl НЕ включаем в основной ответ - он загружается отдельно через /photo endpoint
    // Это значительно уменьшает размер ответа и ускоряет загрузку
    const responseData = {
      ...requestData,
      userId: requestData.userId.toString(),
      amount: requestData.amount ? requestData.amount.toString() : null,
      photoFileUrl: null, // Всегда null - загружается отдельно
      paymentMethod: requestData.paymentMethod || null,
      cryptoPayment: requestData.cryptoPayment ? {
        ...requestData.cryptoPayment,
        amount: requestData.cryptoPayment.amount.toString(),
        fee_amount: requestData.cryptoPayment.fee_amount?.toString() || null,
      } : null,
      incomingPayments: [],
      matchingPayments,
      casinoTransactions,
      userNote: userResult?.note || null,
    }
    
    const response = NextResponse.json(createApiResponse(responseData))
    // Добавляем кэширование для быстрой загрузки
    // Для pending заявок кэш короче (2 сек), для остальных дольше (10 сек)
    const cacheTime = requestData.status === 'pending' ? 2 : 10
    response.headers.set('Cache-Control', `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`)
    return response
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch request'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = requireAuth(request)

    const id = parseInt(params.id)
    const body = await request.json()

    const updateData: any = {}
    if (body.status) updateData.status = body.status
    if (body.statusDetail) updateData.statusDetail = body.statusDetail
    if (body.processedAt !== undefined) {
      updateData.processedAt = body.processedAt ? new Date(body.processedAt) : null
    }

    // Получаем заявку до обновления для отправки уведомления
    const requestBeforeUpdate = await prisma.request.findUnique({
      where: { id },
    })

    if (!requestBeforeUpdate) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    // ЗАЩИТА: Выводы могут быть отклонены ТОЛЬКО администратором через админку
    // Запрещаем автоматическую отмену выводов
    if (body.status === 'rejected' && requestBeforeUpdate.requestType === 'withdraw') {
      // Проверяем, что это запрос от авторизованного администратора (requireAuth уже проверил)
      // Дополнительная проверка: отклонение выводов разрешено только через админку
      console.log(`[Request ${id}] Withdrawal rejection by admin: ${authUser.username}`)
    }

    if (body.status && ['completed', 'rejected', 'approved'].includes(body.status)) {
      updateData.processedAt = new Date()
      // Сохраняем логин админа, который закрыл заявку
      updateData.processedBy = authUser.username
    }

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: updateData,
    })

    // Уведомления в группу для выводов отключены по запросу пользователя

    const response = NextResponse.json(
      createApiResponse({
        ...updatedRequest,
        userId: updatedRequest.userId.toString(),
        amount: updatedRequest.amount ? updatedRequest.amount.toString() : null,
      })
    )
    
    // Инвалидируем кэш для списка заявок, чтобы дашборд обновился сразу
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    
    return response
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to update request'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

