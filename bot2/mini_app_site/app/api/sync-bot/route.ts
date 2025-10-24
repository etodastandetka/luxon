import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user, action, data, initData } = body

    // Валидация данных
    if (!user || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Отправляем данные в Django бэкенд
    const djangoResponse = await fetch(`${process.env.DJANGO_API_URL || 'http://localhost:8000'}/bot_control/api_sync_webapp/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegram_user_id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        language_code: user.language_code,
        action,
        data,
        init_data: initData,
        timestamp: new Date().toISOString()
      })
    })

    if (!djangoResponse.ok) {
      throw new Error('Failed to sync with Django backend')
    }

    const result = await djangoResponse.json()

    return NextResponse.json({
      success: true,
      message: 'Data synced successfully',
      result
    })

  } catch (error) {
    console.error('Error in sync-bot API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}





