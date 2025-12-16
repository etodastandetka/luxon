import { NextRequest, NextResponse } from 'next/server'

// В продакшене всегда используем локальный адрес админки (они на одном сервере)
const ADMIN_API_URL = process.env.ADMIN_API_URL || (process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:3001' : 'http://localhost:3001')

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Next.js API: Получен запрос на загрузку видео инструкций')
    
    // Во время сборки (build time) не делаем fetch, возвращаем дефолтные значения
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({
        success: true,
        data: {
          deposit_video_url: 'https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view',
          withdraw_video_url: 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view',
        }
      })
    }
    
    // Проксируем запрос к админ-панели API
    const response = await fetch(`${ADMIN_API_URL}/api/public/video-instructions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Добавляем таймаут
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      console.error('❌ Admin API error:', response.status)
      
      // Возвращаем значения по умолчанию при ошибке
      return NextResponse.json({
        success: true,
        data: {
          deposit_video_url: 'https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view',
          withdraw_video_url: 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view',
        }
      })
    }
    
    // Проверяем Content-Type перед парсингом JSON
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error('❌ Admin API returned non-JSON response:', contentType)
      
      // Возвращаем значения по умолчанию
      return NextResponse.json({
        success: true,
        data: {
          deposit_video_url: 'https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view',
          withdraw_video_url: 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view',
        }
      })
    }
    
    const data = await response.json()
    console.log('✅ Next.js API: Видео инструкции загружены успешно')
    
    return NextResponse.json(data)
    
  } catch (error: any) {
    console.error('❌ Next.js API error:', error)
    
    // Возвращаем значения по умолчанию при любой ошибке
    return NextResponse.json({
      success: true,
      data: {
        deposit_video_url: 'https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view?usp=drive_link',
        withdraw_video_url: 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view?usp=drive_link',
      }
    })
  }
}

