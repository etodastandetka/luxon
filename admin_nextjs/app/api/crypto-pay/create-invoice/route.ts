import { NextRequest, NextResponse } from 'next/server'
import { createInvoice } from '@/lib/crypto-pay'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации (можно сделать публичным для клиентской части)
    // const session = await getServerSession(authOptions)
    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const body = await request.json()
    const { amount, description, payload, currency_type = 'crypto', asset = 'USDT', expires_in } = body

    if (!amount) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    }

    // Создаем invoice через Crypto Pay API
    const invoice = await createInvoice({
      asset,
      amount: amount.toString(),
      currency_type,
      description: description || 'Пополнение баланса LUXON',
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

