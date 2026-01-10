/**
 * Парсеры для email уведомлений от банков
 * Поддерживаются: Demirbank, Optima, MBank, MegaPay, Bakai
 * Поддерживает русский и кыргызский языки
 */

export interface ParsedEmail {
  amount: number
  isoDatetime: string | null
  bank: string
}

/**
 * Нормализует строку суммы для парсинга
 * Обрабатывает различные форматы чисел:
 * - Пробелы как разделители тысяч: "1 240.06" -> "1240.06"
 * - Запятые как разделители тысяч: "1,240.06" -> "1240.06"
 * - Запятые как десятичный разделитель: "100,50" -> "100.50"
 * - Точки как десятичный разделитель: "100.36" -> "100.36"
 */
function normalizeAmountString(amountStr: string): string {
  if (!amountStr) return ''
  
  // Убираем все пробелы (разделители тысяч)
  let normalized = amountStr.trim().replace(/\s+/g, '')
  
  // Если есть и запятая, и точка: запятая = разделитель тысяч, точка = десятичный разделитель
  // Пример: "1,240.06" -> "1240.06"
  if (normalized.includes(',') && normalized.includes('.')) {
    // Убираем запятые (разделители тысяч), оставляем точку (десятичный разделитель)
    normalized = normalized.replace(/,/g, '')
    return normalized
  }
  
  // Если только запятая: определяем, разделитель тысяч или десятичный разделитель
  if (normalized.includes(',')) {
    const parts = normalized.split(',')
    if (parts.length === 2) {
      const afterComma = parts[1]
      if (afterComma.length <= 2) {
        // Десятичный разделитель: "100,50" -> "100.50"
        return parts[0] + '.' + afterComma
      } else {
        // Разделитель тысяч: "1,240" -> "1240"
        return parts.join('')
      }
    } else {
      // Несколько запятых - все разделители тысяч: "1,240,000" -> "1240000"
      return normalized.replace(/,/g, '')
    }
  }
  
  // Если только точка - в KGS это обычно десятичный разделитель
  // "100.36" остается "100.36"
  // Если несколько точек - оставляем как есть (редкий случай)
  
  return normalized
}

// Улучшенные регулярные выражения для сумм:
// Поддерживает русский: "на сумму 100.36 KGS"
// Поддерживает кыргызский: "100.36 KGS суммасында"
// Поддерживает числа с пробелами как разделителями тысяч: "1 000", "10 000", "100 000"
// Поддерживает числа без пробелов: "1000", "10000", "100000"
// Поддерживает десятичные дроби: "1 000.50", "10,000.50", "1,240.06", "100.36"
// Поддерживает запятые как разделители тысяч: "1,240.06", "10,000.50", "100,000.00"
// Поддерживает числа с запятой как десятичным разделителем: "100,36"

// Русский вариант: "на сумму 100.36 KGS"
const AMOUNT_RE_RU = /на\s+сумму\s+([0-9]{1,3}(?:[,]\s*[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]{1,3}(?:\s+[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)\s*(KGS|сом|сомов)?/i

// Кыргызский вариант: "100.36 KGS суммасында" (число перед KGS, потом "суммасында")
// Паттерн: число + KGS/сом + суммасында
const AMOUNT_RE_KG = /([0-9]{1,3}(?:[,]\s*[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]{1,3}(?:\s+[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)\s*(KGS|сом|сомов)\s+суммасында/i

const DATETIME_RE = /(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/

/**
 * Парсинг email от Demirbank
 * Поддерживает русский: "Вам поступил перевод с помощью QR-платежа на сумму 100.53 KGS от 22.09.2025 22:13:24."
 * Поддерживает кыргызский: "100.36 KGS суммасында которуу келип түштү. 07.12.2025 10:14:42"
 * ВАЖНО: Обрабатывает только ВХОДЯЩИЕ переводы, пропускает исходящие
 */
export function parseDemirbankEmail(text: string): ParsedEmail | null {
  if (!text) return null

  // ВАЖНО: Проверяем, что это ВХОДЯЩИЙ перевод, а не исходящий
  // Исходящие переводы содержат различные варианты:
  // - "Вы осуществили перевод" 
  // - "осуществили перевод"
  // - "Важно! Банк никогда не отправляет электронные письма" (характерная фраза для уведомлений о переводах)
  // - "Уважаемый(ая)" в начале + информация о переводе
  // Входящие переводы содержат: "Вам поступил перевод" или "поступил перевод" или "которуу келип түштү"
  const isOutgoingPatterns = [
    /(?:Вы\s+)?осуществили\s+перевод/i,
    /осуществили\s+перевод/i,
    /Важно!\s*Банк\s+никогда\s+не\s+отправляет\s+электронные\s+письма/i,
    /Уважаемый(?:\(ая\))?\s+\S+.*(?:осуществили|перевод|QR-платежа)/i,
    /С\s+уважением.*ЗАО\s+"Демир\s+Кыргыз/i,
  ]
  
  const isOutgoing = isOutgoingPatterns.some(pattern => pattern.test(text))
  const isIncoming = /(?:Вам\s+)?поступил\s+перевод|поступил\s+перевод|которуу\s+келип\s+түштү/i.test(text)
  
  // Если это исходящий перевод - пропускаем
  if (isOutgoing && !isIncoming) {
    console.log('⏭️ Skipping outgoing transfer email (not processing)')
    console.log('   Email contains outgoing transfer notification, marking as read')
    // Возвращаем специальный объект, чтобы watcher знал, что нужно пометить как прочитанное
    return { amount: 0, isoDatetime: null, bank: 'demirbank', _skip: true } as any
  }
  
  // Если не можем определить тип - пропускаем для безопасности
  if (!isIncoming && !isOutgoing) {
    console.log('⚠️ Cannot determine transfer direction, skipping for safety')
    return null
  }

  // Пробуем сначала русский вариант, потом кыргызский
  let amountMatch = text.match(AMOUNT_RE_RU)
  if (!amountMatch) {
    amountMatch = text.match(AMOUNT_RE_KG)
  }
  
  if (!amountMatch) return null

  // Правильно обрабатываем сумму с учетом запятых как разделителей тысяч
  let amountStr = normalizeAmountString(amountMatch[1])
  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0) {
    console.error(`❌ [Email Parser] Failed to parse amount: "${amountMatch[1]}" -> "${amountStr}" -> ${amount}`)
    return null
  }
  
  // Округляем до 2 знаков после запятой для точности
  const roundedAmount = Math.round(amount * 100) / 100
  
  console.log(`✅ [Email Parser] Parsed amount: "${amountMatch[1]}" -> "${amountStr}" -> ${amount} -> ${roundedAmount}`)

  const datetimeMatch = text.match(DATETIME_RE)
  let isoDatetime: string | null = null
  if (datetimeMatch) {
    const [, date, time] = datetimeMatch
    const [dd, mm, yyyy] = date.split('.')
    // ВАЖНО: Добавляем часовой пояс UTC+6 (Кыргызстан) для правильной интерпретации времени
    // Email от банка содержит время в часовом поясе Кыргызстана (UTC+6)
    // Преобразуем в UTC для корректного сравнения с временем заявки
    const localDatetime = `${yyyy}-${mm}-${dd}T${time}+06:00`
    // Создаем Date объект и конвертируем в UTC ISO строку
    const dateObj = new Date(localDatetime)
    isoDatetime = dateObj.toISOString()
    console.log(`🕐 [Email Parser] Parsed datetime: "${date} ${time}" (local UTC+6) -> ${isoDatetime} (UTC)`)
  }

  return {
    amount: roundedAmount,
    isoDatetime,
    bank: 'demirbank',
  }
}

/**
 * Универсальный парсер для других банков (Optima, MBank, MegaPay, Bakai)
 */
function parseGenericAmountDateTime(text: string): ParsedEmail | null {
  if (!text) return null

  // Пробуем русский вариант, потом кыргызский, потом fallback
  let amountMatch = text.match(AMOUNT_RE_RU)
  if (!amountMatch) {
    amountMatch = text.match(AMOUNT_RE_KG)
  }
  if (!amountMatch) {
    // Fallback: ищем любое число перед (сом|KGS)
    // Поддерживаем числа с пробелами: "1 000", "10 000", "100 000"
    // Поддерживаем запятые как разделители тысяч: "1,240.06"
    // Поддерживаем числа с точкой как десятичным разделителем: "100.36"
    const fallbackMatch = text.match(/([0-9]{1,3}(?:[,\s]+[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:[,\s]+[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)\s*(KGS|сом|сомов)/i)
    if (!fallbackMatch) return null
    amountMatch = fallbackMatch
  }

  // Правильно обрабатываем сумму с учетом запятых как разделителей тысяч
  let amountStr = normalizeAmountString(amountMatch[1])
  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0) {
    console.error(`❌ [Email Parser] Failed to parse amount: "${amountMatch[1]}" -> "${amountStr}" -> ${amount}`)
    return null
  }
  
  // Округляем до 2 знаков после запятой для точности
  const roundedAmount = Math.round(amount * 100) / 100
  
  console.log(`✅ [Email Parser] Parsed amount: "${amountMatch[1]}" -> "${amountStr}" -> ${amount} -> ${roundedAmount}`)

  const datetimeMatch = text.match(DATETIME_RE)
  let isoDatetime: string | null = null
  if (datetimeMatch) {
    const [, date, time] = datetimeMatch
    const [dd, mm, yyyy] = date.split('.')
    // ВАЖНО: Добавляем часовой пояс UTC+6 (Кыргызстан) для правильной интерпретации времени
    // Email от банка содержит время в часовом поясе Кыргызстана (UTC+6)
    // Преобразуем в UTC для корректного сравнения с временем заявки
    const localDatetime = `${yyyy}-${mm}-${dd}T${time}+06:00`
    // Создаем Date объект и конвертируем в UTC ISO строку
    const dateObj = new Date(localDatetime)
    isoDatetime = dateObj.toISOString()
    console.log(`🕐 [Email Parser] Parsed datetime: "${date} ${time}" (local UTC+6) -> ${isoDatetime} (UTC)`)
  }

  return {
    amount: roundedAmount,
    isoDatetime,
    bank: 'unknown',
  }
}

export function parseOptimaEmail(text: string): ParsedEmail | null {
  const result = parseGenericAmountDateTime(text)
  if (result) result.bank = 'optima'
  return result
}

export function parseMbankEmail(text: string): ParsedEmail | null {
  const result = parseGenericAmountDateTime(text)
  if (result) result.bank = 'mbank'
  return result
}

export function parseMegapayEmail(text: string): ParsedEmail | null {
  const result = parseGenericAmountDateTime(text)
  if (result) result.bank = 'megapay'
  return result
}

export function parseBakaiEmail(text: string): ParsedEmail | null {
  const result = parseGenericAmountDateTime(text)
  if (result) result.bank = 'bakai'
  return result
}

/**
 * Автоматический парсинг email по типу банка
 */
export function parseEmailByBank(text: string, bank: string): ParsedEmail | null {
  const normalizedBank = bank.toLowerCase()

  switch (normalizedBank) {
    case 'demirbank':
      return parseDemirbankEmail(text)
    case 'optima':
      return parseOptimaEmail(text)
    case 'mbank':
      return parseMbankEmail(text)
    case 'megapay':
      return parseMegapayEmail(text)
    case 'bakai':
      return parseBakaiEmail(text)
    default:
      // Пробуем все парсеры по очереди
      return (
        parseDemirbankEmail(text) ||
        parseOptimaEmail(text) ||
        parseMbankEmail(text) ||
        parseMegapayEmail(text) ||
        parseBakaiEmail(text)
      )
  }
}


