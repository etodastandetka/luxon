import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const banners = await prisma.banner.findMany({
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

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { image_url, video_url, link, is_active, order } = body

    // Валидация
    if (!image_url && !video_url) {
      return NextResponse.json(
        { success: false, error: 'Either image_url or video_url is required' },
        { status: 400 }
      )
    }

    const banner = await prisma.banner.create({
      data: {
        image_url: image_url || null,
        video_url: video_url || null,
        link: link || null,
        is_active: is_active !== undefined ? is_active : true,
        order: order || 0
      }
    })

    return NextResponse.json({
      success: true,
      data: banner
    })
  } catch (error: any) {
    console.error('Error creating banner:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

