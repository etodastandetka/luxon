import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

/**
 * API endpoint для привязки входящего платежа к заявке
 * POST /api/incoming-payment/[id]/link
 * Body: { requestId }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request)

    const paymentId = parseInt(params.id)
    const body = await request.json()
    const { requestId } = body

    if (!requestId) {
      return NextResponse.json(
        createApiResponse(null, 'requestId is required'),
        { status: 400 }
      )
    }

    // Проверяем, что платеж существует
    const payment = await prisma.incomingPayment.findUnique({
      where: { id: paymentId },
    })

    if (!payment) {
      return NextResponse.json(
        createApiResponse(null, 'Payment not found'),
        { status: 404 }
      )
    }

    // Проверяем, что платеж еще не обработан для другой заявки
    if (payment.isProcessed && payment.requestId && payment.requestId !== requestId) {
      return NextResponse.json(
        createApiResponse(null, 'Payment is already processed for another request'),
        { status: 400 }
      )
    }

    // Привязываем платеж к заявке
    const updatedPayment = await prisma.incomingPayment.update({
      where: { id: paymentId },
      data: {
        requestId: parseInt(requestId),
        isProcessed: true,
      },
    })

    return NextResponse.json(
      createApiResponse({
        id: updatedPayment.id,
        requestId: updatedPayment.requestId,
        isProcessed: updatedPayment.isProcessed,
      }, 'Payment linked to request')
    )
  } catch (error: any) {
    console.error('❌ Error linking payment:', error)
    return NextResponse.json(
      createApiResponse(null, `Error: ${error.message}`),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

