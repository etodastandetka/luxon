import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { requireAuth } from '../../../../../../lib/api-helpers'
import { sendTelegramGroupMessage } from '../../../../../../lib/telegram-group'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request)
    
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
    const { depositToCasino } = await import('../../../../../../lib/deposit-balance')
    
    try {
      await depositToCasino(
        withdrawalRequest.bookmaker,
        withdrawalRequest.bookmakerAccountId,
        parseFloat(withdrawalRequest.amount.toString()),
        undefined // Для referral withdrawal не передаем requestId, так как это другая таблица
      )
      
      // Обновляем статус заявки
      const updatedRequest = await prisma.referralWithdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: 'completed',
          processedAt: new Date(),
          updatedAt: new Date()
        }
      })
      
      // Отправляем уведомление в группу о завершении вывода
      const amountStr = parseFloat(updatedRequest.amount.toString()).toFixed(2)
      const usernameStr = updatedRequest.username || updatedRequest.firstName || 'Пользователь'
      
      const groupMessage = `✅ <b>Вывод обработан</b>\n\n` +
        `👤 Пользователь: ${usernameStr}\n` +
        `💰 Сумма: ${amountStr} ${updatedRequest.currency}\n` +
        `🎰 Казино: ${updatedRequest.bookmaker}\n` +
        `📋 ID заявки: #${requestId}\n\n` +
        `Статус: успешно пополнен`
      
      sendTelegramGroupMessage(groupMessage).catch(err => {
        console.error('Failed to send withdrawal completion notification to group:', err)
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

