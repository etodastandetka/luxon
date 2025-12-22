import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
// Импортируем планировщик для автоматического запуска
import '@/lib/shift-scheduler'

export const dynamic = 'force-dynamic'

interface PlatformStats {
  key: string
  name: string
  depositsSum: number
  depositsCount: number
  withdrawalsSum: number
  withdrawalsCount: number
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию
    try {
      requireAuth(request)
    } catch (authError: any) {
      console.error('❌ [Limits Stats] Auth error:', authError)
      return NextResponse.json(
        createApiResponse(null, authError.message || 'Unauthorized'),
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    
    console.log('📊 [Limits Stats] Fetching stats:', { startDate, endDate })

    // Статусы для подсчета
    const depositSuccessStatuses = ['autodeposit_success', 'auto_completed']
    const withdrawalSuccessStatuses = ['completed', 'approved', 'autodeposit_success', 'auto_completed']

    let totalDepositsSum = 0
    let totalDepositsCount = 0
    let totalWithdrawalsSum = 0
    let totalWithdrawalsCount = 0
    let approximateIncome = 0

    if (startDate && endDate) {
      // Период выбран - получаем все закрытые смены за этот период и суммируем
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)

      const shifts = await prisma.dailyShift.findMany({
        where: {
          shiftDate: {
            gte: start,
            lte: end,
          },
          isClosed: true, // Только закрытые смены
        },
        orderBy: {
          shiftDate: 'asc',
        },
      })

      // Суммируем все смены за период
      shifts.forEach((shift) => {
        totalDepositsSum += parseFloat(shift.depositsSum.toString())
        totalDepositsCount += shift.depositsCount
        totalWithdrawalsSum += parseFloat(shift.withdrawalsSum.toString())
        totalWithdrawalsCount += shift.withdrawalsCount
        approximateIncome += parseFloat(shift.netProfit.toString())
      })

      // Также учитываем текущую смену, если она попадает в период
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)

      if (today >= start && today <= end) {
        // Текущий день попадает в период - добавляем данные за сегодня до текущего момента
        const todayFilter = {
          createdAt: {
            gte: today,
            lte: new Date(), // До текущего момента
          },
        }

        const [todayDepositStats, todayWithdrawalStats] = await Promise.all([
          prisma.request.aggregate({
            where: {
              requestType: 'deposit',
              status: { in: depositSuccessStatuses },
              ...todayFilter,
            },
            _count: { id: true },
            _sum: { amount: true },
          }),
          prisma.request.aggregate({
            where: {
              requestType: 'withdraw',
              status: { in: withdrawalSuccessStatuses },
              ...todayFilter,
            },
            _count: { id: true },
            _sum: { amount: true },
          }),
        ])

        totalDepositsSum += parseFloat(todayDepositStats._sum.amount?.toString() || '0')
        totalDepositsCount += todayDepositStats._count.id || 0
        totalWithdrawalsSum += parseFloat(todayWithdrawalStats._sum.amount?.toString() || '0')
        totalWithdrawalsCount += todayWithdrawalStats._count.id || 0
        approximateIncome += parseFloat(todayDepositStats._sum.amount?.toString() || '0') * 0.08 + 
                            parseFloat(todayWithdrawalStats._sum.amount?.toString() || '0') * 0.02
      }
    } else {
      // Период не выбран - показываем текущую смену (с 00:00 сегодня до текущего времени)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const now = new Date()

      const todayFilter = {
        createdAt: {
          gte: today,
          lte: now,
        },
      }

      const [depositStats, withdrawalStats] = await Promise.all([
        prisma.request.aggregate({
          where: {
            requestType: 'deposit',
            status: { in: depositSuccessStatuses },
            ...todayFilter,
          },
          _count: { id: true },
          _sum: { amount: true },
        }),
        prisma.request.aggregate({
          where: {
            requestType: 'withdraw',
            status: { in: withdrawalSuccessStatuses },
            ...todayFilter,
          },
          _count: { id: true },
          _sum: { amount: true },
        }),
      ])

      totalDepositsCount = depositStats._count.id || 0
      totalDepositsSum = parseFloat(depositStats._sum.amount?.toString() || '0')
      totalWithdrawalsCount = withdrawalStats._count.id || 0
      totalWithdrawalsSum = parseFloat(withdrawalStats._sum.amount?.toString() || '0')
      approximateIncome = totalDepositsSum * 0.08 + totalWithdrawalsSum * 0.02
    }

    // Для графика и статистики по платформам используем те же фильтры
    let dateFilterForStats: any = {}
    if (startDate && endDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilterForStats = {
        createdAt: {
          gte: start,
          lte: end,
        },
      }
    } else {
      // Для графика показываем последние 30 дней
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      dateFilterForStats = {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      }
    }

    // Данные для графика
    // Если период выбран - показываем за период, иначе последние 30 дней
    let chartStartDate: Date
    let chartEndDate: Date
    
    if (startDate && endDate) {
      chartStartDate = new Date(startDate)
      chartStartDate.setHours(0, 0, 0, 0)
      chartEndDate = new Date(endDate)
      chartEndDate.setHours(23, 59, 59, 999)
    } else {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      chartStartDate = thirtyDaysAgo
      chartEndDate = new Date()
    }
    
    // Группировка по датам для графика используя SQL (оптимизировано с индексами)
    // Для пополнений: считаем только РЕАЛЬНО обработанные через API казино
    // Для выводов: считаем все успешные статусы
    // Используем DATE() для более быстрой группировки
    // Ограничиваем последними 30 днями для ускорения
    const [depositsByDate, withdrawalsByDate] = await Promise.all([
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
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
      `,
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
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

    // Оптимизация: получаем статистику по всем платформам одним запросом вместо множества запросов
    // Строим условия для дат
    let dateCondition = ''
    const dateParams: any[] = []
    
    if (dateFilterForStats.createdAt?.gte) {
      dateCondition += ` AND created_at >= $${dateParams.length + 1}::timestamp`
      dateParams.push(dateFilterForStats.createdAt.gte)
    }
    if (dateFilterForStats.createdAt?.lt) {
      dateCondition += ` AND created_at < $${dateParams.length + 1}::timestamp`
      dateParams.push(dateFilterForStats.createdAt.lt)
    } else if (dateFilterForStats.createdAt?.lte) {
      dateCondition += ` AND created_at <= $${dateParams.length + 1}::timestamp`
      dateParams.push(dateFilterForStats.createdAt.lte)
    }
    
    // Один запрос для всех платформ - значительно быстрее
    // Используем подзапрос для правильной группировки по алиасу
    const platformStatsQuery = await prisma.$queryRawUnsafe<Array<{
      platform_key: string;
      deposits_count: bigint;
      deposits_sum: string | null;
      withdrawals_count: bigint;
      withdrawals_sum: string | null;
    }>>(`
      SELECT 
        platform_key,
        SUM(CASE WHEN request_type = 'deposit' AND status IN ('autodeposit_success', 'auto_completed') THEN 1 ELSE 0 END)::bigint as deposits_count,
        COALESCE(SUM(CASE WHEN request_type = 'deposit' AND status IN ('autodeposit_success', 'auto_completed') THEN amount ELSE 0 END), 0)::text as deposits_sum,
        SUM(CASE WHEN request_type = 'withdraw' AND status IN ('completed', 'approved', 'autodeposit_success', 'auto_completed') THEN 1 ELSE 0 END)::bigint as withdrawals_count,
        COALESCE(SUM(CASE WHEN request_type = 'withdraw' AND status IN ('completed', 'approved', 'autodeposit_success', 'auto_completed') THEN amount ELSE 0 END), 0)::text as withdrawals_sum
      FROM (
        SELECT 
          CASE 
            WHEN bookmaker ILIKE '%1xbet%' OR bookmaker ILIKE '%xbet%' THEN '1xbet'
            WHEN bookmaker ILIKE '%1win%' OR bookmaker ILIKE '%onewin%' THEN '1win'
            WHEN bookmaker ILIKE '%melbet%' THEN 'melbet'
            WHEN bookmaker ILIKE '%mostbet%' THEN 'mostbet'
            WHEN bookmaker ILIKE '%winwin%' OR bookmaker ILIKE '%win win%' THEN 'winwin'
            WHEN bookmaker ILIKE '%888%' OR bookmaker ILIKE '%888starz%' THEN '888starz'
            ELSE NULL
          END as platform_key,
          request_type,
          status,
          amount,
          created_at
        FROM requests
        WHERE bookmaker IS NOT NULL
          ${dateCondition}
      ) as platform_requests
      WHERE platform_key IS NOT NULL
      GROUP BY platform_key
    `, ...dateParams)
    
    // Преобразуем результаты в нужный формат
    const platformStatsMap = new Map<string, PlatformStats>()
    platformStatsQuery.forEach((row) => {
      const platform = platformLimits.find(p => p.key.toLowerCase() === row.platform_key.toLowerCase())
      if (platform) {
        platformStatsMap.set(platform.key, {
          key: platform.key,
          name: platform.name,
          depositsSum: parseFloat(row.deposits_sum || '0'),
          depositsCount: Number(row.deposits_count || 0),
          withdrawalsSum: parseFloat(row.withdrawals_sum || '0'),
          withdrawalsCount: Number(row.withdrawals_count || 0),
        })
      }
    })
    
    // Заполняем недостающие платформы нулями
    const platformStats = platformLimits.map(platform => 
      platformStatsMap.get(platform.key) || {
        key: platform.key,
        name: platform.name,
        depositsSum: 0,
        depositsCount: 0,
        withdrawalsSum: 0,
        withdrawalsCount: 0,
      }
    )
    
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
    
    // Добавляем кэширование для быстрой загрузки (10 секунд)
    response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')
    
    return response
  } catch (error: any) {
    console.error('Limits stats error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch limits stats'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

