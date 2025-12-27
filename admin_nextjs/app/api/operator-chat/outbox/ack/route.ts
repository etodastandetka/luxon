import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

interface AckItem {
  id: number
  telegram_message_id?: string
  media_url?: string
}

const requireTokenIfSet = (req: NextRequest) => {
  const token = process.env.OPERATOR_OUTBOX_TOKEN
  if (!token) return true
  const header = req.headers.get('x-operator-token')
  return header === token
}

export async function POST(request: NextRequest) {
  try {
    if (!requireTokenIfSet(request)) {
      return NextResponse.json(
        createApiResponse(null, 'Unauthorized'),
        { status: 401 }
      )
    }

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
      try {
        await prisma.operatorMessage.update({
          where: { id: item.id },
          data: {
            telegramMessageId: item.telegram_message_id
              ? BigInt(item.telegram_message_id)
              : BigInt(item.id),
            mediaUrl: item.media_url || undefined,
          },
        })
      } catch (error: any) {
        // Если таблица operator_messages не существует (P2021), пропускаем обновление
        if (error.code === 'P2021' && error.meta?.table === 'public.operator_messages') {
          console.warn(`⚠️ operator_messages table not found, skipping update for message ${item.id}`)
          continue
        }
        // Если сообщение не найдено (P2025), просто продолжаем
        if (error.code === 'P2025') {
          console.warn(`⚠️ Message ${item.id} not found, skipping`)
          continue
        }
        throw error
      }
    }

    return NextResponse.json(createApiResponse(null, undefined, 'Acknowledged'))
  } catch (error: any) {
    console.error('Operator outbox ack API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to ack outbox'),
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'


