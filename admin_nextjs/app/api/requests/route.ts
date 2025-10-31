import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // deposit or withdraw
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: any = {}
    if (type) where.requestType = type
    if (status) where.status = status

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.request.count({ where }),
    ])

    return NextResponse.json(
      createApiResponse({
        requests: requests.map(r => ({
          ...r,
          amount: r.amount ? r.amount.toString() : null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch requests'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request)

    const body = await request.json()
    const {
      userId,
      username,
      firstName,
      lastName,
      bookmaker,
      accountId,
      amount,
      requestType,
      bank,
      phone,
    } = body

    if (!userId || !requestType || !amount) {
      return NextResponse.json(
        createApiResponse(null, 'Missing required fields'),
        { status: 400 }
      )
    }

    const newRequest = await prisma.request.create({
      data: {
        userId: BigInt(userId),
        username,
        firstName,
        lastName,
        bookmaker,
        accountId,
        amount: parseFloat(amount),
        requestType,
        bank,
        phone,
        status: 'pending',
      },
    })

    return NextResponse.json(
      createApiResponse({
        ...newRequest,
        amount: newRequest.amount ? newRequest.amount.toString() : null,
      }),
      undefined,
      'Request created successfully'
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to create request'),
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

