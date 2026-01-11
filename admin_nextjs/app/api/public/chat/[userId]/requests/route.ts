import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import { 
  protectAPI, 
  rateLimit, 
  sanitizeInput, 
  containsSQLInjection,
  getClientIP 
} from '@/lib/security'

// Публичный эндпоинт для получения списка заявок пользователя (для клиентского сайта)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  try {
    // 🛡️ ЗАЩИТА
    const protectionResult = protectAPI(request)
    if (protectionResult) return protectionResult

    // Обработка Next.js 15+ где params может быть Promise
    const resolvedParams = params instanceof Promise ? await params : params

    // Rate limiting
    const rateLimitResult = rateLimit({ 
      maxRequests: 30, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `chat_requests:${resolvedParams.userId}:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) return rateLimitResult

    let userId = resolvedParams.userId

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

    let userIdBigInt: bigint
    try {
      userIdBigInt = BigInt(userId)
    } catch (e) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID'),
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const requestType = searchParams.get('type') // deposit или withdraw

    // Получаем заявки пользователя
    const where: any = { userId: userIdBigInt }
    if (requestType) {
      where.requestType = requestType
    }

    const requests = await prisma.request.findMany({
      where,
      select: {
        id: true,
        requestType: true,
        status: true,
        amount: true,
        bookmaker: true,
        accountId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50), // Максимум 50 заявок
    })

    return NextResponse.json(
      createApiResponse({
        requests: requests.map(req => ({
          id: req.id,
          requestType: req.requestType,
          status: req.status,
          amount: req.amount?.toString() || null,
          bookmaker: req.bookmaker,
          accountId: req.accountId,
          createdAt: req.createdAt.toISOString(),
          updatedAt: req.updatedAt.toISOString(),
        })),
      })
    )
  } catch (error: any) {
    console.error('Chat requests API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch requests'),
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

