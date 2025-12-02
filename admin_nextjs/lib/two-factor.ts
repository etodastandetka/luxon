import { authenticator, totp } from 'otplib'
import QRCode from 'qrcode'
import { prisma } from './prisma'
import crypto from 'crypto'

// Настройка TOTP
authenticator.options = {
  step: 30, // 30 секунд
  window: 1, // Разрешаем отклонение в 1 период
}

/**
 * Генерирует секретный ключ для 2FA
 */
export function generateSecret(): string {
  return authenticator.generateSecret()
}

/**
 * Генерирует QR код для настройки 2FA
 */
export async function generateQRCode(secret: string, username: string, issuer: string = 'Luxon Admin'): Promise<string> {
  const otpauth = authenticator.keyuri(username, issuer, secret)
  return QRCode.toDataURL(otpauth)
}

/**
 * Генерирует TOTP токен из секрета
 */
export function generateToken(secret: string): string {
  return authenticator.generate(secret)
}

/**
 * Проверяет TOTP токен
 */
export function verifyToken(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret })
  } catch (error) {
    return false
  }
}

/**
 * Генерирует резервные коды для восстановления доступа
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    // Генерируем 8-значный код
    const code = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 8)
    codes.push(code)
  }
  return codes
}

/**
 * Проверяет резервный код
 */
export async function verifyBackupCode(userId: number, code: string): Promise<boolean> {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
  })

  if (!user || !(user as any).twoFactorBackupCodes) {
    return false
  }

  try {
    const backupCodes: string[] = JSON.parse((user as any).twoFactorBackupCodes as string)
    const index = backupCodes.indexOf(code.toUpperCase())

    if (index === -1) {
      return false
    }

    // Удаляем использованный код
    backupCodes.splice(index, 1)
    await prisma.adminUser.update({
      where: { id: userId },
      data: {
        twoFactorBackupCodes: JSON.stringify(backupCodes),
      } as any,
    })

    return true
  } catch {
    return false
  }
}

/**
 * Включает 2FA для пользователя
 */
export async function enable2FA(userId: number, secret: string, backupCodes: string[]): Promise<void> {
  await prisma.adminUser.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: JSON.stringify(backupCodes),
    } as any,
  })
}

/**
 * Отключает 2FA для пользователя
 */
export async function disable2FA(userId: number): Promise<void> {
  await prisma.adminUser.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    } as any,
  })
}

/**
 * Проверяет, включена ли 2FA для пользователя
 */
export async function is2FAEnabled(userId: number): Promise<boolean> {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
  })

  return (user as any)?.twoFactorEnabled || false
}

/**
 * Получает секрет пользователя
 */
export async function getUserSecret(userId: number): Promise<string | null> {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
  })

  return (user as any)?.twoFactorSecret || null
}

