import { NextRequest } from 'next/server'
import { getApiBase } from '@/config/api'
import { createSuccessResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

const ADMIN_API_URL = getApiBase()

const DEFAULT_VIDEOS = {
  deposit_video_url: 'https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view',
  withdraw_video_url: 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view',
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Next.js API: Получен запрос на загрузку видео инструкций')
    
    // During build time, return default values
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return createSuccessResponse(DEFAULT_VIDEOS)
    }
    
    // Proxy request to admin API
    const response = await fetch(`${ADMIN_API_URL}/api/public/video-instructions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      logger.error('Admin API error', response.status)
      return createSuccessResponse(DEFAULT_VIDEOS)
    }
    
    // Check Content-Type before parsing JSON
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      logger.error('Admin API returned non-JSON response', contentType)
      return createSuccessResponse(DEFAULT_VIDEOS)
    }
    
    const data = await response.json()
    
    // If admin API returns standardized format, extract data
    if (data.success !== undefined && data.data) {
      return createSuccessResponse(data.data, data.message)
    }
    
    // Otherwise wrap in standardized format
    return createSuccessResponse(data)
    
  } catch (error: any) {
    logger.error('Video instructions API error', error)
    
    // Return default videos on any error
    return createSuccessResponse(DEFAULT_VIDEOS)
  }
}

