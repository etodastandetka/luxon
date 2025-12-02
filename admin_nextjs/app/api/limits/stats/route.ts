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
    // Ограничиваем данные графика последними 30 днями для ускорения загрузки
    let chartStartDate = startDate ? new Date(startDate) : null
    let chartEndDate = endDate ? new Date(endDate) : null
    
    // Если период не указан, ограничиваем последними 30 днями
    if (!chartStartDate || !chartEndDate) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      chartStartDate = chartStartDate || thirtyDaysAgo
      chartEndDate = chartEndDate || new Date()
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
        LIMIT 30
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
        LIMIT 30
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
    const platformStatsQuery = await prisma.$queryRawUnsafe<Array<{
      platform_key: string;
      deposits_count: bigint;
      deposits_sum: string | null;
      withdrawals_count: bigint;
      withdrawals_sum: string | null;
    }>>(`
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
        SUM(CASE WHEN request_type = 'deposit' AND status IN ('autodeposit_success', 'auto_completed') THEN 1 ELSE 0 END)::bigint as deposits_count,
        COALESCE(SUM(CASE WHEN request_type = 'deposit' AND status IN ('autodeposit_success', 'auto_completed') THEN amount ELSE 0 END), 0)::text as deposits_sum,
        SUM(CASE WHEN request_type = 'withdraw' AND status IN ('completed', 'approved', 'autodeposit_success', 'auto_completed') THEN 1 ELSE 0 END)::bigint as withdrawals_count,
        COALESCE(SUM(CASE WHEN request_type = 'withdraw' AND status IN ('completed', 'approved', 'autodeposit_success', 'auto_completed') THEN amount ELSE 0 END), 0)::text as withdrawals_sum
      FROM requests
      WHERE bookmaker IS NOT NULL
        ${dateCondition}
      GROUP BY platform_key
      HAVING platform_key IS NOT NULL
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

