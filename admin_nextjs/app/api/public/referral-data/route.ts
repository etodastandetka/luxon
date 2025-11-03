import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Публичный эндпоинт для получения данных реферальной программы (без авторизации)
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
    
    // Получаем всех пользователей, которые заходили на сайт (из BotUser или Request)
    // Получаем всех пользователей из Request (кто создавал заявки)
    const allRequests = await prisma.request.findMany({
      select: {
        userId: true,
        username: true,
        firstName: true,
      }
    })
    
    // Убираем дубликаты по userId
    const uniqueUsersFromRequests = Array.from(
      new Map(allRequests.map(r => [r.userId.toString(), r])).values()
    )
    
    // Также получаем пользователей из BotUser (кто заходил на сайт)
    const allUsersFromBot = await prisma.botUser.findMany({
      select: {
        userId: true,
        username: true,
        firstName: true,
      }
    })
    
    // Объединяем пользователей из обоих источников
    const userStatsMap = new Map<string, { userId: string, username: string, totalDeposits: number, referralCount: number }>()
    
    // Добавляем всех пользователей из BotUser (все, кто заходил на сайт)
    for (const user of allUsersFromBot) {
      const userIdStr = user.userId.toString()
      const displayName = user.username 
        ? `@${user.username}` 
        : user.firstName 
          ? user.firstName 
          : `Игрок #${userIdStr}`
      
      if (!userStatsMap.has(userIdStr)) {
        userStatsMap.set(userIdStr, {
          userId: userIdStr,
          username: displayName,
          totalDeposits: 0,
          referralCount: 0
        })
      }
    }
    
    // Добавляем пользователей из Request (могут быть новые, которых нет в BotUser)
    for (const user of uniqueUsersFromRequests) {
      const userIdStr = user.userId.toString()
      const displayName = user.username 
        ? `@${user.username}` 
        : user.firstName 
          ? user.firstName 
          : `Игрок #${userIdStr}`
      
      if (!userStatsMap.has(userIdStr)) {
        userStatsMap.set(userIdStr, {
          userId: userIdStr,
          username: displayName,
          totalDeposits: 0,
          referralCount: 0
        })
      } else {
        // Обновляем имя, если оно есть в Request
        const existing = userStatsMap.get(userIdStr)!
        if (user.username && !existing.username.startsWith('@')) {
          existing.username = displayName
        }
      }
    }
    
    // Получаем завершенные депозиты и считаем суммы для каждого пользователя
    const allDeposits = await prisma.request.findMany({
      where: {
        requestType: 'deposit',
        status: { in: ['completed', 'approved', 'auto_completed', 'autodeposit_success'] }
      }
    })
    
    for (const deposit of allDeposits) {
      const userIdStr = deposit.userId.toString()
      if (userStatsMap.has(userIdStr)) {
        const userStats = userStatsMap.get(userIdStr)!
        userStats.totalDeposits += deposit.amount ? parseFloat(deposit.amount.toString()) : 0
      }
    }
    
    // Считаем количество рефералов для каждого пользователя
    const allReferrals = await prisma.botReferral.findMany({
      include: {
        referrer: true
      }
    })
    
    for (const referral of allReferrals) {
      const userIdStr = referral.referrer.userId.toString()
      if (userStatsMap.has(userIdStr)) {
        const userStats = userStatsMap.get(userIdStr)!
        userStats.referralCount += 1
      }
    }
    
    // Сортируем по сумме депозитов (от большей к меньшей), затем по количеству рефералов
    // Включаем всех пользователей, даже с 0 депозитов
    const allPlayers = Array.from(userStatsMap.values())
      .sort((a, b) => {
        // Сначала по сумме депозитов
        if (b.totalDeposits !== a.totalDeposits) {
          return b.totalDeposits - a.totalDeposits
        }
        // Затем по количеству рефералов
        return b.referralCount - a.referralCount
      })
      .map((p, index) => ({
        id: p.userId,
        username: p.username,
        total_deposits: p.totalDeposits,
        referral_count: p.referralCount,
        rank: index + 1
      }))
    
    // Берем топ-3, но если пользователей меньше 3, показываем всех
    const topPlayers = allPlayers.slice(0, 3)
    
    // Находим место пользователя во всем списке (не только в топ-3)
    let userRank = 0
    for (let i = 0; i < allPlayers.length; i++) {
      if (allPlayers[i].id === userId) {
        userRank = i + 1
        break
      }
    }
    
    // Если пользователь не в топ-3, но есть в списке, убеждаемся что он виден
    // Добавляем текущего пользователя в топ, если его там нет
    const userInTop = topPlayers.find(p => p.id === userId)
    if (!userInTop && userRank > 0) {
      const userData = allPlayers.find(p => p.id === userId)
      if (userData && topPlayers.length < 3) {
        // Если топ не полный, добавляем пользователя
        topPlayers.push(userData)
      } else if (userData && userRank <= 10) {
        // Если пользователь в топ-10, заменяем последнего в топ-3 на него
        topPlayers[2] = userData
      }
    }
    
    const response = NextResponse.json({
      success: true,
      earned: earned,
      referral_count: activeReferralCount,
      top_players: topPlayers,
      user_rank: userRank
    })
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
    
  } catch (error: any) {
    console.error('Referral data API error:', error)
    const errorResponse = NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch referral data'
    }, { status: 500 })
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

export const dynamic = 'force-dynamic'

