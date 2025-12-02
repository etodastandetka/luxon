import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '../../../../lib/api-helpers'
import { createApiResponse } from '../../../../lib/api-helpers'
import { 
  saveAllowedCoordinates,
  getAllowedCoordinates,
  validateCoordinates 
} from '../../../../lib/geolocation'
import { 
  protectAPI, 
  rateLimit, 
  getClientIP 
} from '../../../../lib/security'

/**
 * GET /api/geolocation/settings
 * Получает настройки геолокации (только для админов)
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    
    if (!authUser) {
      return NextResponse.json(
        createApiResponse(null, 'Unauthorized'),
        { status: 401 }
      )
    }

    const coords = await getAllowedCoordinates()
    
    return NextResponse.json(
      createApiResponse({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius: coords.radius,
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to get geolocation settings'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/geolocation/settings
 * Сохраняет настройки геолокации (только для админов)
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    
    if (!authUser) {
      return NextResponse.json(
        createApiResponse(null, 'Unauthorized'),
        { status: 401 }
      )
    }

    // 🛡️ Защита API
    const protectionResult = protectAPI(request)
    if (protectionResult) return protectionResult

    // Rate limiting
    const rateLimitResult = rateLimit({ 
      maxRequests: 10, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `geolocation_settings:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) return rateLimitResult

    const body = await request.json()
    const { latitude, longitude, radius } = body

    // Валидация
    if (!latitude || !longitude || !radius) {
      return NextResponse.json(
        createApiResponse(null, 'Latitude, longitude, and radius are required'),
        { status: 400 }
      )
    }

    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)
    const rad = parseFloat(radius)

    if (!validateCoordinates(lat, lon)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid coordinates'),
        { status: 400 }
      )
    }

    if (isNaN(rad) || rad <= 0 || rad > 10000) {
      return NextResponse.json(
        createApiResponse(null, 'Radius must be between 1 and 10000 meters'),
        { status: 400 }
      )
    }

    // Сохраняем в БД
    await saveAllowedCoordinates(lat, lon, rad)

    return NextResponse.json(
      createApiResponse({
        message: 'Geolocation settings saved successfully',
        latitude: lat,
        longitude: lon,
        radius: rad,
      })
    )
  } catch (error: any) {
    console.error('Geolocation settings save error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to save geolocation settings'),
      { status: 500 }
    )
  }
}

