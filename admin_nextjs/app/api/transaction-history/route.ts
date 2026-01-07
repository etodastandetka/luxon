import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const type = searchParams.get('type') // deposit, withdraw, or empty for all
    const manual = searchParams.get('manual') === 'true' // Ручные заявки (не автопополнение)
    const limit = parseInt(searchParams.get('limit') || '200') // По умолчанию загружаем 200 записей
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (userId) {
      // Валидация userId перед конвертацией в BigInt
      // Проверяем, что это числовая строка (может быть большим числом)
      const userIdTrimmed = userId.trim()
      // Проверяем, что строка содержит только цифры (может быть отрицательным числом, но для Telegram ID это не нужно)
      if (!/^\d+$/.test(userIdTrimmed)) {
        // Логируем как warning, так как это может быть тестовый запрос или некорректный формат
        console.warn(`⚠️ [Transaction History] Invalid userId format: ${userId} (not a valid number, skipping)`)
        return NextResponse.json(
          createApiResponse(null, `Invalid user ID format: ${userId}. User ID must be a number.`),
          { status: 400 }
        )
      }
      
      try {
        where.userId = BigInt(userIdTrimmed)
      } catch (error: any) {
        console.error(`❌ Failed to convert userId to BigInt: ${userId}`, error)
        return NextResponse.json(
          createApiResponse(null, `Invalid user ID: ${userId}`),
          { status: 400 }
        )
      }
    }
    if (type) {
      where.requestType = type
    }
    
    // ВАЖНО: По умолчанию возвращаем ВСЕ заявки независимо от статуса
    // (pending, completed, approved, rejected, failed и т.д.)
    // Это нужно для отображения полной истории транзакций пользователя
    
    // Фильтр для ручных заявок: processedBy не равен "автопополнение" и не null
    // Это означает, что заявка была закрыта админом вручную (processedBy = логин админа)
    if (manual) {
      where.AND = [
        { processedBy: { not: 'автопополнение' } },
        { processedBy: { not: null } }
      ]
      // Для ручных заявок фильтруем только успешные заявки (completed, approved)
      where.status = {
        in: ['completed', 'approved']
      }
    }
    // Если manual не установлен, НЕ фильтруем по статусу - возвращаем все заявки

    // Оптимизация: берем на 1 больше для проверки hasMore
    const takeValue = limit + 1

    const requests = await prisma.request.findMany({
      where,
      select: {
        id: true,
        userId: true,
        username: true,
        firstName: true,
        lastName: true,
        accountId: true,
        requestType: true,
        amount: true,
        status: true,
        statusDetail: true,
        bookmaker: true,
        bank: true,
        phone: true,
        createdAt: true,
        processedAt: true,
        processedBy: true,
      },
      orderBy: { createdAt: 'desc' },
      take: takeValue,
      skip: offset,
    })

    // Проверяем hasMore (если получили больше limit, значит есть еще)
    const hasMore = requests.length > limit
    const actualRequests = hasMore ? requests.slice(0, limit) : requests

    // Получаем userId для запросов без имени, чтобы получить данные из BotUser
    const userIdsWithoutName = actualRequests
      .filter(r => !r.firstName)
      .map(r => r.userId)
    
    // Получаем данные пользователей из BotUser для тех, у кого нет имени в Request
    let userDataMap: Record<string, { firstName: string | null; lastName: string | null; username: string | null }> = {}
    if (userIdsWithoutName.length > 0) {
      try {
        const botUsers = await prisma.botUser.findMany({
          where: {
            userId: { in: userIdsWithoutName },
          },
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        })
        
        botUsers.forEach(user => {
          userDataMap[user.userId.toString()] = {
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          }
        })
      } catch (error: any) {
        console.warn('⚠️ [Transaction History] Не удалось получить данные пользователей из BotUser:', error.message)
      }
    }

    const transactions = actualRequests.map((r) => {
      // Если нет имени в Request, пытаемся получить из BotUser
      let displayName = r.firstName
        ? `${r.firstName}${r.lastName ? ' ' + r.lastName : ''}`
        : null
      
      if (!displayName) {
        const userData = userDataMap[r.userId.toString()]
        if (userData) {
          displayName = userData.firstName
            ? `${userData.firstName}${userData.lastName ? ' ' + userData.lastName : ''}`
            : null
        }
      }
      
      return {
      id: r.id.toString(),
      user_id: r.userId.toString(),
      account_id: r.accountId || '',
        user_display_name: displayName || 'Unknown',
        username: r.username || userDataMap[r.userId.toString()]?.username || '',
        first_name: r.firstName || userDataMap[r.userId.toString()]?.firstName || '',
        last_name: r.lastName || userDataMap[r.userId.toString()]?.lastName || '',
      type: r.requestType,
      amount: r.amount ? parseFloat(r.amount.toString()) : 0,
      status: r.status,
      status_detail: r.statusDetail || null,
      bookmaker: r.bookmaker || '',
      bank: r.bank || '',
      phone: r.phone || '',
      date: r.createdAt.toISOString(),
      created_at: r.createdAt.toISOString(),
      processed_at: r.processedAt?.toISOString() || null,
      processedBy: r.processedBy || null,
      }
    })

    const response = NextResponse.json(createApiResponse({ 
      transactions,
      pagination: {
        limit,
        offset,
        hasMore,
      },
    }))
    
    // Добавляем кэширование для ускорения повторных запросов
    // Кэшируем на 5 секунд для истории (данные не критичны к актуальности)
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15')
    
    return response
  } catch (error: any) {
    console.error('Transaction history error:', error)
    
    // Проверяем, является ли ошибка ошибкой подключения к базе данных
    const errorMessage = error.message || 'Failed to fetch transaction history'
    const isDatabaseError = errorMessage.includes('Can\'t reach database server') || 
                           errorMessage.includes('P1001') ||
                           errorMessage.includes('connection')
    
    const errorResponse = NextResponse.json(
      createApiResponse(null, isDatabaseError 
        ? 'Database connection error. Please try again later.' 
        : errorMessage),
      { status: isDatabaseError ? 503 : 500 } // 503 Service Unavailable для ошибок БД
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

