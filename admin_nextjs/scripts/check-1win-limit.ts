/**
 * Скрипт для получения лимита кассы 1win
 * Делает депозит на большую сумму и парсит ошибку для получения баланса и лимита
 */

import { prisma } from '../lib/prisma'

async function check1winLimit() {
  try {
    console.log('🔍 Checking 1win cash limit...')
    
    // Получаем конфигурацию 1win из БД
    const setting = await prisma.botConfiguration.findFirst({
      where: { key: '1win_api_config' },
    })

    let apiKey: string | undefined
    if (setting) {
      const config = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
      apiKey = config.api_key
    }

    if (!apiKey) {
      apiKey = process.env.ONEWIN_API_KEY || process.env['1WIN_API_KEY'] || ''
    }

    if (!apiKey || apiKey.trim() === '') {
      console.error('❌ 1win API key not found. Please configure 1win_api_config in database or set ONEWIN_API_KEY environment variable.')
      process.exit(1)
    }

    console.log('✅ 1win API key found:', apiKey.substring(0, 20) + '...')

    // Тестовый ID и большая сумма для получения ошибки с лимитом
    const testUserId = 306751296
    const testAmount = 500000

    console.log(`📤 Making deposit request to 1win API:`)
    console.log(`  - User ID: ${testUserId}`)
    console.log(`  - Amount: ${testAmount}`)
    console.log(`  - URL: https://api.1win.win/v1/client/deposit`)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Согласно документации: заголовок x-api-key (строчными)
    headers['x-api-key'] = apiKey.trim()
    
    const response = await fetch('https://api.1win.win/v1/client/deposit', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: testUserId,
        amount: testAmount,
      }),
    })

    const responseText = await response.text()
    console.log(`📥 Response status: ${response.status}`)
    console.log(`📥 Response body:`, responseText)

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error('❌ Failed to parse response:', responseText)
      process.exit(1)
    }

    // Ожидаем ошибку с информацией о лимите
    if (response.ok) {
      console.warn('⚠️ Deposit succeeded unexpectedly. This should not happen with such a large amount.')
      console.log('Response data:', data)
      process.exit(0)
    }

    // Парсим ошибку для получения баланса и лимита
    if (data.errorCode === 'CASH07' || data.errorMessage) {
      const errorMessage = data.errorMessage || data.message || ''
      console.log('📋 Error message:', errorMessage)

      // Парсим формат: "Cash limit exceeded: 22236.57 >= 5000000"
      // Или другие возможные форматы
      const patterns = [
        /Cash limit exceeded:\s*([\d.]+)\s*>=\s*([\d.]+)/i,
        /limit exceeded:\s*([\d.]+)\s*>=\s*([\d.]+)/i,
        /([\d.]+)\s*>=\s*([\d.]+)/,
        /balance:\s*([\d.]+).*limit:\s*([\d.]+)/i,
      ]

      let balance: number | null = null
      let limit: number | null = null

      for (const pattern of patterns) {
        const match = errorMessage.match(pattern)
        if (match && match.length >= 3) {
          balance = parseFloat(match[1])
          limit = parseFloat(match[2])
          console.log(`✅ Parsed from error message:`)
          console.log(`  - Balance: ${balance}`)
          console.log(`  - Limit: ${limit}`)
          break
        }
      }

      if (balance !== null && limit !== null) {
        console.log('\n✅ 1win Cash Limit Information:')
        console.log(`  Current Balance: ${balance.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
        console.log(`  Cash Limit: ${limit.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
        console.log(`  Available: ${(limit - balance).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
        
        return {
          success: true,
          balance,
          limit,
          available: limit - balance,
          errorCode: data.errorCode,
          errorMessage: data.errorMessage,
        }
      } else {
        console.error('❌ Could not parse balance and limit from error message:', errorMessage)
        console.log('Full error data:', data)
        process.exit(1)
      }
    } else {
      console.error('❌ Unexpected error format:', data)
      process.exit(1)
    }
  } catch (error: any) {
    console.error('❌ Error checking 1win limit:', error)
    console.error('Error details:', error.message, error.stack)
    process.exit(1)
  }
}

// Запускаем скрипт
check1winLimit()
  .then((result) => {
    if (result) {
      console.log('\n✅ Script completed successfully')
    }
    return prisma.$disconnect()
  })
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    prisma.$disconnect().finally(() => {
      process.exit(1)
    })
  })

