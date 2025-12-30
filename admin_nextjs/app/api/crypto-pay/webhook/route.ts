import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, getInvoice, getExchangeRates } from '@/lib/crypto-pay'
import { prisma } from '@/lib/prisma'
import { depositToCasino } from '@/lib/deposit-balance'
import { rateLimit, getClientIP } from '@/lib/security'

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
    // 🛡️ Rate limiting для webhook (строгий, т.к. это внешний endpoint)
    const rateLimitResult = rateLimit({ 
      maxRequests: 100, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `webhook:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) {
      console.warn(`🚫 Rate limit exceeded for webhook from ${getClientIP(request)}`)
      return rateLimitResult
    }

    // CRITICAL: Read raw body text FIRST for signature verification
    // According to Crypto Pay API docs, signature must be verified against unparsed JSON string
    const rawBodyText = await request.text()
    
    // Parse body for processing
    const body = JSON.parse(rawBodyText)
    const signature = request.headers.get('crypto-pay-api-signature')

    if (!signature) {
      console.error(`🚫 Missing crypto-pay-api-signature header from ${getClientIP(request)}`)
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature using RAW body text (not parsed/stringified)
    const token = process.env.CRYPTO_PAY_API_TOKEN || '483674:AADGGvOSSrOaWDtd2baJuAN2ePJDVpnYief'
    const isValid = verifyWebhookSignature(token, rawBodyText, signature)

    if (!isValid) {
      console.error(`🚫 Invalid webhook signature from ${getClientIP(request)}`)
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
    let amount: number | null = null // В сомах (для пополнения в казино)
    let amountUsd: number | null = null // В долларах (что ввел пользователь)

    if (invoice.payload) {
      try {
        const payloadData = JSON.parse(invoice.payload)
        requestId = payloadData.request_id || payloadData.transaction_id || null
        telegramUserId = payloadData.telegram_user_id || null
        bookmaker = payloadData.bookmaker || null
        playerId = payloadData.playerId || null
        amount = payloadData.amount || null // В сомах
        amountUsd = payloadData.amount_usd || null // В долларах
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

    const canAutoProcess = botRequest && ['pending', 'manual', 'awaiting_manual', 'deferred'].includes(botRequest.status)

    if (canAutoProcess) {
        // Получаем сумму в USDT из invoice
        const amountUsdt = parseFloat(invoice.paid_amount || invoice.amount)
        
        // Конвертируем USDT -> USD -> KGS для пополнения в казино
        let amountInKgs: number
        if (amount !== null) {
          // Если есть сумма в сомах из payload, используем её
          amountInKgs = amount
        } else {
          // Иначе конвертируем USDT в сомы по текущему курсу из API
          try {
            const rates = await getExchangeRates()
            if (!rates || rates.length === 0) {
              throw new Error('No exchange rates received from API')
            }
            
            // Ищем прямой курс USDT -> KGS (приоритет)
            const usdtToKgs = rates.find(r => r.source === 'USDT' && r.target === 'KGS' && r.is_valid)
            const usdtToUsd = rates.find(r => r.source === 'USDT' && r.target === 'USD' && r.is_valid)
            const usdToKgs = rates.find(r => r.source === 'USD' && r.target === 'KGS' && r.is_valid)
            
            if (usdtToKgs) {
              // Используем прямой курс USDT -> KGS
              const usdtToKgsRate = parseFloat(usdtToKgs.rate)
              amountInKgs = amountUsdt * usdtToKgsRate
              console.log('✅ Using direct USDT -> KGS rate from Crypto Bot API:', usdtToKgsRate)
            } else if (usdtToUsd) {
              // Конвертируем через USD: USDT -> USD -> KGS
              const usdtToUsdRate = parseFloat(usdtToUsd.rate)
              let usdToKgsRate: number
              
              if (usdToKgs) {
                // Используем курс из Crypto Bot API
                usdToKgsRate = parseFloat(usdToKgs.rate)
                console.log('✅ Using USD -> KGS rate from Crypto Bot API:', usdToKgsRate)
              } else {
                // Получаем курс из внешнего API
                const externalApiUrl = 'https://api.exchangerate-api.com/v4/latest/USD'
                console.log('📡 Fetching USD -> KGS from external API for webhook')
                const externalResponse = await fetch(externalApiUrl, {
                  next: { revalidate: 60 }
                })
                
                if (externalResponse.ok) {
                  const externalData = await externalResponse.json()
                  if (externalData.rates && externalData.rates.KGS) {
                    usdToKgsRate = externalData.rates.KGS
                    console.log('✅ Using USD -> KGS rate from external API:', usdToKgsRate)
                  } else {
                    throw new Error('KGS rate not found in external API response')
                  }
                } else {
                  throw new Error(`External API returned ${externalResponse.status}`)
                }
              }
              
              amountInKgs = amountUsdt * usdtToUsdRate * usdToKgsRate
              console.log('✅ Using converted rate USDT -> USD -> KGS:', usdtToUsdRate, '*', usdToKgsRate)
            } else {
              throw new Error('Cannot calculate USDT -> KGS: missing exchange rates')
            }
          } catch (error) {
            console.error('❌ Error converting USDT to KGS:', error)
            // Если не удалось получить курс, используем сумму из заявки (она уже в сомах)
            amountInKgs = botRequest ? (botRequest.amount ? parseFloat(botRequest.amount.toString()) : 0) : 0
            console.warn('⚠️ Using amount from request as fallback:', amountInKgs)
          }
        }

        console.log('🔄 Processing auto-deposit for crypto payment:', {
          request_id: botRequest?.id,
          bookmaker: botRequest?.bookmaker,
          accountId: botRequest?.accountId,
          userId: botRequest?.userId?.toString(),
          amount_usdt: amountUsdt,
          amount_usd: amountUsd,
          amount_kgs: amountInKgs
        })

        // Обновляем заявку с обеими суммами
        const statusDetailData = amountUsd ? JSON.stringify({
          amount_usd: amountUsd,
          amount_kgs: amountInKgs,
          amount_usdt: amountUsdt
        }) : null

        if (botRequest) {
          await prisma.request.update({
            where: { id: botRequest.id },
            data: {
              status: 'auto_completed',
              paymentMethod: 'crypto',
              cryptoPaymentId: cryptoPayment.id,
              amount: amountInKgs, // Обновляем сумму в сомах (для пополнения в казино)
              statusDetail: statusDetailData, // Сохраняем обе суммы
              processedBy: 'автопополнение' as any, // Автопополнение через криптоплатеж
              processedAt: new Date(),
              updatedAt: new Date(),
            }
          })
        }

        // Выполняем автоматическое пополнение в сомах МГНОВЕННО
        const bookmaker = botRequest ? botRequest.bookmaker || '' : ''
        const accountId = botRequest ? (botRequest.accountId || botRequest.userId.toString()) : ''

        console.log(
          `💸 [Crypto Auto-Deposit] Processing instantly: Request ${botRequest ? botRequest.id : 'n/a'}, ${bookmaker}, Account ${accountId}, Amount ${amountInKgs} KGS`
        )

        try {
          // Сразу пополняем баланс (самое важное - делаем мгновенно)
          const depositResult = await depositToCasino(
            bookmaker,
            accountId,
            amountInKgs,
            botRequest?.id
          )
          
          if (!depositResult.success) {
            throw new Error(depositResult.message)
          }
          
          // После успешного пополнения - обновляем статус заявки
          if (botRequest) {
            await prisma.request.update({
              where: { id: botRequest.id },
              data: {
                status: 'autodeposit_success',
                statusDetail: null,
                processedBy: 'автопополнение' as any,
                processedAt: new Date(),
                updatedAt: new Date()
              }
            })
            
            // Отправляем уведомление пользователю в бот
            const source = (botRequest as any).source
            const isFromBot = source === 'bot' || !source
            
            if (isFromBot && botRequest.userId) {
              const notificationMessage = `✅ <b>Ваш баланс пополнен!</b>\n\n` +
                `💰 Сумма: ${amountInKgs} сом\n` +
                `🎰 Казино: ${bookmaker.toUpperCase()}\n` +
                `🆔 ID заявки: #${botRequest.id}`
              
              // Отправляем уведомление напрямую
              const botToken = process.env.BOT_TOKEN
              if (botToken) {
                const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
                fetch(sendMessageUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: botRequest.userId.toString(),
                    text: notificationMessage,
                    parse_mode: 'HTML',
                  }),
                }).catch(error => {
                  console.error(`❌ Failed to send notification for request ${botRequest.id}:`, error)
                })
              }
            }
          }

          console.log(`✅ [Crypto Auto-Deposit] SUCCESS: Request ${botRequest ? botRequest.id : 'n/a'} → autodeposit_success`)
        } catch (error: any) {
          console.error(`❌ [Crypto Auto-Deposit] FAILED for request ${botRequest ? botRequest.id : 'n/a'}:`, error.message)
          
          // Обновляем статус заявки для ручной проверки
          if (botRequest) {
            await prisma.request.update({
              where: { id: botRequest.id },
              data: {
                status: 'auto_completed',
                statusDetail: `crypto_auto_deposit_failed: ${error.message}`,
                updatedAt: new Date()
              }
            })
          }
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

