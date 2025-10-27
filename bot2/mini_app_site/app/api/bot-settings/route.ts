import { NextRequest, NextResponse } from 'next/server'

const DJANGO_API_URL = process.env.DJANGO_API_URL || 'http://127.0.0.1:8081'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Next.js API: Получен запрос на загрузку настроек бота')
    
    // Проксируем запрос к Django API
    const response = await fetch(`${DJANGO_API_URL}/api/get-bot-control/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Добавляем таймаут
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      console.error('❌ Django API error:', response.status)
      
      // Возвращаем настройки по умолчанию при ошибке
      return NextResponse.json({
        success: true,
        data: {
          deposits_enabled: true,
          withdrawals_enabled: true,
          enabled_deposit_banks: ['DemirBank', 'O!bank', 'Balance.kg', 'Bakai', 'MegaPay', 'MBank']
        }
      })
    }
    
    // Проверяем Content-Type перед парсингом JSON
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error('❌ Django API returned non-JSON response:', contentType)
      
      // Возвращаем настройки по умолчанию
      return NextResponse.json({
        success: true,
        data: {
          deposits_enabled: true,
          withdrawals_enabled: true,
          enabled_deposit_banks: ['DemirBank', 'O!bank', 'Balance.kg', 'Bakai', 'MegaPay', 'MBank']
        }
      })
    }
    
    const data = await response.json()
    console.log('✅ Next.js API: Настройки бота загружены успешно')
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('❌ Next.js API error:', error)
    
    // Возвращаем настройки по умолчанию при ошибке
    return NextResponse.json({
      success: true,
      data: {
        deposits_enabled: true,
        withdrawals_enabled: true,
        enabled_deposit_banks: ['DemirBank', 'O!bank', 'Balance.kg', 'Bakai', 'MegaPay', 'MBank']
      }
    })
  }
}

// Делаем роут динамическим, чтобы не пытаться его рендерить во время сборки
export const dynamic = 'force-dynamic'

