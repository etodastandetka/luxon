import { NextRequest, NextResponse } from 'next/server'

// Явно указываем, что это динамический route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fileId = searchParams.get('id')
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }
    
    // Используем прямую ссылку для скачивания видео
    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`
    
    // Проксируем запрос к Google Drive с правильными заголовками
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://drive.google.com/',
    }
    
    // Добавляем Range заголовок только если он есть в запросе
    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      headers['Range'] = rangeHeader
    }
    
    const response = await fetch(driveUrl, {
      method: 'GET',
      headers,
      // Разрешаем редиректы
      redirect: 'follow',
    })
    
    if (!response.ok) {
      console.error('Google Drive error:', response.status, response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch video' },
        { status: response.status }
      )
    }
    
    // Получаем тип контента из ответа Google Drive
    const contentType = response.headers.get('content-type') || 'video/mp4'
    const contentLength = response.headers.get('content-length')
    const acceptRanges = response.headers.get('accept-ranges')
    const contentRange = response.headers.get('content-range')
    
    // Получаем тело ответа
    const videoBuffer = await response.arrayBuffer()
    
    // Возвращаем видео с правильными заголовками
    return new NextResponse(videoBuffer, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength || videoBuffer.byteLength.toString(),
        'Accept-Ranges': acceptRanges || 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
        ...(contentRange && { 'Content-Range': contentRange }),
      },
    })
    
  } catch (error) {
    console.error('Video proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function HEAD(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fileId = searchParams.get('id')
    
    if (!fileId) {
      return new NextResponse(null, { status: 400 })
    }
    
    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`
    
    const response = await fetch(driveUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://drive.google.com/',
      },
      redirect: 'follow',
    })
    
    if (!response.ok) {
      return new NextResponse(null, { status: response.status })
    }
    
    const contentType = response.headers.get('content-type') || 'video/mp4'
    const contentLength = response.headers.get('content-length')
    const acceptRanges = response.headers.get('accept-ranges')
    
    return new NextResponse(null, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength || '0',
        'Accept-Ranges': acceptRanges || 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
      },
    })
    
  } catch (error) {
    console.error('Video proxy HEAD error:', error)
    return new NextResponse(null, { status: 500 })
  }
}

