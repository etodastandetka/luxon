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

// Публичный эндпоинт для редактирования сообщения (для клиентского сайта)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; messageId: string }> | { userId: string; messageId: string } }
) {
  try {
    // 🛡️ ЗАЩИТА
    const protectionResult = protectAPI(request)
    if (protectionResult) return protectionResult

    // Обработка Next.js 15+ где params может быть Promise
    const resolvedParams = params instanceof Promise ? await params : params
    const messageId = parseInt(resolvedParams.messageId)
    if (isNaN(messageId)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid message ID'),
        { status: 400 }
      )
    }

    // Rate limiting
    const rateLimitResult = rateLimit({ 
      maxRequests: 10, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `edit_message:${resolvedParams.userId}:${getClientIP(req)}`
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

    const body = await request.json()
    const { messageText, mediaUrl } = body

    if (!messageText && !mediaUrl) {
      return NextResponse.json(
        createApiResponse(null, 'Message text or media URL is required'),
        { status: 400 }
      )
    }

    // Проверяем, что сообщение существует и принадлежит этому пользователю
    // В мини-приложении: 'in' = от пользователя (можно редактировать)
    const existingMessage = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        userId: userIdBigInt,
        direction: 'in', // В мини-приложении пользователь может редактировать только свои сообщения (direction='in')
        isDeleted: false,
      },
    })

    if (!existingMessage) {
      return NextResponse.json(
        createApiResponse(null, 'Message not found or cannot be edited'),
        { status: 404 }
      )
    }

    // Обновляем сообщение в БД
    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        messageText: messageText !== undefined ? messageText : existingMessage.messageText,
        mediaUrl: mediaUrl !== undefined ? mediaUrl : existingMessage.mediaUrl,
        editedAt: new Date(),
      },
    })

    // Если есть telegramMessageId, обновляем сообщение в Telegram
    if (updated.telegramMessageId) {
      const botToken = process.env.BOT_TOKEN
      if (botToken) {
        try {
          const editMessageUrl = `https://api.telegram.org/bot${botToken}/editMessageText`
          const editCaptionUrl = `https://api.telegram.org/bot${botToken}/editMessageCaption`

          if (existingMessage.messageType === 'text') {
            // Редактируем текстовое сообщение
            await fetch(editMessageUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: userId,
                message_id: Number(updated.telegramMessageId),
                text: messageText || '',
                parse_mode: 'HTML',
              }),
            })
          } else if (existingMessage.mediaUrl && messageText) {
            // Редактируем подпись к медиа
            await fetch(editCaptionUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: userId,
                message_id: Number(updated.telegramMessageId),
                caption: messageText,
                parse_mode: 'HTML',
              }),
            })
          }
        } catch (error) {
          console.error('Failed to edit message in Telegram:', error)
          // Продолжаем, даже если не удалось обновить в Telegram
        }
      }
    }

    return NextResponse.json(
      createApiResponse({
        success: true,
        message: {
          ...updated,
          userId: updated.userId.toString(),
          telegramMessageId: updated.telegramMessageId?.toString(),
        },
      })
    )
  } catch (error: any) {
    console.error('Edit message API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to edit message'),
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

