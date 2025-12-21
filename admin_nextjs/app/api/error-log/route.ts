import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramErrorNotification } from '@/lib/telegram-error-logger'

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      message,
      stack,
      context,
      url,
      userAgent,
      severity = 'error'
    } = body

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    // Отправляем ошибку в Telegram администратору
    await sendTelegramErrorNotification({
      message: String(message),
      stack: stack ? String(stack) : undefined,
      context: context ? String(context) : undefined,
      url: url ? String(url) : undefined,
      userAgent: userAgent ? String(userAgent) : undefined,
      severity: severity as 'error' | 'warning' | 'critical',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json(
      { success: true },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error: any) {
    console.error('Error processing error log:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process error log' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}

export const dynamic = 'force-dynamic'

