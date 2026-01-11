import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// Обновить шаблон
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request)

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid template ID'),
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, text, content, category } = body

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    // Поддерживаем оба варианта: text и content (для совместимости)
    if (text !== undefined) updateData.text = text
    if (content !== undefined) updateData.text = content
    if (category !== undefined) updateData.category = category || null

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(createApiResponse(template))
  } catch (error: any) {
    console.error('Message templates API error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createApiResponse(null, 'Template not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to update message template'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

// Удалить шаблон
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request)

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid template ID'),
        { status: 400 }
      )
    }

    await prisma.messageTemplate.delete({
      where: { id },
    })

    return NextResponse.json(createApiResponse({ success: true }))
  } catch (error: any) {
    console.error('Message templates API error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createApiResponse(null, 'Template not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to delete message template'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

