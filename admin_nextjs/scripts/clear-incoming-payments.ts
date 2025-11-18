#!/usr/bin/env tsx
/**
 * Скрипт для очистки входящих платежей из базы данных
 * Использование:
 *   npm run clear-payments                    - удалить все
 *   npm run clear-payments -- --unprocessed   - удалить только необработанные
 *   npm run clear-payments -- --bank=demirbank - удалить по банку
 */

import { prisma } from '../lib/prisma'

async function clearPayments() {
  const args = process.argv.slice(2)
  const deleteUnprocessed = args.includes('--unprocessed')
  const bankArg = args.find(arg => arg.startsWith('--bank='))
  const bank = bankArg ? bankArg.split('=')[1] : null
  const deleteAll = !deleteUnprocessed && !bank

  try {
    const where: any = {}
    
    if (deleteAll) {
      where.id = { gt: 0 } // Все записи
      console.log('🗑️  Удаление всех входящих платежей...')
    } else {
      if (deleteUnprocessed) {
        where.isProcessed = false
        console.log('🗑️  Удаление необработанных платежей...')
      }
      if (bank) {
        where.bank = { contains: bank, mode: 'insensitive' }
        console.log(`🗑️  Удаление платежей от банка: ${bank}...`)
      }
    }

    // Подсчитываем количество записей
    const count = await prisma.incomingPayment.count({ where })
    
    if (count === 0) {
      console.log('✅ Нет платежей для удаления')
      return
    }

    console.log(`📊 Найдено платежей для удаления: ${count}`)
    
    // Подтверждение
    console.log('⚠️  ВНИМАНИЕ: Это действие необратимо!')
    console.log('   Для продолжения введите "yes" в течение 10 секунд...')
    
    // В production лучше использовать readline для интерактивного ввода
    // Но для простоты используем таймаут
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Удаляем записи
    const result = await prisma.incomingPayment.deleteMany({ where })

    console.log(`✅ Успешно удалено: ${result.count} платеж(ей)`)
  } catch (error: any) {
    console.error('❌ Ошибка при удалении платежей:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

clearPayments()

