import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'

// API для создания заявок из внешних источников (мини-приложение, бот и т.д.)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      userId,
      user_id,
      telegram_user_id,
      type, // deposit/withdraw
      amount,
      bookmaker,
      bank,
      phone,
      account_id,
      telegram_username,
      telegram_first_name,
      telegram_last_name,
    } = body

    // Определяем user_id
    const finalUserId = telegram_user_id || userId || user_id
    const finalAccountId = account_id || user_id || userId

    if (!finalUserId || !type || !amount) {
      return NextResponse.json(
        createApiResponse(null, 'Missing required fields: userId, type, amount'),
        { status: 400 }
      )
    }

    const newRequest = await prisma.request.create({
      data: {
        userId: BigInt(finalUserId),
        username: telegram_username,
        firstName: telegram_first_name,
        lastName: telegram_last_name,
        bookmaker,
        accountId: finalAccountId?.toString(),
        amount: parseFloat(amount),
        requestType: type,
        bank,
        phone,
        status: 'pending',
      },
    })

    return NextResponse.json(
      createApiResponse({
        id: newRequest.id,
        transactionId: newRequest.id,
        message: 'Заявка успешно создана',
      })
    )
  } catch (error: any) {
    console.error('Payment API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to create request'),
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, status_detail } = body

    if (!id || !status) {
      return NextResponse.json(
        createApiResponse(null, 'Missing required fields: id, status'),
        { status: 400 }
      )
    }

    const updateData: any = {
      status,
    }

    if (status_detail) {
      updateData.statusDetail = status_detail
    }

    if (['completed', 'rejected', 'approved'].includes(status)) {
      updateData.processedAt = new Date()
    }

    const updatedRequest = await prisma.request.update({
      where: { id: parseInt(id) },
      data: updateData,
    })

    return NextResponse.json(
      createApiResponse({
        ...updatedRequest,
        amount: updatedRequest.amount ? updatedRequest.amount.toString() : null,
      })
    )
  } catch (error: any) {
    console.error('Payment API update error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to update request'),
      { status: 500 }
    )
  }
}

