import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!userId || !/^\d+$/.test(userId)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID'),
        { status: 400 }
      )
    }

    const userIdBigInt = BigInt(userId)

    // Получаем список рефералов пользователя
    const referrals = await prisma.botReferral.findMany({
      where: {
        referrerId: userIdBigInt,
      },
      include: {
        referred: {
          select: {
            userId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Получаем статистику транзакций для каждого реферала
    const referralsWithStats = await Promise.all(
      referrals.map(async (ref) => {
        const referredId = ref.referredId.toString()

        // Получаем успешные транзакции реферала
        const transactions = await prisma.request.findMany({
          where: {
            userId: ref.referredId,
            status: {
              in: ['completed', 'approved', 'auto_completed', 'autodeposit_success'],
            },
          },
          select: {
            requestType: true,
            amount: true,
          },
        })

        const deposits = transactions.filter((t) => t.requestType === 'deposit')
        const withdrawals = transactions.filter((t) => t.requestType === 'withdraw')

        const totalDeposits = deposits.reduce((sum, t) => sum + parseFloat(t.amount?.toString() || '0'), 0)
        const totalWithdrawals = withdrawals.reduce((sum, t) => sum + parseFloat(t.amount?.toString() || '0'), 0)
        const totalAmount = totalDeposits + totalWithdrawals

        const user = ref.referred
        const displayName = user?.username
          ? `@${user.username}`
          : user?.firstName
            ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
            : `Игрок #${referredId}`

        return {
          userId: referredId,
          username: user?.username || null,
          firstName: user?.firstName || null,
          lastName: user?.lastName || null,
          displayName,
          totalDeposits,
          totalWithdrawals,
          totalAmount,
          depositCount: deposits.length,
          withdrawalCount: withdrawals.length,
          createdAt: ref.createdAt.toISOString(),
        }
      })
    )

    // Сортируем по общей сумме
    referralsWithStats.sort((a, b) => b.totalAmount - a.totalAmount)

    const response = NextResponse.json(createApiResponse({ referrals: referralsWithStats }))
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

    return response
  } catch (error: any) {
    console.error('User referrals error:', error)
    const errorResponse = NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch user referrals'),
      { status: 500 }
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

