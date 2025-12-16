/**
 * Тестовый скрипт для проверки mob-cash API
 * Запуск: tsx scripts/test-mobcash.ts
 */

import { MobCashClient } from '../lib/mob-cash-api'

async function testMobCash() {
  console.log('🧪 Тестирование mob-cash API')
  console.log('=' .repeat(50))

  // Конфигурация из переменных окружения или дефолтные значения
  const config = {
    login: process.env.MOBCASH_LOGIN || 'burgoevk',
    password: process.env.MOBCASH_PASSWORD || 'Kanat312###',
    cashdesk_id: process.env.MOBCASH_CASHDESK_ID || '1001098',
    default_lat: parseFloat(process.env.MOBCASH_DEFAULT_LAT || '42.845778'),
    default_lon: parseFloat(process.env.MOBCASH_DEFAULT_LON || '74.568778'),
  }

  console.log('📋 Конфигурация:')
  console.log(`   Login: ${config.login}`)
  console.log(`   Password: ${config.password.substring(0, 3)}***`)
  console.log(`   Cashdesk ID: ${config.cashdesk_id}`)
  console.log(`   Location: ${config.default_lat}, ${config.default_lon}`)
  console.log()

  const payerID = '1219358907'
  const testAmount = '100.08'

  try {
    console.log('🔐 Шаг 1: Создание клиента...')
    const client = new MobCashClient(config)

    console.log('🔐 Шаг 2: Попытка авторизации...')
    // Авторизация произойдет автоматически при первом запросе
    // Но мы можем проверить её отдельно через приватные методы
    // Для этого попробуем выполнить проверку аккаунта

    console.log('🔍 Шаг 3: Проверка аккаунта игрока...')
    console.log(`   Payer ID: ${payerID}`)
    
    try {
      const nicknameResult = await client.checkPayerNickname(payerID)
      console.log('✅ Аккаунт найден!')
      console.log(`   Nickname: ${nicknameResult.nickname || 'N/A'}`)
    } catch (error: any) {
      console.error('❌ Ошибка при проверке аккаунта:')
      console.error(`   ${error.message}`)
      console.error(`   Stack: ${error.stack}`)
      return
    }

    console.log()
    console.log('💰 Шаг 4: Попытка пополнения...')
    console.log(`   Payer ID: ${payerID}`)
    console.log(`   Amount: ${testAmount}`)

    const depositResult = await client.deposit(payerID, testAmount)
    
    if (depositResult.success) {
      console.log('✅ Пополнение успешно!')
      console.log(`   Message: ${depositResult.message}`)
      if (depositResult.data) {
        console.log(`   Data:`, JSON.stringify(depositResult.data, null, 2))
      }
    } else {
      console.error('❌ Пополнение не удалось!')
      console.error(`   Message: ${depositResult.message}`)
      if (depositResult.data) {
        console.error(`   Data:`, JSON.stringify(depositResult.data, null, 2))
      }
    }

  } catch (error: any) {
    console.error('❌ Критическая ошибка:')
    console.error(`   ${error.message}`)
    console.error(`   Stack: ${error.stack}`)
  }

  console.log()
  console.log('=' .repeat(50))
  console.log('🏁 Тестирование завершено')
}

// Запуск теста
testMobCash().catch(console.error)

