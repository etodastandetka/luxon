import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

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

    const limit = parseInt(new URL(request.url).searchParams.get('limit') || '50')

    const messages = await prisma.operatorMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(
      createApiResponse({
        messages: messages.map((m) => ({
          ...m,
          userId: m.userId.toString(),
          telegramMessageId: m.telegramMessageId?.toString(),
        })),
      })
    )
  } catch (error: any) {
    console.error('Operator chat history API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch operator chat history'),
      { status: 500 }
    )
  }
}



