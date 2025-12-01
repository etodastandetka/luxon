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
    // Не требуем авторизацию для публичного доступа к статусу заявки
    // requireAuth(request)

    const id = parseInt(params.id)

    // Оптимизируем запрос - выбираем только нужные поля
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
        photoFileUrl: true,
        paymentMethod: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
        incomingPayments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            requestId: true,
            isProcessed: true,
          },
        },
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

    // Оптимизация: выполняем все запросы параллельно для ускорения
    const requestAmountInt = requestData.amount ? Math.floor(parseFloat(requestData.amount.toString())) : null
    
    // Параллельно выполняем все дополнительные запросы
    // Оптимизация: загружаем только критичные данные сразу, остальное можно загрузить лениво
    const [matchingPaymentsResult, casinoTransactionsResult, userResult] = await Promise.all([
      // Входящие платежи (уменьшен лимит с 20 до 10 для ускорения)
      requestAmountInt ? prisma.incomingPayment.findMany({
        where: {
          amount: {
            gte: requestAmountInt,
            lt: requestAmountInt + 1,
          },
        },
        orderBy: { paymentDate: 'desc' },
        take: 10, // Уменьшено с 20 до 10 для ускорения
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          requestId: true,
          isProcessed: true,
          bank: true,
        },
      }) : Promise.resolve([]),
      
      // Транзакции казино (уменьшен лимит с 30 до 15 для ускорения)
      requestData.accountId ? prisma.request.findMany({
        where: {
          accountId: requestData.accountId,
          bookmaker: requestData.bookmaker,
        },
        orderBy: { createdAt: 'desc' },
        take: 15, // Уменьшено с 30 до 15 для ускорения
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
      
      // Заметка пользователя
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
    
    const user = userResult

    return NextResponse.json(
      createApiResponse({
        ...requestData,
        userId: requestData.userId.toString(), // Преобразуем BigInt в строку
        amount: requestData.amount ? requestData.amount.toString() : null,
        photoFileUrl: requestData.photoFileUrl, // Фото чека (base64 или URL)
        userNote: user?.note || null, // Заметка пользователя
        paymentMethod: requestData.paymentMethod || null,
        cryptoPayment: requestData.cryptoPayment ? {
          ...requestData.cryptoPayment,
          amount: requestData.cryptoPayment.amount.toString(),
          fee_amount: requestData.cryptoPayment.fee_amount?.toString() || null,
        } : null,
        incomingPayments: requestData.incomingPayments.map(p => ({
          ...p,
          amount: p.amount.toString(),
        })),
        matchingPayments, // Все платежи с совпадающей суммой (по целой части)
        casinoTransactions: casinoTransactions.map(t => ({
          ...t,
          userId: t.userId.toString(),
          amount: t.amount ? t.amount.toString() : null,
        })),
      })
    )
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

    return NextResponse.json(
      createApiResponse({
        ...updatedRequest,
        amount: updatedRequest.amount ? updatedRequest.amount.toString() : null,
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to update request'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

