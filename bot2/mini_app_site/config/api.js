/**
 * API Configuration
 * Определяет URL для API в зависимости от окружения
 * Теперь использует админ-панель вместо Django
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const isServer = typeof window === 'undefined'

// URL для админ-панели API
const ADMIN_API_BASE_URL = isDevelopment 
  ? 'http://localhost:3001' 
  : 'https://xendro.pro'

export const API_URLS = {
  BASE: ADMIN_API_BASE_URL,
  REFERRAL_DATA: `${ADMIN_API_BASE_URL}/api/referral-data/`,
  TRANSACTION_HISTORY: `${ADMIN_API_BASE_URL}/api/transaction-history/`,
  REQUISITES_LIST: `${ADMIN_API_BASE_URL}/api/public/requisites/list/`,
  PAYMENT: `${ADMIN_API_BASE_URL}/api/payment`,
  PAYMENT_SETTINGS: `${ADMIN_API_BASE_URL}/api/public/payment-settings`,
}

export default API_URLS
