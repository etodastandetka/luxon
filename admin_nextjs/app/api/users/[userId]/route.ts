import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    requireAuth(request)

    const userId = BigInt(params.userId)
    console.log(`🔍 Looking for user with ID: ${userId.toString()}`)

    let user = await prisma.botUser.findUnique({
      where: { userId },
      include: {
        transactions: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
        referralMade: {
          include: {
            referred: true,
          },
        },
        referralEarnings: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            transactions: true,
            referralMade: true,
            referralEarnings: true,
          },
        },
      },
    })

    console.log(`📊 BotUser found: ${user ? 'YES' : 'NO'}`)

    // Если пользователь не найден в BotUser, пытаемся получить данные из Request
    if (!user) {
      console.log(`🔍 Searching in Request table for userId: ${userId.toString()}`)
      const latestRequest = await prisma.request.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
      
      console.log(`📋 Latest Request found: ${latestRequest ? 'YES' : 'NO'}`)
      if (latestRequest) {
        console.log(`📋 Request ID: ${latestRequest.id}, userId: ${latestRequest.userId.toString()}`)
      }

      if (latestRequest) {
        // Создаем виртуальный объект пользователя на основе данных из Request
        const allRequests = await prisma.request.findMany({
          where: { userId },
        })

        const deposits = allRequests.filter(r => r.requestType === 'deposit')
        const withdrawals = allRequests.filter(r => r.requestType === 'withdraw')
        
        // Получаем транзакции из Request
        const transactions = allRequests.slice(0, 50).map(req => ({
          id: req.id,
          transType: req.requestType,
          amount: req.amount?.toString() || '0',
          status: req.status,
          bookmaker: req.bookmaker,
          processedBy: (req as any).processedBy || null,
          createdAt: req.createdAt.toISOString(),
        }))

        user = {
          userId,
          username: latestRequest.username,
          firstName: latestRequest.firstName,
          lastName: latestRequest.lastName,
          language: 'ru',
          selectedBookmaker: latestRequest.bookmaker,
          note: null,
          isActive: true,
          createdAt: latestRequest.createdAt,
          transactions,
          referralMade: [],
          referralEarnings: [],
          _count: {
            transactions: allRequests.length,
            referralMade: 0,
            referralEarnings: 0,
          },
        } as any
      }
    }

    if (!user) {
      console.error(`❌ User not found in both BotUser and Request tables for userId: ${userId.toString()}`)
      return NextResponse.json(
        createApiResponse(null, 'User not found'),
        { status: 404 }
      )
    }
    
    console.log(`✅ User found, returning data for userId: ${userId.toString()}`)

    // Для транзакций из BotTransaction нужно найти связанный Request для получения processedBy
    const transactionsWithProcessedBy = await Promise.all(
      user.transactions.map(async (t) => {
        // Если транзакция уже имеет processedBy (из Request), просто возвращаем её
        if ((t as any).processedBy !== undefined) {
          return {
            ...t,
            amount: typeof t.amount === 'string' ? t.amount : t.amount.toString(),
            createdAt: typeof t.createdAt === 'string' ? t.createdAt : t.createdAt.toISOString(),
            processedBy: (t as any).processedBy || null,
            status: t.status,
          }
        }

        // Ищем связанный Request по userId, bookmaker, amount и transType
        // createdAt может быть строкой (из Request) или Date (из BotTransaction)
        const createdAtDate = typeof t.createdAt === 'string' 
          ? new Date(t.createdAt) 
          : t.createdAt

        const relatedRequest = await prisma.request.findFirst({
          where: {
            userId: user.userId,
            bookmaker: t.bookmaker || undefined,
            amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount,
            requestType: t.transType,
            createdAt: {
              gte: new Date(createdAtDate.getTime() - 60000), // ±1 минута
              lte: new Date(createdAtDate.getTime() + 60000),
            },
          },
          select: {
            processedBy: true,
            status: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        return {
          ...t,
          amount: typeof t.amount === 'string' ? t.amount : t.amount.toString(),
          createdAt: typeof t.createdAt === 'string' ? t.createdAt : t.createdAt.toISOString(),
          processedBy: relatedRequest?.processedBy || null,
          status: relatedRequest?.status || t.status,
        }
      })
    )

    return NextResponse.json(
      createApiResponse({
        ...user,
        userId: user.userId.toString(),
        transactions: transactionsWithProcessedBy,
        referralEarnings: user.referralEarnings.map(e => ({
          ...e,
          amount: e.amount.toString(),
          commissionAmount: e.commissionAmount.toString(),
        })),
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch user'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    requireAuth(request)

    const userId = BigInt(params.userId)
    const body = await request.json()
    const { isActive } = body

    // Обновляем или создаем пользователя с новым статусом
    const user = await prisma.botUser.upsert({
      where: { userId },
      update: {
        isActive: isActive !== undefined ? isActive : true,
      },
      create: {
        userId,
        isActive: isActive !== undefined ? isActive : true,
        language: 'ru',
      },
    })

    return NextResponse.json(
      createApiResponse({
        ...user,
        userId: user.userId.toString(),
        isActive: user.isActive,
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to update user'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
