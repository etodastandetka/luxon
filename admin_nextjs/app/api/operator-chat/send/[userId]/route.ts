import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createApiResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const saveLocalFile = async (upload: File, mime?: string): Promise<{ url: string; type: string }> => {
  const uploadDir = path.join(process.cwd(), 'tmp', 'chat_uploads')
  await fs.promises.mkdir(uploadDir, { recursive: true })
  const ext = upload.name.includes('.') ? upload.name.substring(upload.name.lastIndexOf('.')) : ''
  const fileId = `${Date.now()}-${randomUUID()}${ext}`
  const dest = path.join(uploadDir, fileId)
  const arrayBuffer = await upload.arrayBuffer()
  await fs.promises.writeFile(dest, Buffer.from(arrayBuffer))
  const kind = mime?.startsWith('image/')
    ? 'photo'
    : mime?.startsWith('video/')
    ? 'video'
    : mime?.startsWith('audio/')
    ? 'audio'
    : 'document'
  return { url: `/api/chat/file/${fileId}`, type: kind }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    requireAuth(request)

    let userId: bigint
    try {
      userId = BigInt(params.userId)
    } catch (e) {
      return NextResponse.json(
        createApiResponse(null, 'Invalid user ID'),
        { status: 400 }
      )
    }

    const contentType = request.headers.get('content-type') || ''
    let message: string | null = null
    let file: File | null = null
    let fileType: string | null = null
    let mediaUrl: string | null = null
    let messageType = 'text'

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      message = formData.get('message') as string | null
      file = formData.get('file') as File | null
      fileType = formData.get('fileType') as string | null

      if (!message?.trim() && !file) {
        return NextResponse.json(
          createApiResponse(null, 'Message or file is required'),
          { status: 400 }
        )
      }
    } else {
      const body = await request.json()
      message = body.message
      if (!message || !message.trim()) {
        return NextResponse.json(
          createApiResponse(null, 'Message is required'),
          { status: 400 }
        )
      }
    }

    // Bridge only: сохраняем в БД, доставка через Pyrogram бридж
    if (file) {
      const saved = await saveLocalFile(file, fileType || undefined)
      mediaUrl = saved.url
      messageType = saved.type
    }

    const saved = await prisma.operatorMessage.create({
      data: {
        userId,
        messageText: message,
        messageType,
        direction: 'out',
        telegramMessageId: null,
        mediaUrl,
      },
    })

    return NextResponse.json(
      createApiResponse({
        success: true,
        messageId: saved.id,
        mediaUrl,
      })
    )
  } catch (error: any) {
    console.error('Operator send message API error:', error)
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to send message'),
      { status: 500 }
    )
  }
}







