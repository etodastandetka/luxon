import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    requireAuth(request)

    // Проверяем валидность userId
    if (!params.userId || isNaN(Number(params.userId))) {
      console.error(`❌ Invalid userId: ${params.userId}`)
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID'),
        { status: 400 }
      )
    }

    const userId = BigInt(params.userId)
    console.log(`🔍 Looking for user with ID: ${userId.toString()}`)

    // Сначала получаем данные пользователя из BotUser
    let user = await prisma.botUser.findUnique({
      where: { userId },
      include: {
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

    // ВСЕГДА получаем транзакции из Request, так как это основная таблица заявок
    // Request содержит все заявки на пополнение и вывод с полной информацией
    console.log(`🔍 Loading transactions from Request table for userId: ${userId.toString()}`)
    const allRequests = await prisma.request.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100, // Берем больше для статистики
    })
    
    console.log(`📋 Found ${allRequests.length} requests for user ${userId.toString()}`)

    // Преобразуем Request в формат транзакций
    const transactionsFromRequests = allRequests.map(req => ({
      id: req.id,
      transType: req.requestType,
      amount: req.amount ? req.amount.toString() : '0',
      status: req.status,
      bookmaker: req.bookmaker,
      processedBy: req.processedBy || null,
      bank: req.bank || null,
      createdAt: req.createdAt,
    }))

    console.log(`📊 Transactions from Request: ${transactionsFromRequests.length}`)

    // Если пользователь не найден в BotUser, создаем виртуальный объект на основе Request
    if (!user && allRequests.length > 0) {
      const latestRequest = allRequests[0]
      console.log(`📋 Creating virtual user from Request, latest request ID: ${latestRequest.id}`)

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
        transactions: transactionsFromRequests,
        referralMade: [],
        referralEarnings: [],
        _count: {
          transactions: allRequests.length,
          referralMade: 0,
          referralEarnings: 0,
        },
      } as any
    } else if (user) {
      // Если пользователь найден в BotUser, заменяем транзакции на данные из Request
      // так как Request содержит более полную информацию
      console.log(`📊 Replacing BotTransaction data with Request data for user ${userId.toString()}`)
      ;(user as any).transactions = transactionsFromRequests
      ;(user as any)._count.transactions = allRequests.length
    }

    if (!user) {
      console.error(`❌ User not found in both BotUser and Request tables for userId: ${userId.toString()}`)
      return NextResponse.json(
        createApiResponse(null, 'User not found'),
        { status: 404 }
      )
    }
    
    console.log(`✅ User found, returning data for userId: ${userId.toString()}`)
    
    // Транзакции уже приходят из Request с полной информацией (processedBy, bank, status)
    // Просто форматируем их для ответа
    const userTransactions = (user as any).transactions || []
    console.log(`📊 Total transactions to return: ${userTransactions.length}`)
    
    const transactionsFormatted = userTransactions.map((t: any) => {
      // Безопасное преобразование даты
      let createdAtStr: string
      try {
        if (typeof t.createdAt === 'string') {
          createdAtStr = t.createdAt
        } else if (t.createdAt instanceof Date) {
          createdAtStr = t.createdAt.toISOString()
        } else if (t.createdAt && typeof t.createdAt === 'object' && 'toISOString' in t.createdAt) {
          createdAtStr = (t.createdAt as Date).toISOString()
        } else {
          createdAtStr = new Date().toISOString()
        }
      } catch (e) {
        console.warn(`⚠️ Error formatting createdAt for transaction ${t.id}:`, e)
        createdAtStr = new Date().toISOString()
      }

      return {
        id: t.id,
        transType: t.transType || 'deposit',
        amount: typeof t.amount === 'string' ? t.amount : (t.amount?.toString() || '0'),
        status: t.status || 'pending',
        bookmaker: t.bookmaker || null,
        processedBy: t.processedBy || null,
        bank: t.bank || null,
        createdAt: createdAtStr,
      }
    })

    console.log(`📊 Formatted transactions: ${transactionsFormatted.length}`)
    console.log(`📊 Sample transaction:`, transactionsFormatted[0] || 'none')

    // Безопасное преобразование данных пользователя
    const userData = user as any
    const responseData = {
      userId: userData.userId?.toString() || params.userId,
      username: userData.username || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      language: userData.language || 'ru',
      selectedBookmaker: userData.selectedBookmaker || null,
      note: userData.note || null,
      isActive: userData.isActive !== false, // По умолчанию true
      createdAt: userData.createdAt instanceof Date 
        ? userData.createdAt.toISOString() 
        : (typeof userData.createdAt === 'string' ? userData.createdAt : new Date().toISOString()),
      transactions: transactionsFormatted,
      referralMade: (userData.referralMade || []).map((r: any) => ({
        referred: {
          userId: r.referred?.userId?.toString() || r.referred?.userId || '',
          username: r.referred?.username || null,
          firstName: r.referred?.firstName || null,
        },
        createdAt: r.createdAt instanceof Date 
          ? r.createdAt.toISOString() 
          : (typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString()),
      })),
      referralEarnings: (userData.referralEarnings || []).map((e: any) => ({
        ...e,
        amount: e.amount?.toString() || '0',
        commissionAmount: e.commissionAmount?.toString() || '0',
        createdAt: e.createdAt instanceof Date 
          ? e.createdAt.toISOString() 
          : (typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString()),
      })),
      _count: {
        transactions: userData._count?.transactions || transactionsFormatted.length,
        referralMade: userData._count?.referralMade || 0,
        referralEarnings: userData._count?.referralEarnings || 0,
      },
    }

    console.log(`📊 Returning user data:`, {
      userId: responseData.userId,
      transactionsCount: responseData.transactions.length,
      depositsCount: responseData.transactions.filter((t: any) => t.transType === 'deposit').length,
      withdrawalsCount: responseData.transactions.filter((t: any) => t.transType === 'withdraw').length,
    })

    return NextResponse.json(
      createApiResponse(responseData)
    )
  } catch (error: any) {
    console.error(`❌ Error fetching user ${params.userId}:`, error)
    console.error('Error stack:', error.stack)
    
    // Более детальная обработка ошибок
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        createApiResponse(null, 'Unauthorized'),
        { status: 401 }
      )
    }
    
    // Если ошибка связана с BigInt (невалидный userId)
    if (error.message?.includes('Invalid') || error.message?.includes('Cannot convert')) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID'),
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch user'),
      { status: 500 }
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
