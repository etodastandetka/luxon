import { NextRequest, NextResponse } from 'next/server'
import { API_URLS } from '../../config/api'
import { logger } from '../../lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Proxy request to admin API to avoid CORS issues
    const response = await fetch(`${API_URLS.REQUISITES_LIST}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Requisites API error', response.status, errorText)
      
      let errorData: any
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || `Requisites API error: ${response.status}` }
      }
      
      const errorResponse = NextResponse.json(
        { 
          success: false, 
          error: errorData.error || errorData.message || `Requisites API error: ${response.status}` 
        },
        { status: response.status }
      )
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }
    
    const data = await response.json()
    
    // Return data in the format expected by client
    const successResponse = NextResponse.json(data)
    successResponse.headers.set('Access-Control-Allow-Origin', '*')
    return successResponse
    
  } catch (error: any) {
    logger.error('Requisites proxy API error', error)
    const errorResponse = NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Internal server error' 
      },
      { status: 500 }
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

export const dynamic = 'force-dynamic'

