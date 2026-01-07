import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getMiniAppUrl } from '@/config/domains'

export const dynamic = 'force-dynamic'

// Отправка рассылки всем пользователям
export async function POST(request: NextRequest) {
  try {
    requireAuth(request)

    const body = await request.json()
    const { message } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        createApiResponse(null, 'Сообщение не может быть пустым'),
        { status: 400 }
      )
    }

    const botToken = process.env.BOT_TOKEN

    if (!botToken) {
      return NextResponse.json(
        createApiResponse(null, 'BOT_TOKEN not configured'),
        { status: 500 }
      )
    }

    // URL мини-приложения для кнопки (из централизованной конфигурации)
    const miniAppUrl = getMiniAppUrl()

    // Получаем всех пользователей
    const users = await prisma.botUser.findMany({
      select: {
        userId: true,
      },
    })

    if (users.length === 0) {
      return NextResponse.json(
        createApiResponse(null, 'Нет пользователей для рассылки'),
        { status: 400 }
      )
    }

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    console.log(`📢 [Broadcast] Starting broadcast to ${users.length} users`)

    // Отправляем сообщение всем пользователям с кнопкой WebApp
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      try {
        const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
        
        // Добавляем таймаут для запроса
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 секунд таймаут
        
        const telegramResponse = await fetch(sendMessageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: user.userId.toString(),
            text: message,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 Открыть приложение',
                    web_app: {
                      url: miniAppUrl
                    }
                  }
                ]
              ]
            }
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!telegramResponse.ok) {
          const errorText = await telegramResponse.text()
          console.error(`❌ [Broadcast] HTTP error for user ${user.userId}: ${telegramResponse.status} ${errorText}`)
          errorCount++
          errors.push(`User ${user.userId}: HTTP ${telegramResponse.status}`)
          continue
        }

        const telegramData = await telegramResponse.json()

        if (telegramData.ok) {
          successCount++
          if ((i + 1) % 100 === 0) {
            console.log(`✅ [Broadcast] Progress: ${i + 1}/${users.length} sent (${successCount} success, ${errorCount} errors)`)
          }
        } else {
          const errorMsg = telegramData.description || 'Unknown error'
          console.error(`❌ [Broadcast] Telegram API error for user ${user.userId}: ${errorMsg} (error_code: ${telegramData.error_code || 'N/A'})`)
          errorCount++
          errors.push(`User ${user.userId}: ${errorMsg}`)
          
          // Если пользователь заблокировал бота (403) или другие критические ошибки, пропускаем
          if (telegramData.error_code === 403 || telegramData.error_code === 400) {
            // Эти ошибки не критичны, просто пропускаем пользователя
            continue
          }
          
          // Если rate limit (429), делаем паузу
          if (telegramData.error_code === 429) {
            const retryAfter = telegramData.parameters?.retry_after || 1
            console.log(`⏸️ [Broadcast] Rate limit hit, waiting ${retryAfter} seconds...`)
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
            // Пробуем еще раз
            i--
            continue
          }
        }
        
        // Небольшая задержка между запросами чтобы не попасть в rate limit
        // Telegram позволяет до 30 сообщений в секунду
        if (i < users.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50)) // 50ms = 20 сообщений/сек
        }
      } catch (error: any) {
        errorCount++
        const errorMsg = error.name === 'AbortError' ? 'Request timeout' : error.message || 'Unknown error'
        console.error(`❌ [Broadcast] Exception for user ${user.userId}: ${errorMsg}`)
        errors.push(`User ${user.userId}: ${errorMsg}`)
      }
    }

    console.log(`📢 [Broadcast] Completed: ${successCount} success, ${errorCount} errors out of ${users.length} total`)
    if (errors.length > 0 && errors.length <= 10) {
      console.log(`❌ [Broadcast] Errors:`, errors.slice(0, 10))
    }

    // Сохраняем в историю рассылок
    const broadcastTitle = `Рассылка ${successCount} пользователям - ${new Date().toLocaleString('ru-RU')}`
    await prisma.broadcastMessage.create({
      data: {
        title: broadcastTitle,
        message: message,
        isSent: true,
        sentAt: new Date(),
      },
    })

    return NextResponse.json(
      createApiResponse({
        success: true,
        message: `Рассылка завершена. Успешно: ${successCount}, Ошибок: ${errorCount}`,
        sentCount: successCount,
        errorCount: errorCount,
        totalUsers: users.length,
      })
    )
  } catch (error: any) {
    console.error('Broadcast API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to send broadcast'),
      { status: 500 }
    )
  }
}

