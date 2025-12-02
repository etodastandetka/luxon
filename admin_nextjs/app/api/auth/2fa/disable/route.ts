import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-helpers'
import { createApiResponse } from '@/lib/api-helpers'
import { 
  verifyToken, 
  disable2FA,
  getUserSecret 
} from '@/lib/two-factor'

/**
 * POST /api/auth/2fa/disable
 * Отключает 2FA (требует подтверждение токеном)
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

    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        createApiResponse(null, '2FA token is required'),
        { status: 400 }
      )
    }

    // Получаем секрет
    const secret = await getUserSecret(authUser.userId)
    if (!secret) {
      return NextResponse.json(
        createApiResponse(null, '2FA is not enabled'),
        { status: 400 }
      )
    }

    // Проверяем токен
    const isValid = verifyToken(secret, token)
    if (!isValid) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid 2FA token'),
        { status: 400 }
      )
    }

    // Отключаем 2FA
    await disable2FA(authUser.userId)

    return NextResponse.json(
      createApiResponse({ message: '2FA disabled successfully' })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to disable 2FA'),
      { status: 500 }
    )
  }
}

