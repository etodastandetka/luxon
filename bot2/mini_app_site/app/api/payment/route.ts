import { NextRequest, NextResponse } from 'next/server'

const DJANGO_API_URL = process.env.DJANGO_API_URL || 'http://localhost:8081'
const DJANGO_API_TOKEN = process.env.DJANGO_API_TOKEN || '222ef40eaf1486b2588e1214c1ddc112d7296b90'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Payment API received data:', body)
    const { type, amount, user_id, bookmaker, bank, phone, site_code, qr_photo, request_id } = body
    
    // Валидация данных
    if (!type || !amount || !user_id || !bookmaker) {
      console.log('Missing required fields:', { type, amount, user_id, bookmaker })
      return NextResponse.json({ 
        error: 'Missing required fields', 
        details: { type, amount, user_id, bookmaker } 
      }, { status: 400 })
    }
    
    // Преобразуем типы данных
    const parsedUserId = typeof user_id === 'string' ? parseInt(user_id) : user_id
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    
    // Проверяем корректность преобразования
    if (isNaN(parsedUserId) || isNaN(parsedAmount)) {
      console.log('Invalid number format:', { user_id, amount })
      return NextResponse.json({ 
        error: 'Invalid number format', 
        details: { user_id, amount } 
      }, { status: 400 })
    }
    
    // Отправляем данные в Django API через унифицированный API
    const djangoResponse = await fetch(`${DJANGO_API_URL}/bot/api/requests/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: parsedUserId,
        request_type: type,
        amount: parsedAmount,
        bookmaker: bookmaker,
        bank: bank || null,
        phone: phone || null,
        site_code: site_code || null,
        qr_photo: qr_photo || null,
        request_id: request_id || null,
        status: 'pending'
      })
    })
    
    if (!djangoResponse.ok) {
      const errorData = await djangoResponse.json()
      return NextResponse.json({ 
        error: 'Django API error', 
        details: errorData 
      }, { status: djangoResponse.status })
    }
    
    const transactionData = await djangoResponse.json()
    
    // Отправляем уведомление в Telegram через Django
    await sendTelegramNotification(`
🆕 Новая заявка на ${type === 'deposit' ? 'пополнение' : 'вывод'}
🆔 ID: ${transactionData.id}
👤 Пользователь: ${user_id}
🎯 Букмекер: ${bookmaker}
💰 Сумма: ${amount} сом
🏦 Банк: ${bank || 'Не указан'}
${phone ? `📱 Телефон: +${phone}` : ''}
${site_code ? `🔑 Код: ${site_code}` : ''}
${request_id ? `🆔 ID заявки: ${request_id}` : ''}
    `)
    
    return NextResponse.json({
      success: true,
      transactionId: transactionData.id,
      message: 'Транзакция создана успешно'
    })
    
  } catch (error) {
    console.error('Payment API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, reason } = body
    
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // Обновляем статус в Django API через унифицированный API
    const djangoResponse = await fetch(`${DJANGO_API_URL}/bot/api/requests/${id}/status/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: status,
        source: 'mini_app',
        user_id: id,
        amount: 0
      })
    })
    
    if (!djangoResponse.ok) {
      const errorData = await djangoResponse.json()
      return NextResponse.json({ 
        error: 'Django API error', 
        details: errorData 
      }, { status: djangoResponse.status })
    }
    
    const transactionData = await djangoResponse.json()
    
    // Отправляем уведомление о смене статуса
    await sendTelegramNotification(`
🔄 Статус заявки изменен
🆔 ID: ${id}
📊 Статус: ${status === 'completed' ? '✅ Завершено' : status}
    `)
    
    return NextResponse.json({
      success: true,
      transactionId: transactionData.id,
      status: transactionData.status,
      message: 'Статус обновлен успешно'
    })
    
  } catch (error) {
    console.error('Update transaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('id')
    
    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 })
    }
    
    // Получаем данные из Django API через унифицированный API
    const djangoResponse = await fetch(`${DJANGO_API_URL}/bot/api/requests/${transactionId}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    if (!djangoResponse.ok) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }
    
    const transaction = await djangoResponse.json()
    return NextResponse.json(transaction)
    
  } catch (error) {
    console.error('Get transaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function sendTelegramNotification(message: string) {
  try {
    const botToken = process.env.BOT_TOKEN
    const adminChatId = process.env.ADMIN_CHAT_ID
    
    if (!botToken || !adminChatId) {
      console.log('Telegram notification skipped: missing credentials')
      return
    }
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: message,
        parse_mode: 'HTML'
      })
    })
    
    if (!response.ok) {
      console.error('Failed to send Telegram notification:', await response.text())
    }
  } catch (error) {
    console.error('Telegram notification error:', error)
  }
}