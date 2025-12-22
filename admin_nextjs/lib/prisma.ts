import { PrismaClient } from '@prisma/client'
// Импортируем планировщик для автоматического запуска при старте приложения
import './shift-scheduler'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

