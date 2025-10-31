import { NextRequest, NextResponse } from 'next/server'

const ADMIN_API_URL = process.env.ADMIN_API_URL || (process.env.NODE_ENV === 'production' ? 'https://xendro.pro' : 'http://localhost:3001')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('🔄 Next.js API: Получен запрос на создание заявки:', body)
    
    // Проксируем запрос к админ-панели API
    const response = await fetch(`${ADMIN_API_URL}/api/payment`, {
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
    console.log('✅ Next.js API: Заявка создана успешно:', data)
    
    // Преобразуем ответ в формат, который ожидает клиентский сайт
    if (data.data && data.data.id) {
      return NextResponse.json({
        success: true,
        transactionId: data.data.id,
        id: data.data.id,
        message: data.data.message || 'Заявка успешно создана'
      })
    }
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('❌ Next.js API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('🔄 Next.js API: Получен запрос на обновление заявки:', body)
    
    // Проксируем запрос к админ-панели API
    const response = await fetch(`${ADMIN_API_URL}/api/payment`, {
      method: 'PUT',
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
    console.log('✅ Next.js API: Заявка обновлена успешно:', data)
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('❌ Next.js API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
