import { NextRequest } from 'next/server'
import { getApiBase } from '@/config/api'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

const ADMIN_API_URL = getApiBase()

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  const startTime = Date.now()
  
  logger.debug(`[${requestId}] POST /api/payment called`, {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    timestamp: new Date().toISOString()
  })
  
  try {
    let body
    try {
      body = await request.json()
      logger.debug(`[${requestId}] Body parsed successfully`)
    } catch (parseError: any) {
      logger.error(`[${requestId}] Failed to parse body`, parseError)
      return createErrorResponse(
        'Invalid JSON in request body',
        400,
        { requestId }
      )
    }
    
    body = { ...body, is_vip: true }

    logger.debug(`[${requestId}] Payment request received`, {
      type: body.type,
      bookmaker: body.bookmaker,
      userId: body.userId || body.telegram_user_id,
      accountId: body.account_id || body.playerId,
      amount: body.amount,
      payment_method: body.payment_method,
      hasReceiptPhoto: !!body.receipt_photo,
      receiptPhotoSize: body.receipt_photo ? body.receipt_photo.length : 0,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      // Для error_log не требуются эти поля, поэтому undefined нормально
      ...(body.type !== 'error_log' && {
        fullBody: Object.keys(body).reduce((acc, key) => {
          // Не логируем большие поля как receipt_photo
          if (key === 'receipt_photo' || key === 'qr_photo') {
            acc[key] = body[key] ? `[base64, ${body[key].length} chars]` : undefined
          } else {
            acc[key] = body[key]
          }
          return acc
        }, {} as any)
      })
    })
    
    // Proxy request to admin API
    const adminApiUrl = `${ADMIN_API_URL}/api/payment`
    logger.debug(`[${requestId}] Sending request to Admin API`, {
      bodySize: JSON.stringify(body).length,
      bodyKeys: Object.keys(body),
      timestamp: new Date().toISOString()
    })
    
    let response: Response
    try {
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        logger.warn(`[${requestId}] Request timeout to Admin API`)
        controller.abort()
      }, 30000) // 30 seconds
      
      response = await fetch(adminApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      logger.debug(`[${requestId}] Response received from Admin API`)
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        logger.error(`[${requestId}] Request timeout to Admin API`)
        return createErrorResponse(
          'Request timeout',
          504,
          { 
            requestId,
            details: 'Сервер не ответил вовремя. Попробуйте позже.'
          }
        )
      }
      logger.error(`[${requestId}] Fetch error to Admin API`, {
        error: fetchError,
        message: fetchError?.message,
        name: fetchError?.name,
        stack: fetchError?.stack
      })
      return createErrorResponse(
        fetchError?.message || 'Failed to connect to admin API',
        503,
        {
          requestId,
          details: 'Ошибка подключения к серверу. Попробуйте позже.'
        }
      )
    }
    
    const responseTime = Date.now() - startTime
    logger.debug(`[${requestId}] Response from Admin API`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[${requestId}] Admin API error`, {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 1000), // Первые 1000 символов
        errorTextLength: errorText.length,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      })
      
      let errorData
      try {
        errorData = JSON.parse(errorText)
        logger.debug(`[${requestId}] Parsed error data`, errorData)
      } catch (parseError) {
        logger.error(`[${requestId}] Failed to parse JSON error`, parseError)
        errorData = { error: errorText || 'Unknown error' }
      }
      
      return createErrorResponse(
        errorData.error || errorData.message || `Admin API error: ${response.status}`,
        response.status,
        { ...errorData, requestId }
      )
    }
    
    const data = await response.json()
    logger.debug(`[${requestId}] Payment request created successfully`, {
      success: data.success,
      id: data.data?.id,
      transactionId: data.data?.id,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    })
    
    // For error_log, just return success without id
    if (body.type === 'error_log') {
      return createSuccessResponse(null, data.message || 'Error logged successfully')
    }
    
    // Transform response to format expected by client
    // Maintain backward compatibility with transactionId/id fields
    if (data.data && data.data.id) {
      const responseData = {
        ...data.data,
        transactionId: data.data.id,
        id: data.data.id
      }
      return createSuccessResponse(
        responseData,
        data.data.message || data.message || 'Заявка успешно создана'
      )
    }
    
    // If admin API returns standardized format, pass it through
    if (data.success !== undefined) {
      return createSuccessResponse(data.data || data, data.message)
    }
    
    // Otherwise wrap in standardized format
    return createSuccessResponse(data)
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    logger.error(`[${requestId}] Critical error in Payment API (POST)`, {
      error: error,
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorName: error?.name,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    })
    
    return createErrorResponse(
      error?.message || 'Internal server error',
      500,
      {
        requestId,
        timestamp: new Date().toISOString()
      }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Proxy request to admin API
    const response = await fetch(`${ADMIN_API_URL}/api/payment`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Admin API error:', response.status, errorText)
      
      let errorData: any
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || `Admin API error: ${response.status}` }
      }
      
      logger.error('Admin API error', response.status, errorText)
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
    logger.error('Payment API PUT error', error)
    return createErrorResponse(
      error?.message || 'Internal server error',
      500
    )
  }
}
