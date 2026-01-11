import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import { 
  protectAPI, 
  rateLimit, 
  sanitizeInput, 
  containsSQLInjection,
  getClientIP 
} from '@/lib/security'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const saveLocalFile = async (file: File, mime?: string): Promise<{ url: string; type: string }> => {
  const uploadDir = path.join(process.cwd(), 'tmp', 'chat_uploads')
  await fs.promises.mkdir(uploadDir, { recursive: true })
  const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : ''
  const fileId = `${Date.now()}-${randomUUID()}${ext}`
  const dest = path.join(uploadDir, fileId)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.promises.writeFile(dest, buffer)
  const kind = mime?.startsWith('image/')
    ? 'photo'
    : mime?.startsWith('video/')
    ? 'video'
    : mime?.startsWith('audio/')
    ? 'audio'
    : 'document'
  return { url: `/api/chat/file/${fileId}`, type: kind }
}

// Публичный эндпоинт для отправки сообщений в чат (для клиентского сайта)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  try {
    // 🛡️ ЗАЩИТА
    const protectionResult = protectAPI(request)
    if (protectionResult) return protectionResult

    // Обработка Next.js 15+ где params может быть Promise
    const resolvedParams = params instanceof Promise ? await params : params

    // Rate limiting
    const rateLimitResult = rateLimit({ 
      maxRequests: 20, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `chat_send:${resolvedParams.userId}:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) return rateLimitResult

    let userId = resolvedParams.userId

    // 🛡️ Валидация и очистка входных данных
    if (!userId) {
      return NextResponse.json(
        createApiResponse(null, 'User ID is required'),
        { status: 400 }
      )
    }

    // Проверка на SQL инъекции
    if (containsSQLInjection(userId)) {
      console.warn(`🚫 SQL injection attempt from ${getClientIP(request)}: ${userId}`)
      return NextResponse.json(
        createApiResponse(null, 'Invalid input'),
        { status: 400 }
      )
    }

    // Очистка и валидация
    userId = sanitizeInput(userId) as string

    // Проверка формата (должен быть числом)
    if (!/^\d+$/.test(userId)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID format'),
        { status: 400 }
      )
    }

    let userIdBigInt: bigint
    try {
      userIdBigInt = BigInt(userId)
    } catch (e) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID'),
        { status: 400 }
      )
    }

    const contentType = request.headers.get('content-type') || ''
    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel') || 'bot'

    let messageText: string | null = null
    let file: File | null = null
    let fileType: string | null = null
    let mediaUrl: string | null = null
    let messageType = 'text'
    let replyToId: number | null = null

    if (contentType.includes('multipart/form-data')) {
      // Обрабатываем FormData (с файлом)
      const formData = await request.formData()
      file = formData.get('file') as File | null
      messageText = (formData.get('message') as string | null) || null
      fileType = (formData.get('fileType') as string | null) || null
      const replyToIdStr = formData.get('replyToId') as string | null
      if (replyToIdStr) {
        replyToId = parseInt(replyToIdStr)
        if (isNaN(replyToId)) replyToId = null
      }

      if (!messageText?.trim() && !file) {
        return NextResponse.json(
          createApiResponse(null, 'Message text or file is required'),
          { status: 400 }
        )
      }

      if (file) {
        const saved = await saveLocalFile(file, fileType || undefined)
        mediaUrl = saved.url
        messageType = saved.type
      }
    } else {
      // Обрабатываем JSON (только текст)
      const body = await request.json()
      messageText = body.message || null
      if (body.replyToId) {
        replyToId = parseInt(body.replyToId)
        if (isNaN(replyToId)) replyToId = null
      }

      if (!messageText?.trim()) {
        return NextResponse.json(
          createApiResponse(null, 'Message text is required'),
          { status: 400 }
        )
      }
    }

    // Проверяем, существует ли сообщение, на которое отвечаем
    if (replyToId) {
      const replyToMessage = await prisma.chatMessage.findUnique({
        where: { id: replyToId },
        select: { id: true, userId: true },
      })
      if (!replyToMessage || replyToMessage.userId !== userIdBigInt) {
        replyToId = null // Сбрасываем, если сообщение не найдено или принадлежит другому пользователю
      }
    }

    // Сохраняем сообщение в БД
    let message
    try {
      message = await prisma.chatMessage.create({
        data: {
          userId: userIdBigInt,
          messageText: messageText,
          messageType,
          direction: 'in', // Входящее от пользователя
          telegramMessageId: null,
          mediaUrl: mediaUrl || null,
          channel,
          replyToId: replyToId || undefined,
        },
      })
    } catch (error: any) {
      // Если колонка channel не существует (P2022), создаем без channel
      if (error.code === 'P2022' && error.meta?.column === 'chat_messages.channel') {
        console.warn('⚠️ Channel column not found, creating message without channel field')
        message = await prisma.chatMessage.create({
          data: {
            userId: userIdBigInt,
            messageText: messageText,
            messageType,
            direction: 'in',
            telegramMessageId: null,
            mediaUrl: mediaUrl || null,
          } as any, // Type assertion to omit channel field
        })
      } else {
        throw error
      }
    }

    console.log(`✅ Chat send: Сообщение сохранено в БД с ID ${message.id}, direction='in'`)

    return NextResponse.json(
      createApiResponse({
        success: true,
        messageId: message.id,
        mediaUrl: mediaUrl || null,
      })
    )
  } catch (error: any) {
    console.error('Chat send API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to send message'),
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

