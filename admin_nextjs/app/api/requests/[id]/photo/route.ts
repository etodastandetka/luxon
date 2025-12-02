import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid request ID'),
        { status: 400 }
      )
    }
    
    const requestData = await prisma.request.findUnique({
      where: { id },
      select: {
        photoFileUrl: true,
      },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      createApiResponse({
        photoFileUrl: requestData.photoFileUrl,
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to fetch photo'),
      { status: 500 }
    )
  }
}

