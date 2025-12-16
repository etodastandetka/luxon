import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/api-helpers'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const id = parseInt(params.id)
    const body = await request.json()
    const { image_url, video_url, link, is_active, order } = body

    const updateData: any = {}

    if (image_url !== undefined) updateData.image_url = image_url || null
    if (video_url !== undefined) updateData.video_url = video_url || null
    if (link !== undefined) updateData.link = link || null
    if (is_active !== undefined) updateData.is_active = is_active
    if (order !== undefined) updateData.order = order

    const banner = await prisma.banner.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: banner
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Banner not found' },
        { status: 404 }
      )
    }
    console.error('Error updating banner:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const id = parseInt(params.id)

    await prisma.banner.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Banner not found' },
        { status: 404 }
      )
    }
    console.error('Error deleting banner:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

