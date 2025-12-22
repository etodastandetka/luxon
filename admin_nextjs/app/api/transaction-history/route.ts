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
      where.userId = BigInt(userId)
    }
    if (type) {
      where.requestType = type
    }
    // Фильтр для ручных заявок: processedBy не равен "автопополнение" и не null
    // Это означает, что заявка была закрыта админом вручную (processedBy = логин админа)
    if (manual) {
      where.AND = [
        { processedBy: { not: 'автопополнение' } },
        { processedBy: { not: null } }
      ]
      // Также фильтруем только успешные заявки (completed, approved)
      where.status = {
        in: ['completed', 'approved']
      }
    }

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

    const transactions = actualRequests.map((r) => ({
      id: r.id.toString(),
      user_id: r.userId.toString(),
      account_id: r.accountId || '',
      user_display_name: r.firstName
        ? `${r.firstName}${r.lastName ? ' ' + r.lastName : ''}`
        : 'Unknown',
      username: r.username || '',
      first_name: r.firstName || '',
      last_name: r.lastName || '',
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
    }))

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
    const errorResponse = NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch transaction history'),
      { status: 500 }
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

