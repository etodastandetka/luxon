import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Отправка рассылки всем пользователям
export async function POST(request: NextRequest) {
  try {
    requireAuth(request)

    const body = await request.json()
    const { message } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        createApiResponse(null, 'Сообщение не может быть пустым'),
        { status: 400 }
      )
    }

    const botToken = process.env.BOT_TOKEN

    if (!botToken) {
      return NextResponse.json(
        createApiResponse(null, 'BOT_TOKEN not configured'),
        { status: 500 }
      )
    }

    // URL мини-приложения для кнопки
    const miniAppUrl = process.env.MINI_APP_URL || 'https://luxon.dad'

    // Получаем всех пользователей
    const users = await prisma.botUser.findMany({
      select: {
        userId: true,
      },
    })

    if (users.length === 0) {
      return NextResponse.json(
        createApiResponse(null, 'Нет пользователей для рассылки'),
        { status: 400 }
      )
    }

    let successCount = 0
    let errorCount = 0

    // Отправляем сообщение всем пользователям с кнопкой WebApp
    for (const user of users) {
      try {
        const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
        const telegramResponse = await fetch(sendMessageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: user.userId.toString(),
            text: message,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 Открыть приложение',
                    web_app: {
                      url: miniAppUrl
                    }
                  }
                ]
              ]
            }
          })
        })

        const telegramData = await telegramResponse.json()

        if (telegramData.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch (error) {
        errorCount++
      }
    }

    // Сохраняем в историю рассылок
    const broadcastTitle = `Рассылка ${successCount} пользователям - ${new Date().toLocaleString('ru-RU')}`
    await prisma.broadcastMessage.create({
      data: {
        title: broadcastTitle,
        message: message,
        isSent: true,
        sentAt: new Date(),
      },
    })

    return NextResponse.json(
      createApiResponse({
        success: true,
        message: `Рассылка завершена. Успешно: ${successCount}, Ошибок: ${errorCount}`,
        sentCount: successCount,
        errorCount: errorCount,
        totalUsers: users.length,
      })
    )
  } catch (error: any) {
    console.error('Broadcast API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to send broadcast'),
      { status: 500 }
    )
  }
}

