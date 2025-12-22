import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  protectAPI, 
  rateLimit, 
  getClientIP 
} from '@/lib/security'

// Публичный эндпоинт для получения настроек пополнения по номеру (без авторизации)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    // 🛡️ МАКСИМАЛЬНАЯ ЗАЩИТА
    const protectionResult = protectAPI(request)
    if (protectionResult) return protectionResult

    // Rate limiting (строгий для публичного endpoint)
    const rateLimitResult = rateLimit({ 
      maxRequests: 30, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `payment_by_number:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) {
      const res = NextResponse.json({
        success: false,
        error: 'Rate limit exceeded'
      }, { status: 429 })
      res.headers.set('Access-Control-Allow-Origin', '*')
      return res
    }

    const config = await prisma.botConfiguration.findUnique({
      where: { key: 'payment_by_number' }
    })

    let settings = {
      phoneNumber: '',
      recipientName: ''
    }

    if (config) {
      try {
        const parsed = typeof config.value === 'string' 
          ? JSON.parse(config.value) 
          : config.value
        settings = { ...settings, ...parsed }
      } catch {
        // Если не JSON, оставляем дефолтные значения
      }
    }

    const response = NextResponse.json({
      success: true,
      ...settings
    })
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  } catch (error: any) {
    console.error('Payment by number API error:', error)
    const errorResponse = NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch payment by number settings' },
      { status: 500 }
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

export const dynamic = 'force-dynamic'

