import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// Отправка сообщения пользователю через бота
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    requireAuth(request)

    const userId = BigInt(params.userId)
    const body = await request.json()
    const { message } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        createApiResponse(null, 'Message is required'),
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

    // Отправляем сообщение через Telegram Bot API
    const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    const telegramResponse = await fetch(sendMessageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId.toString(),
        text: message,
        parse_mode: 'HTML'
      })
    })

    const telegramData = await telegramResponse.json()

    if (!telegramData.ok) {
      return NextResponse.json(
        createApiResponse(null, telegramData.description || 'Failed to send message'),
        { status: 500 }
      )
    }

    // Сохраняем сообщение в БД
    await prisma.chatMessage.create({
      data: {
        userId,
        messageText: message,
        messageType: 'text',
        direction: 'out', // Сообщение от админа к пользователю
        telegramMessageId: BigInt(telegramData.result.message_id),
      },
    })

    return NextResponse.json(
      createApiResponse({
        success: true,
        messageId: telegramData.result.message_id,
      })
    )
  } catch (error: any) {
    console.error('Send message API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to send message'),
      { status: 500 }
    )
  }
}

