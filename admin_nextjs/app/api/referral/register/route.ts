import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { 
  protectAPI, 
  rateLimit, 
  sanitizeInput, 
  containsSQLInjection,
  containsXSS,
  getClientIP 
} from '../../../../lib/security'

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    // 🛡️ МАКСИМАЛЬНАЯ ЗАЩИТА
    const protectionResult = protectAPI(request)
    if (protectionResult) return protectionResult

    // Rate limiting (строгий для публичного endpoint)
    const rateLimitResult = rateLimit({ 
      maxRequests: 10, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `referral_register:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) {
      const response = NextResponse.json({
        success: false,
        error: 'Rate limit exceeded'
      }, { status: 429 })
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    const body = await request.json()
    
    // 🛡️ Валидация и очистка всех входных данных
    const sanitizedBody = sanitizeInput(body)
    
    let referrerId = sanitizedBody.referrer_id || sanitizedBody.referrerId
    let referredId = sanitizedBody.referred_id || sanitizedBody.referredId
    let username = sanitizedBody.username || null
    let firstName = sanitizedBody.first_name || sanitizedBody.firstName || null
    let lastName = sanitizedBody.last_name || sanitizedBody.lastName || null

    // 🛡️ Проверка на SQL инъекции и XSS во всех строковых полях
    const stringFields = [referrerId, referredId, username, firstName, lastName].filter(Boolean)
    for (const field of stringFields) {
      if (typeof field === 'string') {
        if (containsSQLInjection(field) || containsXSS(field)) {
          console.warn(`🚫 Security threat from ${getClientIP(request)}`)
          const errorResponse = NextResponse.json({
            success: false,
            error: 'Invalid input detected'
          }, { status: 400 })
          errorResponse.headers.set('Access-Control-Allow-Origin', '*')
          return errorResponse
        }
      }
    }

    // Валидация формата ID (должны быть числами)
    if (referrerId && !/^\d+$/.test(String(referrerId))) {
      const errorResponse = NextResponse.json({
        success: false,
        error: 'Invalid referrer ID format'
      }, { status: 400 })
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }

    if (referredId && !/^\d+$/.test(String(referredId))) {
      const errorResponse = NextResponse.json({
        success: false,
        error: 'Invalid referred ID format'
      }, { status: 400 })
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }

    // Ограничение длины строковых полей
    if (username && username.length > 100) {
      const errorResponse = NextResponse.json({
        success: false,
        error: 'Username too long'
      }, { status: 400 })
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }

    if (firstName && firstName.length > 100) {
      const errorResponse = NextResponse.json({
        success: false,
        error: 'First name too long'
      }, { status: 400 })
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }

    if (lastName && lastName.length > 100) {
      const errorResponse = NextResponse.json({
        success: false,
        error: 'Last name too long'
      }, { status: 400 })
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }
    
    if (!referrerId || !referredId) {
      const errorResponse = NextResponse.json({
        success: false,
        error: 'Referrer ID and Referred ID are required'
      }, { status: 400 })
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }
    
    const referrerIdBigInt = BigInt(referrerId)
    const referredIdBigInt = BigInt(referredId)
    
    // Нельзя быть рефералом самого себя
    if (referrerIdBigInt === referredIdBigInt) {
      const errorResponse = NextResponse.json({
        success: false,
        error: 'Cannot refer yourself'
      }, { status: 400 })
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }
    
    // Проверяем, существует ли уже реферальная связь
    const existingReferral = await prisma.botReferral.findUnique({
      where: {
        referredId: referredIdBigInt
      }
    })
    
    if (existingReferral) {
      // Если уже есть реферал, но от другого рефера, возвращаем ошибку
      if (existingReferral.referrerId.toString() !== referrerId) {
        const errorResponse = NextResponse.json({
          success: false,
          error: 'User already referred by another user'
        }, { status: 400 })
        errorResponse.headers.set('Access-Control-Allow-Origin', '*')
        return errorResponse
      }
      // Если уже привязан к этому же рефералу, возвращаем успех
      const successResponse = NextResponse.json({
        success: true,
        message: 'Referral already exists',
        referral_id: existingReferral.id
      })
      successResponse.headers.set('Access-Control-Allow-Origin', '*')
      return successResponse
    }
    
    // Проверяем, существует ли рефер (тот, кто приглашает)
    let referrer = await prisma.botUser.findUnique({
      where: { userId: referrerIdBigInt }
    })
    
    // Если рефера нет в БД, создаем его
    if (!referrer) {
      referrer = await prisma.botUser.create({
        data: {
          userId: referrerIdBigInt,
          username: null,
          firstName: null,
          lastName: null,
          language: 'ru'
        }
      })
    }
    
    // Проверяем, существует ли реферал (тот, кого приглашают)
    let referred = await prisma.botUser.findUnique({
      where: { userId: referredIdBigInt }
    })
    
    // Если реферала нет в БД, создаем его
    if (!referred) {
      referred = await prisma.botUser.create({
        data: {
          userId: referredIdBigInt,
          username: username,
          firstName: firstName,
          lastName: lastName,
          language: 'ru'
        }
      })
    } else {
      // Обновляем данные пользователя, если они есть
      if (username || firstName || lastName) {
        await prisma.botUser.update({
          where: { userId: referredIdBigInt },
          data: {
            username: username || referred.username,
            firstName: firstName || referred.firstName,
            lastName: lastName || referred.lastName
          }
        })
      }
    }
    
    // Создаем реферальную связь
    const referral = await prisma.botReferral.create({
      data: {
        referrerId: referrerIdBigInt,
        referredId: referredIdBigInt
      }
    })
    
    const response = NextResponse.json({
      success: true,
      message: 'Referral registered successfully',
      referral_id: referral.id
    })
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
    
  } catch (error: any) {
    console.error('Referral register error:', error)
    const errorResponse = NextResponse.json({
      success: false,
      error: error.message || 'Failed to register referral'
    }, { status: 500 })
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

export const dynamic = 'force-dynamic'

