import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Публичный эндпоинт для получения списка реквизитов (без авторизации)
export async function GET(request: NextRequest) {
  try {
    const requisites = await prisma.botRequisite.findMany({
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    // Находим активный реквизит
    const activeRequisite = requisites.find(r => r.isActive)
    const activeId = activeRequisite?.id || null

    // Формируем ответ в формате, который ожидает клиентский сайт
    const response = {
      success: true,
      requisites: requisites.map(r => ({
        id: r.id,
        value: r.value,
        name: r.name,
        is_active: r.isActive,
        created_at: r.createdAt.toISOString(),
      })),
      active_id: activeId,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Requisites list API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch requisites' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

