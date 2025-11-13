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

    // Получаем реальный курс USD -> KGS из API
    if (usdToKgs) {
      usdToKgsRate = parseFloat(usdToKgs.rate)
      console.log('✅ Found USD -> KGS rate from API:', usdToKgsRate)
    } else {
      // Если курс не найден, возвращаем ошибку - нужен реальный курс
      console.error('❌ USD -> KGS rate not found in API response')
      return NextResponse.json(
        { error: 'USD -> KGS exchange rate not available. Please check Crypto Bot API configuration.' },
        { status: 500 }
      )
    }

    // Приоритет: прямой курс USDT -> KGS из API
    if (usdtToKgs) {
      usdtToKgsRate = parseFloat(usdtToKgs.rate)
      console.log('✅ Found direct USDT -> KGS rate from API:', usdtToKgsRate)
    } else if (usdtToUsdRate && usdToKgsRate) {
      // Конвертируем через USD: USDT -> USD -> KGS (используя реальные курсы из API)
      usdtToKgsRate = usdtToUsdRate * usdToKgsRate
      console.log('✅ Using converted rate USDT -> USD -> KGS from API:', usdtToKgsRate, `(${usdtToUsdRate} * ${usdToKgsRate})`)
    } else {
      // Если нет данных для конвертации, возвращаем ошибку
      console.error('❌ Cannot calculate USDT -> KGS rate: missing exchange rates')
      return NextResponse.json(
        { error: 'Cannot calculate USDT -> KGS rate. Missing exchange rates from Crypto Bot API.' },
        { status: 500 }
      )
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
