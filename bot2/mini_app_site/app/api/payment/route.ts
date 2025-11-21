import { NextRequest, NextResponse } from 'next/server'

const ADMIN_API_URL = process.env.ADMIN_API_URL || (process.env.NODE_ENV === 'production' ? 'https://xendro.pro' : 'http://localhost:3001')

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  const startTime = Date.now()
  
  console.log(`[${requestId}] 🚀 POST /api/payment вызван`, {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    timestamp: new Date().toISOString()
  })
  
  try {
    let body
    try {
      body = await request.json()
      console.log(`[${requestId}] ✅ Body успешно распарсен`)
    } catch (parseError: any) {
      console.error(`[${requestId}] ❌ Ошибка парсинга body:`, parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body', requestId },
        { status: 400 }
      )
    }
    
    console.log(`[${requestId}] 🔄 Next.js API: Получен запрос на создание заявки:`, {
      type: body.type,
      bookmaker: body.bookmaker,
      userId: body.userId || body.telegram_user_id,
      accountId: body.account_id || body.playerId,
      amount: body.amount,
      payment_method: body.payment_method,
      hasReceiptPhoto: !!body.receipt_photo,
      receiptPhotoSize: body.receipt_photo ? body.receipt_photo.length : 0,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      // Для error_log не требуются эти поля, поэтому undefined нормально
      ...(body.type !== 'error_log' && {
        fullBody: Object.keys(body).reduce((acc, key) => {
          // Не логируем большие поля как receipt_photo
          if (key === 'receipt_photo' || key === 'qr_photo') {
            acc[key] = body[key] ? `[base64, ${body[key].length} chars]` : undefined
          } else {
            acc[key] = body[key]
          }
          return acc
        }, {} as any)
      })
    })
    
    // Проксируем запрос к админ-панели API
    const adminApiUrl = `${ADMIN_API_URL}/api/payment`
    console.log(`[${requestId}] 📤 Отправка запроса к Admin API: ${adminApiUrl}`, {
      bodySize: JSON.stringify(body).length,
      bodyKeys: Object.keys(body),
      timestamp: new Date().toISOString()
    })
    
    let response: Response
    try {
      // Создаем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn(`[${requestId}] ⏱️ Таймаут запроса к Admin API`)
        controller.abort()
      }, 30000) // 30 секунд
      
      response = await fetch(adminApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      console.log(`[${requestId}] ✅ Получен response от Admin API`)
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        console.error(`[${requestId}] ❌ Таймаут запроса к Admin API`)
        return NextResponse.json(
          { 
            error: 'Request timeout',
            requestId,
            details: 'Сервер не ответил вовремя. Попробуйте позже.'
          },
          { status: 504 }
        )
      }
      console.error(`[${requestId}] ❌ Ошибка fetch к Admin API:`, {
        error: fetchError,
        message: fetchError?.message,
        name: fetchError?.name,
        stack: fetchError?.stack
      })
      return NextResponse.json(
        { 
          error: fetchError?.message || 'Failed to connect to admin API',
          requestId,
          details: 'Ошибка подключения к серверу. Попробуйте позже.'
        },
        { status: 503 }
      )
    }
    
    const responseTime = Date.now() - startTime
    console.log(`[${requestId}] 📥 Получен ответ от Admin API:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[${requestId}] ❌ Admin API error:`, {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 1000), // Первые 1000 символов
        errorTextLength: errorText.length,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      })
      
      let errorData
      try {
        errorData = JSON.parse(errorText)
        console.error(`[${requestId}] ❌ Распарсенные данные ошибки:`, errorData)
      } catch (parseError) {
        console.error(`[${requestId}] ❌ Ошибка парсинга JSON:`, parseError)
        errorData = { error: errorText || 'Unknown error' }
      }
      
      return NextResponse.json(
        { 
          error: errorData.error || errorData.message || `Admin API error: ${response.status}`,
          details: errorData,
          requestId: requestId
        },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    console.log(`[${requestId}] ✅ Next.js API: Заявка создана успешно:`, {
      success: data.success,
      id: data.data?.id,
      transactionId: data.data?.id,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    })
    
    // Для error_log просто возвращаем успех без id
    if (body.type === 'error_log') {
      return NextResponse.json({
        success: data.success,
        message: data.message || 'Error logged successfully'
      })
    }
    
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
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    console.error(`[${requestId}] ❌ КРИТИЧЕСКАЯ ОШИБКА Next.js API (POST):`, {
      error: error,
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorName: error?.name,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    })
    
    return NextResponse.json(
      { 
        error: error?.message || 'Internal server error',
        requestId: requestId,
        timestamp: new Date().toISOString()
      },
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
