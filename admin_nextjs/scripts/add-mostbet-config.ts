/**
 * Скрипт для добавления/обновления конфигурации Mostbet API в базу данных
 * 
 * Использование:
 *   npx tsx scripts/add-mostbet-config.ts
 *   или
 *   npm run add-mostbet-config
 * 
 * Переменные окружения (опционально):
 *   MOSTBET_API_KEY - API ключ (например: api-key:3d83ac24-7fd2-498d-84b4-f2a7e80401fb)
 *   MOSTBET_SECRET - Secret ключ
 *   MOSTBET_CASHPOINT_ID - ID кассы (например: 48436 или C131864)
 */

import { prisma } from '../lib/prisma'

async function addMostbetConfig() {
  try {
    console.log('🔑 Добавление/обновление конфигурации Mostbet API...\n')

    // Получаем значения из переменных окружения или запрашиваем у пользователя
    const apiKey = process.env.MOSTBET_API_KEY || process.argv[2]
    const secret = process.env.MOSTBET_SECRET || process.argv[3]
    const cashpointId = process.env.MOSTBET_CASHPOINT_ID || process.argv[4]

    if (!apiKey || !secret || !cashpointId) {
      console.error('❌ Ошибка: Необходимо указать все параметры!')
      console.log('\n📋 Использование:')
      console.log('  npx tsx scripts/add-mostbet-config.ts <API_KEY> <SECRET> <CASHPOINT_ID>')
      console.log('\n📋 Или установите переменные окружения:')
      console.log('  MOSTBET_API_KEY=api-key:...')
      console.log('  MOSTBET_SECRET=...')
      console.log('  MOSTBET_CASHPOINT_ID=...')
      console.log('\n📋 Пример:')
      console.log('  npx tsx scripts/add-mostbet-config.ts "api-key:3d83ac24-7fd2-498d-84b4-f2a7e80401fb" "baa104d1-73a6-4914-866a-ddbbe0aae11a" "48436"')
      return prisma.$disconnect().finally(() => {
        process.exit(1)
      })
    }

    // Проверяем формат API ключа
    const apiKeyFormatted = apiKey.startsWith('api-key:') ? apiKey : `api-key:${apiKey}`

    console.log('📋 Параметры:')
    console.log(`  - API Key: ${apiKeyFormatted.substring(0, 30)}...`)
    console.log(`  - Secret: ${secret.substring(0, 10)}...`)
    console.log(`  - Cashpoint ID: ${cashpointId}`)
    console.log('')

    // Проверяем, существует ли уже конфигурация
    const existing = await prisma.botConfiguration.findFirst({
      where: { key: 'mostbet_api_config' },
    })

    const configData = {
      api_key: apiKeyFormatted,
      secret: secret.trim(),
      cashpoint_id: String(cashpointId).trim(),
    }

    if (existing) {
      // Обновляем существующую конфигурацию
      await prisma.botConfiguration.update({
        where: { key: 'mostbet_api_config' },
        data: {
          value: JSON.stringify(configData),
          description: 'API конфигурация для Mostbet Cash (API Key, Secret, Cashpoint ID)',
        },
      })
      console.log('✅ Mostbet API configuration updated successfully')
    } else {
      // Создаем новую конфигурацию
      await prisma.botConfiguration.create({
        data: {
          key: 'mostbet_api_config',
          value: JSON.stringify(configData),
          description: 'API конфигурация для Mostbet Cash (API Key, Secret, Cashpoint ID)',
        },
      })
      console.log('✅ Mostbet API configuration created successfully')
    }

    // Проверяем результат
    const verify = await prisma.botConfiguration.findFirst({
      where: { key: 'mostbet_api_config' },
    })

    if (verify) {
      const config = typeof verify.value === 'string' ? JSON.parse(verify.value) : verify.value
      console.log('\n📋 Configuration saved:')
      console.log(`  - Key: ${verify.key}`)
      console.log(`  - API Key: ${config.api_key?.substring(0, 40)}...`)
      console.log(`  - Secret: ${config.secret ? config.secret.substring(0, 10) + '...' : 'missing'}`)
      console.log(`  - Cashpoint ID: ${config.cashpoint_id}`)
      console.log(`  - Description: ${verify.description || 'N/A'}`)
    }

    return prisma.$disconnect()
  } catch (error: any) {
    console.error('❌ Error adding Mostbet configuration:', error)
    console.error('Error details:', error.message, error.stack)
    return prisma.$disconnect().finally(() => {
      process.exit(1)
    })
  }
}

addMostbetConfig()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })

