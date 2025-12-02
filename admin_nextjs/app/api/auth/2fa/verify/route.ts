import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/api-helpers'
import { 
  verifyToken, 
  verifyBackupCode,
  getUserSecret,
  is2FAEnabled 
} from '@/lib/two-factor'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/auth'

/**
 * POST /api/auth/2fa/verify
 * Проверяет 2FA токен при логине
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, token, useBackupCode } = body

    if (!userId || !token) {
      return NextResponse.json(
        createApiResponse(null, 'User ID and token are required'),
        { status: 400 }
      )
    }

    const userIdNum = parseInt(userId, 10)
    if (isNaN(userIdNum)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID'),
        { status: 400 }
      )
    }

    // Проверяем, включена ли 2FA
    const enabled = await is2FAEnabled(userIdNum)
    if (!enabled) {
      return NextResponse.json(
        createApiResponse(null, '2FA is not enabled for this user'),
        { status: 400 }
      )
    }

    // Получаем секрет
    const secret = await getUserSecret(userIdNum)
    if (!secret) {
      return NextResponse.json(
        createApiResponse(null, '2FA secret not found'),
        { status: 400 }
      )
    }

    let isValid = false

    // Проверяем либо TOTP токен, либо резервный код
    if (useBackupCode) {
      isValid = await verifyBackupCode(userIdNum, token)
    } else {
      isValid = verifyToken(secret, token)
    }

    if (!isValid) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid 2FA token'),
        { status: 401 }
      )
    }

    // Получаем пользователя
    const user = await prisma.adminUser.findUnique({
      where: { id: userIdNum },
      select: {
        id: true,
        username: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        createApiResponse(null, 'User not found or inactive'),
        { status: 401 }
      )
    }

    // Генерируем JWT токен
    const jwtToken = generateToken({
      userId: user.id,
      username: user.username,
      isSuperAdmin: user.isSuperAdmin,
    })

    const response = NextResponse.json(
      createApiResponse({ 
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isSuperAdmin: user.isSuperAdmin,
        },
        message: '2FA verified successfully' 
      })
    )

    // Устанавливаем cookie с правильными параметрами
    // secure: true только если явно указано в .env или если HTTPS
    const isSecure = process.env.COOKIE_SECURE === 'true' || 
                     (process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:')
    
    response.cookies.set('auth_token', jwtToken, {
      httpOnly: true,
      secure: isSecure, // Только для HTTPS или если явно указано
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/', // Важно: cookie должен быть доступен на всех путях
    })
    
    console.log(`✅ Cookie set: secure=${isSecure}, protocol=${request.nextUrl.protocol}, token=${jwtToken.substring(0, 20)}...`)

    console.log(`✅ 2FA verified for user ${user.id} (${user.username}), token set in cookie. Token preview: ${jwtToken.substring(0, 20)}...`)

    return response
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to verify 2FA'),
      { status: 500 }
    )
  }
}

