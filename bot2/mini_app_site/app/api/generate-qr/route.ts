import { NextRequest, NextResponse } from 'next/server'

// В продакшене всегда используем локальный адрес админки (они на одном сервере)
const ADMIN_API_URL = process.env.ADMIN_API_URL || (process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:3001' : 'http://localhost:3001')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('🔄 Next.js API: Получен запрос на генерацию QR кода:', body)
    
    // Проксируем запрос к админ-панели API
    const response = await fetch(`${ADMIN_API_URL}/api/public/generate-qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Admin API error:', response.status, errorText)
      return NextResponse.json(
        { error: `Admin API error: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    console.log('✅ Next.js API: QR код сгенерирован успешно')
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('❌ Next.js API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
