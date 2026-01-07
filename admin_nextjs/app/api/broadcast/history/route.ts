import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Получение истории рассылок
export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const broadcasts = await prisma.broadcastMessage.findMany({
      where: {
        isSent: true,
      },
      orderBy: {
        sentAt: 'desc',
      },
      take: 50, // Последние 50 рассылок
    })

    // Извлекаем количество из title, если есть
    return NextResponse.json(
      createApiResponse({
        broadcasts: broadcasts.map(b => {
          // Пытаемся извлечь количество из title (формат: "Рассылка 1234 из 1500 пользователям" или "Рассылка 1234 пользователям")
          const matchFull = b.title.match(/Рассылка (\d+) из (\d+) пользователям/)
          const matchSimple = b.title.match(/Рассылка (\d+) пользователям/)
          
          let sentCount = null
          let totalCount = null
          
          if (matchFull) {
            sentCount = parseInt(matchFull[1])
            totalCount = parseInt(matchFull[2])
          } else if (matchSimple) {
            sentCount = parseInt(matchSimple[1])
          }
          
          return {
            id: b.id,
            title: b.title,
            message: b.message,
            sentAt: b.sentAt,
            createdAt: b.createdAt,
            sentCount,
            totalCount,
          }
        }),
      })
    )
  } catch (error: any) {
    console.error('Broadcast history API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch broadcast history'),
      { status: 500 }
    )
  }
}

