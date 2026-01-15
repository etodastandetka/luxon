import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// Обновление шаблона
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    requireAuth(request)

    const resolvedParams = params instanceof Promise ? await params : params
    const id = parseInt(resolvedParams.id)

    if (isNaN(id)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid template ID'),
        { status: 400 }
      )
    }

    const body = await request.json()
    const { text, order, isActive } = body

    const updateData: any = {}
    if (text !== undefined) updateData.text = text.trim()
    if (order !== undefined) updateData.order = order
    if (isActive !== undefined) updateData.isActive = isActive

    const template = await prisma.chatMessageTemplate.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(
      createApiResponse(template)
    )
  } catch (error: any) {
    console.error('Update template API error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createApiResponse(null, 'Template not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to update template'),
      { status: 500 }
    )
  }
}

// Удаление шаблона
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    requireAuth(request)

    const resolvedParams = params instanceof Promise ? await params : params
    const id = parseInt(resolvedParams.id)

    if (isNaN(id)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid template ID'),
        { status: 400 }
      )
    }

    // Мягкое удаление (помечаем как неактивный)
    await prisma.chatMessageTemplate.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json(
      createApiResponse({ success: true })
    )
  } catch (error: any) {
    console.error('Delete template API error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createApiResponse(null, 'Template not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to delete template'),
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

