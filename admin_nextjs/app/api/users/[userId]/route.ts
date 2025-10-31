import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    requireAuth(request)

    const userId = BigInt(params.userId)

    const user = await prisma.botUser.findUnique({
      where: { userId },
      include: {
        transactions: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
        referralMade: {
          include: {
            referred: true,
          },
        },
        referralEarnings: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            transactions: true,
            referralMade: true,
            referralEarnings: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        createApiResponse(null, 'User not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      createApiResponse({
        ...user,
        userId: user.userId.toString(),
        transactions: user.transactions.map(t => ({
          ...t,
          amount: t.amount.toString(),
        })),
        referralEarnings: user.referralEarnings.map(e => ({
          ...e,
          amount: e.amount.toString(),
          commissionAmount: e.commissionAmount.toString(),
        })),
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch user'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

