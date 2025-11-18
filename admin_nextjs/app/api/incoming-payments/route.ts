import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

/**
 * API endpoint для получения списка входящих платежей
 * GET /api/incoming-payments?limit=50&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const bank = searchParams.get('bank')
    const isProcessed = searchParams.get('is_processed')

    const where: any = {}
    if (bank) {
      where.bank = { contains: bank, mode: 'insensitive' }
    }
    if (isProcessed !== null) {
      where.isProcessed = isProcessed === 'true'
    }

    const [payments, total] = await Promise.all([
      prisma.incomingPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          request: {
            select: {
              id: true,
              userId: true,
              amount: true,
              status: true,
            },
          },
        },
      }),
      prisma.incomingPayment.count({ where }),
    ])

    return NextResponse.json(
      createApiResponse({
        payments: payments.map(p => ({
          id: p.id,
          amount: p.amount.toString(),
          bank: p.bank,
          paymentDate: p.paymentDate.toISOString(),
          notificationText: p.notificationText,
          requestId: p.requestId,
          isProcessed: p.isProcessed,
          createdAt: p.createdAt.toISOString(),
          request: p.request
            ? {
                id: p.request.id,
                userId: p.request.userId.toString(),
                amount: p.request.amount?.toString() || null,
                status: p.request.status,
              }
            : null,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch incoming payments'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

/**
 * API endpoint для удаления входящих платежей
 * DELETE /api/incoming-payments?all=true - удалить все
 * DELETE /api/incoming-payments?is_processed=false - удалить только необработанные
 * DELETE /api/incoming-payments?bank=demirbank - удалить по банку
 */
export async function DELETE(request: NextRequest) {
  try {
    requireAuth(request)

    const { searchParams } = new URL(request.url)
    const deleteAll = searchParams.get('all') === 'true'
    const isProcessed = searchParams.get('is_processed')
    const bank = searchParams.get('bank')

    const where: any = {}
    
    if (deleteAll) {
      // Удаляем все поступления
      where.id = { gt: 0 } // Все записи
    } else {
      // Фильтруем по параметрам
      if (isProcessed !== null) {
        where.isProcessed = isProcessed === 'true'
      }
      if (bank) {
        where.bank = { contains: bank, mode: 'insensitive' }
      }
    }

    // Подсчитываем количество записей перед удалением
    const count = await prisma.incomingPayment.count({ where })

    if (count === 0) {
      return NextResponse.json(
        createApiResponse({ deleted: 0 }, 'No payments found to delete'),
        { status: 200 }
      )
    }

    // Удаляем записи
    const result = await prisma.incomingPayment.deleteMany({ where })

    console.log(`🗑️ Deleted ${result.count} incoming payment(s)`)

    return NextResponse.json(
      createApiResponse(
        {
          deleted: result.count,
          total: count,
        },
        `Successfully deleted ${result.count} payment(s)`
      )
    )
  } catch (error: any) {
    console.error('❌ Error deleting incoming payments:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to delete incoming payments'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

