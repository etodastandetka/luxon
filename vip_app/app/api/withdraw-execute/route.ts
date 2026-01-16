import { NextRequest } from 'next/server'
import { getApiBase } from '@/config/api'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

const ADMIN_API_URL = getApiBase()

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2)

  logger.debug(`[${requestId}] POST /api/withdraw-execute called`, {
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
  })

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch (error) {
    logger.error(`[${requestId}] Failed to parse JSON body`, error)
    return createErrorResponse('Invalid JSON body', 400, { requestId })
  }

  body = { ...body, is_vip: true }

  const adminUrl = `${ADMIN_API_URL}/api/withdraw-execute`
  logger.debug(`[${requestId}] Proxying request to Admin API`, {
    body,
    timestamp: new Date().toISOString(),
  })

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseText = await response.text()
    if (!response.ok) {
      logger.error(`[${requestId}] Admin API error (${response.status})`, responseText)

      let errorData: any = null
      try {
        errorData = JSON.parse(responseText)
      } catch (_) {
        errorData = { error: responseText || `Admin API error: ${response.status}` }
      }

      return createErrorResponse(
        errorData.error || errorData.message || `Admin API error: ${response.status}`,
        response.status,
        { ...errorData, requestId }
      )
    }

    let data: any = null
    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch (parseError) {
      logger.error(`[${requestId}] Failed to parse JSON response`, parseError)
      return createErrorResponse(
        'Invalid JSON response from admin API',
        502,
        { requestId }
      )
    }

    logger.debug(`[${requestId}] Response received from admin API`, data)
    
    // If admin API returns standardized format, pass it through
    if (data.success !== undefined) {
      return createSuccessResponse(data.data || data, data.message)
    }
    
    // Otherwise wrap in standardized format
    return createSuccessResponse(data)
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      logger.error(`[${requestId}] Request timeout to admin API`)
      return createErrorResponse(
        'Request timeout',
        504,
        { requestId }
      )
    }

    logger.error(`[${requestId}] Error calling admin API`, error)
    return createErrorResponse(
      error?.message || 'Failed to reach admin API',
      502,
      { requestId }
    )
  }
}


