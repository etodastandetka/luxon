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

    const requestData = await prisma.request.findUnique({
      where: { id },
      include: {
        incomingPayments: true,
        cryptoPayment: true,
      },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    // Получаем все входящие платежи с совпадающей суммой (по целой части)
    // Если заявка на 100.23, показываем все платежи на 100.XX
    let matchingPayments: any[] = []
    if (requestData.amount) {
      const requestAmountInt = Math.floor(parseFloat(requestData.amount.toString()))
      
      // Получаем все платежи с той же целой частью суммы
      const allPayments = await prisma.incomingPayment.findMany({
        where: {
          amount: {
            gte: requestAmountInt,
            lt: requestAmountInt + 1,
          },
        },
        orderBy: { paymentDate: 'desc' },
        take: 50,
      })

      matchingPayments = allPayments.map(p => ({
        ...p,
        amount: p.amount.toString(),
      }))
    }

    // Получаем все транзакции по accountId (ID казино), если он есть
    // Включаем все заявки с таким же accountId и букмекером от всех пользователей
    let casinoTransactions: any[] = []
    if (requestData.accountId) {
      casinoTransactions = await prisma.request.findMany({
        where: {
          accountId: requestData.accountId,
          bookmaker: requestData.bookmaker, // Также фильтруем по букмекеру для точности
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // Лимит на количество транзакций
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
      })
    }

    // Получаем заметку пользователя
    const user = await prisma.botUser.findUnique({
      where: { userId: requestData.userId },
      select: { note: true },
    })

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

    if (body.status && ['completed', 'rejected', 'approved'].includes(body.status)) {
      updateData.processedAt = new Date()
      // Сохраняем логин админа, который закрыл заявку
      updateData.processedBy = authUser.username
    }

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: updateData,
    })

    // Отправляем уведомление пользователю в Telegram при изменении статуса
    if (body.status && body.status !== requestBeforeUpdate.status) {
      const amount = updatedRequest.amount ? parseFloat(updatedRequest.amount.toString()).toFixed(2) : '0.00'
      const bookmaker = updatedRequest.bookmaker || 'казино'
      
      let notificationMessage = ''
      
      if (body.status === 'completed' || body.status === 'approved') {
        notificationMessage = `✅ <b>Ваша заявка успешно обработана!</b>\n\n` +
          `💰 Сумма: ${amount} сом\n` +
          `🎰 Казино: ${bookmaker}\n\n` +
          `Ваш баланс пополнен. Спасибо за использование нашего сервиса!`
      } else if (body.status === 'rejected') {
        notificationMessage = `❌ <b>Ваша заявка отклонена</b>\n\n` +
          `💰 Сумма: ${amount} сом\n` +
          `🎰 Казино: ${bookmaker}\n\n` +
          `Пожалуйста, обратитесь в поддержку для уточнения деталей.`
      }

      if (notificationMessage) {
        // Отправляем уведомление асинхронно, не блокируя ответ
        sendTelegramNotification(updatedRequest.userId, notificationMessage).catch(err => {
          console.error('Failed to send notification:', err)
        })
      }
      
      // Если это вывод, отправляем уведомление в группу
      if (updatedRequest.requestType === 'withdraw') {
        const usernameStr = updatedRequest.username || updatedRequest.firstName || 'Пользователь'
        const accountIdStr = updatedRequest.accountId || 'не указан'
        
        let groupMessage = ''
        if (body.status === 'completed' || body.status === 'approved') {
          groupMessage = `✅ <b>Вывод обработан</b>\n\n` +
            `👤 Пользователь: ${usernameStr}\n` +
            `💰 Сумма: ${amount} сом\n` +
            `🎰 Казино: ${bookmaker}\n` +
            `🆔 ID аккаунта: ${accountIdStr}\n` +
            `📋 ID заявки: #${updatedRequest.id}\n\n` +
            `Статус: успешно пополнен`
        } else if (body.status === 'rejected') {
          groupMessage = `❌ <b>Вывод отклонен</b>\n\n` +
            `👤 Пользователь: ${usernameStr}\n` +
            `💰 Сумма: ${amount} сом\n` +
            `🎰 Казино: ${bookmaker}\n` +
            `🆔 ID аккаунта: ${accountIdStr}\n` +
            `📋 ID заявки: #${updatedRequest.id}\n\n` +
            `Статус: отклонен`
        }
        
        if (groupMessage) {
          sendTelegramGroupMessage(groupMessage).catch(err => {
            console.error('Failed to send withdrawal status notification to group:', err)
          })
        }
      }
    }

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

