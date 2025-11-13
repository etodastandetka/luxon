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
      console.error('❌ No exchange rates received from API')
      return NextResponse.json(
        { error: 'Failed to get exchange rates' },
        { status: 500 }
      )
    }

    console.log('📊 Received exchange rates:', rates.length, 'rates')
    // Логируем все курсы для отладки
    const usdtRates = rates.filter(r => r.source === 'USDT')
    const kgsRates = rates.filter(r => r.target === 'KGS')
    console.log('💱 USDT rates:', usdtRates.map(r => `${r.source}->${r.target}: ${r.rate}`))
    console.log('💱 KGS rates:', kgsRates.map(r => `${r.source}->${r.target}: ${r.rate}`))

    // Ищем прямой курс USDT -> KGS (сомы) - приоритет
    const usdtToKgs = rates.find(
      (rate) => rate.source === 'USDT' && rate.target === 'KGS' && rate.is_valid
    )

    // Ищем курс USDT -> USD
    const usdtToUsd = rates.find(
      (rate) => rate.source === 'USDT' && rate.target === 'USD' && rate.is_valid
    )

    // Ищем курс USD -> KGS (если доступен)
    const usdToKgs = rates.find(
      (rate) => rate.source === 'USD' && rate.target === 'KGS' && rate.is_valid
    )

    let usdtToUsdRate: number | null = null
    let usdToKgsRate: number | null = null
    let usdtToKgsRate: number | null = null

    if (usdtToUsd) {
      usdtToUsdRate = parseFloat(usdtToUsd.rate)
    }

    if (usdToKgs) {
      usdToKgsRate = parseFloat(usdToKgs.rate)
      console.log('✅ Found USD -> KGS rate:', usdToKgsRate)
    } else {
      // Fallback: более актуальный курс USD -> KGS (87.41 по данным на ноябрь 2024)
      usdToKgsRate = 87.41
      console.warn('⚠️ USD -> KGS rate not found, using fallback:', usdToKgsRate)
    }

    // Приоритет: прямой курс USDT -> KGS
    if (usdtToKgs) {
      usdtToKgsRate = parseFloat(usdtToKgs.rate)
      console.log('✅ Found direct USDT -> KGS rate:', usdtToKgsRate)
    } else if (usdtToUsdRate && usdToKgsRate) {
      // Fallback: конвертируем через USD: USDT -> USD -> KGS
      usdtToKgsRate = usdtToUsdRate * usdToKgsRate
      console.log('⚠️ Using converted rate USDT -> USD -> KGS:', usdtToKgsRate, `(${usdtToUsdRate} * ${usdToKgsRate})`)
    } else {
      // Если ничего не найдено, используем прямой fallback для USDT -> KGS
      usdtToKgsRate = 87.41 // Примерный курс USDT -> KGS
      console.warn('⚠️ No exchange rate found, using fallback USDT -> KGS:', usdtToKgsRate)
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
