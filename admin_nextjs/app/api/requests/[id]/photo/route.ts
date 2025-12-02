import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid request ID'),
        { status: 400 }
      )
    }
    
    const requestData = await prisma.request.findUnique({
      where: { id },
      select: {
        photoFileUrl: true,
      },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    let photoFileUrl = requestData.photoFileUrl
    
    // Нормализуем фото: если это base64 без префикса, добавляем его
    if (photoFileUrl && !photoFileUrl.startsWith('data:image') && !photoFileUrl.startsWith('http')) {
      // Пытаемся определить тип изображения
      let mimeType = 'image/jpeg' // По умолчанию JPEG
      
      if (photoFileUrl.startsWith('iVBORw0KGgo')) {
        mimeType = 'image/png'
      } else if (photoFileUrl.startsWith('R0lGODlh') || photoFileUrl.startsWith('R0lGODdh')) {
        mimeType = 'image/gif'
      } else if (photoFileUrl.startsWith('/9j/')) {
        mimeType = 'image/jpeg'
      } else if (photoFileUrl.startsWith('UklGR')) {
        mimeType = 'image/webp'
      }
      
      photoFileUrl = `data:${mimeType};base64,${photoFileUrl}`
      console.log('📸 [Photo API] Нормализован формат фото:', { id, mimeType })
    }

    console.log('📸 [Photo API] Загрузка фото:', {
      id,
      hasPhoto: !!photoFileUrl,
      photoLength: photoFileUrl?.length || 0,
      isBase64: photoFileUrl?.startsWith('data:image') || false
    })

    return NextResponse.json(
      createApiResponse({
        photoFileUrl: photoFileUrl,
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch photo'),
      { status: 500 }
    )
  }
}

