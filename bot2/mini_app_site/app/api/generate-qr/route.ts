import { NextRequest, NextResponse } from 'next/server'

const DJANGO_API_URL = process.env.DJANGO_API_URL || 'http://127.0.0.1:8081'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('🔄 Next.js API: Получен запрос на генерацию QR кода:', body)
    
    // Проксируем запрос к Django API
    const response = await fetch(`${DJANGO_API_URL}/bot/api/generate-qr/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Django API error:', response.status, errorText)
      return NextResponse.json(
        { error: `Django API error: ${response.status} - ${errorText}` },
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
