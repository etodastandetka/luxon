import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/api-helpers'
import { 
  isInAllowedZone, 
  validateCoordinates,
  getAllowedCoordinates,
  calculateDistance 
} from '@/lib/geolocation'
import { 
  protectAPI, 
  rateLimit, 
  getClientIP 
} from '@/lib/security'
import { sendTelegramGroupMessage } from '@/lib/telegram-group'

/**
 * POST /api/geolocation/verify
 * Проверяет, находится ли пользователь в разрешенной зоне
 */
export async function POST(request: NextRequest) {
  try {
    // 🛡️ Защита API
    const protectionResult = protectAPI(request)
    if (protectionResult) return protectionResult

    // Rate limiting
    const rateLimitResult = rateLimit({ 
      maxRequests: 10, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `geolocation:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) return rateLimitResult

    const body = await request.json()
    const { latitude, longitude } = body

    // Валидация входных данных
    if (!latitude || !longitude) {
      return NextResponse.json(
        createApiResponse(null, 'Latitude and longitude are required'),
        { status: 400 }
      )
    }

    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)

    if (!validateCoordinates(lat, lon)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid coordinates'),
        { status: 400 }
      )
    }

    // Проверяем, находится ли пользователь в разрешенной зоне
    const coords = await getAllowedCoordinates()
    const distance = calculateDistance(coords.latitude, coords.longitude, lat, lon)
    const inZone = distance <= coords.radius
    
    const ip = getClientIP(request)
    
    // Детальное логирование для отладки
    console.log(`🔍 Геолокация проверка:`)
    console.log(`   Пользователь: ${lat.toFixed(6)}, ${lon.toFixed(6)}`)
    console.log(`   Разрешенная зона: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`)
    console.log(`   Радиус: ${coords.radius}м`)
    console.log(`   Расстояние: ${distance.toFixed(2)}м`)
    console.log(`   В зоне: ${inZone ? '✅' : '❌'}`)
    console.log(`   IP: ${ip}`)

    if (!inZone) {
      console.warn(`🚫 Geolocation denied: ${lat.toFixed(6)}, ${lon.toFixed(6)} from ${ip} (distance: ${distance.toFixed(2)}m, required: ${coords.radius}m)`)

      // Отправляем уведомление в Telegram группу
      const userAgent = request.headers.get('user-agent') || 'Unknown'
      const referer = request.headers.get('referer') || 'Direct'
      
      const alertMessage = `🚫 <b>Попытка доступа вне разрешенной зоны</b>\n\n` +
        `📍 <b>Координаты пользователя:</b>\n` +
        `   Широта: ${lat.toFixed(6)}\n` +
        `   Долгота: ${lon.toFixed(6)}\n\n` +
        `📍 <b>Разрешенная зона:</b>\n` +
        `   Широта: ${coords.latitude.toFixed(6)}\n` +
        `   Долгота: ${coords.longitude.toFixed(6)}\n` +
        `   Радиус: ${coords.radius} метров\n\n` +
        `📏 <b>Расстояние:</b> ${distance.toFixed(2)} метров (вне зоны, нужно быть в пределах ${coords.radius}м)\n\n` +
        `🌐 <b>IP адрес:</b> ${ip}\n` +
        `🔍 <b>User-Agent:</b> ${userAgent.substring(0, 100)}\n` +
        `🔗 <b>Referer:</b> ${referer.substring(0, 100)}\n\n` +
        `⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek' })}`

      // Отправляем в группу асинхронно (не блокируем ответ)
      sendTelegramGroupMessage(alertMessage).catch(err => {
        console.error('Failed to send geolocation alert to group:', err)
      })

      // Показываем пользователю детальную информацию
      const userMessage = `Сайт недоступен в вашем регионе. Вы находитесь на расстоянии ${distance.toFixed(0)}м от разрешенной зоны (требуется быть в пределах ${coords.radius}м).`
      
      return NextResponse.json(
        createApiResponse({
          distance: distance.toFixed(2),
          requiredRadius: coords.radius,
          userCoords: { lat, lon },
          allowedCoords: { lat: coords.latitude, lon: coords.longitude }
        }, userMessage),
        { status: 403 }
      )
    }

    console.log(`✅ Geolocation approved: ${lat}, ${lon} from ${getClientIP(request)}`)

    const response = NextResponse.json(
      createApiResponse({
        success: true,
        message: 'Location verified',
        distance: 'within allowed zone',
      })
    )

    // Устанавливаем cookie что геолокация проверена
    response.cookies.set('geolocation_verified', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 часа
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('Geolocation verify error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to verify location'),
      { status: 500 }
    )
  }
}

/**
 * GET /api/geolocation/verify
 * Получает разрешенные координаты (только для админов)
 */
export async function GET(request: NextRequest) {
  try {
    const { getAuthUser } = await import('@/lib/api-helpers')
    const authUser = getAuthUser(request)
    
    // Только для авторизованных пользователей
    if (!authUser) {
      return NextResponse.json(
        createApiResponse(null, 'Unauthorized'),
        { status: 401 }
      )
    }

    const coords = await getAllowedCoordinates()
    
    // Возвращаем координаты только для админов
    return NextResponse.json(
      createApiResponse({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius: coords.radius,
        message: 'Allowed zone configured',
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to get coordinates'),
      { status: 500 }
    )
  }
}

