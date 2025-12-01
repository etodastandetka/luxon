import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    
    // Получаем только photoFileUrl и cryptoPayment
    const requestData = await prisma.request.findUnique({
      where: { id },
      select: {
        photoFileUrl: true,
        cryptoPayment: {
          select: {
            id: true,
            invoice_id: true,
            amount: true,
            fee_amount: true,
            asset: true,
            status: true,
            request_id: true,
          },
        },
      },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      createApiResponse({
        photoFileUrl: requestData.photoFileUrl,
        cryptoPayment: requestData.cryptoPayment ? {
          ...requestData.cryptoPayment,
          amount: requestData.cryptoPayment.amount.toString(),
          fee_amount: requestData.cryptoPayment.fee_amount?.toString() || null,
        } : null,
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch photo'),
      { status: 500 }
    )
  }
}

