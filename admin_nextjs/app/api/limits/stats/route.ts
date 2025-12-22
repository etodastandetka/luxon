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

    // Статусы для подсчета (учитываем все успешные статусы, включая ручную обработку)
    const depositSuccessStatuses = ['autodeposit_success', 'auto_completed', 'completed', 'approved']
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

      // Пытаемся получить закрытые смены за период
      let shifts: any[] = []
      try {
        // @ts-ignore - dailyShift может быть не в типах, если Prisma Client не обновлен
        shifts = await prisma.dailyShift.findMany({
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
      } catch (dbError: any) {
        // Если таблица не существует, просто продолжаем без смен
        if (dbError.message?.includes('does not exist') || 
            dbError.message?.includes('Unknown model') ||
            dbError.code === 'P2021') {
          console.warn('⚠️ [Limits Stats] DailyShift table does not exist yet. Run: npx prisma db push')
          shifts = []
        } else {
          throw dbError
        }
      }

      // Суммируем все смены за период
      shifts.forEach((shift) => {
        totalDepositsSum += parseFloat(shift.depositsSum.toString())
        totalDepositsCount += shift.depositsCount
        totalWithdrawalsSum += parseFloat(shift.withdrawalsSum.toString())
        totalWithdrawalsCount += shift.withdrawalsCount
        approximateIncome += parseFloat(shift.netProfit.toString())
      })

      // Также учитываем текущую смену, если она попадает в период И еще не закрыта
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)

      if (today >= start && today <= end) {
        // Проверяем, закрыта ли уже смена за сегодня
        let todayShift: any = null
        try {
          // @ts-ignore - dailyShift может быть не в типах, если Prisma Client не обновлен
          todayShift = await prisma.dailyShift.findUnique({
            where: {
              shiftDate: today,
            },
          })
        } catch (dbError: any) {
          // Если таблица не существует, просто продолжаем
          if (!(dbError.message?.includes('does not exist') || 
                dbError.message?.includes('Unknown model') ||
                dbError.code === 'P2021')) {
            throw dbError
          }
        }

        // Добавляем данные за сегодня только если смена еще НЕ закрыта
        // Если смена закрыта, данные уже учтены в shifts выше
        if (!todayShift || !todayShift.isClosed) {
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
      }
    } else {
      // Период не выбран - показываем данные за сегодня (с 00:00 сегодня)
      // Сначала проверяем, есть ли закрытая смена за сегодня
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const now = new Date()

      // Проверяем, есть ли закрытая смена за сегодня
      let todayShift: any = null
      try {
        // @ts-ignore - dailyShift может быть не в типах, если Prisma Client не обновлен
        todayShift = await prisma.dailyShift.findUnique({
          where: {
            shiftDate: today,
          },
        })
      } catch (dbError: any) {
        // Если таблица не существует, просто продолжаем без смены
        if (dbError.message?.includes('does not exist') || 
            dbError.message?.includes('Unknown model') ||
            dbError.code === 'P2021') {
          console.warn('⚠️ [Limits Stats] DailyShift table does not exist yet. Run: npx prisma db push')
          todayShift = null
        } else {
          throw dbError
        }
      }

      if (todayShift && todayShift.isClosed) {
        // Используем данные из закрытой смены
        totalDepositsSum = parseFloat(todayShift.depositsSum.toString())
        totalDepositsCount = todayShift.depositsCount
        totalWithdrawalsSum = parseFloat(todayShift.withdrawalsSum.toString())
        totalWithdrawalsCount = todayShift.withdrawalsCount
        approximateIncome = parseFloat(todayShift.netProfit.toString())
      } else {
        // Смена еще не закрыта - считаем данные напрямую из requests за сегодня
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
    }

    // Для статистики по платформам используем ТОЧНО ТЕ ЖЕ данные, что и для общей статистики
    // Если общая статистика берется из DailyShift, то статистика по платформам тоже должна учитывать это
    // Но DailyShift не хранит разбивку по платформам, поэтому всегда берем из requests
    // НО используем те же фильтры дат, что и для общей статистики
    let dateFilterForStats: any = {}
    let useDirectRequests = true // Флаг: использовать ли данные напрямую из requests
    
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
      // Для периода всегда используем requests напрямую (DailyShift не хранит разбивку по платформам)
      useDirectRequests = true
    } else {
      // Период не выбран - используем те же данные, что и для общей статистики
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const now = new Date()
      
      // Проверяем, откуда взялась общая статистика (из DailyShift или из requests)
      let todayShift: any = null
      try {
        // @ts-ignore - dailyShift может быть не в типах, если Prisma Client не обновлен
        todayShift = await prisma.dailyShift.findUnique({
          where: {
            shiftDate: today,
          },
        })
      } catch (dbError: any) {
        // Игнорируем ошибки таблицы
      }
      
      if (todayShift && todayShift.isClosed) {
        // Общая статистика взята из DailyShift, но для платформ все равно используем requests
        // так как DailyShift не хранит разбивку по платформам
        dateFilterForStats = {
          createdAt: {
            gte: today,
            lte: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1), // До конца дня
          },
        }
        useDirectRequests = true
      } else {
        // Общая статистика взята из requests - используем те же фильтры
        dateFilterForStats = {
          createdAt: {
            gte: today,
            lte: now,
          },
        }
        useDirectRequests = true
      }
    }

    // Данные для графика - вычисляем даты заранее
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
    
    // Получаем настройки казино, лимиты платформ, статистику по платформам и данные графика параллельно
    // Это значительно ускоряет загрузку, так как все выполняется параллельно
    const [casinoSettingsConfig, platformLimitsResult, platformStatsQuery, chartData] = await Promise.all([
      prisma.botConfiguration.findFirst({
        where: { key: 'casinos' },
      }),
      (async () => {
        const { getPlatformLimits } = await import('../../../../lib/casino-api')
        return await getPlatformLimits()
      })(),
      // Выполняем запрос статистики по платформам параллельно
      (async () => {
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
        
        return await prisma.$queryRawUnsafe<Array<{
          platform_key: string;
          deposits_count: bigint;
          deposits_sum: string | null;
          withdrawals_count: bigint;
          withdrawals_sum: string | null;
        }>>(`
          SELECT 
            platform_key,
            SUM(CASE WHEN request_type = 'deposit' THEN 1 ELSE 0 END)::bigint as deposits_count,
            COALESCE(SUM(CASE WHEN request_type = 'deposit' THEN amount ELSE 0 END), 0)::text as deposits_sum,
            SUM(CASE WHEN request_type = 'withdraw' THEN 1 ELSE 0 END)::bigint as withdrawals_count,
            COALESCE(SUM(CASE WHEN request_type = 'withdraw' THEN amount ELSE 0 END), 0)::text as withdrawals_sum
          FROM (
            SELECT 
              CASE 
                WHEN LOWER(TRIM(bookmaker)) = '1xbet' THEN '1xbet'
                WHEN LOWER(TRIM(bookmaker)) = '1win' THEN '1win'
                WHEN LOWER(TRIM(bookmaker)) = 'melbet' THEN 'melbet'
                WHEN LOWER(TRIM(bookmaker)) = 'mostbet' THEN 'mostbet'
                WHEN LOWER(TRIM(bookmaker)) = 'winwin' THEN 'winwin'
                WHEN LOWER(TRIM(bookmaker)) = '888starz' THEN '888starz'
                WHEN LOWER(TRIM(bookmaker)) LIKE '%1xbet%' OR LOWER(TRIM(bookmaker)) LIKE '%xbet%' THEN '1xbet'
                WHEN LOWER(TRIM(bookmaker)) LIKE '%1win%' OR LOWER(TRIM(bookmaker)) LIKE '%onewin%' THEN '1win'
                WHEN LOWER(TRIM(bookmaker)) LIKE '%melbet%' THEN 'melbet'
                WHEN LOWER(TRIM(bookmaker)) LIKE '%mostbet%' THEN 'mostbet'
                WHEN LOWER(TRIM(bookmaker)) LIKE '%winwin%' OR LOWER(TRIM(bookmaker)) LIKE '%win win%' THEN 'winwin'
                WHEN LOWER(TRIM(bookmaker)) LIKE '%888starz%' OR LOWER(TRIM(bookmaker)) LIKE '%888%' THEN '888starz'
                ELSE NULL
              END as platform_key,
              request_type,
              status,
              amount,
              created_at
            FROM requests
            WHERE bookmaker IS NOT NULL
              AND TRIM(bookmaker) != ''
              AND (
                (request_type = 'deposit' AND status IN ('autodeposit_success', 'auto_completed', 'completed', 'approved'))
                OR
                (request_type = 'withdraw' AND status IN ('completed', 'approved', 'autodeposit_success', 'auto_completed'))
              )
              ${dateCondition}
          ) as platform_requests
          WHERE platform_key IS NOT NULL
          GROUP BY platform_key
        `, ...dateParams)
      })(),
      // Выполняем запрос данных графика параллельно
      prisma.$queryRaw<Array<{ 
        date: string; 
        deposit_count: bigint;
        withdrawal_count: bigint;
      }>>`
        SELECT 
          DATE(created_at)::text as date,
          SUM(CASE WHEN request_type = 'deposit' AND status IN ('autodeposit_success', 'auto_completed', 'completed', 'approved') THEN 1 ELSE 0 END)::bigint as deposit_count,
          SUM(CASE WHEN request_type = 'withdraw' AND status IN ('completed', 'approved', 'autodeposit_success', 'auto_completed') THEN 1 ELSE 0 END)::bigint as withdrawal_count
        FROM requests
        WHERE created_at >= ${chartStartDate}::timestamp
          AND created_at <= ${chartEndDate}::timestamp
          AND (
            (request_type = 'deposit' AND status IN ('autodeposit_success', 'auto_completed', 'completed', 'approved'))
            OR
            (request_type = 'withdraw' AND status IN ('completed', 'approved', 'autodeposit_success', 'auto_completed'))
          )
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,
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
      return isEnabled
    })

    // Обрабатываем данные графика (получены параллельно выше)
    const chartDataSafe = chartData || []
    const depositsByDate = chartDataSafe.map((d: any) => ({ date: d.date, count: d.deposit_count }))
    const withdrawalsByDate = chartDataSafe.map((d: any) => ({ date: d.date, count: d.withdrawal_count }))

    // Форматируем даты для графика (YYYY-MM-DD -> dd.mm)
    const formatDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-')
      return `${day}.${month}`
    }

    const depositsLabels = depositsByDate.map((d: any) => formatDate(d.date))
    const depositsData = depositsByDate.map((d: any) => Number(d.count))
    const withdrawalsLabels = withdrawalsByDate.map((d: any) => formatDate(d.date))
    const withdrawalsData = withdrawalsByDate.map((d: any) => Number(d.count))

    // Создаем мапу для быстрого доступа
    const depositsDateMap = new Map<string, string>()
    depositsByDate.forEach((d: any) => {
      depositsDateMap.set(formatDate(d.date), d.date)
    })
    
    const withdrawalsDateMap = new Map<string, string>()
    withdrawalsByDate.forEach((d: any) => {
      withdrawalsDateMap.set(formatDate(d.date), d.date)
    })

    // Объединяем метки и сортируем по исходной дате
    const allLabelsSet = new Set([...depositsLabels, ...withdrawalsLabels])
    const allLabels = Array.from(allLabelsSet).sort((a: string, b: string) => {
      const dateA = depositsDateMap.get(a) || withdrawalsDateMap.get(a) || ''
      const dateB = depositsDateMap.get(b) || withdrawalsDateMap.get(b) || ''
      return dateA.localeCompare(dateB)
    })

    // Синхронизируем данные
    const depositsDict = Object.fromEntries(
      depositsLabels.map((label: string, i: number) => [label, depositsData[i]])
    )
    const withdrawalsDict = Object.fromEntries(
      withdrawalsLabels.map((label: string, i: number) => [label, withdrawalsData[i]])
    )

    const synchronizedDeposits = allLabels.map((label: string) => depositsDict[label] || 0)
    const synchronizedWithdrawals = allLabels.map((label: string) => withdrawalsDict[label] || 0)
    
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
    
    // Кеширование: если период выбран (закрытые смены) - кешируем на 30 секунд
    // Если период не выбран (текущий день) - кешируем на 5 секунд для свежести данных
    if (startDate && endDate) {
      response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    } else {
      response.headers.set('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15')
    }
    
    return response
  } catch (error: any) {
    console.error('Limits stats error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch limits stats'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

