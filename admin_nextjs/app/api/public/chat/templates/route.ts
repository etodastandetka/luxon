import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import { 
  protectAPI, 
  rateLimit, 
  getClientIP 
} from '@/lib/security'

// Публичный эндпоинт для получения шаблонов (для клиентского сайта)
export async function GET(request: NextRequest) {
  try {
    // 🛡️ ЗАЩИТА
    const protectionResult = protectAPI(request)
    if (protectionResult) return protectionResult

    // Rate limiting
    const rateLimitResult = rateLimit({ 
      maxRequests: 30, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `chat_templates:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) return rateLimitResult

    const templates = await prisma.chatMessageTemplate.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        text: true,
      },
    })

    return NextResponse.json(
      createApiResponse(templates)
    )
  } catch (error: any) {
    console.error('Get templates API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch templates'),
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

