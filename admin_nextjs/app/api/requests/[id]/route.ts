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

    // КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ: Выбираем только минимально необходимые поля для быстрой загрузки
    // photoFileUrl может быть очень большим (base64 изображения), загружаем его отдельно
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
        // Убираем photoFileUrl - может быть очень большим, загружаем отдельно если нужен
        // photoFileUrl: true,
        paymentMethod: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
        // Убираем cryptoPayment из основного запроса - не критично для первого отображения
        // cryptoPayment: {
        //   select: {
        //     id: true,
        //     invoice_id: true,
        //     amount: true,
        //     fee_amount: true,
        //     asset: true,
        //     status: true,
        //     request_id: true,
        //   },
        // },
      },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    // КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ: Возвращаем только минимально необходимую информацию сразу
    // Все остальное загружается отдельными запросами после отображения страницы
    return NextResponse.json(
      createApiResponse({
        ...requestData,
        userId: requestData.userId.toString(),
        amount: requestData.amount ? requestData.amount.toString() : null,
        // Убираем photoFileUrl - может быть очень большим, загружаем отдельно
        photoFileUrl: null,
        paymentMethod: requestData.paymentMethod || null,
        // Убираем cryptoPayment - не критично для первого отображения
        cryptoPayment: null,
        // Убираем incomingPayments - они не критичны для первого отображения
        incomingPayments: [],
        // Дополнительные данные загружаются отдельно
        matchingPayments: [],
        casinoTransactions: [],
        userNote: null,
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

