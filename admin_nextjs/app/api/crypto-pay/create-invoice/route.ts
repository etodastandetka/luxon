import { NextRequest, NextResponse } from 'next/server'
import { createInvoice } from '@/lib/crypto-pay'
import { getExchangeRates } from '@/lib/crypto-pay'

export const dynamic = 'force-dynamic'

/**
 * Получение курса USD -> KGS
 */
async function getUsdToKgsRate(): Promise<number> {
  try {
    const rates = await getExchangeRates()
    
    // Ищем курс USD -> KGS
    const usdToKgs = rates.find(
      (rate) => rate.source === 'USD' && rate.target === 'KGS' && rate.is_valid
    )
    
    if (usdToKgs) {
      return parseFloat(usdToKgs.rate)
    }
  } catch (error) {
    console.error('Error getting exchange rate:', error)
  }
  
  // Fallback: фиксированный курс
  return 95
}

/**
 * Получение курса USDT -> USD
 */
async function getUsdtToUsdRate(): Promise<number> {
  try {
    const rates = await getExchangeRates()
    
    // Ищем курс USDT -> USD
    const usdtToUsd = rates.find(
      (rate) => rate.source === 'USDT' && rate.target === 'USD' && rate.is_valid
    )
    
    if (usdtToUsd) {
      return parseFloat(usdtToUsd.rate)
    }
  } catch (error) {
    console.error('Error getting exchange rate:', error)
  }
  
  // Fallback: 1 USDT = 1 USD
  return 1
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amountUsd, description, payload, asset = 'USDT' } = body

    // Пользователь вводит сумму в долларах (USD)
    if (!amountUsd) {
      return NextResponse.json({ error: 'amountUsd is required' }, { status: 400 })
    }

    const amountUsdNum = parseFloat(amountUsd)

    // Валидация суммы в долларах
    if (isNaN(amountUsdNum) || amountUsdNum < 1) {
      return NextResponse.json({ error: 'Минимальная сумма: $1 USD' }, { status: 400 })
    }
    
    if (amountUsdNum > 1000) {
      return NextResponse.json({ error: 'Максимальная сумма: $1000 USD' }, { status: 400 })
    }

    // Конвертируем USD -> USDT для оплаты
    const usdtToUsdRate = await getUsdtToUsdRate()
    const amountUsdt = amountUsdNum / usdtToUsdRate

    // Конвертируем USD -> KGS для пополнения в казино
    const usdToKgsRate = await getUsdToKgsRate()
    const amountKgs = amountUsdNum * usdToKgsRate

    // Создаем invoice через Crypto Pay API
    const invoice = await createInvoice({
      asset: asset,
      amount: amountUsdt.toFixed(2),
      description: description || 'Пополнение баланса LUXON',
      payload: payload || JSON.stringify({
        amount_usd: amountUsdNum,
        amount_kgs: amountKgs,
        amount_usdt: amountUsdt
      })
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
    }

    // Адаптируем ответ под формат, который ожидает клиент
    return NextResponse.json({
      success: true,
      data: {
        invoice_id: invoice.invoice_id,
        hash: invoice.hash,
        bot_invoice_url: invoice.bot_invoice_url,
        mini_app_invoice_url: invoice.mini_app_invoice_url,
        web_app_invoice_url: invoice.web_app_invoice_url,
        amount: amountUsdt, // Сумма в USDT для оплаты
        amount_usd: amountUsdNum, // Сумма в USD (что ввел пользователь)
        amount_kgs: amountKgs, // Сумма в сомах (для пополнения в казино)
        asset: invoice.asset || asset,
        status: invoice.status || 'active'
      }
    })
  } catch (error: any) {
    console.error('Error creating crypto invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

