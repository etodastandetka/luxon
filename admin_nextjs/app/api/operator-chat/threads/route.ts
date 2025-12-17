import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const messages = await prisma.operatorMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 400,
    })

    const latestByUser = new Map<bigint, (typeof messages)[number]>()
    for (const msg of messages) {
      if (!latestByUser.has(msg.userId)) {
        latestByUser.set(msg.userId, msg)
      }
    }

    const userIds = Array.from(latestByUser.keys())
    const users = await prisma.botUser.findMany({
      where: { userId: { in: userIds } },
    })
    const userById = new Map(users.map((u) => [u.userId.toString(), u]))

    const threads = Array.from(latestByUser.entries()).map(([userId, msg]) => {
      const u = userById.get(userId.toString())
      return {
        userId: userId.toString(),
        username: u?.username,
        firstName: u?.firstName,
        lastName: u?.lastName,
        lastMessageText: msg.messageText,
        lastMessageType: msg.messageType,
        direction: msg.direction,
        createdAt: msg.createdAt,
      }
    })

    threads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json(createApiResponse({ threads }))
  } catch (error: any) {
    console.error('Operator threads API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch operator chat threads'),
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'


