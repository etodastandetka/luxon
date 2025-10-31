import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

// Публичный эндпоинт для получения настроек платежей (без авторизации)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    // Получаем настройки из BotConfiguration
    const configs = await prisma.botConfiguration.findMany()
    const settingsMap: Record<string, any> = {}
    
    configs.forEach((config) => {
      let value: any = config.value
      // Пытаемся распарсить JSON, если это строка
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value)
        } catch {
          // Если не JSON, оставляем как строку
        }
      }
      settingsMap[config.key] = value
    })

    // Получаем настройки депозитов
    const depositSettings = settingsMap.deposit_settings || settingsMap.deposits || {
      enabled: true,
      banks: ['mbank', 'bakai', 'balance', 'demir', 'omoney', 'megapay']
    }

    // Получаем настройки выводов
    const withdrawalSettings = settingsMap.withdrawal_settings || settingsMap.withdrawals || {
      enabled: true,
      banks: ['kompanion', 'odengi', 'bakai', 'balance', 'megapay', 'mbank']
    }

    // Получаем настройки казино
    const casinoSettings = settingsMap.casinos || {
      '1xbet': true,
      '1win': true,
      melbet: true,
      mostbet: true
    }

    // Формируем ответ в формате, который ожидает клиентский сайт
    const response = {
      success: true,
      deposits: typeof depositSettings === 'object' ? depositSettings : { enabled: depositSettings !== false, banks: [] },
      withdrawals: typeof withdrawalSettings === 'object' ? withdrawalSettings : { enabled: withdrawalSettings !== false, banks: [] },
      casinos: casinoSettings,
      pause: settingsMap.pause === 'true' || settingsMap.pause === true,
      maintenance_message: settingsMap.maintenance_message || 'Технические работы. Попробуйте позже.',
    }

    const res = NextResponse.json(response)
    res.headers.set('Access-Control-Allow-Origin', '*')
    return res
  } catch (error: any) {
    console.error('Payment settings API error:', error)
    // Возвращаем настройки по умолчанию при ошибке
    const res = NextResponse.json({
      success: true,
      deposits: { enabled: true, banks: ['mbank', 'bakai', 'balance', 'demir', 'omoney', 'megapay'] },
      withdrawals: { enabled: true, banks: ['kompanion', 'odengi', 'bakai', 'balance', 'megapay', 'mbank'] },
      casinos: {
        '1xbet': true,
        '1win': true,
        melbet: true,
        mostbet: true
      },
      pause: false,
      maintenance_message: 'Технические работы. Попробуйте позже.',
    })
    res.headers.set('Access-Control-Allow-Origin', '*')
    return res
  }
}

export const dynamic = 'force-dynamic'

