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
    
    // Пробуем несколько вариантов URL для получения видео
    // Сначала пробуем view (для просмотра), потом download
    const driveUrls = [
      `https://drive.google.com/uc?export=view&id=${fileId}`,
      `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
    ]
    
    // Проксируем запрос к Google Drive с правильными заголовками
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://drive.google.com/',
    }
    
    // Добавляем Range заголовок только если он есть в запросе
    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      headers['Range'] = rangeHeader
    }
    
    let response: Response | null = null
    let lastError: Error | null = null
    
    // Пробуем каждый URL по очереди
    for (const driveUrl of driveUrls) {
      try {
        response = await fetch(driveUrl, {
          method: 'GET',
          headers,
          redirect: 'follow',
        })
        
        // Проверяем, что получили видео (не HTML страницу)
        const contentType = response.headers.get('content-type') || ''
        if (response.ok && (contentType.startsWith('video/') || contentType.includes('octet-stream'))) {
          break
        }
        
        // Если получили HTML, пробуем следующий URL
        if (contentType.includes('text/html')) {
          response = null
          continue
        }
      } catch (error) {
        lastError = error as Error
        response = null
        continue
      }
    }
    
    if (!response || !response.ok) {
      console.error('Google Drive error:', response?.status, response?.statusText, lastError)
      return NextResponse.json(
        { error: 'Failed to fetch video' },
        { status: response?.status || 500 }
      )
    }
    
    // Получаем тип контента из ответа Google Drive
    const contentType = response.headers.get('content-type') || 'video/mp4'
    const contentLength = response.headers.get('content-length')
    const acceptRanges = response.headers.get('accept-ranges')
    const contentRange = response.headers.get('content-range')
    
    // Для больших файлов используем streaming
    // Если есть Range запрос, обрабатываем его
    if (rangeHeader) {
      const stream = response.body
      if (!stream) {
        return NextResponse.json(
          { error: 'No stream available' },
          { status: 500 }
        )
      }
      
      return new NextResponse(stream, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Content-Length': contentLength || '',
          'Accept-Ranges': acceptRanges || 'bytes',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
          ...(contentRange && { 'Content-Range': contentRange }),
        },
      })
    }
    
    // Получаем тело ответа для небольших файлов
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
    
    // Пробуем несколько вариантов URL
    const driveUrls = [
      `https://drive.google.com/uc?export=view&id=${fileId}`,
      `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    ]
    
    let response: Response | null = null
    
    for (const driveUrl of driveUrls) {
      try {
        response = await fetch(driveUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://drive.google.com/',
          },
          redirect: 'follow',
        })
        
        if (response.ok) {
          break
        }
      } catch (error) {
        continue
      }
    }
    
    if (!response) {
      return new NextResponse(null, { status: 500 })
    }
    
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

