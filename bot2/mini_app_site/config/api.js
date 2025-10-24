/**
 * API Configuration
 * Определяет URL для API в зависимости от окружения
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const isServer = typeof window === 'undefined'

// URL для API
const API_BASE_URL = isDevelopment 
  ? 'http://localhost:8081' 
  : 'https://xendro.pro'

export const API_URLS = {
  BASE: API_BASE_URL,
  REFERRAL_DATA: `${API_BASE_URL}/api/referral-data/`,
  TRANSACTION_HISTORY: `${API_BASE_URL}/api/transaction-history/`,
  REQUISITES_LIST: `${API_BASE_URL}/api/requisites/list/`,
  PAYMENT: `${API_BASE_URL}/api/payment/`,
}

export default API_URLS
