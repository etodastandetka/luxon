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
import { DATABASE_CONFIG } from '@/config/app'

// Публичный эндпоинт для получения истории сообщений чата (для клиентского сайта)
export async function GET(
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
      maxRequests: 30, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `chat_messages:${resolvedParams.userId}:${getClientIP(req)}`
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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || DATABASE_CONFIG.CHAT_MESSAGES_LIMIT.toString())
    const channel = searchParams.get('channel') || 'bot'

    // Получаем историю сообщений
    let messages
    try {
      messages = await prisma.chatMessage.findMany({
        where: { 
          userId: userIdBigInt, 
          channel,
          isDeleted: false,
          // Фильтруем команды пользователя (сообщения, начинающиеся с /)
          NOT: [
            { 
              AND: [
                { direction: 'in' },
                { messageText: { startsWith: '/' } }
              ]
            }
          ]
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
        take: Math.min(limit, 100), // Максимум 100 сообщений
      })
    } catch (error: any) {
      // Если колонка channel не существует (P2022), делаем запрос без фильтра по channel
      if (error.code === 'P2022' && error.meta?.column === 'chat_messages.channel') {
        console.warn('⚠️ Channel column not found, querying messages without channel filter')
        messages = await prisma.chatMessage.findMany({
          where: { 
            userId: userIdBigInt,
            isDeleted: false,
            // Фильтруем команды пользователя
            NOT: [
              { 
                AND: [
                  { direction: 'in' },
                  { messageText: { startsWith: '/' } }
                ]
              }
            ]
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
          take: Math.min(limit, 100),
        })
      } else {
        throw error
      }
    }

    // Получаем информацию о пользователе для отображения имени
    let userInfo = null
    try {
      const user = await prisma.botUser.findUnique({
        where: { userId: userIdBigInt },
        select: {
          firstName: true,
          lastName: true,
          username: true,
        },
      })
      if (user) {
        userInfo = {
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch user info:', error)
    }

    return NextResponse.json(
      createApiResponse({
        messages: messages.map(msg => ({
          ...msg,
          userId: msg.userId.toString(),
          telegramMessageId: msg.telegramMessageId?.toString(),
          replyTo: msg.replyTo ? {
            ...msg.replyTo,
            userId: msg.replyTo.userId?.toString(),
          } : null,
        })),
        userInfo, // Добавляем информацию о пользователе
      })
    )
  } catch (error: any) {
    console.error('Chat messages API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch chat messages'),
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

