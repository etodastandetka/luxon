/**
 * Crypto Pay API integration
 * Documentation: https://help.crypt.bot/crypto-pay-api
 */

import { createHash, createHmac } from 'crypto'

const CRYPTO_PAY_API_TOKEN = process.env.CRYPTO_PAY_API_TOKEN || '483674:AADGGvOSSrOaWDtd2baJuAN2ePJDVpnYief'
const CRYPTO_PAY_API_URL = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api'

interface CreateInvoiceParams {
  asset?: string // 'USDT', 'TON', 'BTC', 'ETH', etc.
  amount: string // Amount in float, e.g. '125.50'
  currency_type?: 'crypto' | 'fiat' // Defaults to 'crypto'
  fiat?: string // Fiat currency code if currency_type is 'fiat'
  description?: string // Up to 1024 characters
  hidden_message?: string // Up to 2048 characters
  paid_btn_name?: 'viewItem' | 'openChannel' | 'openBot' | 'callback'
  paid_btn_url?: string // URL for the button
  payload?: string // Any data to attach (up to 4kb)
  expires_in?: number // Payment time limit in seconds (1-2678400)
}

interface Invoice {
  invoice_id: number
  hash: string
  currency_type: string
  asset?: string
  fiat?: string
  amount: string
  paid_asset?: string
  paid_amount?: string
  bot_invoice_url: string
  mini_app_invoice_url: string
  web_app_invoice_url: string
  description?: string
  status: 'active' | 'paid' | 'expired'
  created_at: string
  paid_at?: string
  payload?: string
}

interface CryptoPayResponse<T> {
  ok: boolean
  result?: T
  error?: {
    code: string
    name: string
  }
}

/**
 * Create a new invoice in Crypto Pay
 */
export async function createInvoice(params: CreateInvoiceParams): Promise<Invoice | null> {
  try {
    const url = `${CRYPTO_PAY_API_URL}/createInvoice`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN
      },
      body: JSON.stringify(params)
    })

    const data: CryptoPayResponse<Invoice> = await response.json()

    if (data.ok && data.result) {
      return data.result
    } else {
      console.error('Crypto Pay API error:', data.error)
      return null
    }
  } catch (error) {
    console.error('Error creating Crypto Pay invoice:', error)
    return null
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoice(invoiceId: number): Promise<Invoice | null> {
  try {
    const url = `${CRYPTO_PAY_API_URL}/getInvoices?invoice_ids=${invoiceId}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN
      }
    })

    const data: CryptoPayResponse<Invoice[]> = await response.json()

    if (data.ok && data.result && data.result.length > 0) {
      return data.result[0]
    } else {
      console.error('Crypto Pay API error:', data.error)
      return null
    }
  } catch (error) {
    console.error('Error getting Crypto Pay invoice:', error)
    return null
  }
}

/**
 * Get app balance
 */
export interface Balance {
  currency_code: string
  available: string
  onhold: string
}

export async function getBalance(): Promise<Balance[]> {
  try {
    const url = `${CRYPTO_PAY_API_URL}/getBalance`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN
      }
    })

    const data: CryptoPayResponse<Balance[]> = await response.json()

    if (data.ok && data.result) {
      return data.result
    } else {
      console.error('Crypto Pay API error:', data.error)
      return []
    }
  } catch (error) {
    console.error('Error getting Crypto Pay balance:', error)
    return []
  }
}

/**
 * Get exchange rates
 */
export interface ExchangeRate {
  is_valid: boolean
  is_crypto: boolean
  is_fiat: boolean
  source: string
  target: string
  rate: string
}

export async function getExchangeRates(): Promise<ExchangeRate[]> {
  try {
    const url = `${CRYPTO_PAY_API_URL}/getExchangeRates`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN
      }
    })

    const data: CryptoPayResponse<ExchangeRate[]> = await response.json()

    if (data.ok && data.result) {
      return data.result
    } else {
      console.error('Crypto Pay API error:', data.error)
      return []
    }
  } catch (error) {
    console.error('Error getting exchange rates:', error)
    return []
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(token: string, body: any, signature: string): boolean {
  try {
    const secret = createHash('sha256').update(token).digest()
    const checkString = JSON.stringify(body)
    const hmac = createHmac('sha256', secret).update(checkString).digest('hex')
    return hmac === signature
  } catch (error) {
    console.error('Error verifying webhook signature:', error)
    return false
  }
}

