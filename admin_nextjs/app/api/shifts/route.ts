import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

/**
 * Получает смены за указанный период
 */
export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    let where: any = {}

    if (startDate && endDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)

      where.shiftDate = {
        gte: start,
        lte: end,
      }
    }

    const shifts = await prisma.dailyShift.findMany({
      where,
      orderBy: {
        shiftDate: 'desc',
      },
    })

    return NextResponse.json(
      createApiResponse({
        shifts: shifts.map((shift) => ({
          id: shift.id,
          date: shift.shiftDate.toISOString().split('T')[0],
          depositsSum: shift.depositsSum.toString(),
          withdrawalsSum: shift.withdrawalsSum.toString(),
          netProfit: shift.netProfit.toString(),
          depositsCount: shift.depositsCount,
          withdrawalsCount: shift.withdrawalsCount,
          isClosed: shift.isClosed,
          closedAt: shift.closedAt?.toISOString(),
        })),
      })
    )
  } catch (error: any) {
    console.error('Get shifts error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch shifts'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

