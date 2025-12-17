import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const items: AckItem[] = body.messages || body.items || []

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'messages array is required' },
        { status: 400 }
      )
    }

    for (const item of items) {
      if (!item.id) continue
      await prisma.operatorMessage.update({
        where: { id: item.id },
        data: {
          telegramMessageId: item.telegram_message_id
            ? BigInt(item.telegram_message_id)
            : BigInt(item.id),
          mediaUrl: item.media_url || undefined,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Operator outbox ack API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to ack outbox' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'


