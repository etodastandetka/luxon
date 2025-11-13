import { NextRequest, NextResponse } from 'next/server'
import { getExchangeRates } from '@/lib/crypto-pay'

export const dynamic = 'force-dynamic'

/**
 * API endpoint для получения курса валют через Crypto Bot API
 * Возвращает курс USDT -> USD и USD -> KGS
 */
export async function GET(request: NextRequest) {
  try {
    const rates = await getExchangeRates()
    
    if (!rates || rates.length === 0) {
      return NextResponse.json(
        { error: 'Failed to get exchange rates' },
        { status: 500 }
      )
    }

    // Ищем курс USDT -> USD
    const usdtToUsd = rates.find(
      (rate) => rate.source === 'USDT' && rate.target === 'USD' && rate.is_valid
    )

    // Ищем курс USD -> KGS (если доступен)
    const usdToKgs = rates.find(
      (rate) => rate.source === 'USD' && rate.target === 'KGS' && rate.is_valid
    )

    // Если есть прямой курс USDT -> KGS
    const usdtToKgs = rates.find(
      (rate) => rate.source === 'USDT' && rate.target === 'KGS' && rate.is_valid
    )

    let usdtToUsdRate: number | null = null
    let usdToKgsRate: number | null = null
    let usdtToKgsRate: number | null = null

    if (usdtToUsd) {
      usdtToUsdRate = parseFloat(usdtToUsd.rate)
    }

    if (usdToKgs) {
      usdToKgsRate = parseFloat(usdToKgs.rate)
    } else {
      // Fallback: фиксированный курс USD -> KGS (95)
      usdToKgsRate = 95
    }

    if (usdtToKgs) {
      // Используем прямой курс USDT -> KGS
      usdtToKgsRate = parseFloat(usdtToKgs.rate)
    } else if (usdtToUsdRate && usdToKgsRate) {
      // Конвертируем через USD: USDT -> USD -> KGS
      usdtToKgsRate = usdtToUsdRate * usdToKgsRate
    }

    return NextResponse.json({
      success: true,
      data: {
        usdtToUsd: usdtToUsdRate,
        usdToKgs: usdToKgsRate,
        usdtToKgs: usdtToKgsRate,
        timestamp: new Date().toISOString(),
        source: usdtToKgs ? 'direct' : 'converted'
      }
    })
  } catch (error: any) {
    console.error('Error getting exchange rate:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
