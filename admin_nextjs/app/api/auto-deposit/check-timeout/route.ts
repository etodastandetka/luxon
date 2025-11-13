import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

/**
 * API endpoint для проверки таймаутов автопополнения
 * Проверяет заявки, которые были созданы более 1 минуты назад
 * и имеют statusDetail = 'autodeposit_pending', но автопополнение не сработало
 * Меняет их на statusDetail = 'profile-1'
 */
export async function POST(request: NextRequest) {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)

    // Ищем заявки на пополнение, которые:
    // 1. Созданы более 1 минуты назад
    // 2. Имеют статус pending
    // 3. Имеют statusDetail = 'autodeposit_pending' или null (для новых заявок)
    const expiredRequests = await prisma.request.findMany({
      where: {
        requestType: 'deposit',
        status: 'pending',
        createdAt: {
          lt: oneMinuteAgo,
        },
        OR: [
          { statusDetail: 'autodeposit_pending' },
          { statusDetail: null },
        ],
      },
    })

    console.log(`⏰ Found ${expiredRequests.length} requests that need timeout check`)

    const updated = []
    for (const req of expiredRequests) {
      // Проверяем, не обработана ли заявка (не привязан ли платеж)
      const hasLinkedPayment = await prisma.incomingPayment.findFirst({
        where: {
          requestId: req.id,
          isProcessed: true,
        },
      })

      // Если платеж не привязан и прошла минута - меняем на profile-1
      if (!hasLinkedPayment) {
        await prisma.request.update({
          where: { id: req.id },
          data: {
            statusDetail: 'profile-1',
            updatedAt: new Date(),
          },
        })
        updated.push(req.id)
        console.log(`⏰ Request ${req.id} timeout: changed to profile-1`)
      }
    }

    return NextResponse.json(
      createApiResponse(
        {
          checked: expiredRequests.length,
          updated: updated.length,
          requestIds: updated,
        },
        'Timeout check completed'
      )
    )
  } catch (error: any) {
    console.error('❌ Error checking timeouts:', error)
    return NextResponse.json(
      createApiResponse(null, `Error: ${error.message}`),
      { status: 500 }
    )
  }
}

