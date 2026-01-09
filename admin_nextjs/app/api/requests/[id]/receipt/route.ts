import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse } from '@/lib/api-helpers'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// Поддержка CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// Загрузка чека для заявки
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Обработка Next.js 15+ где params может быть Promise
    const resolvedParams = params instanceof Promise ? await params : params
    const requestId = parseInt(resolvedParams.id)

    if (isNaN(requestId)) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid request ID'),
        { status: 400 }
      )
    }

    // Проверяем, существует ли заявка
    const requestData = await prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, userId: true },
    })

    if (!requestData) {
      return NextResponse.json(
        createApiResponse(null, 'Request not found'),
        { status: 404 }
      )
    }

    // Получаем файл из FormData
    const formData = await request.formData()
    const file = formData.get('receipt') as File | null

    if (!file) {
      return NextResponse.json(
        createApiResponse(null, 'No file provided'),
        { status: 400 }
      )
    }

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        createApiResponse(null, 'File must be an image'),
        { status: 400 }
      )
    }

    // Проверка размера файла (20MB - увеличили для поддержки больших фото с iPhone)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        createApiResponse(null, 'File size must be less than 20MB'),
        { status: 400 }
      )
    }

    // Сохраняем файл локально
    const uploadDir = path.join(process.cwd(), 'tmp', 'receipts')
    await fs.promises.mkdir(uploadDir, { recursive: true })

    const ext = file.name.includes('.') 
      ? file.name.substring(file.name.lastIndexOf('.')) 
      : '.jpg'
    const fileId = `${requestId}-${Date.now()}-${randomUUID()}${ext}`
    const dest = path.join(uploadDir, fileId)

    const arrayBuffer = await file.arrayBuffer()
    await fs.promises.writeFile(dest, Buffer.from(arrayBuffer))

    // URL для доступа к файлу
    const fileUrl = `/api/receipts/${fileId}`

    // Обновляем заявку с URL чека
    await prisma.request.update({
      where: { id: requestId },
      data: {
        photoFileUrl: fileUrl,
      },
    })

    console.log(`✅ Receipt uploaded for request ${requestId}: ${fileUrl}`)

    return NextResponse.json(
      createApiResponse({ url: fileUrl }, undefined, 'Receipt uploaded successfully'),
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error: any) {
    console.error('❌ Error uploading receipt:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to upload receipt'),
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}


