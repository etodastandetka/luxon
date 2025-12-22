import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request)
    
    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid request ID'),
        { status: 400 }
      )
    }

    // Загружаем только photoFileUrl для уменьшения размера запроса
    const requestData = await prisma.request.findUnique({
      where: { id },
      select: {
        id: true,
        photoFileUrl: true,
      },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    const response = NextResponse.json(
      createApiResponse({
        photoFileUrl: requestData.photoFileUrl,
      })
    )
    
    // Кэшируем фото на 60 секунд для ускорения (фото редко меняется)
    // Используем более длительное кэширование для ускорения повторных загрузок
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    // Добавляем заголовки для оптимизации
    response.headers.set('X-Content-Type-Options', 'nosniff')
    
    return response
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch photo'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
