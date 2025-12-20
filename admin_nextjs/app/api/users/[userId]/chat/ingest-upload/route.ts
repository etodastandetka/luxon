import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const saveLocalFile = async (file: File, mime?: string): Promise<{ url: string; type: string }> => {
  const uploadDir = path.join(process.cwd(), 'tmp', 'chat_uploads')
  await fs.promises.mkdir(uploadDir, { recursive: true })
  const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : ''
  const fileId = `${Date.now()}-${randomUUID()}${ext}`
  const dest = path.join(uploadDir, fileId)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.promises.writeFile(dest, buffer)
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
    let userId: bigint
    try {
      userId = BigInt(params.userId)
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const contentType = request.headers.get('content-type') || ''
    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel') || 'bot'
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'multipart/form-data required' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const messageText = (formData.get('message') as string | null) || null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      )
    }

    const saved = await saveLocalFile(file, file.type)

    let message
    try {
      message = await prisma.chatMessage.create({
        data: {
          userId,
          messageText,
          messageType: saved.type,
          direction: 'in',
          telegramMessageId: null,
          mediaUrl: saved.url,
          channel,
        },
      })
    } catch (error: any) {
      // Если колонка channel не существует (P2022), создаем без channel
      if (error.code === 'P2022' && error.meta?.column === 'chat_messages.channel') {
        console.warn('⚠️ Channel column not found, creating message without channel field')
        message = await prisma.chatMessage.create({
          data: {
            userId,
            messageText,
            messageType: saved.type,
            direction: 'in',
            telegramMessageId: null,
            mediaUrl: saved.url,
          } as any, // Type assertion to omit channel field
        })
      } else {
        throw error
      }
    }

    return NextResponse.json({
      success: true,
      messageId: message.id,
      mediaUrl: saved.url,
    })
  } catch (error: any) {
    console.error('Chat ingest-upload API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save message' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'


