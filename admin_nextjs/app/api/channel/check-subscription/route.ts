import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, channelId } = body

    if (!userId || !channelId) {
      return NextResponse.json(
        createApiResponse(null, 'Missing userId or channelId'),
        { status: 400 }
      )
    }

    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      return NextResponse.json(
        createApiResponse(null, 'BOT_TOKEN not configured'),
        { status: 500 }
      )
    }

    // Проверяем подписку пользователя на канал через Telegram API
    const checkUrl = `https://api.telegram.org/bot${botToken}/getChatMember`
    const response = await fetch(checkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: channelId,
        user_id: parseInt(userId.toString()),
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      return NextResponse.json(
        createApiResponse(null, data.description || 'Failed to check subscription'),
        { status: 500 }
      )
    }

    const member = data.result
    const isSubscribed = 
      member.status === 'member' || 
      member.status === 'administrator' || 
      member.status === 'creator'

    return NextResponse.json(
      createApiResponse({
        subscribed: isSubscribed,
        status: member.status,
      })
    )
  } catch (error: any) {
    console.error('Error checking channel subscription:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to check subscription'),
      { status: 500 }
    )
  }
}

