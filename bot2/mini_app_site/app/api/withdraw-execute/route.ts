import { NextRequest, NextResponse } from 'next/server'

const ADMIN_API_URL =
  process.env.ADMIN_API_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://xendro.pro' : 'http://localhost:3001')

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2)

  console.log(`[${requestId}] 🚀 POST /api/withdraw-execute вызван`, {
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
  })

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch (error) {
    console.error(`[${requestId}] ❌ Не удалось распарсить JSON тела запроса`, error)
    return NextResponse.json({ error: 'Invalid JSON body', requestId }, { status: 400 })
  }

  const adminUrl = `${ADMIN_API_URL}/api/withdraw-execute`
  console.log(`[${requestId}] 📤 Проксируем запрос к Admin API: ${adminUrl}`, {
    body,
    timestamp: new Date().toISOString(),
  })

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseText = await response.text()
    if (!response.ok) {
      console.error(`[${requestId}] ❌ Admin API error (${response.status}):`, responseText)

      let errorData: any = null
      try {
        errorData = JSON.parse(responseText)
      } catch (_) {
        errorData = { error: responseText || `Admin API error: ${response.status}` }
      }

      return NextResponse.json(
        {
          error: errorData.error || errorData.message || `Admin API error: ${response.status}`,
          details: errorData,
          requestId,
        },
        { status: response.status },
      )
    }

    let data: any = null
    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch (parseError) {
      console.error(`[${requestId}] ❌ Ошибка парсинга JSON ответа`, parseError)
      return NextResponse.json(
        {
          error: 'Invalid JSON response from admin API',
          requestId,
        },
        { status: 502 },
      )
    }

    console.log(`[${requestId}] ✅ Ответ от admin API получен`, data)
    return NextResponse.json(data)
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.error(`[${requestId}] ❌ Таймаут запроса к admin API`)
      return NextResponse.json(
        {
          error: 'Request timeout',
          requestId,
        },
        { status: 504 },
      )
    }

    console.error(`[${requestId}] ❌ Ошибка при обращении к admin API`, error)
    return NextResponse.json(
      {
        error: error?.message || 'Failed to reach admin API',
        requestId,
      },
      { status: 502 },
    )
  }
}


