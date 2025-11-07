import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, getInvoice } from '@/lib/crypto-pay'
import { prisma } from '@/lib/prisma'
import { depositToCasino } from '@/lib/deposit-balance'

export const dynamic = 'force-dynamic'

interface WebhookUpdate {
  update_id: number
  update_type: 'invoice_paid'
  request_date: string
  payload: {
    invoice_id: number
    hash: string
    currency_type: string
    asset?: string
    fiat?: string
    amount: string
    paid_asset?: string
    paid_amount?: string
    paid_fiat_rate?: string
    fee_asset?: string
    fee_amount?: number
    bot_invoice_url: string
    description?: string
    status: 'paid'
    paid_at: string
    paid_usd_rate?: string
    payload?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const signature = request.headers.get('crypto-pay-api-signature')

    if (!signature) {
      console.error('Missing crypto-pay-api-signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature
    const token = process.env.CRYPTO_PAY_API_TOKEN || '483674:AADGGvOSSrOaWDtd2baJuAN2ePJDVpnYief'
    const isValid = verifyWebhookSignature(token, body, signature)

    if (!isValid) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const update: WebhookUpdate = body

    // Проверяем тип обновления
    if (update.update_type !== 'invoice_paid') {
      return NextResponse.json({ ok: true, message: 'Update type not processed' })
    }

    const invoice = update.payload

    // Проверяем, что invoice оплачен
    if (invoice.status !== 'paid') {
      return NextResponse.json({ ok: true, message: 'Invoice not paid' })
    }

    console.log('💳 Crypto Pay invoice paid:', {
      invoice_id: invoice.invoice_id,
      amount: invoice.paid_amount || invoice.amount,
      asset: invoice.paid_asset || invoice.asset,
      payload: invoice.payload
    })

    // Парсим payload (должен содержать request_id или другую информацию для связи с заявкой)
    let requestId: string | null = null
    let telegramUserId: string | null = null
    let bookmaker: string | null = null
    let playerId: string | null = null
    let amount: number | null = null

    if (invoice.payload) {
      try {
        const payloadData = JSON.parse(invoice.payload)
        requestId = payloadData.request_id || payloadData.transaction_id || null
        telegramUserId = payloadData.telegram_user_id || null
        bookmaker = payloadData.bookmaker || null
        playerId = payloadData.playerId || null
        amount = payloadData.amount || null
      } catch (e) {
        // Если payload не JSON, пробуем найти request_id в строке
        const match = invoice.payload.match(/request_id[=:](\d+)/i)
        if (match) {
          requestId = match[1]
        }
      }
    }

    // Если нет request_id в payload, ищем по invoice_id в базе
    if (!requestId) {
      const existingPayment = await prisma.cryptoPayment.findFirst({
        where: { invoice_id: invoice.invoice_id.toString() }
      })
      if (existingPayment) {
        requestId = existingPayment.request_id
      }
    }

    // Сохраняем информацию о крипто-платеже
    const cryptoPayment = await prisma.cryptoPayment.upsert({
      where: {
        invoice_id: invoice.invoice_id.toString()
      },
      create: {
        invoice_id: invoice.invoice_id.toString(),
        hash: invoice.hash,
        amount: parseFloat(invoice.paid_amount || invoice.amount),
        asset: invoice.paid_asset || invoice.asset || 'USDT',
        currency_type: invoice.currency_type,
        status: 'paid',
        paid_at: new Date(invoice.paid_at),
        request_id: requestId,
        telegram_user_id: telegramUserId,
        payload: invoice.payload || null,
        fee_amount: invoice.fee_amount || 0,
        fee_asset: invoice.fee_asset || null
      },
      update: {
        status: 'paid',
        paid_at: new Date(invoice.paid_at),
        amount: parseFloat(invoice.paid_amount || invoice.amount),
        asset: invoice.paid_asset || invoice.asset || 'USDT'
      }
    })

    // Если есть request_id, обновляем заявку и выполняем автоматическое пополнение
    // Если нет request_id, но есть данные в payload, создаем новую заявку
    let botRequest = null
    
    if (requestId) {
      botRequest = await prisma.request.findUnique({
        where: { id: parseInt(requestId) }
      })
    } else if (bookmaker && playerId && amount && telegramUserId) {
      // Создаем новую заявку, если её еще нет
      botRequest = await prisma.request.create({
        data: {
          userId: BigInt(telegramUserId),
          bookmaker,
          accountId: playerId,
          amount: amount,
          requestType: 'deposit',
          status: 'pending',
          paymentMethod: 'crypto',
          cryptoPaymentId: cryptoPayment.id
        }
      })
      // Обновляем крипто-платеж с request_id
      await prisma.cryptoPayment.update({
        where: { id: cryptoPayment.id },
        data: { request_id: botRequest.id.toString() }
      })
    }

    if (botRequest && botRequest.status === 'pending') {
        console.log('🔄 Processing auto-deposit for crypto payment:', {
          request_id: botRequest.id,
          bookmaker: botRequest.bookmaker,
          accountId: botRequest.accountId,
          userId: botRequest.userId.toString(),
          amount: invoice.paid_amount || invoice.amount
        })

        // Обновляем заявку
        await prisma.request.update({
          where: { id: botRequest.id },
          data: {
            status: 'auto_completed',
            paymentMethod: 'crypto',
            cryptoPaymentId: cryptoPayment.id
          }
        })

        // Выполняем автоматическое пополнение
        try {
          const bookmaker = botRequest.bookmaker || ''
          const accountId = botRequest.accountId || botRequest.userId.toString()
          const amount = parseFloat(invoice.paid_amount || invoice.amount)

          console.log('💸 Attempting auto-deposit:', {
            bookmaker,
            accountId,
            amount
          })

          const depositResult = await depositToCasino(
            bookmaker,
            accountId,
            amount
          )
          
          console.log('📊 Deposit result:', depositResult)
          
          if (!depositResult.success) {
            console.error('❌ Deposit failed:', depositResult.message)
            throw new Error(depositResult.message)
          }
          
          // Обновляем статус заявки на успешное автопополнение
          await prisma.request.update({
            where: { id: botRequest.id },
            data: {
              status: 'autodeposit_success',
              statusDetail: 'crypto_auto_deposit_success',
              processedAt: new Date(),
              updatedAt: new Date()
            }
          })

          console.log('✅ Auto-deposit successful for crypto payment:', {
            request_id: botRequest.id,
            bookmaker,
            accountId,
            amount,
            transaction_id: depositResult.data?.transactionId
          })
        } catch (error: any) {
          console.error('❌ Auto-deposit failed for crypto payment:', {
            request_id: botRequest.id,
            error: error.message,
            stack: error.stack
          })
          
          // Обновляем статус заявки для ручной проверки
          await prisma.request.update({
            where: { id: botRequest.id },
            data: {
              status: 'auto_completed',
              statusDetail: `crypto_auto_deposit_failed: ${error.message}`,
              updatedAt: new Date()
            }
          })
        }
    } else if (botRequest) {
      console.log('ℹ️ Request already processed:', {
        request_id: botRequest.id,
        status: botRequest.status
      })
    } else {
      console.log('⚠️ No matching request found for crypto payment:', {
        invoice_id: invoice.invoice_id,
        requestId,
        bookmaker,
        playerId,
        amount
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Error processing crypto webhook:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

