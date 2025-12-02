import { prisma } from '../lib/prisma'

/**
 * Скрипт для очистки всех блокировок IP из БД и памяти
 */
async function unblockAllIPs() {
  console.log('🔓 Очистка всех блокировок IP...')
  console.log('')

  try {
    // 1. Проверяем BotConfiguration на наличие записей о блокировках
    console.log('📋 Проверяю BotConfiguration на записи о блокировках...')
    
    const blockedIPKeys = [
      'blocked_ips',
      'blocked_ip_list',
      'ip_blocks',
      'security_blocked_ips',
      'rate_limit_blocks',
    ]

    let deletedCount = 0
    for (const key of blockedIPKeys) {
      const config = await prisma.botConfiguration.findUnique({
        where: { key },
      })
      
      if (config) {
        await prisma.botConfiguration.delete({
          where: { key },
        })
        console.log(`  ✅ Удалена запись: ${key}`)
        deletedCount++
      }
    }

    if (deletedCount === 0) {
      console.log('  ℹ️  Записей о блокировках в БД не найдено')
    }

    console.log('')
    console.log('✅ Очистка БД завершена')
    console.log('')
    console.log('💡 ВАЖНО: Перезапустите приложение для очистки блокировок в памяти:')
    console.log('   pm2 restart luxon-admin')
    console.log('')

  } catch (error: any) {
    console.error('❌ Ошибка при очистке БД:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

unblockAllIPs()

