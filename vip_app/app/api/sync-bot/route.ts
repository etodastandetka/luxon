import { NextRequest } from 'next/server'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Log sync data (for internal tracking)
    logger.debug('Sync data logged', {
      user: body.user?.id || body.user?.username || 'unknown',
      action: body.action || 'unknown',
      data: body.data || {}
    })
    
    return createSuccessResponse(null, 'Sync data received')
    
  } catch (error: any) {
    logger.error('Sync API error', error)
    return createErrorResponse(
      error?.message || 'Internal server error',
      500
    )
  }
}
