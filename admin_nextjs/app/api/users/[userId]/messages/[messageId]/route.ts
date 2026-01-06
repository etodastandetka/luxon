import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// Редактирование сообщения
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string; messageId: string } }
) {
  try {
    requireAuth(request)

    const messageId = parseInt(params.messageId)
    if (isNaN(messageId)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid message ID'),
        { status: 400 }
      )
    }

    const body = await request.json()
    const { messageText, mediaUrl } = body

    // Проверяем, что сообщение существует и принадлежит этому пользователю
    const existingMessage = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        userId: BigInt(params.userId),
        direction: 'out', // Можно редактировать только исходящие сообщения
      },
    })

    if (!existingMessage) {
      return NextResponse.json(
        createApiResponse(null, 'Message not found'),
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
                chat_id: params.userId,
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
                chat_id: params.userId,
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
        message: updated,
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

// Удаление сообщения
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string; messageId: string } }
) {
  try {
    requireAuth(request)

    const messageId = parseInt(params.messageId)
    if (isNaN(messageId)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid message ID'),
        { status: 400 }
      )
    }

    // Проверяем, что сообщение существует и принадлежит этому пользователю
    const existingMessage = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        userId: BigInt(params.userId),
        direction: 'out', // Можно удалять только исходящие сообщения
      },
    })

    if (!existingMessage) {
      return NextResponse.json(
        createApiResponse(null, 'Message not found'),
        { status: 404 }
      )
    }

    // Помечаем сообщение как удаленное
    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        messageText: null,
        mediaUrl: null,
      },
    })

    // Если есть telegramMessageId, удаляем сообщение в Telegram
    if (updated.telegramMessageId) {
      const botToken = process.env.BOT_TOKEN
      if (botToken) {
        try {
          const deleteMessageUrl = `https://api.telegram.org/bot${botToken}/deleteMessage`
          await fetch(deleteMessageUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: params.userId,
              message_id: Number(updated.telegramMessageId),
            }),
          })
        } catch (error) {
          console.error('Failed to delete message in Telegram:', error)
          // Продолжаем, даже если не удалось удалить в Telegram
        }
      }
    }

    return NextResponse.json(
      createApiResponse({
        success: true,
      })
    )
  } catch (error: any) {
    console.error('Delete message API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to delete message'),
      { status: 500 }
    )
  }
}

