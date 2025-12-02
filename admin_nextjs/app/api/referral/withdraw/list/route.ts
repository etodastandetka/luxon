import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    
    const where: any = {}
    if (status) {
      where.status = status
    }
    
    const withdrawalRequests = await prisma.referralWithdrawalRequest.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    const formatted = withdrawalRequests.map(req => ({
      id: req.id,
      userId: req.userId.toString(),
      username: req.username,
      firstName: req.firstName,
      lastName: req.lastName,
      phoneNumber: req.phoneNumber,
      amount: parseFloat(req.amount.toString()),
      currency: req.currency,
      bookmaker: req.bookmaker,
      bookmakerAccountId: req.bookmakerAccountId,
      paymentMethod: req.paymentMethod,
      walletDetails: req.walletDetails,
      status: req.status,
      adminComment: req.adminComment,
      createdAt: req.createdAt.toISOString(),
      updatedAt: req.updatedAt.toISOString(),
      processedAt: req.processedAt?.toISOString() || null
    }))
    
    return NextResponse.json({
      success: true,
      requests: formatted
    })
    
  } catch (error: any) {
    console.error('Referral withdrawal list error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch withdrawal requests'
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

