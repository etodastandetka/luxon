import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const activeOnly = searchParams.get('active') === 'true'

    const where: any = {}
    if (activeOnly) {
      where.is_active = true
    }

    const banners = await prisma.banner.findMany({
      where,
      orderBy: { order: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: banners
    })
  } catch (error: any) {
    console.error('Error fetching banners:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

