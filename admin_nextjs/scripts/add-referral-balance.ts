#!/usr/bin/env tsx
/**
 * Скрипт для добавления тестового баланса в реферальную программу
 * Использование: tsx scripts/add-referral-balance.ts <userId> <amount>
 * Пример: tsx scripts/add-referral-balance.ts 8281001567 100
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addReferralBalance(userId: string, amount: number) {
  try {
    const userIdBigInt = BigInt(userId)
    
    // Проверяем существует ли пользователь
    const user = await prisma.botUser.findUnique({
      where: { userId: userIdBigInt }
    })
    
    if (!user) {
      console.error(`❌ Пользователь с ID ${userId} не найден`)
      process.exit(1)
    }
    
    console.log(`✅ Пользователь найден: ${user.username || user.firstName || `ID: ${userId}`}`)
    
    // Создаем тестовую запись о заработке
    // Используем фиктивный referredId (самого пользователя) для теста
    const earning = await prisma.botReferralEarning.create({
      data: {
        referrerId: userIdBigInt,
        referredId: userIdBigInt, // Для теста используем самого пользователя
        amount: amount,
        commissionAmount: amount, // Комиссия равна сумме для теста
        bookmaker: 'test',
        status: 'completed'
      }
    })
    
    console.log(`✅ Создана запись о заработке:`)
    console.log(`   ID: ${earning.id}`)
    console.log(`   Сумма: ${amount} сом`)
    console.log(`   Статус: ${earning.status}`)
    
    // Проверяем новый баланс
    const earnings = await prisma.botReferralEarning.findMany({
      where: {
        referrerId: userIdBigInt,
        status: 'completed'
      }
    })
    
    const totalEarned = earnings.reduce((sum, e) => {
      return sum + (e.commissionAmount ? parseFloat(e.commissionAmount.toString()) : 0)
    }, 0)
    
    const completedWithdrawals = await prisma.referralWithdrawalRequest.findMany({
      where: {
        userId: userIdBigInt,
        status: 'completed'
      }
    })
    
    const totalWithdrawn = completedWithdrawals.reduce((sum, w) => {
      return sum + (w.amount ? parseFloat(w.amount.toString()) : 0)
    }, 0)
    
    const availableBalance = totalEarned - totalWithdrawn
    
    console.log(`\n📊 Текущий баланс:`)
    console.log(`   Заработано: ${totalEarned.toFixed(2)} сом`)
    console.log(`   Выведено: ${totalWithdrawn.toFixed(2)} сом`)
    console.log(`   Доступно для вывода: ${availableBalance.toFixed(2)} сом`)
    
    console.log(`\n✅ Готово! Баланс успешно добавлен.`)
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Получаем аргументы из командной строки
const args = process.argv.slice(2)

if (args.length < 2) {
  console.error('Использование: tsx scripts/add-referral-balance.ts <userId> <amount>')
  console.error('Пример: tsx scripts/add-referral-balance.ts 8281001567 100')
  process.exit(1)
}

const userId = args[0]
const amount = parseFloat(args[1])

if (isNaN(amount) || amount <= 0) {
  console.error('❌ Неверная сумма. Должно быть положительное число.')
  process.exit(1)
}

addReferralBalance(userId, amount)

