import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Скрипт для создания админов
 * 
 * Использование:
 *   npx tsx scripts/create-admin.ts <username> <password> [email]
 * 
 * Примеры:
 *   npx tsx scripts/create-admin.ts admin1 password123 admin1@luxon.com
 *   npx tsx scripts/create-admin.ts admin2 password456
 */
async function createAdmin() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.log('📝 Использование:')
    console.log('   npx tsx scripts/create-admin.ts <username> <password> [email]')
    console.log('')
    console.log('Примеры:')
    console.log('   npx tsx scripts/create-admin.ts admin1 password123 admin1@luxon.com')
    console.log('   npx tsx scripts/create-admin.ts admin2 password456')
    process.exit(1)
  }

  const username = args[0]
  const password = args[1]
  const email = args[2] || undefined

  if (!username || !password) {
    console.error('❌ Username и password обязательны!')
    process.exit(1)
  }

  if (password.length < 6) {
    console.error('❌ Пароль должен быть не менее 6 символов!')
    process.exit(1)
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const admin = await prisma.adminUser.upsert({
      where: { username },
      update: {
        password: hashedPassword,
        email: email || undefined,
      },
      create: {
        username,
        password: hashedPassword,
        email: email || undefined,
        isActive: true,
        isSuperAdmin: true,
      },
    })

    console.log('✅ Админ успешно создан/обновлен!')
    console.log(`   Username: ${admin.username}`)
    if (admin.email) {
      console.log(`   Email: ${admin.email}`)
    }
    console.log(`   Password: ${password}`)
    console.log(`   ID: ${admin.id}`)
  } catch (error: any) {
    console.error('❌ Ошибка при создании админа:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()

