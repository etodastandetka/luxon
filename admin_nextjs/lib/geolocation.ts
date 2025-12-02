/**
 * 🗺️ Геолокационная защита
 * Проверяет, находится ли пользователь в разрешенной зоне
 */

import { prisma } from './prisma'

// Координаты разрешенной зоны (по умолчанию - Бишкек)
// Могут быть переопределены из БД или .env
let ALLOWED_LATITUDE = parseFloat(process.env.ALLOWED_LATITUDE || '42.84877')
let ALLOWED_LONGITUDE = parseFloat(process.env.ALLOWED_LONGITUDE || '74.57028')
let ALLOWED_RADIUS_METERS = parseFloat(process.env.ALLOWED_RADIUS_METERS || '10') // 10 метров

// Кэш для координат из БД
let coordinatesCache: {
  latitude: number
  longitude: number
  radius: number
  timestamp: number
} | null = null

const CACHE_TTL = 5 * 60 * 1000 // 5 минут

/**
 * Вычисляет расстояние между двумя точками на Земле (формула гаверсинуса)
 * @param lat1 Широта первой точки
 * @param lon1 Долгота первой точки
 * @param lat2 Широта второй точки
 * @param lon2 Долгота второй точки
 * @returns Расстояние в метрах
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Радиус Земли в метрах
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Проверяет, находится ли пользователь в разрешенной зоне
 * @param latitude Широта пользователя
 * @param longitude Долгота пользователя
 * @returns true если в зоне, false если нет
 */
export async function isInAllowedZone(latitude: number, longitude: number): Promise<boolean> {
  const coords = await getAllowedCoordinates()
  const distance = calculateDistance(
    coords.latitude,
    coords.longitude,
    latitude,
    longitude
  )

  return distance <= coords.radius
}

/**
 * Получает разрешенные координаты из переменных окружения или БД
 */
export async function getAllowedCoordinates(): Promise<{
  latitude: number
  longitude: number
  radius: number
}> {
  // Проверяем кэш
  if (coordinatesCache && Date.now() - coordinatesCache.timestamp < CACHE_TTL) {
    return {
      latitude: coordinatesCache.latitude,
      longitude: coordinatesCache.longitude,
      radius: coordinatesCache.radius,
    }
  }

  try {
    // Пытаемся получить из БД
    const config = await prisma.botConfiguration.findUnique({
      where: { key: 'geolocation_allowed_zone' },
    })

    if (config) {
      try {
        const data = JSON.parse(config.value)
        if (data.latitude && data.longitude && data.radius) {
          ALLOWED_LATITUDE = parseFloat(data.latitude)
          ALLOWED_LONGITUDE = parseFloat(data.longitude)
          ALLOWED_RADIUS_METERS = parseFloat(data.radius)
          
          // Обновляем кэш
          coordinatesCache = {
            latitude: ALLOWED_LATITUDE,
            longitude: ALLOWED_LONGITUDE,
            radius: ALLOWED_RADIUS_METERS,
            timestamp: Date.now(),
          }
        }
      } catch (e) {
        // Если не JSON, используем значения по умолчанию
      }
    }
  } catch (error) {
    // Если ошибка БД, используем значения по умолчанию
    console.warn('Failed to load geolocation from DB, using defaults:', error)
  }

  return {
    latitude: ALLOWED_LATITUDE,
    longitude: ALLOWED_LONGITUDE,
    radius: ALLOWED_RADIUS_METERS,
  }
}

/**
 * Сохраняет координаты в БД
 */
export async function saveAllowedCoordinates(
  latitude: number,
  longitude: number,
  radius: number
): Promise<void> {
  const data = {
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    radius: radius.toString(),
  }

  await prisma.botConfiguration.upsert({
    where: { key: 'geolocation_allowed_zone' },
    update: {
      value: JSON.stringify(data),
      description: 'Разрешенная зона для геолокации (широта, долгота, радиус в метрах)',
    },
    create: {
      key: 'geolocation_allowed_zone',
      value: JSON.stringify(data),
      description: 'Разрешенная зона для геолокации (широта, долгота, радиус в метрах)',
    },
  })

  // Обновляем кэш
  ALLOWED_LATITUDE = latitude
  ALLOWED_LONGITUDE = longitude
  ALLOWED_RADIUS_METERS = radius
  coordinatesCache = {
    latitude,
    longitude,
    radius,
    timestamp: Date.now(),
  }
}

/**
 * Валидирует координаты
 */
export function validateCoordinates(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

