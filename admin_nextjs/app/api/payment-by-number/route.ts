import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

// GET - получить настройки пополнения по номеру
export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const config = await prisma.botConfiguration.findUnique({
      where: { key: 'payment_by_number' }
    })

    let settings = {
      phoneNumber: '',
      recipientName: ''
    }

    if (config) {
      try {
        const parsed = typeof config.value === 'string' 
          ? JSON.parse(config.value) 
          : config.value
        settings = { ...settings, ...parsed }
      } catch {
        // Если не JSON, оставляем дефолтные значения
      }
    }

    return NextResponse.json(createApiResponse(settings))
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch payment by number settings'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

// POST - сохранить настройки пополнения по номеру
export async function POST(request: NextRequest) {
  try {
    requireAuth(request)

    const body = await request.json()
    const { phoneNumber, recipientName } = body

    if (!phoneNumber || !recipientName) {
      return NextResponse.json(
        createApiResponse(null, 'Phone number and recipient name are required'),
        { status: 400 }
      )
    }

    const settings = {
      phoneNumber: String(phoneNumber).trim(),
      recipientName: String(recipientName).trim()
    }

    await prisma.botConfiguration.upsert({
      where: { key: 'payment_by_number' },
      update: {
        value: JSON.stringify(settings),
        updatedAt: new Date()
      },
      create: {
        key: 'payment_by_number',
        value: JSON.stringify(settings),
        description: 'Настройки пополнения по номеру телефона'
      }
    })

    return NextResponse.json(createApiResponse(settings, 'Settings saved successfully'))
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to save settings'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

