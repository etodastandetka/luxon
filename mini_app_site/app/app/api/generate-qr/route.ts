import { NextRequest } from 'next/server'
import { getApiBase } from '@/config/api'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

const ADMIN_API_URL = getApiBase()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Proxy request to admin API
    const response = await fetch(`${ADMIN_API_URL}/api/public/generate-qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Admin API error', response.status, errorText)
      
      let errorData: any
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || `Admin API error: ${response.status}` }
      }
      
      return createErrorResponse(
        errorData.error || errorData.message || `Admin API error: ${response.status}`,
        response.status,
        errorData
      )
    }
    
    const data = await response.json()
    
    // If admin API returns standardized format, pass it through
    if (data.success !== undefined) {
      return createSuccessResponse(data.data || data, data.message)
    }
    
    // Otherwise wrap in standardized format
    return createSuccessResponse(data)
    
  } catch (error: any) {
    logger.error('Generate QR API error', error)
    return createErrorResponse(
      error?.message || 'Internal server error',
      500
    )
  }
}
