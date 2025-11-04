import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка авторизации
    const cookieStore = await cookies()
    const sessionId = cookieStore.get('session_id')?.value
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }
    
    const requestId = parseInt(params.id)
    
    if (isNaN(requestId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request ID'
      }, { status: 400 })
    }
    
    // Получаем заявку на вывод
    const withdrawalRequest = await prisma.referralWithdrawalRequest.findUnique({
      where: { id: requestId }
    })
    
    if (!withdrawalRequest) {
      return NextResponse.json({
        success: false,
        error: 'Withdrawal request not found'
      }, { status: 404 })
    }
    
    if (withdrawalRequest.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: `Request is already ${withdrawalRequest.status}`
      }, { status: 400 })
    }
    
    // Пополняем баланс в казино
    const { depositToCasino } = await import('@/lib/deposit-balance')
    
    try {
      await depositToCasino(
        withdrawalRequest.bookmaker,
        withdrawalRequest.bookmakerAccountId,
        parseFloat(withdrawalRequest.amount.toString())
      )
      
      // Обновляем статус заявки
      await prisma.referralWithdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: 'completed',
          processedAt: new Date(),
          updatedAt: new Date()
        }
      })
      
      return NextResponse.json({
        success: true,
        message: 'Вывод подтвержден и баланс пополнен'
      })
      
    } catch (casinoError: any) {
      console.error('Casino deposit error:', casinoError)
      
      // Обновляем статус на отклоненный, если не удалось пополнить
      await prisma.referralWithdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          adminComment: `Ошибка пополнения: ${casinoError.message}`,
          processedAt: new Date(),
          updatedAt: new Date()
        }
      })
      
      return NextResponse.json({
        success: false,
        error: `Ошибка пополнения баланса: ${casinoError.message}`
      }, { status: 500 })
    }
    
  } catch (error: any) {
    console.error('Referral withdrawal approve error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to approve withdrawal'
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

