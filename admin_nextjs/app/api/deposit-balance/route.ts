import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { depositToCasino } from '@/lib/deposit-balance'

// Функция для отправки уведомления пользователю в Telegram
async function sendTelegramNotification(userId: bigint, message: string) {
  try {
    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      console.warn('⚠️ BOT_TOKEN not configured, skipping Telegram notification')
      return
    }

    const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    const response = await fetch(sendMessageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId.toString(),
        text: message,
        parse_mode: 'HTML',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Failed to send Telegram notification:', errorData)
      return
    }

    const data = await response.json()
    if (data.ok) {
      console.log(`✅ Telegram notification sent to user ${userId}`)
    }
  } catch (error) {
    console.error('❌ Error sending Telegram notification:', error)
  }
}

export const dynamic = 'force-dynamic'

// API для пополнения баланса игрока
export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request)

    const body = await request.json()
    const { requestId, bookmaker, accountId, amount } = body

    if (!requestId || !bookmaker || !accountId || !amount) {
      return NextResponse.json(
        createApiResponse(null, 'Missing required fields: requestId, bookmaker, accountId, amount'),
        { status: 400 }
      )
    }

    // Получаем заявку
    const requestData = await prisma.request.findUnique({
      where: { id: parseInt(requestId) },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    // ВАЖНО: Используем accountId (ID казино), а не userId (Telegram ID)
    // accountId - это ID игрока в казино (например, ID счета 1xbet, Melbet и т.д.)
    console.log(`[Deposit Balance] Bookmaker: ${bookmaker}, Casino Account ID: ${accountId}, Amount: ${amount}, Request ID: ${requestId}`)
    
    // Пополняем баланс через API казино
    const depositResult = await depositToCasino(bookmaker, accountId, parseFloat(amount), parseInt(requestId))

    if (!depositResult.success) {
      const errorMessage = depositResult.message || 'Failed to deposit balance'
      console.error(`[Deposit Balance] Failed for ${bookmaker}, accountId: ${accountId}`, depositResult)
      
      // Сохраняем ошибку в БД для отображения в админке
      if (requestId) {
        try {
          await prisma.request.update({
            where: { id: parseInt(requestId) },
            data: {
              status: 'api_error',
              statusDetail: errorMessage.length > 50 ? errorMessage.substring(0, 50) : errorMessage,
              processedAt: new Date(),
              updatedAt: new Date(),
            } as any,
          })
          console.log(`⚠️ [Deposit Balance] Saved error to request ${requestId}: ${errorMessage}`)
        } catch (dbError: any) {
          console.error(`❌ [Deposit Balance] Failed to save error to DB:`, dbError.message)
        }
      }
      
      return NextResponse.json(
        createApiResponse(null, errorMessage),
        { status: 500 }
      )
    }
    
    console.log(`[Deposit Balance] Success for ${bookmaker}, accountId: ${accountId}`, depositResult)

    // Обновляем статус заявки на completed
    // processedBy устанавливается из токена админа (ручное подтверждение)
    const updatedRequest = await prisma.request.update({
      where: { id: parseInt(requestId) },
      data: {
        status: 'completed',
        processedAt: new Date(),
        processedBy: authUser.username as any,
      },
    })


    // Преобразуем BigInt в строки для JSON сериализации
    const serializeBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) return obj
      if (typeof obj === 'bigint') return obj.toString()
      if (Array.isArray(obj)) return obj.map(serializeBigInt)
      if (typeof obj === 'object') {
        const serialized: any = {}
        for (const [key, value] of Object.entries(obj)) {
          serialized[key] = serializeBigInt(value)
        }
        return serialized
      }
      return obj
    }

    const serializedRequest = serializeBigInt(updatedRequest)

    return NextResponse.json(
      createApiResponse({
        success: true,
        message: depositResult.message,
        request: serializedRequest,
      })
    )
  } catch (error: any) {
    console.error('Deposit balance API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to deposit balance'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

