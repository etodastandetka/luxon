/**
 * Централизованная конфигурация доменов и URL
 * 
 * Для изменения доменов обновите переменные окружения:
 * - MINI_APP_URL - URL клиентского сайта (мини-приложения)
 * - ADMIN_URL - URL админки (для внутреннего использования)
 * - NEXT_PUBLIC_API_URL - Публичный URL админки API
 */

export const DOMAIN_CONFIG = {
  // URL клиентского сайта (мини-приложения)
  MINI_APP_URL: process.env.MINI_APP_URL || 'https://lux-on.org',
  
  // URL админки (для внутренних вызовов)
  ADMIN_URL: process.env.ADMIN_URL || process.env.ADMIN_INTERNAL_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'http://127.0.0.1:3001' 
      : 'http://localhost:3001'),
  
  // Публичный URL админки (для внешних вызовов)
  ADMIN_PUBLIC_URL: process.env.NEXT_PUBLIC_API_URL || 
    process.env.ADMIN_PUBLIC_URL ||
    (process.env.NODE_ENV === 'production' 
      ? 'https://pipiska.net' 
      : 'http://localhost:3001'),
  
  // Внутренний URL для межсервисных вызовов
  INTERNAL_API_URL: process.env.INTERNAL_API_URL || 
    process.env.ADMIN_INTERNAL_URL ||
    (process.env.NODE_ENV === 'production' 
      ? 'http://127.0.0.1:3001' 
      : 'http://localhost:3001'),
} as const

/**
 * Получить URL мини-приложения
 */
export function getMiniAppUrl(): string {
  return DOMAIN_CONFIG.MINI_APP_URL
}

/**
 * Получить публичный URL админки
 */
export function getAdminPublicUrl(): string {
  return DOMAIN_CONFIG.ADMIN_PUBLIC_URL
}

/**
 * Получить внутренний URL админки (для межсервисных вызовов)
 */
export function getAdminInternalUrl(): string {
  return DOMAIN_CONFIG.INTERNAL_API_URL
}

