/**
 * Скрипт для добавления конфигурации 1xbet Cashdesk API в базу данных
 * 
 * Использование:
 *   npx tsx scripts/add-1xbet-config.ts
 * 
 * Или с параметрами:
 *   npx tsx scripts/add-1xbet-config.ts --hash <hash> --login <login> --password <password> --cashdeskid <id>
 */

import { prisma } from '../lib/prisma'

async function add1xbetConfig() {
  try {
    // Парсим аргументы командной строки
    const args = process.argv.slice(2)
    const getArg = (name: string, defaultValue?: string): string | undefined => {
      const index = args.indexOf(`--${name}`)
      if (index !== -1 && index + 1 < args.length) {
        return args[index + 1]
      }
      return defaultValue
    }

    // Данные из сообщения пользователя
    const hash = getArg('hash', '97f471a9db92debbda38201af67e15f64d086e94ae4b919d8a6a4f64958912cf') || '97f471a9db92debbda38201af67e15f64d086e94ae4b919d8a6a4f64958912cf'
    const login = getArg('login', 'zhenishbAd') || 'zhenishbAd'
    const password = getArg('password', 'wiaWAfE9') || 'wiaWAfE9'
    const cashdeskid = getArg('cashdeskid', '1388580') || '1388580'

    console.log('🔧 Adding 1xbet Cashdesk API configuration...')
    console.log(`  - Hash: ${hash.substring(0, 20)}...`)
    console.log(`  - Login: ${login}`)
    console.log(`  - Password: ${password.substring(0, 3)}...`)
    console.log(`  - Cashdesk ID: ${cashdeskid}`)

    // Проверяем, существует ли уже конфигурация
    const existing = await prisma.botConfiguration.findFirst({
      where: { key: '1xbet_api_config' },
    })

    const configData = {
      hash: hash!,
      cashierpass: password!, // password используется как cashierpass
      login: login!,
      cashdeskid: parseInt(cashdeskid!),
    }

    if (existing) {
      // Обновляем существующую конфигурацию
      await prisma.botConfiguration.update({
        where: { key: '1xbet_api_config' },
        data: {
          value: JSON.stringify(configData),
        },
      })
      console.log('✅ 1xbet API configuration updated successfully')
    } else {
      // Создаем новую конфигурацию
      await prisma.botConfiguration.create({
        data: {
          key: '1xbet_api_config',
          value: JSON.stringify(configData),
        },
      })
      console.log('✅ 1xbet API configuration created successfully')
    }

    // Проверяем результат
    const verify = await prisma.botConfiguration.findFirst({
      where: { key: '1xbet_api_config' },
    })

    if (verify) {
      const config = typeof verify.value === 'string' ? JSON.parse(verify.value) : verify.value
      console.log('\n📋 Configuration saved:')
      console.log(`  - Key: ${verify.key}`)
      console.log(`  - Hash: ${config.hash?.substring(0, 20)}...`)
      console.log(`  - Login: ${config.login}`)
      console.log(`  - Cashdesk ID: ${config.cashdeskid}`)
    }

    return prisma.$disconnect()
  } catch (error: any) {
    console.error('❌ Error adding 1xbet configuration:', error)
    console.error('Error details:', error.message, error.stack)
    return prisma.$disconnect().finally(() => {
      process.exit(1)
    })
  }
}

add1xbetConfig()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    prisma.$disconnect().finally(() => {
      process.exit(1)
    })
  })

