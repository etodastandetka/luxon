import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { 
  protectAPI, 
  rateLimit, 
  getClientIP 
} from '@/lib/security'

// Публичный эндпоинт для получения настроек канала (без авторизации, для бота)
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
      keyGenerator: (req) => `channel_settings:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) {
      const response = NextResponse.json(
        createApiResponse(null, 'Rate limit exceeded'),
        { status: 429 }
      )
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    console.log('📡 [Channel Settings API] Получен запрос на настройки канала')
    
    // Получаем настройки канала из BotConfiguration
    const channelConfig = await prisma.botConfiguration.findUnique({
      where: { key: 'channel_subscription' }
    })

    console.log('📋 [Channel Settings API] Настройки из БД:', channelConfig ? 'найдены' : 'не найдены')

    if (!channelConfig) {
      console.log('ℹ️ [Channel Settings API] Настройки канала не найдены, возвращаю значения по умолчанию')
      return NextResponse.json(
        createApiResponse({
          enabled: false,
          username: '',
          channel_id: ''
        })
      )
    }

    let channelSettings: any = {}
    try {
      channelSettings = JSON.parse(channelConfig.value)
      console.log('✅ [Channel Settings API] Настройки распарсены:', channelSettings)
    } catch (parseError) {
      console.error('❌ [Channel Settings API] Ошибка парсинга настроек:', parseError)
      channelSettings = {
        enabled: false,
        username: '',
        channel_id: ''
      }
    }

    const result = {
      enabled: channelSettings.enabled || false,
      username: channelSettings.username || '',
      channel_id: channelSettings.channel_id || ''
    }
    
    console.log('📤 [Channel Settings API] Возвращаю настройки:', result)

    const response = NextResponse.json(
      createApiResponse(result)
    )
    
    // Добавляем CORS заголовки
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    return response
  } catch (error: any) {
    console.error('❌ [Channel Settings API] Ошибка:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch channel settings'),
      { status: 500 }
    )
  }
}

