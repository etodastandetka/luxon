import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Функция для получения API ключей из настроек
async function getCasinoApiKeys() {
  const settings = await prisma.botConfiguration.findMany({
    where: {
      key: {
        in: ['1xbet_api_key', 'melbet_api_key', 'mostbet_api_key', '1win_api_key']
      }
    }
  })

  const keys: Record<string, string> = {}
  settings.forEach(setting => {
    const keyName = setting.key.replace('_api_key', '')
    keys[keyName] = typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value)
  })

  return keys
}

// Функция для пополнения баланса через API казино
async function depositToCasino(
  bookmaker: string,
  accountId: string,
  amount: number
): Promise<{ success: boolean; message: string; data?: any }> {
  const apiKeys = await getCasinoApiKeys()
  const normalizedBookmaker = bookmaker?.toLowerCase() || ''

  try {
    if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet') {
      // 1xbet API
      const apiKey = apiKeys['1xbet'] || process.env.ONEXBET_API_KEY
      if (!apiKey) {
        return { success: false, message: '1xbet API key not configured' }
      }

      // Пример вызова API 1xbet (нужно будет уточнить правильный формат)
      const response = await fetch(`https://api.1xbet.com/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          accountId: accountId,
          amount: amount,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        return { success: true, message: 'Balance deposited successfully', data }
      }
      return { success: false, message: data.message || 'Failed to deposit balance' }
    } else if (normalizedBookmaker.includes('melbet') || normalizedBookmaker === 'melbet') {
      // Melbet API
      const apiKey = apiKeys['melbet'] || process.env.MELBET_API_KEY
      if (!apiKey) {
        return { success: false, message: 'Melbet API key not configured' }
      }

      const response = await fetch(`https://api.melbet.com/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          playerId: accountId,
          amount: amount,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        return { success: true, message: 'Balance deposited successfully', data }
      }
      return { success: false, message: data.message || 'Failed to deposit balance' }
    } else if (normalizedBookmaker.includes('mostbet') || normalizedBookmaker === 'mostbet') {
      // Mostbet API
      const apiKey = apiKeys['mostbet'] || process.env.MOSTBET_API_KEY
      if (!apiKey) {
        return { success: false, message: 'Mostbet API key not configured' }
      }

      const response = await fetch(`https://api.mostbet.com/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          userId: accountId,
          amount: amount,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        return { success: true, message: 'Balance deposited successfully', data }
      }
      return { success: false, message: data.message || 'Failed to deposit balance' }
    } else if (normalizedBookmaker.includes('1win') || normalizedBookmaker === '1win') {
      // 1win API
      const apiKey = apiKeys['1win'] || process.env.ONEWIN_API_KEY
      if (!apiKey) {
        return { success: false, message: '1win API key not configured' }
      }

      const response = await fetch(`https://api.1win.com/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          accountId: accountId,
          amount: amount,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        return { success: true, message: 'Balance deposited successfully', data }
      }
      return { success: false, message: data.message || 'Failed to deposit balance' }
    } else {
      return { success: false, message: `Unsupported bookmaker: ${bookmaker}` }
    }
  } catch (error: any) {
    console.error('Deposit balance error:', error)
    return { success: false, message: error.message || 'Failed to deposit balance' }
  }
}

// API для пополнения баланса игрока
export async function POST(request: NextRequest) {
  try {
    requireAuth(request)

    const body = await request.json()
    const { requestId, bookmaker, accountId, amount } = body

    if (!requestId || !bookmaker || !accountId || !amount) {
      return NextResponse.json(
        createApiResponse(null, 'Missing required fields: requestId, bookmaker, accountId, amount'),
        { status: 400 }
      )
    }

    // Получаем заявку
    const requestData = await prisma.request.findUnique({
      where: { id: parseInt(requestId) },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    // Пополняем баланс через API казино
    const depositResult = await depositToCasino(bookmaker, accountId, parseFloat(amount))

    if (!depositResult.success) {
      return NextResponse.json(
        createApiResponse(null, depositResult.message),
        { status: 500 }
      )
    }

    // Обновляем статус заявки на completed
    const updatedRequest = await prisma.request.update({
      where: { id: parseInt(requestId) },
      data: {
        status: 'completed',
        processedAt: new Date(),
      },
    })

    return NextResponse.json(
      createApiResponse({
        success: true,
        message: depositResult.message,
        request: {
          ...updatedRequest,
          amount: updatedRequest.amount ? updatedRequest.amount.toString() : null,
        },
      })
    )
  } catch (error: any) {
    console.error('Deposit balance API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to deposit balance'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

