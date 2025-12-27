/**
 * Unified API Configuration
 * Centralized configuration for all API endpoints
 * Uses environment variables for flexibility
 */

/**
 * Get the base URL for the admin API
 * Priority:
 * 1. NEXT_PUBLIC_ADMIN_API_URL (for client-side)
 * 2. ADMIN_API_URL (for server-side)
 * 3. Environment-based defaults
 */
function getAdminApiBaseUrl(): string {
  // Client-side: use NEXT_PUBLIC_ prefix
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_ADMIN_API_URL || 
           (process.env.NODE_ENV === 'development' 
             ? 'http://localhost:3001' 
             : 'https://japar.click')
  }
  
  // Server-side: can use non-public env vars
  return process.env.ADMIN_API_URL || 
         (process.env.NODE_ENV === 'production' 
           ? 'http://127.0.0.1:3001'  // Internal server communication
           : 'http://localhost:3001')
}

const ADMIN_API_BASE_URL = getAdminApiBaseUrl()

/**
 * API endpoint URLs
 */
export const API_URLS = {
  BASE: ADMIN_API_BASE_URL,
  REFERRAL_DATA: `${ADMIN_API_BASE_URL}/api/referral-data/`,
  TRANSACTION_HISTORY: `${ADMIN_API_BASE_URL}/api/transaction-history/`,
  REQUISITES_LIST: `${ADMIN_API_BASE_URL}/api/public/requisites/list/`,
  PAYMENT: `${ADMIN_API_BASE_URL}/api/payment`,
  PAYMENT_SETTINGS: `${ADMIN_API_BASE_URL}/api/public/payment-settings`,
  LEADERBOARD: `${ADMIN_API_BASE_URL}/api/public/leaderboard`,
  USER_REFERRALS: `${ADMIN_API_BASE_URL}/api/public/user-referrals`,
} as const

/**
 * Get the base API URL
 * @returns Base URL for API requests
 */
export function getApiBase(): string {
  return ADMIN_API_BASE_URL
}

export default API_URLS

