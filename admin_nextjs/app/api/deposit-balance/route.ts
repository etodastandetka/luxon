import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { depositCashdeskAPI, depositMostbetAPI } from '@/lib/casino-deposit'

export const dynamic = 'force-dynamic'

// Функция для получения конфигурации API казино из настроек
async function getCasinoConfig(bookmaker: string) {
  const normalizedBookmaker = bookmaker?.toLowerCase() || ''
  
  // Для 1xbet и Melbet нужны: hash, cashierpass, login, cashdeskid
  if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker.includes('melbet')) {
    const configKey = normalizedBookmaker.includes('1xbet') ? '1xbet_api_config' : 'melbet_api_config'
    
    const setting = await prisma.botConfiguration.findFirst({
      where: { key: configKey },
    })

    if (!setting) {
      return null
    }

    const config = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
    return {
      hash: config.hash || config.api_key,
      cashierpass: config.cashierpass || config.password,
      login: config.login || config.username,
      cashdeskid: config.cashdeskid || config.cashdesk_id,
    }
  }
  
  // Для Mostbet нужны: api_key, secret, cashpoint_id
  if (normalizedBookmaker.includes('mostbet')) {
    const setting = await prisma.botConfiguration.findFirst({
      where: { key: 'mostbet_api_config' },
    })

    if (!setting) {
      return null
    }

    const config = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
    return {
      api_key: config.api_key || config.apiKey,
      secret: config.secret,
      cashpoint_id: config.cashpoint_id || config.cashpointId,
    }
  }

  return null
}

// Функция для пополнения баланса через API казино
async function depositToCasino(
  bookmaker: string,
  accountId: string,
  amount: number
): Promise<{ success: boolean; message: string; data?: any }> {
  const normalizedBookmaker = bookmaker?.toLowerCase() || ''

  try {
    // 1xbet и Melbet используют Cashdesk API
    if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker.includes('melbet')) {
      const config = await getCasinoConfig(bookmaker)
      
      if (!config) {
        return {
          success: false,
          message: `${bookmaker} API configuration not found in database`,
        }
      }

      return await depositCashdeskAPI(bookmaker, accountId, amount, config)
    }
    
    // Mostbet использует свой API
    if (normalizedBookmaker.includes('mostbet')) {
      const config = await getCasinoConfig(bookmaker)
      
      if (!config) {
        return {
          success: false,
          message: 'Mostbet API configuration not found in database',
        }
      }

      return await depositMostbetAPI(accountId, amount, config)
    }
    
    // 1win (если нужно будет добавить)
    if (normalizedBookmaker.includes('1win')) {
      return {
        success: false,
        message: '1win API not yet implemented',
      }
    }

    return {
      success: false,
      message: `Unsupported bookmaker: ${bookmaker}`,
    }
  } catch (error: any) {
    console.error('Deposit balance error:', error)
    return {
      success: false,
      message: error.message || 'Failed to deposit balance',
    }
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

