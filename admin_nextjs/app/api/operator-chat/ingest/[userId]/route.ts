import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Публичный эндпоинт для сохранения входящих сообщений от пользователя (операторский канал, вызывается Pyrogram)
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    let userId: bigint
    try {
      userId = BigInt(params.userId)
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      message_text,
      message_type = 'text',
      media_url,
      telegram_message_id,
    } = body

    if (!message_text?.trim() && !media_url) {
      return NextResponse.json(
        { success: false, error: 'Message text or media is required' },
        { status: 400 }
      )
    }

    let message
    try {
      message = await prisma.operatorMessage.create({
        data: {
          userId,
          messageText: message_text || null,
          messageType: message_type,
          direction: 'in',
          telegramMessageId: telegram_message_id ? BigInt(telegram_message_id) : null,
          mediaUrl: media_url || null,
        },
      })
    } catch (error: any) {
      // Если таблица operator_messages не существует (P2021), пропускаем сохранение в БД
      if (error.code === 'P2021' && error.meta?.table === 'public.operator_messages') {
        console.warn('⚠️ operator_messages table not found, skipping DB save')
        // Создаем минимальный объект для ответа
        message = { id: 0 } as any
      } else {
        throw error
      }
    }

    return NextResponse.json({
      success: true,
      messageId: message.id,
    })
  } catch (error: any) {
    console.error('Operator ingest API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save message' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'








