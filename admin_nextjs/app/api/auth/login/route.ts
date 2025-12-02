import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth'
import { createApiResponse } from '@/lib/api-helpers'
import { is2FAEnabled } from '@/lib/two-factor'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        createApiResponse(null, 'Username and password are required'),
        { status: 400 }
      )
    }

    // Проверяем пользователя (но не выдаем токен, если включена 2FA)
    const user = await prisma.adminUser.findUnique({
      where: { username },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid credentials'),
        { status: 401 }
      )
    }

    // Проверяем пароль
    const { verifyPassword } = await import('@/lib/auth')
    const isValidPassword = await verifyPassword(password, user.password)

    if (!isValidPassword) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid credentials'),
        { status: 401 }
      )
    }

    // Проверяем, включена ли 2FA (используем безопасный доступ к полю)
    const has2FA = (user as any).twoFactorEnabled === true

    if (has2FA) {
      // Если 2FA включена, возвращаем userId для следующего шага
      return NextResponse.json(
        createApiResponse({ 
          requires2FA: true,
          userId: user.id,
          message: '2FA verification required' 
        })
      )
    }

    // Если 2FA не включена, выдаем токен как обычно
    const result = await authenticateUser(username, password)

    if (!result) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid credentials'),
        { status: 401 }
      )
    }

    const response = NextResponse.json(
      createApiResponse({ user: result.user, message: 'Login successful' })
    )

    response.cookies.set('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Login failed'),
      { status: 500 }
    )
  }
}

