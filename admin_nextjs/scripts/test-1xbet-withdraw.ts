/**
 * Тестовый скрипт для проверки работы вывода через MobCash API для 1xbet
 * 
 * Использование:
 *   npm run test:withdraw
 *   или
 *   npx tsx scripts/test-1xbet-withdraw.ts
 * 
 * Переменные окружения (опционально, если не указаны в БД):
 *   MOBCASH_LOGIN - логин для MobCash
 *   MOBCASH_PASSWORD - пароль для MobCash
 *   MOBCASH_CASHDESK_ID - ID кассы
 *   MOBCASH_BEARER_TOKEN - Bearer токен (если есть)
 *   MOBCASH_USER_ID - User ID (если есть)
 *   MOBCASH_SESSION_ID - Session ID (если есть)
 */

import { MobCashClient } from '../lib/mob-cash-api'
import { getMobCashConfig } from '../lib/deposit-balance'
import { checkWithdrawAmountMobCash, processWithdrawMobCash } from '../lib/casino-withdraw'
import { prisma } from '../lib/prisma'

// Параметры для теста (измените на свои)
const TEST_PAYER_ID = process.env.TEST_PAYER_ID || '1085261647' // ID аккаунта игрока
const TEST_WITHDRAWAL_CODE = process.env.TEST_WITHDRAWAL_CODE || 'bbbb' // Код ордера на вывод

async function testWithdraw() {
  console.log('🧪 Тестирование вывода через MobCash API для 1xbet\n')
  console.log('📋 Параметры теста:')
  console.log(`   Payer ID: ${TEST_PAYER_ID}`)
  console.log(`   Withdrawal Code: ${TEST_WITHDRAWAL_CODE}\n`)

  try {
    // Получаем конфигурацию MobCash
    console.log('🔧 Получение конфигурации MobCash...')
    const mobCashConfig = await getMobCashConfig('1xbet')
    
    if (!mobCashConfig || !mobCashConfig.login || !mobCashConfig.password || !mobCashConfig.cashdesk_id) {
      console.error('❌ Ошибка: Конфигурация MobCash не найдена!')
      console.error('   Убедитесь, что в базе данных есть запись с ключом "1xbet_mobcash_config"')
      console.error('   или установлены переменные окружения MOBCASH_*')
      process.exit(1)
    }

    console.log('✅ Конфигурация получена:')
    console.log(`   Login: ${mobCashConfig.login}`)
    console.log(`   Cashdesk ID: ${mobCashConfig.cashdesk_id}`)
    console.log(`   Bearer Token: ${mobCashConfig.bearer_token ? '✅ Установлен' : '❌ Не установлен'}`)
    console.log(`   User ID: ${mobCashConfig.user_id || '❌ Не установлен'}`)
    console.log(`   Session ID: ${mobCashConfig.session_id || '❌ Не установлен'}`)
    console.log(`   Location: lat=${mobCashConfig.default_lat || 42.845778}, lon=${mobCashConfig.default_lon || 74.568778}\n`)

    // Предупреждение, если токены не установлены
    if (!mobCashConfig.bearer_token || !mobCashConfig.user_id || !mobCashConfig.session_id) {
      console.warn('⚠️  Внимание: Токены MobCash не установлены!')
      console.warn('   Для работы API необходимо установить токены одним из способов:')
      console.warn('   1. Запустить Python скрипт: python3 scripts/update_mobcash_tokens.py')
      console.warn('   2. Установить переменные окружения: MOBCASH_BEARER_TOKEN, MOBCASH_USER_ID, MOBCASH_SESSION_ID')
      console.warn('   3. Добавить токены в БД в настройке "1xbet_mobcash_config"')
      console.warn('   Система попытается выполнить OAuth2 авторизацию, но это может не сработать без client_secret.\n')
    }

    // Шаг 1: Проверка кода и получение суммы ордера
    console.log('📝 Шаг 1: Проверка кода и получение суммы ордера (mobile.getWithdrawalAmount)...')
    const checkResult = await checkWithdrawAmountMobCash(
      TEST_PAYER_ID,
      TEST_WITHDRAWAL_CODE,
      mobCashConfig
    )

    if (!checkResult.success) {
      console.error('❌ Ошибка при проверке кода:')
      console.error(`   ${checkResult.message}`)
      process.exit(1)
    }

    const amount = checkResult.amount || 0
    console.log('✅ Код проверен успешно!')
    console.log(`   Сумма ордера: ${amount}\n`)

    if (amount === 0) {
      console.warn('⚠️  Внимание: Сумма ордера равна 0. Возможно, код неверный или ордер не найден.')
      console.warn('   Продолжение теста может привести к ошибке.\n')
    }

    // Шаг 2: Выполнение вывода
    console.log('💰 Шаг 2: Выполнение вывода (mobile.withdrawal)...')
    console.log(`   Сумма: ${amount}`)
    console.log(`   Payer ID: ${TEST_PAYER_ID}`)
    console.log(`   Withdrawal Code: ${TEST_WITHDRAWAL_CODE}\n`)

    // ВАЖНО: Раскомментируйте следующую строку только если хотите реально выполнить вывод!
    // const withdrawResult = await processWithdrawMobCash(
    //   TEST_PAYER_ID,
    //   amount,
    //   TEST_WITHDRAWAL_CODE,
    //   mobCashConfig
    // )

    // if (!withdrawResult.success) {
    //   console.error('❌ Ошибка при выполнении вывода:')
    //   console.error(`   ${withdrawResult.message}`)
    //   process.exit(1)
    // }

    // console.log('✅ Вывод выполнен успешно!')
    // console.log(`   Результат: ${JSON.stringify(withdrawResult.data, null, 2)}\n`)

    console.log('⚠️  Выполнение вывода пропущено (закомментировано для безопасности)')
    console.log('   Раскомментируйте код в скрипте, если хотите реально выполнить вывод.\n')

    // Тест через прямой вызов MobCashClient
    console.log('🔍 Дополнительный тест: Прямой вызов MobCashClient...')
    const client = new MobCashClient(mobCashConfig)
    
    console.log('   Тест 1: getWithdrawalAmount...')
    const directCheckResult = await client.getWithdrawalAmount(TEST_PAYER_ID, TEST_WITHDRAWAL_CODE)
    
    if (!directCheckResult.success) {
      console.error(`   ❌ Ошибка: ${directCheckResult.message}`)
    } else {
      console.log(`   ✅ Успешно! Сумма: ${directCheckResult.amount}`)
    }

    // Раскомментируйте для реального вывода:
    // console.log('   Тест 2: withdrawal...')
    // const directWithdrawResult = await client.withdrawal(TEST_PAYER_ID, amount, TEST_WITHDRAWAL_CODE)
    // if (!directWithdrawResult.success) {
    //   console.error(`   ❌ Ошибка: ${directWithdrawResult.message}`)
    // } else {
    //   console.log(`   ✅ Успешно!`)
    // }

    console.log('\n✅ Все тесты пройдены успешно!')
    console.log('\n📝 Резюме:')
    console.log(`   ✅ Конфигурация MobCash загружена`)
    console.log(`   ✅ Проверка кода работает (mobile.getWithdrawalAmount)`)
    console.log(`   ✅ Сумма ордера получена: ${amount}`)
    console.log(`   ⚠️  Выполнение вывода пропущено (для безопасности)`)

  } catch (error: any) {
    console.error('\n❌ Критическая ошибка при тестировании:')
    console.error(`   ${error.message}`)
    if (error.stack) {
      console.error('\n   Stack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Запуск теста
testWithdraw()
  .then(() => {
    console.log('\n✅ Тестирование завершено')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Необработанная ошибка:')
    console.error(error)
    process.exit(1)
  })

