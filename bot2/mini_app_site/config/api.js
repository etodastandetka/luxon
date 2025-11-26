/**
 * API Configuration
 * Определяет URL для API в зависимости от окружения
 * 
 * На клиенте используем относительные URL (запросы идут через Next.js прокси)
 * На сервере используем локальный адрес админки
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const isServer = typeof window === 'undefined'

// На клиенте - пустая строка (запросы идут на тот же домен через прокси)
// На сервере - локальный адрес админки
const getApiBase = () => {
  if (isServer) {
    // SSR: используем локальный адрес админки
    return isDevelopment ? 'http://localhost:3001' : 'http://127.0.0.1:3001'
  }
  // Клиент: пустая строка = запросы на тот же домен (luxservice.online)
  return ''
}

const ADMIN_API_BASE_URL = getApiBase()

export const API_URLS = {
  BASE: ADMIN_API_BASE_URL,
  REFERRAL_DATA: `${ADMIN_API_BASE_URL}/api/referral-data/`,
  TRANSACTION_HISTORY: `${ADMIN_API_BASE_URL}/api/transaction-history/`,
  REQUISITES_LIST: `${ADMIN_API_BASE_URL}/api/public/requisites/list/`,
  PAYMENT: `${ADMIN_API_BASE_URL}/api/payment`,
  PAYMENT_SETTINGS: `${ADMIN_API_BASE_URL}/api/public/payment-settings`,
}

export default API_URLS
