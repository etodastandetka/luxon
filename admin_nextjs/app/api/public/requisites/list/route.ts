import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  protectAPI, 
  rateLimit, 
  getClientIP 
} from '@/lib/security'

// Публичный эндпоинт для получения списка реквизитов (без авторизации)
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
      keyGenerator: (req) => `requisites:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) {
      const res = NextResponse.json({
        success: false,
        error: 'Rate limit exceeded'
      }, { status: 429 })
      res.headers.set('Access-Control-Allow-Origin', '*')
      return res
    }
    const requisites = await prisma.botRequisite.findMany({
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    // Находим активный реквизит
    const activeRequisite = requisites.find(r => r.isActive)
    const activeId = activeRequisite?.id || null

    // Формируем ответ в формате, который ожидает клиентский сайт
    const response = {
      success: true,
      requisites: requisites.map(r => ({
        id: r.id,
        value: r.value,
        name: r.name,
        bank: r.bank,
        is_active: r.isActive,
        created_at: r.createdAt.toISOString(),
      })),
      active_id: activeId,
    }

    const res = NextResponse.json(response)
    res.headers.set('Access-Control-Allow-Origin', '*')
    return res
  } catch (error: any) {
    console.error('Requisites list API error:', error)
    const errorResponse = NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch requisites' },
      { status: 500 }
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

export const dynamic = 'force-dynamic'

