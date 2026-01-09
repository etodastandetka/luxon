import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Поддержка CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// Получение файла чека
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> | { fileId: string } }
) {
  try {
    // Обработка Next.js 15+ где params может быть Promise
    const resolvedParams = params instanceof Promise ? await params : params
    const fileId = resolvedParams.fileId

    if (!fileId || fileId.includes('..')) {
      return new NextResponse('Invalid file ID', { status: 400 })
    }

    // Разрешаем слэши в имени файла, но проверяем на path traversal
    const normalizedFileId = fileId.replace(/\\/g, '/')
    if (normalizedFileId.includes('../') || normalizedFileId.startsWith('/')) {
      return new NextResponse('Invalid file ID', { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), 'tmp', 'receipts')
    const filePath = path.join(uploadDir, normalizedFileId)

    // Проверяем, существует ли файл
    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 })
    }

    // Читаем файл
    const fileBuffer = await fs.promises.readFile(filePath)
    
    // Определяем MIME тип по расширению
    const ext = path.extname(fileId).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }
    const contentType = mimeTypes[ext] || 'image/jpeg'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error: any) {
    console.error('❌ Error serving receipt file:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}


