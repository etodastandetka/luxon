import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore - @koo0ki/send types may not be available
import { CryptoPayClient, Networks } from "@koo0ki/send";

const USD_TO_KGS_RATE = 95;

// Инициализация клиента
const cryptoPay = new CryptoPayClient({
    token: process.env.CRYPTO_PAY_TOKEN || process.env.NEXT_PUBLIC_CRYPTO_PAY_TOKEN || process.env.CRYPTO_PAY_API_TOKEN || "",
    net: process.env.NODE_ENV === 'production' ? Networks.MAINNET : Networks.TESTNET,
    pollingEnabled: true,
    pollingInterval: 15000,
});

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, amountKgs, description, payload, asset = 'USDT' } = body

    // Если передана сумма в сомах, конвертируем в USDT
    let amountUsdt: number;
    if (amountKgs !== undefined && amountKgs !== null) {
      amountUsdt = amountKgs / USD_TO_KGS_RATE;
    } else if (amount) {
      // Если передана сумма напрямую, считаем что это USDT
      amountUsdt = parseFloat(amount);
    } else {
      return NextResponse.json({ error: 'Amount or amountKgs is required' }, { status: 400 })
    }

    // Валидация суммы
    if (amountUsdt < 1) {
      return NextResponse.json({ error: 'Минимальная сумма: 1 USDT (95 сом)' }, { status: 400 })
    }
    
    if (amountUsdt > 1000) {
      return NextResponse.json({ error: 'Максимальная сумма: 1000 USDT (95,000 сом)' }, { status: 400 })
    }

    // Создаем invoice через @koo0ki/send
    const invoice: any = await cryptoPay.createInvoice({
      amount: amountUsdt,
      asset: asset,
      description: description || 'Пополнение баланса LUXON',
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
    }

    // Адаптируем ответ под формат, который ожидает клиент
    return NextResponse.json({
      success: true,
      data: {
        invoice_id: invoice.invoiceId || invoice.id || invoice.invoice_id,
        hash: invoice.hash,
        bot_invoice_url: invoice.botInvoiceUrl || invoice.url || invoice.bot_invoice_url,
        mini_app_invoice_url: invoice.miniAppInvoiceUrl || invoice.url || invoice.mini_app_invoice_url,
        web_app_invoice_url: invoice.webAppInvoiceUrl || invoice.url || invoice.web_app_invoice_url,
        amount: amountUsdt,
        amountKgs: amountKgs || (amountUsdt * USD_TO_KGS_RATE),
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

