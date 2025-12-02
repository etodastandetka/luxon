import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '../../../../../lib/api-helpers'
import { prisma } from '../../../../../lib/prisma'

// Отправка сообщения пользователю через бота (поддерживает текст, фото и видео)
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    requireAuth(request)

    let userId: bigint
    try {
      userId = BigInt(params.userId)
    } catch (e) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID'),
        { status: 400 }
      )
    }

    const botToken = process.env.BOT_TOKEN

    // Логируем токен для отладки (первые 10 символов для безопасности)
    console.log('🔑 BOT_TOKEN used:', botToken ? `${botToken.substring(0, 15)}...` : 'NOT SET')

    if (!botToken) {
      return NextResponse.json(
        createApiResponse(null, 'BOT_TOKEN not configured'),
        { status: 500 }
      )
    }

    // Проверяем, есть ли файл в запросе (FormData)
    const contentType = request.headers.get('content-type') || ''
    let message: string | null = null
    let file: File | null = null
    let fileType: string | null = null
    let mediaUrl: string | null = null
    let messageType = 'text'

    if (contentType.includes('multipart/form-data')) {
      // Обрабатываем FormData
      const formData = await request.formData()
      message = formData.get('message') as string | null
      file = formData.get('file') as File | null
      fileType = formData.get('fileType') as string | null

      if (!message?.trim() && !file) {
        return NextResponse.json(
          createApiResponse(null, 'Message or file is required'),
          { status: 400 }
        )
      }
    } else {
      // Обрабатываем JSON (обратная совместимость)
      const body = await request.json()
      message = body.message

      if (!message || !message.trim()) {
        return NextResponse.json(
          createApiResponse(null, 'Message is required'),
          { status: 400 }
        )
      }
    }

    let telegramData: any
    let telegramMessageId: bigint

    if (file) {
      // Отправляем медиа (фото или видео)
      const isVideo = fileType?.startsWith('video/')
      const isPhoto = fileType?.startsWith('image/')

      if (!isPhoto && !isVideo) {
        return NextResponse.json(
          createApiResponse(null, 'File must be an image or video'),
          { status: 400 }
        )
      }

      // Конвертируем файл в Blob для отправки
      const arrayBuffer = await file.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: fileType || (isPhoto ? 'image/jpeg' : 'video/mp4') })

      // Создаем FormData для Telegram API
      // В Node.js 18+ глобальный FormData должен работать с fetch
      const telegramFormData = new FormData()
      telegramFormData.append('chat_id', userId.toString())
      if (message?.trim()) {
        telegramFormData.append('caption', message)
      }
      telegramFormData.append(isPhoto ? 'photo' : 'video', blob, file.name)

      const apiEndpoint = isPhoto 
        ? `https://api.telegram.org/bot${botToken}/sendPhoto`
        : `https://api.telegram.org/bot${botToken}/sendVideo`

      const telegramResponse = await fetch(apiEndpoint, {
        method: 'POST',
        body: telegramFormData,
      })

      telegramData = await telegramResponse.json()

      if (!telegramData.ok) {
        return NextResponse.json(
          createApiResponse(null, telegramData.description || 'Failed to send media'),
          { status: 500 }
        )
      }

      messageType = isPhoto ? 'photo' : 'video'
      telegramMessageId = BigInt(telegramData.result.message_id)
      
      // Получаем URL медиа из ответа Telegram
      const media = telegramData.result.photo?.[telegramData.result.photo.length - 1] || telegramData.result.video
      if (media?.file_id) {
        // Получаем путь к файлу
        const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${media.file_id}`
        const fileResponse = await fetch(getFileUrl)
        const fileData = await fileResponse.json()
        
        if (fileData.ok && fileData.result?.file_path) {
          mediaUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
        }
      }
    } else {
      // Отправляем текстовое сообщение
      const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
      const telegramResponse = await fetch(sendMessageUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: userId.toString(),
          text: message,
          parse_mode: 'HTML'
        })
      })

      telegramData = await telegramResponse.json()

      if (!telegramData.ok) {
        return NextResponse.json(
          createApiResponse(null, telegramData.description || 'Failed to send message'),
          { status: 500 }
        )
      }

      telegramMessageId = BigInt(telegramData.result.message_id)
    }

    // Сохраняем сообщение в БД
    await prisma.chatMessage.create({
      data: {
        userId,
        messageText: message,
        messageType,
        direction: 'out', // Сообщение от админа к пользователю
        telegramMessageId,
        mediaUrl,
      },
    })

    return NextResponse.json(
      createApiResponse({
        success: true,
        messageId: Number(telegramMessageId),
        mediaUrl,
      })
    )
  } catch (error: any) {
    console.error('Send message API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to send message'),
      { status: 500 }
    )
  }
}

