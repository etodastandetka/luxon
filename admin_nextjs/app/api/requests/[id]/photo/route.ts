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
    
    // Функция для нормализации base64 строки
    const normalizeBase64 = (str: string | null): string | null => {
      if (!str) return null
      if (str.startsWith('http')) return str // URL не нормализуем
      
      // Удаляем все пробелы и переносы строк
      str = str.trim().replace(/\s/g, '')
      
      // Если уже правильный формат, возвращаем как есть
      if (/^data:image\/\w+;base64,.+$/.test(str)) {
        return str
      }
      
      // Если есть неправильный формат (например, data:image/jpegbase64 или data:image/jpegbase64,)
      // Ищем паттерн data:image/типbase64 (без точки с запятой между типом и base64)
      const wrongFormatMatch = str.match(/^data:image\/(jpeg|png|gif|webp|jpg)base64,?(.+)$/i)
      if (wrongFormatMatch) {
        const mimeType = wrongFormatMatch[1].toLowerCase()
        const base64Data = wrongFormatMatch[2]
        // Нормализуем mimeType (jpg -> jpeg)
        const normalizedMimeType = mimeType === 'jpg' ? 'jpeg' : mimeType
        console.log('📸 [Photo API] Исправлен неправильный формат (без точки с запятой):', { 
          id, 
          was: str.substring(0, 50), 
          mimeType: normalizedMimeType,
          base64Length: base64Data.length
        })
        return `data:image/${normalizedMimeType};base64,${base64Data}`
      }
      
      // Также проверяем более общий случай: data:image/любое_словоbase64
      const generalWrongMatch = str.match(/^data:image\/(\w+)base64,?(.+)$/i)
      if (generalWrongMatch) {
        const mimeType = generalWrongMatch[1].toLowerCase()
        const base64Data = generalWrongMatch[2]
        // Нормализуем mimeType
        const normalizedMimeType = mimeType === 'jpg' ? 'jpeg' : mimeType
        console.log('📸 [Photo API] Исправлен общий неправильный формат:', { 
          id, 
          was: str.substring(0, 50), 
          mimeType: normalizedMimeType 
        })
        return `data:image/${normalizedMimeType};base64,${base64Data}`
      }
      
      // Если есть data:image/... но без base64, или неправильный формат
      const partialMatch = str.match(/^data:image\/(\w+)([^;]*)(.+)$/i)
      if (partialMatch) {
        const mimeType = partialMatch[1]
        const base64Data = partialMatch[3].replace(/^[,;]/, '') // Убираем лишние символы
        console.log('📸 [Photo API] Исправлен частичный формат:', { id, mimeType, base64Length: base64Data.length })
        return `data:image/${mimeType};base64,${base64Data}`
      }
      
      // Если нет префикса data:image вообще, добавляем его
      // Пытаемся определить тип изображения по первым байтам base64
      let mimeType = 'image/jpeg' // По умолчанию JPEG
      
      if (str.startsWith('iVBORw0KGgo') || str.startsWith('iVBOR')) {
        mimeType = 'image/png'
      } else if (str.startsWith('R0lGODlh') || str.startsWith('R0lGODdh')) {
        mimeType = 'image/gif'
      } else if (str.startsWith('/9j/') || str.startsWith('/9j')) {
        mimeType = 'image/jpeg'
      } else if (str.startsWith('UklGR')) {
        mimeType = 'image/webp'
      } else {
        // Если не можем определить, но это похоже на валидный base64
        if (str.length > 100 && /^[A-Za-z0-9+/=]+$/.test(str)) {
          mimeType = 'image/jpeg' // Используем JPEG по умолчанию
        }
      }
      
      console.log('📸 [Photo API] Добавлен префикс к фото:', { id, mimeType, originalLength: str.length })
      return `data:${mimeType};base64,${str}`
    }
    
    // Нормализуем фото
    photoFileUrl = normalizeBase64(photoFileUrl)

    console.log('📸 [Photo API] Загрузка фото:', {
      id,
      hasPhoto: !!photoFileUrl,
      photoLength: photoFileUrl?.length || 0,
      isBase64: photoFileUrl?.startsWith('data:image') || false,
      photoPreview: photoFileUrl ? photoFileUrl.substring(0, 100) + '...' : null,
      isNull: photoFileUrl === null,
      isUndefined: photoFileUrl === undefined
    })
    
    // Если фото нет в базе данных, возвращаем явный ответ
    if (!photoFileUrl) {
      console.warn(`⚠️ [Photo API] Фото не найдено в БД для заявки ${id}`)
      return NextResponse.json(
        createApiResponse({
          photoFileUrl: null,
        }, 'Photo not found')
      )
    }

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

