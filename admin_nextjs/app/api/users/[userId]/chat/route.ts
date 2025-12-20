import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// Получение истории чата с пользователем
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    requireAuth(request)

    let userId: bigint
    try {
      userId = BigInt(params.userId)
    } catch (e) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID'),
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const channel = searchParams.get('channel') || 'bot'

    let messages
    try {
      messages = await prisma.chatMessage.findMany({
        where: { userId, channel },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    } catch (error: any) {
      // Если колонка channel не существует (P2022), делаем запрос без фильтра по channel
      if (error.code === 'P2022' && error.meta?.column === 'chat_messages.channel') {
        console.warn('⚠️ Channel column not found, querying messages without channel filter')
        messages = await prisma.chatMessage.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })
      } else {
        throw error
      }
    }

    return NextResponse.json(
      createApiResponse({
        messages: messages.map(msg => ({
          ...msg,
          userId: msg.userId.toString(),
          telegramMessageId: msg.telegramMessageId?.toString(),
        })),
      })
    )
  } catch (error: any) {
    console.error('Chat history API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch chat history'),
      { status: 500 }
    )
  }
}

