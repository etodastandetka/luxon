/**
 * Скрипт для добавления API ключа 1win в базу данных
 * 
 * Использование:
 *   npx tsx scripts/add-1win-api-key.ts
 *   или
 *   npm run add-1win-api-key
 */

import { prisma } from '../lib/prisma'

const API_KEY = 'f69190bced227b4d2ee16f614c64f777d1414435570efb430a6008242da0244c'

async function main() {
  try {
    console.log('🔑 Добавление API ключа для 1win...')
    
    const configValue = JSON.stringify({
      api_key: API_KEY
    })

    const result = await prisma.botConfiguration.upsert({
      where: { key: '1win_api_config' },
      update: {
        value: configValue,
        description: 'API конфигурация для 1win (API ключ)',
      },
      create: {
        key: '1win_api_config',
        value: configValue,
        description: 'API конфигурация для 1win (API ключ)',
      },
    })

    console.log('✅ API ключ успешно добавлен!')
    console.log('📋 Конфигурация:', {
      id: result.id,
      key: result.key,
      value: JSON.parse(result.value),
      description: result.description,
    })
  } catch (error: any) {
    console.error('❌ Ошибка при добавлении API ключа:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

