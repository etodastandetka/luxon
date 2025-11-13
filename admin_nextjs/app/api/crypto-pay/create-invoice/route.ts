import { NextRequest, NextResponse } from 'next/server'
import { createInvoice, getExchangeRates } from '@/lib/crypto-pay'
// @ts-ignore - @koo0ki/send types may not be available
import { CryptoPayClient, Networks } from "@koo0ki/send"

// Инициализация клиента @koo0ki/send для создания invoice
const cryptoPay = new CryptoPayClient({
  token: process.env.CRYPTO_PAY_API_TOKEN || '',
  net: process.env.NODE_ENV === 'production' ? Networks.MAINNET : Networks.TESTNET,
  pollingEnabled: false,
})

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

    // Получаем курсы валют
    const rates = await getExchangeRates()
    
    // Ищем прямой курс USDT -> KGS (приоритет)
    const usdtToKgs = rates.find(
      (rate) => rate.source === 'USDT' && rate.target === 'KGS' && rate.is_valid
    )
    
    // Ищем курс USD -> KGS
    const usdToKgs = rates.find(
      (rate) => rate.source === 'USD' && rate.target === 'KGS' && rate.is_valid
    )
    
    // Ищем курс USDT -> USD
    const usdtToUsd = rates.find(
      (rate) => rate.source === 'USDT' && rate.target === 'USD' && rate.is_valid
    )

    // Получаем реальный курс USD -> KGS из API (обязательно)
    if (!usdToKgs) {
      console.error('❌ USD -> KGS rate not found in API response')
      return NextResponse.json(
        { error: 'USD -> KGS exchange rate not available. Please check Crypto Bot API configuration.' },
        { status: 500 }
      )
    }
    const usdToKgsRate = parseFloat(usdToKgs.rate)
    console.log('✅ Using USD -> KGS rate from API:', usdToKgsRate)
    const amountKgs = amountUsdNum * usdToKgsRate

    // Конвертируем USD -> USDT для оплаты (используя реальные курсы из API)
    let amountUsdt: number
    if (usdtToKgs) {
      // Если есть прямой курс USDT -> KGS, используем его для обратной конвертации
      const usdtToKgsRate = parseFloat(usdtToKgs.rate)
      amountUsdt = amountKgs / usdtToKgsRate
      console.log('✅ Using direct USDT -> KGS rate for conversion:', usdtToKgsRate)
    } else if (usdtToUsd) {
      // Используем курс USDT -> USD из API
      const usdtToUsdRate = parseFloat(usdtToUsd.rate)
      amountUsdt = amountUsdNum / usdtToUsdRate
      console.log('✅ Using USDT -> USD rate for conversion:', usdtToUsdRate)
    } else {
      // Если нет курса для конвертации, возвращаем ошибку
      console.error('❌ Cannot convert USD to USDT: missing exchange rates')
      return NextResponse.json(
        { error: 'Cannot convert USD to USDT. Missing exchange rates from Crypto Bot API.' },
        { status: 500 }
      )
    }

    // Создаем invoice через библиотеку @koo0ki/send
    let invoice: any
    try {
      invoice = await cryptoPay.createInvoice({
        amount: amountUsdt,
        asset: asset,
        description: description || 'Пополнение баланса LUXON',
        payload: payload || JSON.stringify({
          amount_usd: amountUsdNum,
          amount_kgs: amountKgs,
          amount_usdt: amountUsdt
        })
      })
    } catch (error) {
      console.error('Error creating invoice with @koo0ki/send, falling back to direct API:', error)
      // Fallback: используем прямой API
      invoice = await createInvoice({
        asset: asset,
        amount: amountUsdt.toFixed(2),
        description: description || 'Пополнение баланса LUXON',
        payload: payload || JSON.stringify({
          amount_usd: amountUsdNum,
          amount_kgs: amountKgs,
          amount_usdt: amountUsdt
        })
      })
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
    }

    // Адаптируем ответ под формат, который ожидает клиент
    // Библиотека @koo0ki/send может возвращать другой формат
    const invoiceId = invoice.invoiceId || invoice.invoice_id || invoice.id
    const invoiceHash = invoice.hash
    const botInvoiceUrl = invoice.botInvoiceUrl || invoice.bot_invoice_url || invoice.url
    const miniAppInvoiceUrl = invoice.miniAppInvoiceUrl || invoice.mini_app_invoice_url || invoice.url
    const webAppInvoiceUrl = invoice.webAppInvoiceUrl || invoice.web_app_invoice_url || invoice.url

    return NextResponse.json({
      success: true,
      data: {
        invoice_id: invoiceId,
        hash: invoiceHash,
        bot_invoice_url: botInvoiceUrl,
        mini_app_invoice_url: miniAppInvoiceUrl,
        web_app_invoice_url: webAppInvoiceUrl,
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

