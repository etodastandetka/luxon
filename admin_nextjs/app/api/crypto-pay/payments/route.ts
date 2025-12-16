import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    const where: any = {}
    if (status) {
      where.status = status
    }

    const payments = await prisma.cryptoPayment.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset,
      include: {
        request: {
          select: {
            id: true,
            bookmaker: true,
            amount: true,
            status: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: payments.map(p => ({
        id: p.id,
        invoice_id: p.invoice_id,
        hash: p.hash,
        amount: p.amount.toString(),
        asset: p.asset,
        currency_type: p.currency_type,
        status: p.status,
        paid_at: p.paid_at?.toISOString(),
        request_id: p.request_id,
        telegram_user_id: p.telegram_user_id,
        fee_amount: p.fee_amount?.toString(),
        fee_asset: p.fee_asset,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        request: p.request
      }))
    })
  } catch (error: any) {
    console.error('Error fetching crypto payments:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

