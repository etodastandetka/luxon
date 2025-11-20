import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

/**
 * API endpoint для поиска по игрокам и заявкам
 * GET /api/search?q=query&type=all|users|requests
 */
export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')?.trim() || ''
    const type = searchParams.get('type') || 'all' // all, users, requests

    if (!query || query.length < 1) {
      return NextResponse.json(
        createApiResponse({
          users: [],
          requests: [],
          total: 0,
        })
      )
    }

    const results: {
      users: any[]
      requests: any[]
      total: number
    } = {
      users: [],
      requests: [],
      total: 0,
    }

    // Поиск игроков
    if (type === 'all' || type === 'users') {
      try {
        // Пробуем найти по userId (BigInt)
        let userId: bigint | null = null
        if (/^\d+$/.test(query)) {
          try {
            userId = BigInt(query)
          } catch (e) {
            // Не удалось преобразовать в BigInt
          }
        }

        const userWhere: any = {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
        }

        if (userId) {
          userWhere.OR.push({ userId: userId })
        }

        const users = await prisma.botUser.findMany({
          where: userWhere,
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            userId: true,
            username: true,
            firstName: true,
            lastName: true,
            language: true,
            isActive: true,
            createdAt: true,
          },
        })

        results.users = users.map((user) => ({
          id: user.userId.toString(),
          userId: user.userId.toString(),
          username: user.username || '-',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Без имени',
          language: user.language,
          isActive: user.isActive,
          createdAt: user.createdAt,
          type: 'user',
        }))
      } catch (error: any) {
        console.error('[Search] Error searching users:', error)
      }
    }

    // Поиск заявок
    if (type === 'all' || type === 'requests') {
      try {
        // Пробуем найти по ID заявки
        let requestId: number | null = null
        if (/^\d+$/.test(query)) {
          requestId = parseInt(query)
        }

        const requestWhere: any = {
          OR: [
            { accountId: { contains: query, mode: 'insensitive' } },
            { withdrawalCode: { contains: query, mode: 'insensitive' } },
            { status: { contains: query, mode: 'insensitive' } },
            { bookmaker: { contains: query, mode: 'insensitive' } },
          ],
        }

        if (requestId && !isNaN(requestId)) {
          requestWhere.OR.push({ id: requestId })
        }

        // Также ищем по userId (если это число)
        if (/^\d+$/.test(query)) {
          try {
            const userId = BigInt(query)
            requestWhere.OR.push({ userId: userId })
          } catch (e) {
            // Не удалось преобразовать в BigInt
          }
        }

        const requests = await prisma.request.findMany({
          where: requestWhere,
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            accountId: true,
            amount: true,
            status: true,
            requestType: true,
            bookmaker: true,
            bank: true,
            withdrawalCode: true,
            createdAt: true,
            processedAt: true,
            processedBy: true,
          },
        })

        results.requests = requests.map((req) => ({
          id: req.id.toString(),
          requestId: req.id,
          userId: req.userId?.toString() || '-',
          accountId: req.accountId || '-',
          amount: typeof req.amount === 'string' ? parseFloat(req.amount) : (req.amount as any).toNumber ? (req.amount as any).toNumber() : Number(req.amount),
          status: req.status,
          requestType: req.requestType,
          bookmaker: req.bookmaker,
          bank: req.bank,
          withdrawalCode: req.withdrawalCode,
          createdAt: req.createdAt,
          processedAt: req.processedAt,
          processedBy: req.processedBy,
          type: 'request',
        }))
      } catch (error: any) {
        console.error('[Search] Error searching requests:', error)
      }
    }

    results.total = results.users.length + results.requests.length

    return NextResponse.json(createApiResponse(results))
  } catch (error: any) {
    console.error('[Search] Error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Search failed'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

