import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const requireTokenIfSet = (req: NextRequest) => {
  const token = process.env.OPERATOR_OUTBOX_TOKEN
  if (!token) return true
  const header = req.headers.get('x-operator-token')
  return header === token
}

export async function GET(request: NextRequest) {
  try {
    if (!requireTokenIfSet(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') || 50)

    const messages = await prisma.operatorMessage.findMany({
      where: {
        direction: 'out',
        telegramMessageId: null,
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
    })

    return NextResponse.json({
      success: true,
      data: {
        messages: messages.map((m) => ({
          id: m.id,
          userId: m.userId.toString(),
          messageText: m.messageText,
          messageType: m.messageType,
          mediaUrl: m.mediaUrl,
          createdAt: m.createdAt,
        })),
      },
    })
  } catch (error: any) {
    console.error('Operator outbox API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch outbox' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'


