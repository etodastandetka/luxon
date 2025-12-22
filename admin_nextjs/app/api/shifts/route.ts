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

    // Проверяем, существует ли модель DailyShift в Prisma Client
    let shifts: any[] = []
    try {
      shifts = await prisma.dailyShift.findMany({
        where,
        orderBy: {
          shiftDate: 'desc',
        },
      })
    } catch (dbError: any) {
      // Если таблица не существует, возвращаем пустой массив
      if (dbError.message?.includes('does not exist') || 
          dbError.message?.includes('Unknown model') ||
          dbError.code === 'P2021') {
        console.warn('⚠️ [Shifts API] DailyShift table does not exist yet. Run: npx prisma db push')
        return NextResponse.json(
          createApiResponse({
            shifts: [],
          })
        )
      }
      throw dbError
    }

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
    console.error('❌ [Shifts API] Get shifts error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    })
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch shifts'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

