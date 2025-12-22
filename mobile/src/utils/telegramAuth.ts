import { sha256 } from 'js-sha256'
import { TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_DOMAIN } from '../config/env'

type TelegramInitData = Record<string, string>

const BOT_TOKEN = TELEGRAM_BOT_TOKEN

// Валидируем initData Telegram WebApp по документации
export function validateTelegramInitData(initData: string): { ok: boolean; data?: TelegramInitData; error?: string } {
  if (!initData) return { ok: false, error: 'initData пустой' }
  if (!BOT_TOKEN) return { ok: false, error: 'Нет бот токена' }

  const params = new URLSearchParams(initData)
  const data: TelegramInitData = {}
  params.forEach((value, key) => {
    data[key] = value
  })

  const hash = data.hash
  if (!hash) return { ok: false, error: 'Нет hash' }

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n')

  const secretKey = sha256.hmac.create('WebAppData', BOT_TOKEN).hex()
  const calcHash = sha256.hmac(secretKey, dataCheckString)

  if (calcHash !== hash) {
    return { ok: false, error: 'Хэш не совпал' }
  }

  return { ok: true, data }
}

export function parseUser(initData: TelegramInitData | undefined) {
  if (!initData) return null
  try {
    const rawUser = initData.user || initData.userdata
    if (!rawUser) return null
    const user = JSON.parse(rawUser)
    return {
      id: String(user.id),
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'User',
      username: user.username,
      photo_url: user.photo_url,
      is_premium: user.is_premium,
    }
  } catch (e) {
    return null
  }
}

export function validateDomain(origin?: string) {
  if (!origin || !TELEGRAM_BOT_DOMAIN) return true
  try {
    const url = new URL(origin.startsWith('http') ? origin : `https://${origin}`)
    return url.hostname.endsWith(TELEGRAM_BOT_DOMAIN)
  } catch {
    return false
  }
}











