import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  protectAPI, 
  rateLimit, 
  sanitizeInput, 
  containsSQLInjection,
  getClientIP 
} from '@/lib/security'

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
    // 🛡️ МАКСИМАЛЬНАЯ ЗАЩИТА (но разрешаем Telegram WebApp)
    // Для публичного API referral-data ослабляем защиту, т.к. запросы идут из Telegram WebApp
    const userAgent = request.headers.get('user-agent') || ''
    const isTelegramWebApp = userAgent.includes('Telegram') || request.headers.get('x-telegram-bot-api-secret-token')
    
    // Если это не Telegram WebApp, применяем защиту
    if (!isTelegramWebApp) {
      const protectionResult = protectAPI(request)
      if (protectionResult) {
        // Добавляем CORS заголовки к ответу защиты
        protectionResult.headers.set('Access-Control-Allow-Origin', '*')
        console.log('🚫 [Referral Data API] Запрос заблокирован защитой:', {
          userAgent,
          ip: getClientIP(request)
        })
        return protectionResult
      }
    }

    // Rate limiting (строгий для публичного endpoint)
    const rateLimitResult = rateLimit({ 
      maxRequests: 20, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `referral_data:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) {
      // Добавляем CORS заголовки к ответу rate limiting
      rateLimitResult.headers.set('Access-Control-Allow-Origin', '*')
      return rateLimitResult
    }

    const { searchParams } = new URL(request.url)
    let userId = searchParams.get('user_id')
    const topOnly = searchParams.get('top_only') === 'true'
    
    const clientIP = getClientIP(request)
    
    console.log('📋 [Referral Data API] Запрос данных рефералов:', { 
      userId, 
      topOnly,
      ip: clientIP,
      userAgent: userAgent.substring(0, 100), // Первые 100 символов
      url: request.url
    })
    
    // Если запрашивается только топ, пропускаем проверку user_id
    if (!topOnly && !userId) {
      console.log('❌ [Referral Data API] User ID не предоставлен')
      const response = NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }
    
    // Если только топ, возвращаем только топ игроков
    if (topOnly) {
      try {
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
                firstName: true
              }
            })
          : []
      
      const userMap = new Map(topReferrerUsers.map(u => [u.userId.toString(), u]))
      
      const prizeDistribution = [10000, 5000, 2500, 1500, 1000]
      
      const topReferrers = topReferrersRaw.map((ref, index) => {
        const user = userMap.get(ref.referrer_id.toString())
        const displayName = user?.username 
          ? `@${user.username}` 
          : user?.firstName 
            ? user.firstName 
            : `Игрок #${ref.referrer_id}`
        
        return {
          id: ref.referrer_id.toString(),
          username: displayName,
          total_deposits: parseFloat(ref.total_deposits.toString()),
          referral_count: parseInt(ref.referral_count.toString()),
          rank: index + 1,
          prize: prizeDistribution[index] || 0
        }
      })
      
      // Рассчитываем дату следующей выплаты
      const now = new Date()
      const currentDay = now.getDate()
      let nextPayoutDate: Date
      
      if (currentDay < 21) {
        nextPayoutDate = new Date(now.getFullYear(), now.getMonth(), 21)
      } else {
        nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 21)
      }
      
      const monthNames = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
      ]
      const nextPayoutDateFormatted = `${nextPayoutDate.getDate()} ${monthNames[nextPayoutDate.getMonth()]}`
      
      const response = NextResponse.json({
        success: true,
        top_players: topReferrers,
        settings: {
          referral_percentage: 5,
          min_payout: 100,
          first_place_prize: prizeDistribution[0],
          second_place_prize: prizeDistribution[1],
          third_place_prize: prizeDistribution[2],
          fourth_place_prize: prizeDistribution[3],
          fifth_place_prize: prizeDistribution[4],
          total_prize_pool: 20000,
          next_payout_date: nextPayoutDateFormatted
        }
      })
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
      } catch (error: any) {
        console.error('❌ [Referral Data API] Ошибка при загрузке топа:', error)
        // Возвращаем пустой топ вместо ошибки
        const response = NextResponse.json({
          success: true,
          top_players: [],
          settings: {
            referral_percentage: 5,
            min_payout: 100,
            first_place_prize: 10000,
            second_place_prize: 5000,
            third_place_prize: 2500,
            fourth_place_prize: 1500,
            fifth_place_prize: 1000,
            total_prize_pool: 20000,
            next_payout_date: '1 ноября'
          }
        })
        response.headers.set('Access-Control-Allow-Origin', '*')
        return response
      }
    }

    // 🛡️ Валидация и очистка
    if (userId && containsSQLInjection(userId)) {
      console.warn(`🚫 SQL injection attempt from ${getClientIP(request)}`)
      const response = NextResponse.json({
        success: false,
        error: 'Invalid input'
      }, { status: 400 })
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    userId = sanitizeInput(userId || '') as string

    // Telegram user_id должен состоять только из цифр
    if (!/^\d+$/.test(userId)) {
      const response = NextResponse.json({
        success: false,
        error: 'Invalid user ID format'
      }, { status: 400 })
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    // Ограничение длины
    if (userId.length > 20) {
      const response = NextResponse.json({
        success: false,
        error: 'User ID too long'
      }, { status: 400 })
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }
    
    const userIdBigInt = BigInt(userId)
    
    console.log('🔍 [Referral Data API] Поиск рефералов для пользователя:', userIdBigInt.toString())
    
    // ОПТИМИЗИРОВАННЫЕ ЗАПРОСЫ: Используем параллельные запросы и агрегацию
    const [referrals, earnings, stats] = await Promise.all([
      // Получаем только количество рефералов (без include для скорости)
      prisma.botReferral.count({
        where: {
          referrer: {
            userId: userIdBigInt
          }
        }
      }),
      // Получаем заработанные комиссии с агрегацией
      prisma.botReferralEarning.aggregate({
        where: {
          referrer: {
            userId: userIdBigInt
          },
          status: 'completed'
        },
        _sum: {
          commissionAmount: true
        }
      }),
      // Получаем статистику депозитов рефералов через агрегацию
      prisma.$queryRaw<Array<{
        active_referrals: bigint,
        total_deposits: number
      }>>`
        SELECT 
          COUNT(DISTINCT r.user_id) as active_referrals,
          COALESCE(SUM(r.amount), 0) as total_deposits
        FROM "referrals" br
        INNER JOIN "requests" r ON r.user_id = br.referred_id
        WHERE br.referrer_id = ${userIdBigInt}
          AND r.request_type = 'deposit'
          AND r.status IN ('completed', 'approved', 'auto_completed', 'autodeposit_success')
          AND r.amount > 0
      `
    ])
    
    const referralCount = referrals
    const earned = earnings._sum.commissionAmount ? parseFloat(earnings._sum.commissionAmount.toString()) : 0
    const activeReferralCount = stats.length > 0 ? parseInt(stats[0].active_referrals.toString()) : 0
    const totalDeposits = stats.length > 0 ? parseFloat(stats[0].total_deposits.toString()) : 0
    
    console.log('📊 [Referral Data API] Найдено рефералов:', referralCount)
    console.log('📊 [Referral Data API] Активных рефералов:', activeReferralCount)
    console.log('📊 [Referral Data API] Заработано:', earned)
    
    // ОПТИМИЗИРОВАННАЯ ЛОГИКА: Используем агрегацию на уровне БД для скорости
    // Получаем топ-5 реферов через агрегацию (быстрее чем обработка в памяти)
    const topReferrersRaw = await prisma.$queryRaw<Array<{
      referrer_id: bigint,
      total_deposits: number,
      referral_count: bigint
    }>>`
      SELECT 
        br.referrer_id,
        COALESCE(SUM(r.amount), 0) as total_deposits,
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
    const topReferrerIds = topReferrersRaw.map(r => r.referrer_id)
    const topReferrerUsers = await prisma.botUser.findMany({
      where: {
        userId: { in: topReferrerIds }
      },
      select: {
        userId: true,
        username: true,
        firstName: true
      }
    })
    
    const userMap = new Map(topReferrerUsers.map(u => [u.userId.toString(), u]))
    
    const topReferrers = topReferrersRaw.map((ref, index) => {
      const user = userMap.get(ref.referrer_id.toString())
      const displayName = user?.username 
        ? `@${user.username}` 
        : user?.firstName 
          ? user.firstName 
          : `Игрок #${ref.referrer_id}`
      
      return {
        id: ref.referrer_id.toString(),
        username: displayName,
        total_deposits: parseFloat(ref.total_deposits.toString()),
        referral_count: parseInt(ref.referral_count.toString()),
        rank: index + 1
      }
    })
    
    // Находим место текущего пользователя через отдельный запрос
    const userRankData = await prisma.$queryRaw<Array<{
      referrer_id: bigint,
      total_deposits: number,
      rank: bigint
    }>>`
      WITH ranked_referrers AS (
        SELECT 
          br.referrer_id,
          COALESCE(SUM(r.amount), 0) as total_deposits,
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(r.amount), 0) DESC) as rank
        FROM "BotReferral" br
        LEFT JOIN "Request" r ON r.user_id = br.referred_id 
          AND r.request_type = 'deposit'
          AND r.status IN ('completed', 'approved', 'auto_completed', 'autodeposit_success')
          AND r.amount > 0
        GROUP BY br.referrer_id
      )
      SELECT referrer_id, total_deposits, rank
      FROM ranked_referrers
      WHERE referrer_id = ${userIdBigInt}
    `
    
    let userRank = 0
    let userTotalDeposits = 0
    if (userRankData.length > 0) {
      userRank = parseInt(userRankData[0].rank.toString())
      userTotalDeposits = parseFloat(userRankData[0].total_deposits.toString())
    }
    
    // Определяем причину, почему пользователь не в топе (если не в топе)
    let notInTopReason: string | null = null
    if (userRank === 0) {
      if (referralCount === 0) {
        notInTopReason = 'no_referrals' // Нет рефералов
      } else if (totalDeposits === 0) {
        notInTopReason = 'no_deposits' // Рефералы не делали депозиты
      } else {
        notInTopReason = 'low_amount' // Сумма депозитов меньше, чем у топ-5
      }
    }
    
    // Если пользователь не в топ-5, но есть данные, показываем его место
    const userInTop5 = userRank > 0 && userRank <= 5
    
    // Настройки призового фонда: 20,000 сом распределены между 5 местами
    const prizeDistribution = [
      10000, // 1 место
      5000,  // 2 место
      2500,  // 3 место
      1500,  // 4 место
      1000   // 5 место
    ]
    
    // Добавляем призы к топ-5 реферам
    const topReferrersWithPrizes = topReferrers.map((ref, index) => ({
      ...ref,
      prize: prizeDistribution[index] || 0
    }))
    
    // Получаем уже выведенные средства для расчета доступного баланса
    const completedWithdrawals = await prisma.referralWithdrawalRequest.findMany({
      where: {
        userId: userIdBigInt,
        status: 'completed'
      }
    })
    
    const totalWithdrawn = completedWithdrawals.reduce((sum, w) => {
      return sum + (w.amount ? parseFloat(w.amount.toString()) : 0)
    }, 0)
    
    const availableBalance = earned - totalWithdrawn
    
    // Проверяем, есть ли pending заявка
    const pendingWithdrawal = await prisma.referralWithdrawalRequest.findFirst({
      where: {
        userId: userIdBigInt,
        status: 'pending'
      }
    })
    
    const hasPendingWithdrawal = !!pendingWithdrawal
    
    console.log('📊 [Referral Data API] Доступный баланс:', availableBalance)
    console.log('📊 [Referral Data API] Есть pending заявка:', hasPendingWithdrawal)
    
    // Рассчитываем дату следующей выплаты (21 число каждого месяца)
    const now = new Date()
    const currentDay = now.getDate()
    let nextPayoutDate: Date
    
    if (currentDay < 21) {
      // Если сегодняшнее число меньше 21, следующая выплата будет 21 числа текущего месяца
      nextPayoutDate = new Date(now.getFullYear(), now.getMonth(), 21)
    } else {
      // Если сегодняшнее число больше или равно 21, следующая выплата будет 21 числа следующего месяца
      nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 21)
    }
    
    // Форматируем дату на русском языке
    const monthNames = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ]
    const nextPayoutDateFormatted = `${nextPayoutDate.getDate()} ${monthNames[nextPayoutDate.getMonth()]}`
    
    const responseData = {
      success: true,
      earned: earned,
      available_balance: availableBalance, // Доступный баланс для вывода
      has_pending_withdrawal: hasPendingWithdrawal, // Есть ли pending заявка
      referral_count: activeReferralCount, // Количество рефералов, которые сделали депозиты
      total_referrals: referralCount, // Общее количество рефералов (включая тех, кто не делал депозиты)
      top_players: topReferrersWithPrizes, // Топ-5 реферов
      user_rank: userRank > 0 ? userRank : null, // Место в рейтинге (null если не в топе)
      user_in_top5: userInTop5, // В топ-5 или нет
      user_total_deposits: userTotalDeposits, // Сумма всех депозитов рефералов пользователя
      not_in_top_reason: notInTopReason, // Причина, почему не в топе (если не в топе)
      // Минимальная сумма для попадания в топ-5 (сумма 5-го места)
      min_amount_for_top5: topReferrersWithPrizes.length >= 5 
        ? topReferrersWithPrizes[4].total_deposits 
        : 0,
      settings: {
        referral_percentage: 5,
        min_payout: 100,
        first_place_prize: prizeDistribution[0],
        second_place_prize: prizeDistribution[1],
        third_place_prize: prizeDistribution[2],
        fourth_place_prize: prizeDistribution[3],
        fifth_place_prize: prizeDistribution[4],
        total_prize_pool: 20000,
        next_payout_date: nextPayoutDateFormatted
      }
    }
    
    console.log('✅ [Referral Data API] Отправка данных:', {
      earned: responseData.earned,
      total_referrals: responseData.total_referrals,
      referral_count: responseData.referral_count,
      user_rank: responseData.user_rank
    })
    
    const response = NextResponse.json(responseData)
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
    
  } catch (error: any) {
    console.error('❌ [Referral Data API] Критическая ошибка:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    })
    
    // Возвращаем более информативную ошибку
    const errorResponse = NextResponse.json({
      success: false,
      error: error.message || 'Ошибка на сервере. Попробуйте позже.'
    }, { status: 500 })
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

export const dynamic = 'force-dynamic'

