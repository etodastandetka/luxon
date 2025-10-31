import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Публичный эндпоинт для получения данных реферальной программы (без авторизации)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
    }
    
    const userIdBigInt = BigInt(userId)
    
    // Получаем всех рефералов пользователя
    const referrals = await prisma.botReferral.findMany({
      where: {
        referrer: {
          userId: userIdBigInt
        }
      },
      include: {
        referred: true
      }
    })
    
    const referredUserIds = referrals.map(r => r.referred.userId)
    
    // Получаем завершенные депозиты рефералов
    const completedDeposits = await prisma.request.findMany({
      where: {
        userId: { in: referredUserIds },
        requestType: 'deposit',
        status: { in: ['completed', 'approved', 'auto_completed', 'autodeposit_success'] }
      }
    })
    
    // Считаем количество активных рефералов (которые сделали депозит)
    const activeReferralCount = new Set(completedDeposits.map(d => d.userId.toString())).size
    
    // Считаем общую сумму депозитов рефералов
    const totalDeposits = completedDeposits.reduce((sum, dep) => {
      return sum + (dep.amount ? parseFloat(dep.amount.toString()) : 0)
    }, 0)
    
    // Получаем заработанные комиссии (завершенные)
    const earnings = await prisma.botReferralEarning.findMany({
      where: {
        referrer: {
          userId: userIdBigInt
        },
        status: 'completed'
      }
    })
    
    const earned = earnings.reduce((sum, e) => {
      return sum + (e.commissionAmount ? parseFloat(e.commissionAmount.toString()) : 0)
    }, 0)
    
    // Получаем топ игроков по сумме пополнений
    const allDeposits = await prisma.request.findMany({
      where: {
        requestType: 'deposit',
        status: { in: ['completed', 'approved', 'auto_completed', 'autodeposit_success'] }
      },
      include: {
        user: true
      }
    })
    
    // Группируем по пользователям
    const userStatsMap = new Map<string, { userId: string, username: string, totalDeposits: number }>()
    
    for (const deposit of allDeposits) {
      const userIdStr = deposit.userId.toString()
      if (!userStatsMap.has(userIdStr)) {
        userStatsMap.set(userIdStr, {
          userId: userIdStr,
          username: deposit.user?.username || deposit.user?.firstName || `Игрок #${userIdStr}`,
          totalDeposits: 0
        })
      }
      const userStats = userStatsMap.get(userIdStr)!
      userStats.totalDeposits += deposit.amount ? parseFloat(deposit.amount.toString()) : 0
    }
    
    // Сортируем и берем топ-3
    const topPlayers = Array.from(userStatsMap.values())
      .sort((a, b) => b.totalDeposits - a.totalDeposits)
      .slice(0, 3)
      .map((p, index) => ({
        id: p.userId,
        username: p.username,
        total_deposits: p.totalDeposits,
        referral_count: 0, // Пока не считаем
        rank: index + 1
      }))
    
    // Находим место пользователя
    let userRank = 0
    for (let i = 0; i < topPlayers.length; i++) {
      if (topPlayers[i].id === userId) {
        userRank = i + 1
        break
      }
    }
    
    return NextResponse.json({
      success: true,
      earned: earned,
      referral_count: activeReferralCount,
      top_players: topPlayers,
      user_rank: userRank
    })
    
  } catch (error: any) {
    console.error('Referral data API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch referral data'
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

