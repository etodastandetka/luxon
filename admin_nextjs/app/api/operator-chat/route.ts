import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse, getAuthUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Получение сообщений между операторами
export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    
    const authUser = getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        createApiResponse(null, 'Unauthorized'),
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const channel = 'operator' // Всегда используем channel='operator' для чата операторов

    // Получаем сообщения из чата операторов
    let messages: any[] = []
    try {
      messages = await prisma.chatMessage.findMany({
        where: { 
          channel,
          isDeleted: false,
        },
        include: {
          replyTo: {
            select: {
              id: true,
              userId: true,
              messageText: true,
              messageType: true,
              mediaUrl: true,
              direction: true,
              isDeleted: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
      })
    } catch (error: any) {
      // Если колонка channel не существует, возвращаем пустой массив
      if (error.code === 'P2022' && error.meta?.column === 'chat_messages.channel') {
        console.warn('⚠️ Channel column not found, returning empty messages')
        messages = []
      } else {
        throw error
      }
    }

    // Получаем информацию об админах для сообщений
    const adminIds = [...new Set(messages.map(m => Number(m.userId.toString())))]
    const admins = await prisma.adminUser.findMany({
      where: {
        id: { in: adminIds }
      },
      select: {
        id: true,
        username: true,
        email: true,
      }
    })

    const adminMap = new Map(admins.map(a => [a.id, a]))

    // Форматируем сообщения
    const formattedMessages = messages.map(msg => ({
      ...msg,
      userId: msg.userId.toString(),
      telegramMessageId: msg.telegramMessageId?.toString(),
      admin: adminMap.get(Number(msg.userId.toString())) || null,
      replyTo: msg.replyTo ? {
        ...msg.replyTo,
        userId: msg.replyTo.userId?.toString(),
      } : null,
    }))

    // Разворачиваем, чтобы старые были первыми
    formattedMessages.reverse()

    return NextResponse.json(
      createApiResponse({
        messages: formattedMessages,
      })
    )
  } catch (error: any) {
    console.error('Operator chat API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch operator chat'),
      { status: 500 }
    )
  }
}

// Отправка сообщения в чат операторов
export async function POST(request: NextRequest) {
  try {
    requireAuth(request)
    
    const authUser = getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        createApiResponse(null, 'Unauthorized'),
        { status: 401 }
      )
    }

    const contentType = request.headers.get('content-type') || ''
    const channel = 'operator'

    let messageText: string | null = null
    let file: File | null = null
    let fileType: string | null = null
    let mediaUrl: string | null = null
    let messageType = 'text'
    let replyToId: number | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      file = formData.get('file') as File | null
      messageText = (formData.get('message') as string | null) || null
      fileType = (formData.get('fileType') as string | null) || null
      const replyToIdStr = formData.get('replyToId') as string | null
      if (replyToIdStr) {
        replyToId = parseInt(replyToIdStr)
      }

      if (!messageText?.trim() && !file) {
        return NextResponse.json(
          createApiResponse(null, 'Message text or file is required'),
          { status: 400 }
        )
      }

      if (file) {
        // Сохраняем файл локально
        const fs = await import('fs')
        const path = await import('path')
        const { randomUUID } = await import('crypto')
        
        const uploadDir = path.join(process.cwd(), 'tmp', 'operator_chat_uploads')
        await fs.promises.mkdir(uploadDir, { recursive: true })
        const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : ''
        const fileId = `${Date.now()}-${randomUUID()}${ext}`
        const dest = path.join(uploadDir, fileId)
        const buffer = Buffer.from(await file.arrayBuffer())
        await fs.promises.writeFile(dest, buffer)
        
        mediaUrl = `/api/operator-chat/file/${fileId}`
        const mime = fileType || file.type || ''
        messageType = mime.startsWith('image/')
          ? 'photo'
          : mime.startsWith('video/')
          ? 'video'
          : mime.startsWith('audio/')
          ? 'audio'
          : 'document'
      }
    } else {
      const body = await request.json()
      messageText = body.message || null
      replyToId = body.replyToId || null

      if (!messageText?.trim()) {
        return NextResponse.json(
          createApiResponse(null, 'Message text is required'),
          { status: 400 }
        )
      }
    }

    // Сохраняем сообщение в БД
    // Используем userId = adminId (конвертированный в BigInt)
    const adminId = BigInt(authUser.userId)
    
    let message
    try {
      message = await prisma.chatMessage.create({
        data: {
          userId: adminId,
          messageText: messageText,
          messageType,
          direction: 'out', // Все сообщения операторов - исходящие
          telegramMessageId: null,
          mediaUrl: mediaUrl || null,
          channel,
          replyToId: replyToId || undefined,
        },
      })
    } catch (error: any) {
      if (error.code === 'P2022' && error.meta?.column === 'chat_messages.channel') {
        console.warn('⚠️ Channel column not found, creating message without channel field')
        message = await prisma.chatMessage.create({
          data: {
            userId: adminId,
            messageText: messageText,
            messageType,
            direction: 'out',
            telegramMessageId: null,
            mediaUrl: mediaUrl || null,
            replyToId: replyToId || undefined,
          } as any,
        })
      } else {
        throw error
      }
    }

    return NextResponse.json(
      createApiResponse({
        success: true,
        messageId: message.id,
        mediaUrl: mediaUrl || null,
      })
    )
  } catch (error: any) {
    console.error('Operator chat send API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to send message'),
      { status: 500 }
    )
  }
}
