import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request)

    const id = parseInt(params.id)

    const requestData = await prisma.request.findUnique({
      where: { id },
      include: {
        incomingPayments: true,
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
        ...requestData,
        amount: requestData.amount ? requestData.amount.toString() : null,
        incomingPayments: requestData.incomingPayments.map(p => ({
          ...p,
          amount: p.amount.toString(),
        })),
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch request'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request)

    const id = parseInt(params.id)
    const body = await request.json()

    const updateData: any = {}
    if (body.status) updateData.status = body.status
    if (body.statusDetail) updateData.statusDetail = body.statusDetail
    if (body.processedAt !== undefined) {
      updateData.processedAt = body.processedAt ? new Date(body.processedAt) : null
    }

    if (body.status && ['completed', 'rejected', 'approved'].includes(body.status)) {
      updateData.processedAt = new Date()
    }

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(
      createApiResponse({
        ...updatedRequest,
        amount: updatedRequest.amount ? updatedRequest.amount.toString() : null,
      }),
      undefined,
      'Request updated successfully'
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to update request'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

