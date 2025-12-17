import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const limit = Number(new URL(request.url).searchParams.get('limit') || 50)

    const messages = await prisma.chatMessage.findMany({
      where: {
        direction: 'out',
        telegramMessageId: null,
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
    })

    return NextResponse.json(
      createApiResponse({
        messages: messages.map((m) => ({
          id: m.id,
          userId: m.userId.toString(),
          messageText: m.messageText,
          messageType: m.messageType,
          mediaUrl: m.mediaUrl,
          createdAt: m.createdAt,
        })),
      })
    )
  } catch (error: any) {
    console.error('Outbox API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch outbox'),
      { status: 500 }
    )
  }
}


