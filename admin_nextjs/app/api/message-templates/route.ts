import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// Получить все шаблоны
export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const templates = await prisma.messageTemplate.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(createApiResponse(templates))
  } catch (error: any) {
    console.error('Message templates API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch message templates'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

// Создать новый шаблон
export async function POST(request: NextRequest) {
  try {
    requireAuth(request)

    const body = await request.json()
    const { title, text, category } = body

    if (!title || !text) {
      return NextResponse.json(
        createApiResponse(null, 'Title and text are required'),
        { status: 400 }
      )
    }

    const template = await prisma.messageTemplate.create({
      data: {
        title,
        text,
        category: category || null,
      },
    })

    return NextResponse.json(createApiResponse(template))
  } catch (error: any) {
    console.error('Message templates API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to create message template'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

