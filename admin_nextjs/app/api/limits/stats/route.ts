import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    // По умолчанию показываем статистику за все время
    // Если выбран период - показываем за период
    let filters: any = {}
    let dateFilterForStats: any = {}
    
    if (startDate && endDate) {
      // Период выбран - используем его
      filters.createdAt = { 
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
      dateFilterForStats = {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      }
    } else {
      // Период не выбран - показываем все данные (не применяем фильтр по датам)
      // Оставляем filters и dateFilterForStats пустыми
    }

    // Статистика пополнений и выводов параллельно
    // Для пополнений: считаем только РЕАЛЬНО обработанные через API казино
    // - autodeposit_success: автоматически зачислено через API
    // - auto_completed: автоматически завершено
    // Для выводов: считаем все успешные (completed, approved, autodeposit_success, auto_completed)
    // так как выводы часто подтверждаются вручную админом
    const depositSuccessStatuses = ['autodeposit_success', 'auto_completed']
    const withdrawalSuccessStatuses = ['completed', 'approved', 'autodeposit_success', 'auto_completed']
    
    const [depositStats, withdrawalStats] = await Promise.all([
      prisma.request.aggregate({
        where: {
          requestType: 'deposit',
          status: { in: depositSuccessStatuses },
          ...dateFilterForStats,
        },
        _count: { id: true },
        _sum: { amount: true },
      }),
      prisma.request.aggregate({
        where: {
          requestType: 'withdraw',
          status: { in: withdrawalSuccessStatuses },
          ...dateFilterForStats,
        },
        _count: { id: true },
        _sum: { amount: true },
      }),
    ])

    const totalDepositsCount = depositStats._count.id || 0
    const totalDepositsSum = parseFloat(depositStats._sum.amount?.toString() || '0')
    const totalWithdrawalsCount = withdrawalStats._count.id || 0
    const totalWithdrawalsSum = parseFloat(withdrawalStats._sum.amount?.toString() || '0')

    // Приблизительный доход: 8% от пополнений + 2% от выводов
    // Если период не выбран - считаем за сегодня, иначе за выбранный период
    let approximateIncome: number
    if (startDate && endDate) {
      // Период выбран - используем общую статистику
      approximateIncome = totalDepositsSum * 0.08 + totalWithdrawalsSum * 0.02
    } else {
      // Период не выбран - считаем только за сегодня
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const todayFilter = {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
      
      const [todayDepositStats, todayWithdrawalStats] = await Promise.all([
        prisma.request.aggregate({
          where: {
            requestType: 'deposit',
            status: { in: depositSuccessStatuses },
            ...todayFilter,
          },
          _sum: { amount: true },
        }),
        prisma.request.aggregate({
          where: {
            requestType: 'withdraw',
            status: { in: withdrawalSuccessStatuses },
            ...todayFilter,
          },
          _sum: { amount: true },
        }),
      ])
      
      const todayDepositsSum = parseFloat(todayDepositStats._sum.amount?.toString() || '0')
      const todayWithdrawalsSum = parseFloat(todayWithdrawalStats._sum.amount?.toString() || '0')
      approximateIncome = todayDepositsSum * 0.08 + todayWithdrawalsSum * 0.02
    }

    // Данные для графика (все данные если период не указан, иначе за период)
    let chartStartDate = startDate ? new Date(startDate) : null
    let chartEndDate = endDate ? new Date(endDate) : null
    
    // Группировка по датам для графика используя SQL (оптимизировано с индексами)
    // Для пополнений: считаем только РЕАЛЬНО обработанные через API казино
    // Для выводов: считаем все успешные статусы
    // Используем DATE() для более быстрой группировки
    const [depositsByDate, withdrawalsByDate] = await Promise.all([
      chartStartDate && chartEndDate
        ? prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
            SELECT 
              DATE(created_at)::text as date,
              COUNT(*)::bigint as count
            FROM requests
            WHERE request_type = 'deposit'
              AND status IN ('autodeposit_success', 'auto_completed')
              AND created_at >= ${chartStartDate}::timestamp
              AND created_at <= ${chartEndDate}::timestamp
            GROUP BY DATE(created_at)
            ORDER BY date DESC
          `
        : prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
            SELECT 
              DATE(created_at)::text as date,
              COUNT(*)::bigint as count
            FROM requests
            WHERE request_type = 'deposit'
              AND status IN ('autodeposit_success', 'auto_completed')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
          `,
      chartStartDate && chartEndDate
        ? prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
            SELECT 
              DATE(created_at)::text as date,
              COUNT(*)::bigint as count
            FROM requests
            WHERE request_type = 'withdraw'
              AND status IN ('completed', 'approved', 'autodeposit_success', 'auto_completed')
              AND created_at >= ${chartStartDate}::timestamp
              AND created_at <= ${chartEndDate}::timestamp
            GROUP BY DATE(created_at)
            ORDER BY date DESC
          `
        : prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
            SELECT 
              DATE(created_at)::text as date,
              COUNT(*)::bigint as count
            FROM requests
            WHERE request_type = 'withdraw'
              AND status IN ('completed', 'approved', 'autodeposit_success', 'auto_completed')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
          `,
    ])

    // Форматируем даты для графика (YYYY-MM-DD -> dd.mm)
    const formatDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-')
      return `${day}.${month}`
    }

    const depositsLabels = depositsByDate.map((d) => formatDate(d.date))
    const depositsData = depositsByDate.map((d) => Number(d.count))
    const withdrawalsLabels = withdrawalsByDate.map((d) => formatDate(d.date))
    const withdrawalsData = withdrawalsByDate.map((d) => Number(d.count))

    // Создаем мапу для быстрого доступа
    const depositsDateMap = new Map<string, string>()
    depositsByDate.forEach((d) => {
      depositsDateMap.set(formatDate(d.date), d.date)
    })
    
    const withdrawalsDateMap = new Map<string, string>()
    withdrawalsByDate.forEach((d) => {
      withdrawalsDateMap.set(formatDate(d.date), d.date)
    })
    
    // Объединяем метки и сортируем по исходной дате
    const allLabelsSet = new Set([...depositsLabels, ...withdrawalsLabels])
    const allLabels = Array.from(allLabelsSet).sort((a, b) => {
      const dateA = depositsDateMap.get(a) || withdrawalsDateMap.get(a) || ''
      const dateB = depositsDateMap.get(b) || withdrawalsDateMap.get(b) || ''
      return dateA.localeCompare(dateB)
    })

    // Синхронизируем данные
    const depositsDict = Object.fromEntries(
      depositsLabels.map((label, i) => [label, depositsData[i]])
    )
    const withdrawalsDict = Object.fromEntries(
      withdrawalsLabels.map((label, i) => [label, withdrawalsData[i]])
    )

    const synchronizedDeposits = allLabels.map((label) => depositsDict[label] || 0)
    const synchronizedWithdrawals = allLabels.map((label) => withdrawalsDict[label] || 0)

    // Получаем настройки казино и лимиты платформ параллельно (с кешированием на 30 секунд)
    const [casinoSettingsConfig, platformLimitsResult] = await Promise.all([
      prisma.botConfiguration.findFirst({
        where: { key: 'casinos' },
      }),
      (async () => {
        const { getPlatformLimits } = await import('../../../../lib/casino-api')
        return await getPlatformLimits()
      })(),
    ])
    
    let platformLimits = platformLimitsResult
    
    let casinoSettings: Record<string, boolean> = {
      '1xbet': true,
      '888starz': true,
      '1win': true,
      melbet: true,
      mostbet: true,
      winwin: true,
    }
    
    if (casinoSettingsConfig) {
      try {
        const parsed = typeof casinoSettingsConfig.value === 'string' 
          ? JSON.parse(casinoSettingsConfig.value) 
          : casinoSettingsConfig.value
        casinoSettings = { ...casinoSettings, ...parsed }
      } catch (e) {
        console.error('Failed to parse casino settings:', e)
      }
    }
    
    // Фильтруем платформы: показываем только те, которые включены в настройках
    platformLimits = platformLimits.filter((platform) => {
      const key = platform.key.toLowerCase()
      // Маппинг ключей платформ на настройки
      const settingKey = key === '1xbet' ? '1xbet' 
        : key === '888starz' ? '888starz'
        : key === '1win' ? '1win'
        : key === 'melbet' ? 'melbet'
        : key === 'mostbet' ? 'mostbet'
        : key === 'winwin' ? 'winwin'
        : key
      
      const isEnabled = casinoSettings[settingKey] !== false
      if (!isEnabled) {
        console.log(`🚫 Platform ${platform.name} (${key}) is disabled in settings, hiding from limits`)
      }
      return isEnabled
    })
    
    console.log(`✅ Platform limits received:`, platformLimits.map(p => `${p.name}=${p.limit}`).join(', '))

    // Получаем статистику по каждой платформе отдельно
    const platformStatsPromises = platformLimits.map(async (platform) => {
      const platformKey = platform.key.toLowerCase()
      const platformName = platform.name.toLowerCase()
      
      // Нормализуем название платформы для поиска в БД
      // В БД могут быть разные варианты написания: "1xbet", "1XBet", "1xBet" и т.д.
      // Используем case-insensitive поиск через SQL для большей гибкости
      let searchPatterns: string[] = []
      if (platformKey === '1xbet' || platformKey.includes('xbet')) {
        searchPatterns = ['1xbet', '1XBet', '1xBet', '1XBET', 'xbet', 'XBet']
      } else if (platformKey === '1win' || platformKey.includes('1win')) {
        searchPatterns = ['1win', '1Win', '1WIN', 'onewin', 'OneWin']
      } else if (platformKey === 'melbet' || platformName.includes('melbet')) {
        searchPatterns = ['melbet', 'Melbet', 'MELBET']
      } else if (platformKey === 'mostbet' || platformName.includes('mostbet')) {
        searchPatterns = ['mostbet', 'Mostbet', 'MOSTBET']
      } else if (platformKey === 'winwin' || platformName.includes('winwin')) {
        searchPatterns = ['winwin', 'WinWin', 'WINWIN', 'win win']
      } else if (platformKey === '888starz' || platformName.includes('888')) {
        searchPatterns = ['888starz', '888Starz', '888STARZ', '888 starz']
      } else {
        // Для остальных используем варианты написания
        searchPatterns = [
          platformKey,
          platformKey.charAt(0).toUpperCase() + platformKey.slice(1),
          platformKey.toUpperCase(),
          platform.name,
        ]
      }
      
      // Используем SQL для более надежного поиска по платформам
      // Это позволяет находить платформы независимо от регистра и вариантов написания
      // Например, "Melbet", "melbet", "MELBET" все будут найдены
      
      // Строим условия для дат
      let depositDateCondition = ''
      let withdrawalDateCondition = ''
      const depositDateParams: any[] = []
      const withdrawalDateParams: any[] = []
      
      if (dateFilterForStats.createdAt?.gte) {
        depositDateCondition += ` AND created_at >= $${depositDateParams.length + 2}::timestamp`
        depositDateParams.push(dateFilterForStats.createdAt.gte)
        withdrawalDateCondition += ` AND created_at >= $${withdrawalDateParams.length + 2}::timestamp`
        withdrawalDateParams.push(dateFilterForStats.createdAt.gte)
      }
      if (dateFilterForStats.createdAt?.lt) {
        depositDateCondition += ` AND created_at < $${depositDateParams.length + 2}::timestamp`
        depositDateParams.push(dateFilterForStats.createdAt.lt)
        withdrawalDateCondition += ` AND created_at < $${withdrawalDateParams.length + 2}::timestamp`
        withdrawalDateParams.push(dateFilterForStats.createdAt.lt)
      } else if (dateFilterForStats.createdAt?.lte) {
        depositDateCondition += ` AND created_at <= $${depositDateParams.length + 2}::timestamp`
        depositDateParams.push(dateFilterForStats.createdAt.lte)
        withdrawalDateCondition += ` AND created_at <= $${withdrawalDateParams.length + 2}::timestamp`
        withdrawalDateParams.push(dateFilterForStats.createdAt.lte)
      }
      
      // Используем оптимизированный SQL с индексами для быстрого поиска
      // Используем ILIKE для case-insensitive поиска (быстрее чем LOWER)
      const [depositStatsRaw, withdrawalStatsRaw] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{ count: bigint; sum: string | null }>>(
          `SELECT 
            COUNT(*)::bigint as count,
            COALESCE(SUM(amount), 0)::text as sum
          FROM requests
          WHERE request_type = 'deposit'
            AND status IN ('autodeposit_success', 'auto_completed')
            AND bookmaker ILIKE $1
            ${depositDateCondition}`,
          `%${platformKey}%`,
          ...depositDateParams
        ),
        prisma.$queryRawUnsafe<Array<{ count: bigint; sum: string | null }>>(
          `SELECT 
            COUNT(*)::bigint as count,
            COALESCE(SUM(amount), 0)::text as sum
          FROM requests
          WHERE request_type = 'withdraw'
            AND status IN ('completed', 'approved', 'autodeposit_success', 'auto_completed')
            AND bookmaker ILIKE $1
            ${withdrawalDateCondition}`,
          `%${platformKey}%`,
          ...withdrawalDateParams
        ),
      ])
      
      // Преобразуем результаты SQL
      const depositsSum = parseFloat(depositStatsRaw[0]?.sum || '0')
      const withdrawalsSum = parseFloat(withdrawalStatsRaw[0]?.sum || '0')
      const depositsCount = Number(depositStatsRaw[0]?.count || 0)
      const withdrawalsCount = Number(withdrawalStatsRaw[0]?.count || 0)
      
      console.log(`📊 Platform ${platform.name} (${platformKey}): deposits=${depositsSum} (${depositsCount}), withdrawals=${withdrawalsSum} (${withdrawalsCount})`)
      
      const depositStats = {
        _count: { id: depositsCount },
        _sum: { amount: depositsSum }
      }
      
      const withdrawalStats = {
        _count: { id: withdrawalsCount },
        _sum: { amount: withdrawalsSum }
      }
      
      return {
        key: platform.key,
        name: platform.name,
        depositsSum: depositsSum,
        depositsCount: depositsCount,
        withdrawalsSum: withdrawalsSum,
        withdrawalsCount: withdrawalsCount,
      }
    })
    
    const platformStats = await Promise.all(platformStatsPromises)
    
    // Убрали отладочные запросы для ускорения

    const response = NextResponse.json(
      createApiResponse({
        platformLimits,
        platformStats,
        totalDepositsCount,
        totalDepositsSum,
        totalWithdrawalsCount,
        totalWithdrawalsSum,
        approximateIncome,
        chart: {
          labels: allLabels,
          deposits: synchronizedDeposits,
          withdrawals: synchronizedWithdrawals,
        },
      })
    )
    
    // Добавляем кэширование для быстрой загрузки (5 секунд)
    response.headers.set('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=10')
    
    return response
  } catch (error: any) {
    console.error('Limits stats error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch limits stats'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

