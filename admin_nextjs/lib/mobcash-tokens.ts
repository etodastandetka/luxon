/**
 * Утилита для чтения токенов MobCash из файла, созданного Python скриптом
 */

import { readFileSync } from 'fs'
import { join } from 'path'

interface MobCashTokens {
  bearer_token: string
  user_id: string
  session_id: string
  updated_at: string
  expires_at: number
}

const TOKENS_FILE = join(process.cwd(), '.mobcash_tokens.json')

/**
 * Чтение токенов из файла
 */
export function readMobCashTokens(): MobCashTokens | null {
  try {
    const fileContent = readFileSync(TOKENS_FILE, 'utf-8')
    const tokens = JSON.parse(fileContent) as MobCashTokens
    
    // Проверяем, не истекли ли токены
    const now = Date.now() / 1000 // timestamp в секундах
    if (tokens.expires_at && tokens.expires_at < now) {
      console.warn('[MobCash Tokens] ⚠️ Токены истекли, требуется обновление')
      return null
    }
    
    return tokens
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('[MobCash Tokens] ⚠️ Файл с токенами не найден:', TOKENS_FILE)
      console.warn('[MobCash Tokens] Запустите: python3 scripts/update_mobcash_tokens.py')
    } else {
      console.error('[MobCash Tokens] ❌ Ошибка чтения токенов:', error.message)
    }
    return null
  }
}

/**
 * Получение конфигурации MobCash с токенами из файла или переменных окружения
 */
export function getMobCashConfigFromTokens() {
  // Сначала пробуем прочитать из файла (созданного Python скриптом)
  const tokens = readMobCashTokens()
  
  if (tokens) {
    console.log('[MobCash Config] ✅ Используются токены из файла')
    return {
      bearer_token: tokens.bearer_token,
      user_id: tokens.user_id,
      session_id: tokens.session_id,
    }
  }
  
  // Если файла нет или токены истекли, используем переменные окружения
  console.log('[MobCash Config] ⚠️ Используются токены из переменных окружения')
  return {
    bearer_token: process.env.MOBCASH_BEARER_TOKEN,
    user_id: process.env.MOBCASH_USER_ID,
    session_id: process.env.MOBCASH_SESSION_ID,
  }
}

