import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Получение списка пользователей с сообщениями для операторов
export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel') || 'bot'

    // Получаем последние сообщения от пользователей (direction='in')
    // Берем больше сообщений, чтобы потом сгруппировать по userId
    let messages: any[] = []
    try {
      messages = await prisma.chatMessage.findMany({
        where: { 
          direction: 'in',
          channel,
          isDeleted: false,
          NOT: [
            { messageText: { startsWith: '/' } }
          ]
        },
        select: { userId: true },
        orderBy: { createdAt: 'desc' },
        take: 500, // Берем больше, чтобы потом отфильтровать уникальные
      })
    } catch (error: any) {
      if (error.code === 'P2022' && error.meta?.column === 'chat_messages.channel') {
        messages = await prisma.chatMessage.findMany({
          where: { 
            direction: 'in',
            isDeleted: false,
            NOT: [
              { messageText: { startsWith: '/' } }
            ]
          },
          select: { userId: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        })
      } else {
        throw error
      }
    }

    // Получаем уникальные userId (сохраняем порядок по времени последнего сообщения)
    const userIds: bigint[] = []
    const seenUserIds = new Set<string>()
    for (const message of messages) {
      const userIdStr = message.userId.toString()
      if (!seenUserIds.has(userIdStr)) {
        seenUserIds.add(userIdStr)
        userIds.push(message.userId)
      }
    }

    // Получаем информацию о пользователях и последние сообщения
    const usersWithMessages = await Promise.all(
      userIds.map(async (userId) => {
        // Получаем информацию о пользователе
        const user = await prisma.botUser.findUnique({
          where: { userId },
          select: {
            userId: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        })

        // Получаем последнее сообщение от пользователя
        let lastMessage: any = null
        try {
          lastMessage = await prisma.chatMessage.findFirst({
            where: {
              userId,
              direction: 'in',
              channel,
              isDeleted: false,
              NOT: [
                { messageText: { startsWith: '/' } }
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
          })
        } catch (error: any) {
          if (error.code === 'P2022' && error.meta?.column === 'chat_messages.channel') {
            lastMessage = await prisma.chatMessage.findFirst({
              where: {
                userId,
                direction: 'in',
                isDeleted: false,
                NOT: [
                  { messageText: { startsWith: '/' } }
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
            })
          }
        }

        // Получаем последнее исходящее сообщение для подсчета непрочитанных
        let lastOutgoing: any = null
        try {
          lastOutgoing = await prisma.chatMessage.findFirst({
            where: {
              userId,
              direction: 'out',
              channel,
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
          })
        } catch (error: any) {
          if (error.code === 'P2022' && error.meta?.column === 'chat_messages.channel') {
            lastOutgoing = await prisma.chatMessage.findFirst({
              where: {
                userId,
                direction: 'out',
              },
              orderBy: { createdAt: 'desc' },
              select: { createdAt: true }
            })
          }
        }

        // Подсчитываем непрочитанные сообщения
        let unreadCount = 0
        if (lastOutgoing?.createdAt && lastMessage) {
          try {
            unreadCount = await prisma.chatMessage.count({
              where: {
                userId,
                direction: 'in',
                channel,
                isDeleted: false,
                createdAt: {
                  gt: lastOutgoing.createdAt
                }
              }
            })
          } catch (error: any) {
            if (error.code === 'P2022' && error.meta?.column === 'chat_messages.channel') {
              unreadCount = await prisma.chatMessage.count({
                where: {
                  userId,
                  direction: 'in',
                  isDeleted: false,
                  createdAt: {
                    gt: lastOutgoing.createdAt
                  }
                }
              })
            }
          }
        } else if (lastMessage) {
          // Если нет исходящих сообщений, но есть входящие - все непрочитанные
          unreadCount = 1
        }

        return {
          userId: userId.toString(),
          username: user?.username || null,
          firstName: user?.firstName || null,
          lastName: user?.lastName || null,
          lastMessage: lastMessage ? {
            ...lastMessage,
            userId: lastMessage.userId.toString(),
            telegramMessageId: lastMessage.telegramMessageId?.toString(),
            replyTo: lastMessage.replyTo ? {
              ...lastMessage.replyTo,
              userId: lastMessage.replyTo.userId?.toString(),
            } : null,
          } : null,
          unreadCount,
        }
      })
    )

    // Сортируем по времени последнего сообщения
    usersWithMessages.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0
      if (!a.lastMessage) return 1
      if (!b.lastMessage) return -1
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    })

    return NextResponse.json(
      createApiResponse({
        users: usersWithMessages,
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
