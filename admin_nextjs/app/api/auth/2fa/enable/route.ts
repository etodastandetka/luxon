import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-helpers'
import { createApiResponse } from '@/lib/api-helpers'
import { 
  verifyToken, 
  enable2FA,
  is2FAEnabled,
  getUserSecret 
} from '@/lib/two-factor'

/**
 * POST /api/auth/2fa/enable
 * Включает 2FA после проверки токена
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
    const { secret, token, backupCodes } = body

    if (!secret || !token || !backupCodes || !Array.isArray(backupCodes)) {
      return NextResponse.json(
        createApiResponse(null, 'Secret, token, and backup codes are required'),
        { status: 400 }
      )
    }

    // Проверяем, не включена ли уже 2FA
    const alreadyEnabled = await is2FAEnabled(authUser.userId)
    if (alreadyEnabled) {
      return NextResponse.json(
        createApiResponse(null, '2FA is already enabled'),
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

    // Включаем 2FA
    await enable2FA(authUser.userId, secret, backupCodes)

    return NextResponse.json(
      createApiResponse({ message: '2FA enabled successfully' })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to enable 2FA'),
      { status: 500 }
    )
  }
}

