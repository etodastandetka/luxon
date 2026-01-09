import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, createApiResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Обработка Next.js 15+ где params может быть Promise
    const resolvedParams = params instanceof Promise ? await params : params
    const id = parseInt(resolvedParams.id)
    
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
        userId: true,
      },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    // Проверяем авторизацию (опционально для админов)
    const authUser = getAuthUser(request)
    
    // Если пользователь не авторизован, проверяем по userId из query параметра
    // Это позволяет клиентскому приложению получать фото своей заявки
    if (!authUser) {
      const userIdParam = request.nextUrl.searchParams.get('user_id')
      if (userIdParam) {
        try {
          const userId = BigInt(userIdParam)
          if (requestData.userId !== userId) {
            return NextResponse.json(
              createApiResponse(null, 'Unauthorized'),
              { status: 401 }
            )
          }
        } catch (e) {
          // Если userId невалидный, разрешаем доступ (для обратной совместимости)
        }
      }
    }

    // Формируем полный URL если photoFileUrl относительный
    let photoFileUrl = requestData.photoFileUrl
    if (photoFileUrl && photoFileUrl.startsWith('/api/')) {
      const baseUrl = request.nextUrl.origin
      photoFileUrl = `${baseUrl}${photoFileUrl}`
    }

    const response = NextResponse.json(
      createApiResponse({
        photoFileUrl: photoFileUrl,
      }),
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
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
      {
        status: error.message === 'Unauthorized' ? 401 : 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}
