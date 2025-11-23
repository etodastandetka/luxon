import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Получаем настройки канала из BotConfiguration
    const channelConfig = await prisma.botConfiguration.findUnique({
      where: { key: 'channel_subscription' }
    })

    if (!channelConfig) {
      return NextResponse.json(
        createApiResponse({
          enabled: false,
          username: '',
          channel_id: ''
        })
      )
    }

    let channelSettings: any = {}
    try {
      channelSettings = JSON.parse(channelConfig.value)
    } catch {
      channelSettings = {
        enabled: false,
        username: '',
        channel_id: ''
      }
    }

    return NextResponse.json(
      createApiResponse({
        enabled: channelSettings.enabled || false,
        username: channelSettings.username || '',
        channel_id: channelSettings.channel_id || ''
      })
    )
  } catch (error: any) {
    console.error('Error fetching channel settings:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch channel settings'),
      { status: 500 }
    )
  }
}

