/**
 * Централизованная конфигурация доменов и URL для клиентского сайта
 * 
 * Для изменения доменов обновите переменные окружения:
 * - NEXT_PUBLIC_ADMIN_API_URL - URL админки API
 */

export const DOMAIN_CONFIG = {
  // URL админки API (для запросов к бэкенду)
  ADMIN_API_URL: process.env.NEXT_PUBLIC_ADMIN_API_URL || 
    (process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3001' 
      : 'https://pipiska.net'),
  
  // URL клиентского сайта (текущий домен)
  CLIENT_URL: typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_CLIENT_URL || 'https://lux-on.org',
} as const

/**
 * Получить базовый URL для API запросов
 */
export function getAdminApiUrl(): string {
  return DOMAIN_CONFIG.ADMIN_API_URL
}

/**
 * Получить URL клиентского сайта
 */
export function getClientUrl(): string {
  return DOMAIN_CONFIG.CLIENT_URL
}

