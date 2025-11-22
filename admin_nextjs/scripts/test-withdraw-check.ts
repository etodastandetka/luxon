#!/usr/bin/env tsx
/**
 * Тестовый скрипт для проверки withdraw-check API
 * Использование: tsx scripts/test-withdraw-check.ts <bookmaker> <playerId> <code>
 * Пример: tsx scripts/test-withdraw-check.ts 1xbet 1464797575 9LpG
 */

import { checkWithdrawAmountCashdesk } from '../lib/casino-withdraw'
import { getCasinoConfig } from '../lib/deposit-balance'

async function testWithdrawCheck(bookmaker: string, playerId: string, code: string) {
  try {
    console.log('🧪 Тестирование withdraw-check API')
    console.log(`   Bookmaker: ${bookmaker}`)
    console.log(`   Player ID: ${playerId}`)
    console.log(`   Code: ${code}`)
    console.log('')
    
    // Получаем конфигурацию
    const config = await getCasinoConfig(bookmaker)
    
    if (!config || !config.hash || !config.cashierpass || !config.cashdeskid) {
      console.error('❌ Конфигурация не найдена для', bookmaker)
      process.exit(1)
    }
    
    console.log('✅ Конфигурация получена')
    console.log('')
    
    // Вызываем checkWithdrawAmountCashdesk
    console.log('🔄 Вызов checkWithdrawAmountCashdesk...')
    const result = await checkWithdrawAmountCashdesk(bookmaker, playerId, code, config)
    
    console.log('')
    console.log('📥 Результат:')
    console.log(JSON.stringify(result, null, 2))
    console.log('')
    
    if (result.success && result.amount) {
      console.log('✅ УСПЕХ!')
      console.log(`   Сумма: ${result.amount} сом`)
      console.log(`   Сообщение: ${result.message || 'N/A'}`)
      
      // Симулируем ответ API
      const apiResponse = {
        success: true,
        data: {
          amount: result.amount,
          alreadyExecuted: true,
          message: result.message || 'Вывод выполнен успешно'
        },
        message: 'Withdrawal executed'
      }
      
      console.log('')
      console.log('📤 Симулированный ответ API:')
      console.log(JSON.stringify(apiResponse, null, 2))
      console.log('')
      console.log('✅ Проверка извлечения суммы из ответа:')
      console.log(`   data.data.amount: ${apiResponse.data.amount}`)
      console.log(`   data.data.amount type: ${typeof apiResponse.data.amount}`)
      console.log(`   parseFloat(String(${apiResponse.data.amount})): ${parseFloat(String(apiResponse.data.amount))}`)
      console.log(`   isNaN: ${isNaN(parseFloat(String(apiResponse.data.amount)))}`)
      console.log(`   > 0: ${parseFloat(String(apiResponse.data.amount)) > 0}`)
    } else {
      console.error('❌ ОШИБКА!')
      console.error(`   Сообщение: ${result.message || 'Unknown error'}`)
      process.exit(1)
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Получаем аргументы из командной строки
const args = process.argv.slice(2)

if (args.length < 3) {
  console.error('Использование: tsx scripts/test-withdraw-check.ts <bookmaker> <playerId> <code>')
  console.error('Пример: tsx scripts/test-withdraw-check.ts 1xbet 1464797575 9LpG')
  process.exit(1)
}

const bookmaker = args[0]
const playerId = args[1]
const code = args[2]

testWithdrawCheck(bookmaker, playerId, code)

