import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'deposits' // deposits, withdrawals, or total
    const limit = parseInt(searchParams.get('limit') || '10')

    // Получаем топ игроков по успешным транзакциям
    const statusFilter = ['completed', 'approved', 'auto_completed', 'autodeposit_success']
    
    let topUsers: any[] = []

    if (type === 'deposits') {
      // Топ по пополнениям
      const depositsRaw = await prisma.$queryRaw<any[]>`
        SELECT 
          r.user_id,
          COUNT(*)::int as transaction_count,
          COALESCE(SUM(r.amount), 0)::numeric as total_amount
        FROM "requests" r
        WHERE r.request_type = 'deposit'
          AND r.status = ANY(ARRAY['completed', 'approved', 'auto_completed', 'autodeposit_success']::text[])
          AND r.amount > 0
        GROUP BY r.user_id
        ORDER BY total_amount DESC
        LIMIT ${limit}
      `
      
      const userIds = depositsRaw.map((r: any) => BigInt(r.user_id.toString()))
      const users = await prisma.botUser.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      })
      
      const userMap = new Map(users.map(u => [u.userId.toString(), u]))
      
      topUsers = depositsRaw.map((r: any) => {
        const user = userMap.get(r.user_id.toString())
        return {
          userId: r.user_id.toString(),
          username: user?.username || null,
          firstName: user?.firstName || null,
          lastName: user?.lastName || null,
          displayName: user?.username 
            ? `@${user.username}` 
            : user?.firstName 
              ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
              : `Игрок #${r.user_id}`,
          transactionCount: Number(r.transaction_count),
          totalAmount: parseFloat(r.total_amount.toString()),
        }
      })
    } else if (type === 'withdrawals') {
      // Топ по выводам
      const withdrawalsRaw = await prisma.$queryRaw<any[]>`
        SELECT 
          r.user_id,
          COUNT(*)::int as transaction_count,
          COALESCE(SUM(r.amount), 0)::numeric as total_amount
        FROM "requests" r
        WHERE r.request_type = 'withdraw'
          AND r.status = ANY(ARRAY['completed', 'approved']::text[])
          AND r.amount > 0
        GROUP BY r.user_id
        ORDER BY total_amount DESC
        LIMIT ${limit}
      `
      
      const userIds = withdrawalsRaw.map((r: any) => BigInt(r.user_id.toString()))
      const users = await prisma.botUser.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      })
      
      const userMap = new Map(users.map(u => [u.userId.toString(), u]))
      
      topUsers = withdrawalsRaw.map((r: any) => {
        const user = userMap.get(r.user_id.toString())
        return {
          userId: r.user_id.toString(),
          username: user?.username || null,
          firstName: user?.firstName || null,
          lastName: user?.lastName || null,
          displayName: user?.username 
            ? `@${user.username}` 
            : user?.firstName 
              ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
              : `Игрок #${r.user_id}`,
          transactionCount: Number(r.transaction_count),
          totalAmount: parseFloat(r.total_amount.toString()),
        }
      })
    } else {
      // Топ по общей сумме (пополнения + выводы)
      const totalRaw = await prisma.$queryRaw<any[]>`
        SELECT 
          r.user_id,
          COUNT(*)::int as transaction_count,
          COALESCE(SUM(r.amount), 0)::numeric as total_amount
        FROM "requests" r
        WHERE r.status = ANY(ARRAY['completed', 'approved', 'auto_completed', 'autodeposit_success']::text[])
          AND r.amount > 0
        GROUP BY r.user_id
        ORDER BY total_amount DESC
        LIMIT ${limit}
      `
      
      const userIds = totalRaw.map((r: any) => BigInt(r.user_id.toString()))
      const users = await prisma.botUser.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      })
      
      const userMap = new Map(users.map(u => [u.userId.toString(), u]))
      
      topUsers = totalRaw.map((r: any) => {
        const user = userMap.get(r.user_id.toString())
        return {
          userId: r.user_id.toString(),
          username: user?.username || null,
          firstName: user?.firstName || null,
          lastName: user?.lastName || null,
          displayName: user?.username 
            ? `@${user.username}` 
            : user?.firstName 
              ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
              : `Игрок #${r.user_id}`,
          transactionCount: Number(r.transaction_count),
          totalAmount: parseFloat(r.total_amount.toString()),
        }
      })
    }

    // Определяем ранг для каждого игрока
    const getRank = (index: number): string => {
      if (index === 0) return 'diamond' // Алмаз
      if (index === 1) return 'gold' // Золото
      if (index === 2) return 'silver' // Серебро
      if (index >= 3 && index < 10) return 'bronze' // Бронза
      return 'iron' // Железо
    }

    const leaderboard = topUsers.map((user, index) => ({
      ...user,
      rank: index + 1,
      rankType: getRank(index),
    }))

    const response = NextResponse.json(createApiResponse({ leaderboard, type }))
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    
    return response
  } catch (error: any) {
    console.error('Leaderboard error:', error)
    const errorResponse = NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch leaderboard'),
      { status: 500 }
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

