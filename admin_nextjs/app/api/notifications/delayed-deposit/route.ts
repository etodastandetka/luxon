import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTelegramGroupMessage } from '@/lib/telegram-group'
import { createApiResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

/**
 * API для отправки отложенного уведомления о депозите
 * Вызывается через минуту после создания заявки, если автопополнение не сработало
 * GET /api/notifications/delayed-deposit?requestId=123
 */
export async function GET(req: NextRequest) {
  try {
    // ВАЖНО: Это внутренний endpoint, вызываемый через setTimeout из payment API
    // Проверяем, что это внутренний запрос (localhost или внутренний IP)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown'
    
    const isInternalRequest = ip === '127.0.0.1' || 
                             ip === '::1' || 
                             ip === 'localhost' ||
                             ip === '::ffff:127.0.0.1' ||
                             ip.startsWith('192.168.') || 
                             ip.startsWith('10.') || 
                             ip.startsWith('172.16.')
    
    // Логируем для отладки
    console.log(`📧 [Delayed Notification] Request received:`, {
      requestId: req.nextUrl.searchParams.get('requestId'),
      ip,
      isInternal: isInternalRequest,
      userAgent: req.headers.get('user-agent')
    })
    
    const searchParams = req.nextUrl.searchParams
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json(
        createApiResponse(null, 'Missing requestId parameter'),
        { status: 400 }
      )
    }

    const requestIdNum = parseInt(requestId)
    if (isNaN(requestIdNum)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid requestId'),
        { status: 400 }
      )
    }

    // Получаем заявку
    const request = await prisma.request.findUnique({
      where: { id: requestIdNum },
    })

    if (!request) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    // Проверяем, что это депозит
    if (request.requestType !== 'deposit') {
      return NextResponse.json(
        createApiResponse(null, 'Not a deposit request'),
        { status: 400 }
      )
    }

    // Проверяем статус - если уже обработано (автопополнение сработало), не отправляем уведомление
    if (
      request.status === 'completed' ||
      request.status === 'approved' ||
      request.status === 'autodeposit_success' ||
      request.status === 'auto_completed'
    ) {
      console.log(`ℹ️ [Delayed Notification] Request ${requestId} already processed (status: ${request.status}), skipping notification`)
      return NextResponse.json(
        createApiResponse({ skipped: true, reason: 'Already processed' }, undefined, 'Notification skipped - request already processed')
      )
    }

    // Если заявка все еще pending - отправляем уведомление
    if (request.status === 'pending') {
      const amountStr = request.amount ? parseFloat(request.amount.toString()).toFixed(2) : '0.00'
      const bookmakerStr = request.bookmaker || 'не указано'
      const usernameStr = request.username || request.firstName || 'Пользователь'
      const accountIdStr = request.accountId || 'не указан'
      
      const groupMessage = `🟢 <b>Новая заявка на пополнение</b>\n\n` +
        `👤 Пользователь: ${usernameStr}\n` +
        `💰 Сумма: ${amountStr} сом\n` +
        `🎰 Казино: ${bookmakerStr}\n` +
        `🆔 ID аккаунта: ${accountIdStr}\n` +
        `📋 ID заявки: #${request.id}\n\n` +
        `Статус: ожидает обработки`
      
      const sent = await sendTelegramGroupMessage(groupMessage)
      
      if (sent) {
        console.log(`✅ [Delayed Notification] Sent notification for request ${requestId}`)
        return NextResponse.json(
          createApiResponse({ sent: true }, undefined, 'Notification sent successfully')
        )
      } else {
        console.error(`❌ [Delayed Notification] Failed to send notification for request ${requestId}`)
        return NextResponse.json(
          createApiResponse(null, 'Failed to send notification'),
          { status: 500 }
        )
      }
    }

    // Если статус другой (например, rejected, api_error) - не отправляем
    console.log(`ℹ️ [Delayed Notification] Request ${requestId} has status ${request.status}, skipping notification`)
    return NextResponse.json(
      createApiResponse({ skipped: true, reason: `Status: ${request.status}` }, undefined, 'Notification skipped')
    )
  } catch (error: any) {
    console.error('❌ Error in delayed deposit notification:', error)
    return NextResponse.json(
      createApiResponse(null, `Error: ${error.message}`),
      { status: 500 }
    )
  }
}

