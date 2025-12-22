/**
 * Автоматическое закрытие дневных смен
 * Запускается при старте приложения и закрывает смену каждый день в 23:59
 */

import cron from 'node-cron'
import { prisma } from './prisma'

let isSchedulerStarted = false

/**
 * Закрывает смену за указанную дату
 */
async function closeShiftForDate(date: Date) {
  try {
    const shiftDate = new Date(date)
    shiftDate.setHours(0, 0, 0, 0)

    // Получаем начало и конец дня (00:00:00 - 23:59:59)
    const shiftStart = new Date(shiftDate)
    const shiftEnd = new Date(shiftDate)
    shiftEnd.setHours(23, 59, 59, 999)

    console.log(`🔄 [Shift Scheduler] Закрытие смены за ${shiftDate.toISOString().split('T')[0]}`)

    // Статусы для подсчета
    const depositSuccessStatuses = ['autodeposit_success', 'auto_completed']
    const withdrawalSuccessStatuses = ['completed', 'approved', 'autodeposit_success', 'auto_completed']

    // Получаем статистику за день
    const [depositStats, withdrawalStats] = await Promise.all([
      prisma.request.aggregate({
        where: {
          requestType: 'deposit',
          status: { in: depositSuccessStatuses },
          createdAt: {
            gte: shiftStart,
            lte: shiftEnd,
          },
        },
        _count: { id: true },
        _sum: { amount: true },
      }),
      prisma.request.aggregate({
        where: {
          requestType: 'withdraw',
          status: { in: withdrawalSuccessStatuses },
          createdAt: {
            gte: shiftStart,
            lte: shiftEnd,
          },
        },
        _count: { id: true },
        _sum: { amount: true },
      }),
    ])

    const depositsSum = parseFloat(depositStats._sum.amount?.toString() || '0')
    const withdrawalsSum = parseFloat(withdrawalStats._sum.amount?.toString() || '0')
    const depositsCount = depositStats._count.id || 0
    const withdrawalsCount = withdrawalStats._count.id || 0

    // Чистая прибыль: 8% от пополнений + 2% от выводов
    const netProfit = depositsSum * 0.08 + withdrawalsSum * 0.02

    // Проверяем, не закрыта ли уже смена
    const existingShift = await prisma.dailyShift.findUnique({
      where: {
        shiftDate: shiftDate,
      },
    })

    if (existingShift && existingShift.isClosed) {
      console.log(`ℹ️ [Shift Scheduler] Смена за ${shiftDate.toISOString().split('T')[0]} уже закрыта`)
      return
    }

    // Создаем или обновляем смену
    const shift = await prisma.dailyShift.upsert({
      where: {
        shiftDate: shiftDate,
      },
      create: {
        shiftDate: shiftDate,
        depositsSum: depositsSum,
        withdrawalsSum: withdrawalsSum,
        netProfit: netProfit,
        depositsCount: depositsCount,
        withdrawalsCount: withdrawalsCount,
        isClosed: true,
        closedAt: new Date(),
      },
      update: {
        depositsSum: depositsSum,
        withdrawalsSum: withdrawalsSum,
        netProfit: netProfit,
        depositsCount: depositsCount,
        withdrawalsCount: withdrawalsCount,
        isClosed: true,
        closedAt: new Date(),
      },
    })

    console.log(`✅ [Shift Scheduler] Смена закрыта:`, {
      date: shift.shiftDate.toISOString().split('T')[0],
      depositsSum: shift.depositsSum.toString(),
      withdrawalsSum: shift.withdrawalsSum.toString(),
      netProfit: shift.netProfit.toString(),
      depositsCount: shift.depositsCount,
      withdrawalsCount: shift.withdrawalsCount,
    })
  } catch (error: any) {
    console.error('❌ [Shift Scheduler] Ошибка при закрытии смены:', error)
  }
}

/**
 * Запускает планировщик для автоматического закрытия смен
 * Закрывает смену каждый день в 23:59
 */
export function startShiftScheduler() {
  // Защита от повторного запуска
  if (isSchedulerStarted) {
    console.log('ℹ️ [Shift Scheduler] Планировщик уже запущен')
    return
  }

  // Запускаем только на сервере (не в браузере)
  if (typeof window !== 'undefined') {
    return
  }

  // Запускаем cron задачу: каждый день в 23:59
  // Формат: секунда минута час день месяц день_недели
  // '59 23 * * *' = в 23:59:00 каждый день
  // Используем системный часовой пояс сервера
  cron.schedule('59 23 * * *', async () => {
    console.log('⏰ [Shift Scheduler] Запуск автоматического закрытия смены...')
    const today = new Date()
    await closeShiftForDate(today)
  })

  isSchedulerStarted = true
  console.log('✅ [Shift Scheduler] Планировщик запущен. Смена будет закрываться автоматически каждый день в 23:59')
}

// Автоматически запускаем планировщик при импорте модуля
// Это сработает при старте сервера Next.js
if (typeof window === 'undefined') {
  startShiftScheduler()
}

