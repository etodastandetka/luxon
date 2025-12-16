import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('🔄 Next.js API: Получен запрос на синхронизацию с ботом:', body)
    
    // Логируем данные синхронизации (Django API больше не используется)
    // Просто возвращаем успех, чтобы клиент не получал ошибку
    console.log('✅ Sync data logged:', {
      user: body.user?.id || body.user?.username || 'unknown',
      action: body.action || 'unknown',
      data: body.data || {}
    })
    
    return NextResponse.json({
      success: true,
      message: 'Sync data received'
    })
    
  } catch (error) {
    console.error('❌ Next.js API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
