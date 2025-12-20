import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-helpers'

// Призы для топ-рефералов
const TOP_PRIZES = [10000, 5000, 2500, 1500, 1000]

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    
    // Получаем топ-5 реферов через агрегацию
    const topReferrersRaw = await prisma.$queryRaw<Array<{
      referrer_id: bigint,
      total_deposits: number | bigint,
      referral_count: bigint
    }>>`
      SELECT 
        br.referrer_id,
        COALESCE(SUM(r.amount), 0)::numeric as total_deposits,
        COUNT(DISTINCT br.referred_id) as referral_count
      FROM "referrals" br
      LEFT JOIN "requests" r ON r.user_id = br.referred_id 
        AND r.request_type = 'deposit'
        AND r.status IN ('completed', 'approved', 'auto_completed', 'autodeposit_success')
        AND r.amount > 0
      GROUP BY br.referrer_id
      ORDER BY total_deposits DESC
      LIMIT 5
    `
    
    // Получаем данные пользователей для топ-5
    const topReferrerIds = topReferrersRaw.length > 0 
      ? topReferrersRaw.map(r => r.referrer_id)
      : []
    
    const topReferrerUsers = topReferrerIds.length > 0
      ? await prisma.botUser.findMany({
          where: {
            userId: { in: topReferrerIds }
          },
          select: {
            userId: true,
            username: true,
            firstName: true,
            lastName: true
          }
        })
      : []
    
    const userMap = new Map(topReferrerUsers.map(u => [u.userId.toString(), u]))
    
    const topPlayers = topReferrersRaw.map((ref, index) => {
      const user = userMap.get(ref.referrer_id.toString())
      const rank = index + 1
      const prize = TOP_PRIZES[index] || 0
      
      return {
        id: ref.referrer_id.toString(),
        username: user?.username || null,
        firstName: user?.firstName || null,
        lastName: user?.lastName || null,
        total_deposits: parseFloat(ref.total_deposits.toString()),
        referral_count: parseInt(ref.referral_count.toString()),
        rank,
        prize
      }
    })
    
    return NextResponse.json({
      success: true,
      top_players: topPlayers
    })
    
  } catch (error: any) {
    console.error('Top players fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch top players'
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

