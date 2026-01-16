import { NextRequest } from 'next/server'
import { getApiBase } from '@/config/api'
import { createSuccessResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

const ADMIN_API_URL = getApiBase()

const DEFAULT_SETTINGS = {
  deposits_enabled: true,
  withdrawals_enabled: true,
  enabled_deposit_banks: ['DemirBank', 'O!bank', 'Balance.kg', 'Bakai', 'MegaPay', 'MBank']
}

export async function GET(request: NextRequest) {
  try {
    // Proxy request to admin API
    const response = await fetch(`${ADMIN_API_URL}/api/public/payment-settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      logger.error('Admin API error', response.status)
      return createSuccessResponse(DEFAULT_SETTINGS)
    }
    
    // Check Content-Type before parsing JSON
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      logger.error('Admin API returned non-JSON response', contentType)
      return createSuccessResponse(DEFAULT_SETTINGS)
    }
    
    const data = await response.json()
    
    // If admin API returns standardized format, extract data
    if (data.success !== undefined && data.data) {
      return createSuccessResponse(data.data, data.message)
    }
    
    // Otherwise wrap in standardized format
    return createSuccessResponse(data)
    
  } catch (error: any) {
    logger.error('Bot settings API error', error)
    
    // Return default settings on error
    return createSuccessResponse(DEFAULT_SETTINGS)
  }
}

export const dynamic = 'force-dynamic'

