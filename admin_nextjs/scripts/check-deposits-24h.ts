/**
 * Скрипт для проверки депозитов за период с позавчерашнего 12:00 до сегодняшнего 12:00 (2 суток)
 */

import { prisma } from '../lib/prisma'

async function checkDeposits24h() {
  try {
    // Получаем текущую дату и время
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Сегодняшний день в 12:00
    const today12 = new Date(today)
    today12.setHours(12, 0, 0, 0)
    
    // Позавчерашний день в 12:00 (2 суток назад)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const twoDaysAgo12 = new Date(twoDaysAgo)
    twoDaysAgo12.setHours(12, 0, 0, 0)
    
    console.log('📅 Период проверки (2 суток):')
    console.log(`   С: ${twoDaysAgo12.toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek' })}`)
    console.log(`   До: ${today12.toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek' })}\n`)
    
    // Получаем все депозиты за этот период
    const deposits = await prisma.request.findMany({
      where: {
        requestType: 'deposit',
        createdAt: {
          gte: twoDaysAgo12,
          lt: today12,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        cryptoPayment: true,
      },
    })
    
    console.log(`📊 Найдено депозитов: ${deposits.length}\n`)
    
    if (deposits.length === 0) {
      console.log('✅ Депозитов за этот период не найдено')
      return
    }
    
    // Статистика по статусам
    const statusStats: Record<string, number> = {}
    const statusAmounts: Record<string, number> = {}
    
    // Статистика по букмекерам
    const bookmakerStats: Record<string, number> = {}
    const bookmakerAmounts: Record<string, number> = {}
    
    // Статистика по методам оплаты
    const paymentMethodStats: Record<string, number> = {}
    const paymentMethodAmounts: Record<string, number> = {}
    
    // Статистика по пользователям
    const userStats: Record<string, { username: string; firstName: string | null; lastName: string | null; userId: bigint; count: number; totalAmount: number }> = {}
    
    let totalAmount = 0
    let processedAmount = 0
    let pendingAmount = 0
    let rejectedAmount = 0
    
    deposits.forEach((deposit) => {
      const amount = deposit.amount ? Number(deposit.amount) : 0
      totalAmount += amount
      
      // Статистика по статусам
      const status = deposit.status || 'unknown'
      statusStats[status] = (statusStats[status] || 0) + 1
      statusAmounts[status] = (statusAmounts[status] || 0) + amount
      
      if (status === 'completed' || status === 'approved') {
        processedAmount += amount
      } else if (status === 'pending') {
        pendingAmount += amount
      } else if (status === 'rejected' || status === 'cancelled') {
        rejectedAmount += amount
      }
      
      // Статистика по букмекерам
      const bookmaker = deposit.bookmaker || 'unknown'
      bookmakerStats[bookmaker] = (bookmakerStats[bookmaker] || 0) + 1
      bookmakerAmounts[bookmaker] = (bookmakerAmounts[bookmaker] || 0) + amount
      
      // Статистика по методам оплаты
      const paymentMethod = deposit.paymentMethod || deposit.cryptoPayment ? 'crypto' : 'bank' || 'unknown'
      paymentMethodStats[paymentMethod] = (paymentMethodStats[paymentMethod] || 0) + 1
      paymentMethodAmounts[paymentMethod] = (paymentMethodAmounts[paymentMethod] || 0) + amount
      
      // Статистика по пользователям
      const userKey = deposit.userId.toString()
      if (!userStats[userKey]) {
        userStats[userKey] = {
          username: deposit.username || '',
          firstName: deposit.firstName,
          lastName: deposit.lastName,
          userId: deposit.userId,
          count: 0,
          totalAmount: 0,
        }
      }
      userStats[userKey].count += 1
      userStats[userKey].totalAmount += amount
    })
    
    // Выводим общую статистику
    console.log('💰 Общая статистика:')
    console.log(`   Общая сумма: ${totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`   Обработано: ${processedAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`   В ожидании: ${pendingAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`   Отклонено: ${rejectedAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`)
    
    // Выводим статистику по статусам
    console.log('📋 Статистика по статусам:')
    Object.entries(statusStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        const amount = statusAmounts[status] || 0
        console.log(`   ${status}: ${count} шт. (${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`)
      })
    console.log()
    
    // Выводим статистику по букмекерам
    console.log('🎰 Статистика по букмекерам:')
    Object.entries(bookmakerStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([bookmaker, count]) => {
        const amount = bookmakerAmounts[bookmaker] || 0
        console.log(`   ${bookmaker}: ${count} шт. (${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`)
      })
    console.log()
    
    // Выводим статистику по методам оплаты
    console.log('💳 Статистика по методам оплаты:')
    Object.entries(paymentMethodStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([method, count]) => {
        const amount = paymentMethodAmounts[method] || 0
        console.log(`   ${method}: ${count} шт. (${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`)
      })
    console.log()
    
    // Выводим список всех депозитов
    console.log('📝 Список всех депозитов:')
    console.log('─'.repeat(120))
    deposits.forEach((deposit, index) => {
      const amount = deposit.amount ? Number(deposit.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
      const createdAt = new Date(deposit.createdAt).toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek' })
      const username = deposit.username || deposit.firstName || deposit.userId.toString()
      const bookmaker = deposit.bookmaker || 'N/A'
      const status = deposit.status || 'N/A'
      const paymentMethod = deposit.paymentMethod || (deposit.cryptoPayment ? 'crypto' : 'bank') || 'N/A'
      
      console.log(`${index + 1}. ${createdAt} | ${username} | ${bookmaker} | ${amount} | ${status} | ${paymentMethod}`)
      if (deposit.processedBy) {
        console.log(`   Обработано: ${deposit.processedBy}`)
      }
      if (deposit.processedAt) {
        const processedAt = new Date(deposit.processedAt).toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek' })
        console.log(`   Время обработки: ${processedAt}`)
      }
    })
    console.log('─'.repeat(120))
    console.log()
    
    // Выводим топ пользователей по сумме депозитов
    console.log('👥 Топ пользователей по сумме депозитов:')
    console.log('─'.repeat(120))
    const topUsers = Object.values(userStats)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 20) // Топ 20
    
    if (topUsers.length === 0) {
      console.log('   Пользователей не найдено')
    } else {
      topUsers.forEach((user, index) => {
        const displayName = user.username || 
          (user.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : '') ||
          `User ${user.userId.toString()}`
        const amount = user.totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        console.log(`${index + 1}. ${displayName} (ID: ${user.userId}) - ${amount} (${user.count} депозитов)`)
      })
    }
    console.log('─'.repeat(120))
    
  } catch (error: any) {
    console.error('❌ Ошибка при проверке депозитов:', error)
    console.error('Детали ошибки:', error.message, error.stack)
    process.exit(1)
  }
}

// Запускаем скрипт
checkDeposits24h()
  .then(() => {
    console.log('\n✅ Скрипт выполнен успешно')
    return prisma.$disconnect()
  })
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Скрипт завершился с ошибкой:', error)
    prisma.$disconnect().finally(() => {
      process.exit(1)
    })
  })

