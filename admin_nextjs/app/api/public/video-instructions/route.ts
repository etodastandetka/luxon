import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    // Получаем настройки видео из BotConfiguration
    const configs = await prisma.botConfiguration.findMany({
      where: {
        key: {
          in: ['deposit_video_url', 'withdraw_video_url']
        }
      }
    })

    const settingsMap: Record<string, string> = {}
    configs.forEach((config) => {
      settingsMap[config.key] = config.value
    })

    const videoSettings = {
      deposit_video_url: settingsMap.deposit_video_url || '',
      withdraw_video_url: settingsMap.withdraw_video_url || '',
    }

    return NextResponse.json(
      createApiResponse(videoSettings),
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  } catch (error: any) {
    console.error('Failed to fetch video instructions:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch video instructions'),
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  }
}

