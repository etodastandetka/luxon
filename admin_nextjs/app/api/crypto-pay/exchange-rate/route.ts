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

    // Ищем курс USD -> KGS (если доступен в Crypto Bot API)
    const usdToKgs = rates.find(
      (rate) => rate.source === 'USD' && rate.target === 'KGS' && rate.is_valid
    )

    let usdtToUsdRate: number | null = null
    let usdToKgsRate: number | null = null
    let usdtToKgsRate: number | null = null

    if (usdtToUsd) {
      usdtToUsdRate = parseFloat(usdtToUsd.rate)
      console.log('✅ Found USDT -> USD rate from API:', usdtToUsdRate)
    }

    // Получаем курс USD -> KGS
    if (usdToKgs) {
      // Если курс доступен в Crypto Bot API, используем его
      usdToKgsRate = parseFloat(usdToKgs.rate)
      console.log('✅ Found USD -> KGS rate from Crypto Bot API:', usdToKgsRate)
    } else {
      // Если курс не найден в Crypto Bot API, получаем из внешнего источника
      try {
        // Используем exchangerate-api.com для получения курса USD -> KGS
        const externalApiUrl = 'https://api.exchangerate-api.com/v4/latest/USD'
        console.log('📡 Fetching USD -> KGS from external API:', externalApiUrl)
        const externalResponse = await fetch(externalApiUrl, {
          cache: 'no-store',
          next: { revalidate: 60 } // Кэш на 60 секунд
        })
        
        if (externalResponse.ok) {
          const externalData = await externalResponse.json()
          if (externalData.rates && externalData.rates.KGS) {
            usdToKgsRate = externalData.rates.KGS
            console.log('✅ Found USD -> KGS rate from external API:', usdToKgsRate)
          } else {
            throw new Error('KGS rate not found in external API response')
          }
        } else {
          throw new Error(`External API returned ${externalResponse.status}`)
        }
      } catch (externalError: any) {
        console.error('❌ Error fetching USD -> KGS from external API:', externalError.message)
        // Если внешний API недоступен, возвращаем ошибку
        return NextResponse.json(
          { error: 'USD -> KGS exchange rate not available. Crypto Bot API and external API both failed.' },
          { status: 500 }
        )
      }
    }

    // Приоритет: прямой курс USDT -> KGS из Crypto Bot API
    if (usdtToKgs) {
      usdtToKgsRate = parseFloat(usdtToKgs.rate)
      console.log('✅ Found direct USDT -> KGS rate from Crypto Bot API:', usdtToKgsRate)
    } else if (usdtToUsdRate && usdToKgsRate) {
      // Конвертируем через USD: USDT -> USD -> KGS (используя реальные курсы)
      usdtToKgsRate = usdtToUsdRate * usdToKgsRate
      console.log('✅ Using converted rate USDT -> USD -> KGS:', usdtToKgsRate, `(${usdtToUsdRate} * ${usdToKgsRate})`)
    } else {
      // Если нет данных для конвертации, возвращаем ошибку
      console.error('❌ Cannot calculate USDT -> KGS rate: missing exchange rates')
      return NextResponse.json(
        { error: 'Cannot calculate USDT -> KGS rate. Missing exchange rates.' },
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
