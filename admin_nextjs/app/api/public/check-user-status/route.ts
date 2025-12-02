import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { createApiResponse } from '../../../../lib/api-helpers'
import { 
  protectAPI, 
  rateLimit, 
  sanitizeInput, 
  containsSQLInjection,
  getClientIP 
} from '../../../../lib/security'

// Публичный эндпоинт для проверки статуса пользователя (для клиентского сайта)
export async function GET(request: NextRequest) {
  try {
    // 🛡️ МАКСИМАЛЬНАЯ ЗАЩИТА
    const protectionResult = protectAPI(request)
    if (protectionResult) return protectionResult

    // Rate limiting (строгий для публичного endpoint)
    const rateLimitResult = rateLimit({ 
      maxRequests: 20, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `check_user:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) return rateLimitResult

    const { searchParams } = new URL(request.url)
    let userId = searchParams.get('user_id')

    // 🛡️ Валидация и очистка входных данных
    if (!userId) {
      return NextResponse.json(
        createApiResponse(null, 'User ID is required'),
        { status: 400 }
      )
    }

    // Проверка на SQL инъекции
    if (containsSQLInjection(userId)) {
      console.warn(`🚫 SQL injection attempt from ${getClientIP(request)}: ${userId}`)
      return NextResponse.json(
        createApiResponse(null, 'Invalid input'),
        { status: 400 }
      )
    }

    // Очистка и валидация
    userId = sanitizeInput(userId) as string

    // Проверка формата (должен быть числом)
    if (!/^\d+$/.test(userId)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID format'),
        { status: 400 }
      )
    }

    // Ограничение длины
    if (userId.length > 20) {
      return NextResponse.json(
        createApiResponse(null, 'User ID too long'),
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        createApiResponse(null, 'User ID is required'),
        { status: 400 }
      )
    }

    let userIdBigInt: bigint
    try {
      userIdBigInt = BigInt(userId)
    } catch (e) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID'),
        { status: 400 }
      )
    }

    const user = await prisma.botUser.findUnique({
      where: { userId: userIdBigInt },
      select: {
        isActive: true,
      },
    })

    // Если пользователь не найден, считаем его активным (по умолчанию)
    const isActive = user?.isActive !== false

    return NextResponse.json(
      createApiResponse({
        isActive,
        isBlocked: !isActive,
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to check user status'),
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

