import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

/**
 * API для проверки, был ли уже использован код вывода
 * GET /api/withdraw-check-code?code=XXX&playerId=XXX&bookmaker=XXX
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const playerId = searchParams.get('playerId')
    const bookmaker = searchParams.get('bookmaker')

    if (!code || !playerId || !bookmaker) {
      return NextResponse.json(
        createApiResponse(null, 'Missing required parameters: code, playerId, bookmaker'),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Проверяем, был ли уже использован этот код
    const existingRequest = await prisma.request.findFirst({
      where: {
        withdrawalCode: code.trim(),
        accountId: playerId.trim(),
        bookmaker: bookmaker.toLowerCase().trim(),
        requestType: 'withdraw',
        status: {
          in: ['pending', 'completed', 'auto_completed']
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    })

    if (existingRequest) {
      return NextResponse.json(
        createApiResponse(
          {
            exists: true,
            requestId: existingRequest.id,
            status: existingRequest.status,
            createdAt: existingRequest.createdAt.toISOString()
          },
          'This withdrawal code has already been used'
        ),
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    return NextResponse.json(
      createApiResponse(
        {
          exists: false
        },
        'Code is available'
      ),
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  } catch (error: any) {
    console.error('❌ Error checking withdrawal code:', error)
    return NextResponse.json(
      createApiResponse(null, `Error: ${error.message}`),
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }
}

export const dynamic = 'force-dynamic'

