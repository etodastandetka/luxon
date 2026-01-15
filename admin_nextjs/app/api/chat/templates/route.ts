import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// Получение всех шаблонов
export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const templates = await prisma.chatMessageTemplate.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(
      createApiResponse(templates)
    )
  } catch (error: any) {
    console.error('Get templates API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch templates'),
      { status: 500 }
    )
  }
}

// Создание нового шаблона
export async function POST(request: NextRequest) {
  try {
    requireAuth(request)

    const body = await request.json()
    const { text, order } = body

    if (!text || !text.trim()) {
      return NextResponse.json(
        createApiResponse(null, 'Template text is required'),
        { status: 400 }
      )
    }

    // Получаем максимальный order для установки нового
    const maxOrder = await prisma.chatMessageTemplate.aggregate({
      _max: { order: true },
    })

    const template = await prisma.chatMessageTemplate.create({
      data: {
        text: text.trim(),
        order: order !== undefined ? order : (maxOrder._max.order || 0) + 1,
      },
    })

    return NextResponse.json(
      createApiResponse(template)
    )
  } catch (error: any) {
    console.error('Create template API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to create template'),
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

