import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
import { 
  protectAPI, 
  rateLimit, 
  sanitizeInput, 
  containsSQLInjection,
  containsXSS,
  getClientIP 
} from '@/lib/security'

// Публичный эндпоинт для генерации QR кода (без авторизации)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    // 🛡️ МАКСИМАЛЬНАЯ ЗАЩИТА
    const protectionResult = protectAPI(request)
    if (protectionResult) return protectionResult

    // Rate limiting (строгий для публичного endpoint)
    const rateLimitResult = rateLimit({ 
      maxRequests: 20, 
      windowMs: 60 * 1000,
      keyGenerator: (req) => `generate_qr:${getClientIP(req)}`
    })(request)
    if (rateLimitResult) {
      const errorResponse = NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      )
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }

    const body = await request.json()
    
    // 🛡️ Валидация и очистка всех входных данных
    const sanitizedBody = sanitizeInput(body)
    
    // Проверка на SQL инъекции и XSS
    const stringFields = [sanitizedBody.playerId, sanitizedBody.bank].filter(Boolean)
    for (const field of stringFields) {
      if (typeof field === 'string') {
        if (containsSQLInjection(field) || containsXSS(field)) {
          console.warn(`🚫 Security threat from ${getClientIP(request)}`)
          const errorResponse = NextResponse.json(
            { success: false, error: 'Invalid input detected' },
            { status: 400 }
          )
          errorResponse.headers.set('Access-Control-Allow-Origin', '*')
          return errorResponse
        }
      }
    }
    
    const amount = parseFloat(String(sanitizedBody.amount || 0))
    const playerId = sanitizedBody.playerId || ''
    const bank = sanitizedBody.bank || 'demirbank'
    
    // Валидация
    if (isNaN(amount) || amount <= 0) {
      const errorResponse = NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      )
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }
    
    // Получаем активный реквизит
    let requisite = null
    let requisiteBank = null
    try {
      const activeRequisite = await prisma.botRequisite.findFirst({
        where: { isActive: true }
      })
      if (activeRequisite) {
        requisite = activeRequisite.value
        requisiteBank = activeRequisite.bank
        console.log(`✅ Using active requisite: ${activeRequisite.name || `#${activeRequisite.id}`} - Bank: ${requisiteBank || 'N/A'} - ${requisite.slice(0, 4)}****${requisite.slice(-4)}`)
      } else {
        console.error('❌ No active requisite found in database')
      }
    } catch (error) {
      console.error('Error fetching requisite:', error)
    }
    
    // Если не нашли реквизит, возвращаем ошибку на русском языке
    if (!requisite) {
      const errorResponse = NextResponse.json(
        { 
          success: false, 
          error: 'Активный кошелек не настроен.',
          message: 'Обратитесь в поддержку.'
        },
        { status: 400 }
      )
      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      return errorResponse
    }
    
    let qrHash: string
    
    // Логируем для отладки
    console.log(`🔍 Processing QR generation - RequisiteBank: ${requisiteBank || 'null'}, Amount: ${amount}`)
    
    // Если банк кошелька Bakai, используем base_hash напрямую с обновлением суммы
    // Сравниваем без учета регистра
    if (requisiteBank && requisiteBank.toUpperCase() === 'BAKAI') {
      console.log('✅ Detected BAKAI bank, using base_hash update logic')
      // Проверяем, что base_hash не содержит данные DemirBank (это было бы ошибкой)
      if (requisite.includes('qr.demirbank.kg') || requisite.toUpperCase().includes('DEMIRBANK')) {
        const errorResponse = NextResponse.json(
          { success: false, error: 'Base_hash для Bakai содержит данные DemirBank. Проверьте настройки кошелька в админке.' },
          { status: 400 }
        )
        errorResponse.headers.set('Access-Control-Allow-Origin', '*')
        return errorResponse
      }
      
      // Для Bakai base_hash может быть любым валидным QR-кодом, поэтому проверяем только наличие полей 54 и 63
      
      // Конвертируем сумму в копейки
      const amountCents = Math.round(amount * 100)
      const amountStr = amountCents.toString()
      const amountLen = amountStr.length.toString().padStart(2, '0')
      
      // Находим последнее поле 54 перед полем 63 (контрольная сумма)
      const field54Pattern = /54(\d{2})(\d+)/g
      const field54Matches: Array<{ index: number; fullMatch: string }> = []
      let match54
      while ((match54 = field54Pattern.exec(requisite)) !== null) {
        field54Matches.push({
          index: match54.index,
          fullMatch: match54[0]
        })
      }
      
      console.log(`🔍 Found ${field54Matches.length} field 54 matches in base_hash`)
      
      if (field54Matches.length === 0) {
        const errorResponse = NextResponse.json(
          { success: false, error: 'Не найдено поле 54 в base_hash для Bakai' },
          { status: 400 }
        )
        errorResponse.headers.set('Access-Control-Allow-Origin', '*')
        return errorResponse
      }
      
      // Находим индекс последнего поля 63 (контрольная сумма)
      const last63Index = requisite.lastIndexOf('6304')
      if (last63Index === -1) {
        const errorResponse = NextResponse.json(
          { success: false, error: 'Не найдено поле 63 в base_hash для Bakai' },
          { status: 400 }
        )
        errorResponse.headers.set('Access-Control-Allow-Origin', '*')
        return errorResponse
      }
      
      console.log(`🔍 Field 63 found at index ${last63Index}`)
      
      // Находим последнее поле 54 перед полем 63
      const lastField54Before63 = field54Matches
        .filter(m => m.index < last63Index)
        .sort((a, b) => b.index - a.index)[0]
      
      if (!lastField54Before63) {
        const errorResponse = NextResponse.json(
          { success: false, error: 'Не найдено поле 54 перед полем 63 в base_hash для Bakai' },
          { status: 400 }
        )
        errorResponse.headers.set('Access-Control-Allow-Origin', '*')
        return errorResponse
      }
      
      console.log(`🔍 Last field 54 before 63: "${lastField54Before63.fullMatch}" at index ${lastField54Before63.index}`)
      
      // Заменяем последнее поле 54 на новое значение
      const oldField54 = lastField54Before63.fullMatch
      const newField54 = `54${amountLen}${amountStr}`
      
      console.log(`💰 Updating field 54: "${oldField54}" -> "${newField54}" (amount: ${amount}, cents: ${amountCents})`)
      
      // Заменяем последнее вхождение поля 54 (перед полем 63)
      let updatedHash = requisite.substring(0, lastField54Before63.index) + 
                       newField54 + 
                       requisite.substring(lastField54Before63.index + oldField54.length)
      
      // Извлекаем данные до последнего объекта 63 (ID "00" - "90", исключая ID 63)
      let dataBefore63 = updatedHash.substring(0, last63Index)
      
      console.log(`🔍 Data before field 63 length: ${dataBefore63.length} chars`)
      
      // Согласно алгоритму:
      // 1. Все значения до объекта 63 преобразуются в строку (уже есть)
      // 2. Декодируем процентное кодирование (%20 -> пробел и т.д.)
      // 3. Строка переводится в массив байт с кодировкой UTF-8
      // 4. Вычисляется SHA256 хеш от массива байт
      // 5. Массив байт преобразуется в строку (hex)
      // 6. Удаляются все символы "-" если есть
      // 7. Берутся последние 4 символа
      
      // Декодируем процентное кодирование (%20 -> пробел и т.д.)
      try {
        dataBefore63 = decodeURIComponent(dataBefore63)
      } catch (e) {
        // Если декодирование не удалось, используем исходную строку
        console.warn('⚠️ Could not decode URI component, using original string')
      }
      
      // Вычисляем SHA256 от данных до объекта 63
      // createHash('sha256').update() уже работает с UTF-8 байтами по умолчанию
      const checksumFull = createHash('sha256').update(dataBefore63, 'utf8').digest('hex')
      
      // Удаляем все символы "-" если есть (хотя в hex их обычно нет)
      const checksumCleaned = checksumFull.replace(/-/g, '')
      
      // Берем последние 4 символа в верхнем регистре
      const checksum = checksumCleaned.slice(-4).toUpperCase()
      
      console.log(`🔐 SHA-256 checksum calculated: ${checksumFull.substring(0, 20)}...${checksumFull.slice(-4)} (last 4: ${checksum})`)
      
      // Заменяем последнее поле 63 (контрольная сумма) - формат: 6304 + 4 символа hex
      const newField63 = `6304${checksum}`
      qrHash = updatedHash.substring(0, last63Index) + newField63
      
      console.log(`✅ BAKAI QR hash generated successfully`)
      console.log(`   Old field 63: ${requisite.substring(last63Index, last63Index + 8)}`)
      console.log(`   New field 63: ${newField63}`)
      console.log(`   Final hash preview: ${qrHash.substring(0, 30)}...${qrHash.slice(-15)}`)
    } else {
      // Для Demir Bank используем существующую логику
      // Проверяем, что реквизит - это 16 цифр
      if (!/^\d{16}$/.test(requisite)) {
        const errorResponse = NextResponse.json(
          { success: false, error: 'Реквизит для Demir Bank должен содержать 16 цифр' },
          { status: 400 }
        )
        errorResponse.headers.set('Access-Control-Allow-Origin', '*')
        return errorResponse
      }
      
      // Конвертируем сумму в центы и форматируем
      const amountCents = Math.round(amount * 100)
      const amountStr = amountCents.toString().padStart(5, '0')
      const amountLen = amountStr.length.toString().padStart(2, '0')
      
      // Формируем TLV структуру
      const requisiteLen = requisite.length.toString().padStart(2, '0')
      
      const merchantAccountValue = (
        `0015qr.demirbank.kg` +  // Под-тег 00: домен
        `01047001` +              // Под-тег 01: короткий тип (7001)
        `10${requisiteLen}${requisite}` +  // Под-тег 10: реквизит
        `120211130212`            // Под-теги 12, 13: дополнительные поля
      )
      const merchantAccountLen = merchantAccountValue.length.toString().padStart(2, '0')
      
      // Payload БЕЗ контрольной суммы и без 6304
      const payload = (
        `000201` +  // 00 - Payload Format Indicator
        `010211` +  // 01 - Point of Initiation Method (статический QR)
        `32${merchantAccountLen}${merchantAccountValue}` +  // 32 - Merchant Account
        `52044829` +  // 52 - Merchant Category Code
        `5303417` +   // 53 - Transaction Currency
        `54${amountLen}${amountStr}` +  // 54 - Amount
        `5909DEMIRBANK`  // 59 - Merchant Name
      )
      
      // Вычисляем SHA256 контрольную сумму от payload (БЕЗ 6304)
      const checksumFull = createHash('sha256').update(payload).digest('hex')
      // Берем последние 4 символа в нижнем регистре
      const checksum = checksumFull.slice(-4).toLowerCase()
      
      // Полный QR хеш: payload + '6304' + checksum
      qrHash = payload + '6304' + checksum
    }
    
    // Создаем ссылки для всех банков
    const bankLinks: Record<string, string> = {
      'DemirBank': `https://retail.demirbank.kg/#${qrHash}`,
      'O!Money': `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
      'Balance.kg': `https://balance.kg/#${qrHash}`,
      'Bakai': `https://bakai24.app/#${qrHash}`,
      'MegaPay': `https://megapay.kg/get#${qrHash}`,
      'MBank': `https://app.mbank.kg/qr/#${qrHash}`,
      // Также добавляем варианты с нижним регистром для совместимости
      'demirbank': `https://retail.demirbank.kg/#${qrHash}`,
      'omoney': `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
      'balance': `https://balance.kg/#${qrHash}`,
      'bakai': `https://bakai24.app/#${qrHash}`,
      'megapay': `https://megapay.kg/get#${qrHash}`,
      'mbank': `https://app.mbank.kg/qr/#${qrHash}`
    }
    
    // Получаем настройки депозитов для определения включенных банков
    let enabledBanks = ['demirbank', 'omoney', 'balance', 'bakai', 'megapay', 'mbank']
    try {
      const depositConfig = await prisma.botConfiguration.findFirst({
        where: { key: { in: ['deposits', 'deposit_settings'] } }
      })
      if (depositConfig) {
        const depositSettings = typeof depositConfig.value === 'string' 
          ? JSON.parse(depositConfig.value) 
          : depositConfig.value
        if (depositSettings?.banks && Array.isArray(depositSettings.banks)) {
          enabledBanks = depositSettings.banks
        }
      }
    } catch (error) {
      console.error('Error fetching deposit settings:', error)
    }
    
    // Определяем primary_url на основе переданного bank
    const primaryBankMap: Record<string, string> = {
      'demirbank': 'DemirBank',
      'omoney': 'O!Money',
      'balance': 'Balance.kg',
      'bakai': 'Bakai',
      'megapay': 'MegaPay',
      'mbank': 'MBank'
    }
    const primaryBank = primaryBankMap[bank.toLowerCase()] || 'DemirBank'
    const primaryUrl = bankLinks[primaryBank] || bankLinks['DemirBank']
    
    console.log(`✅ QR generation successful - Primary URL: ${primaryUrl.substring(0, 50)}...`)
    console.log(`✅ Bakai URL: ${bankLinks['Bakai']?.substring(0, 50)}...`)
    
    const response = NextResponse.json({
      success: true,
      qr_hash: qrHash,
      primary_url: primaryUrl,
      all_bank_urls: bankLinks,
      settings: {
        enabled_banks: enabledBanks,
        deposits_enabled: true
      }
    })
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
    
  } catch (error: any) {
    console.error('Generate QR API error:', error)
    const errorResponse = NextResponse.json(
      { success: false, error: error.message || 'Failed to generate QR code' },
      { status: 500 }
    )
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    return errorResponse
  }
}

export const dynamic = 'force-dynamic'

