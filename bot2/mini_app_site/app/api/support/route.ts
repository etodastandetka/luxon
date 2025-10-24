import { NextRequest, NextResponse } from 'next/server'

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '12345' // Замените на реальный ID админа
const BOT_TOKEN = process.env.BOT_TOKEN || 'your_bot_token' // Замените на реальный токен бота

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, user_id, timestamp } = body
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    
    // Формируем сообщение для админа
    const adminMessage = `
🆘 Новое сообщение в поддержку

👤 Пользователь: ${user_id}
📅 Время: ${new Date(timestamp).toLocaleString('ru-RU')}
💬 Сообщение: ${message}
    `.trim()
    
    // Отправляем сообщение в Telegram админу
    const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: adminMessage,
        parse_mode: 'HTML'
      })
    })
    
    if (!telegramResponse.ok) {
      console.error('Failed to send Telegram message:', await telegramResponse.text())
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Сообщение отправлено в поддержку' 
    })
    
  } catch (error) {
    console.error('Support API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}





