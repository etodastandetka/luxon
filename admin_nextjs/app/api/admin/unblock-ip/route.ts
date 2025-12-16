import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { unblockIP, isIPBlocked, getClientIP } from '@/lib/security'
import { createApiResponse } from '@/lib/api-helpers'

// API endpoint для разблокировки IP (только для админов)
export async function POST(request: NextRequest) {
  try {
    requireAuth(request)
    
    const body = await request.json()
    const { ip } = body
    
    if (!ip) {
      return NextResponse.json(
        createApiResponse(null, 'IP address is required'),
        { status: 400 }
      )
    }
    
    // Проверяем, заблокирован ли IP
    const wasBlocked = isIPBlocked(ip)
    
    // Разблокируем IP
    unblockIP(ip)
    
    return NextResponse.json(
      createApiResponse({
        ip,
        wasBlocked,
        unblocked: true,
        message: wasBlocked ? `IP ${ip} разблокирован` : `IP ${ip} не был заблокирован`
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to unblock IP'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

// Получить список заблокированных IP
export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    
    // Получаем IP из запроса (для проверки конкретного IP)
    const { searchParams } = new URL(request.url)
    const ip = searchParams.get('ip')
    
    if (ip) {
      const blocked = isIPBlocked(ip)
      return NextResponse.json(
        createApiResponse({
          ip,
          blocked
        })
      )
    }
    
    // Если IP не указан, возвращаем информацию о текущем IP
    const currentIP = getClientIP(request)
    const blocked = isIPBlocked(currentIP)
    
    return NextResponse.json(
      createApiResponse({
        currentIP,
        blocked,
        message: blocked ? `Ваш IP ${currentIP} заблокирован` : `Ваш IP ${currentIP} не заблокирован`
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to check IP status'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

