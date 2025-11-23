/**
 * Парсеры для email уведомлений от банков
 * Поддерживаются: Demirbank, Optima, MBank, MegaPay, Bakai
 */

export interface ParsedEmail {
  amount: number
  isoDatetime: string | null
  bank: string
}

/**
 * Нормализует строку суммы для парсинга
 * Обрабатывает:
 * - Пробелы как разделители тысяч: "1 240.06" -> "1240.06"
 * - Запятые как разделители тысяч: "1,240.06" -> "1240.06"
 * - Запятые как десятичный разделитель: "100,50" -> "100.50"
 * - Точки как десятичный разделитель: "100.50" -> "100.50"
 */
function normalizeAmountString(amountStr: string): string {
  // Убираем все пробелы (разделители тысяч)
  let normalized = amountStr.replace(/\s+/g, '')
  
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
    // Если после запятой 1-2 цифры - это десятичный разделитель
    // Если после запятой 3+ цифры - это разделитель тысяч
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
  
  // Если только точка или без разделителей - возвращаем как есть
  return normalized
}

// Улучшенное регулярное выражение для сумм:
// Поддерживает числа с пробелами как разделителями тысяч: "1 000", "10 000", "100 000"
// Поддерживает числа без пробелов: "1000", "10000", "100000"
// Поддерживает десятичные дроби: "1 000.50", "10,000.50", "1,240.06"
// Поддерживает запятые как разделители тысяч: "1,240.06", "10,000.50", "100,000.00"
const AMOUNT_RE = /на\s+сумму\s+([0-9]{1,3}(?:[,]\s*[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]{1,3}(?:\s+[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)\s*(KGS|сом|сомов)?/i
const DATETIME_RE = /(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/

/**
 * Парсинг email от Demirbank
 * Пример: "Вам поступил перевод с помощью QR-платежа на сумму 100.53 KGS от 22.09.2025 22:13:24."
 */
export function parseDemirbankEmail(text: string): ParsedEmail | null {
  if (!text) return null

  const amountMatch = text.match(AMOUNT_RE)
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
    isoDatetime = `${yyyy}-${mm}-${dd}T${time}`
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

  let amountMatch = text.match(AMOUNT_RE)
  if (!amountMatch) {
    // Fallback: ищем любое число перед (сом|KGS)
    // Поддерживаем числа с пробелами: "1 000", "10 000", "100 000"
    // Поддерживаем запятые как разделители тысяч: "1,240.06"
    const fallbackMatch = text.match(/([0-9]{1,3}(?:[,\s]+[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:[,\s]+[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)\s*(KGS|сом|сомов)/i)
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
    isoDatetime = `${yyyy}-${mm}-${dd}T${time}`
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


