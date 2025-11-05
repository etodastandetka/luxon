import { NextRequest, NextResponse } from 'next/server'
import { createInvoice } from '@/lib/crypto-pay'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Публичный endpoint для клиентской части

    const body = await request.json()
    const { amount, description, payload, currency_type = 'crypto', asset = 'USDT', expires_in } = body

    if (!amount) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    }

    // Создаем invoice через Crypto Pay API
    // Примечание: Crypto Bot API не позволяет указать сеть по умолчанию (TRC20/ERC20)
    // Пользователь должен выбрать сеть вручную при оплате
    // Рекомендуется выбрать TRC20 (TRON) для оплаты
    const invoiceDescription = description || 'Пополнение баланса LUXON'
    const invoice = await createInvoice({
      asset,
      amount: amount.toString(),
      currency_type,
      description: invoiceDescription,
      payload: payload || '',
      expires_in: expires_in || 3600, // 1 час по умолчанию
      paid_btn_name: 'callback',
      paid_btn_url: process.env.NEXT_PUBLIC_APP_URL || 'https://luxservice.online'
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        invoice_id: invoice.invoice_id,
        hash: invoice.hash,
        bot_invoice_url: invoice.bot_invoice_url,
        mini_app_invoice_url: invoice.mini_app_invoice_url,
        web_app_invoice_url: invoice.web_app_invoice_url,
        amount: invoice.amount,
        asset: invoice.asset,
        status: invoice.status
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

