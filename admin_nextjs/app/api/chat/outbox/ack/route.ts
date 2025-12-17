import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

interface AckItem {
  id: number
  telegram_message_id?: string
  media_url?: string
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request)
    const body = await request.json()
    const items: AckItem[] = body.messages || body.items || []

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        createApiResponse(null, 'messages array is required'),
        { status: 400 }
      )
    }

    for (const item of items) {
      if (!item.id) continue
      await prisma.chatMessage.update({
        where: { id: item.id },
        data: {
          telegramMessageId: item.telegram_message_id
            ? BigInt(item.telegram_message_id)
            : BigInt(item.id),
          mediaUrl: item.media_url || undefined,
        },
      })
    }

    return NextResponse.json(createApiResponse({ success: true }))
  } catch (error: any) {
    console.error('Outbox ack API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to ack outbox'),
      { status: 500 }
    )
  }
}


