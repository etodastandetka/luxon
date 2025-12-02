import { NextRequest, NextResponse } from 'next/server'

/**
 * 🛡️ Комплексная система защиты от DDoS и атак
 */

// Rate limiting storage (в продакшене используйте Redis)
interface RateLimitEntry {
  count: number
  resetTime: number
  blocked: boolean
  blockUntil?: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Очистка старых записей каждые 5 минут
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now && (!entry.blockUntil || entry.blockUntil < now)) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Получает IP адрес из запроса (с учетом Cloudflare и прокси)
 */
export function getClientIP(request: NextRequest): string {
  // Cloudflare передает реальный IP в заголовке
  const cfIP = request.headers.get('cf-connecting-ip')
  if (cfIP) return cfIP

  // X-Forwarded-For (может содержать несколько IP)
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim())
    return ips[0] // Первый IP - это оригинальный клиент
  }

  // X-Real-IP
  const xRealIP = request.headers.get('x-real-ip')
  if (xRealIP) return xRealIP

  // Fallback
  return request.ip || 'unknown'
}

/**
 * Проверяет User-Agent на подозрительные паттерны
 */
export function isSuspiciousUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true

  // Разрешаем нормальные браузеры и приложения
  const allowedPatterns = [
    /^Mozilla\/5\.0/i, // Нормальные браузеры
    /Chrome/i,
    /Firefox/i,
    /Safari/i,
    /Edge/i,
    /Opera/i,
    /Mobile/i,
    /Android/i,
    /iPhone/i,
    /iPad/i,
    /Telegram/i, // Telegram WebApp
    /TelegramBot/i,
  ]

  // Если это нормальный браузер - пропускаем
  if (allowedPatterns.some(pattern => pattern.test(userAgent))) {
    return false
  }

  const suspiciousPatterns = [
    /^$/, // Пустой
    /^curl/i,
    /^wget/i,
    /^python/i,
    /^go-http/i,
    /^java/i,
    /^scanner/i,
    /^bot/i,
    /^crawler/i,
    /^spider/i,
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /burp/i,
    /postman/i,
    /insomnia/i,
    /httpie/i,
    /^Mozilla\/4/i, // Старые браузеры
    /^Mozilla\/5\.0 \(compatible/i, // Поддельные User-Agent
  ]

  return suspiciousPatterns.some(pattern => pattern.test(userAgent))
}

/**
 * Проверяет подозрительные паттерны в URL
 */
export function isSuspiciousURL(url: string): boolean {
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /\/etc\/passwd/i,
    /\/proc\/self/i,
    /\/admin/i,
    /\/wp-admin/i,
    /\/phpmyadmin/i,
    /\/\.env/i,
    /\/config/i,
    /\/backup/i,
    /\/\.git/i,
    /\/\.svn/i,
    /\/\.DS_Store/i,
    /\/shell/i,
    /\/cmd/i,
    /\/exec/i,
    /\/eval/i,
    /\/system/i,
    /\/phpinfo/i,
    /\/test/i,
    /\/debug/i,
    /\/api\/v1\/admin/i,
    /\/api\/v2\/admin/i,
  ]

  return suspiciousPatterns.some(pattern => pattern.test(url))
}

/**
 * Проверяет подозрительные заголовки
 */
export function hasSuspiciousHeaders(request: NextRequest): boolean {
  const suspiciousHeaders = [
    'x-forwarded-host',
    'x-original-url',
    'x-rewrite-url',
    'x-original-host',
  ]

  for (const header of suspiciousHeaders) {
    const value = request.headers.get(header)
    if (value && (value.includes('..') || value.includes('localhost') || value.includes('127.0.0.1'))) {
      return true
    }
  }

  return false
}

/**
 * Проверяет подозрительные параметры запроса
 */
export function hasSuspiciousParams(searchParams: URLSearchParams): boolean {
  const suspiciousValues = [
    /\.\./,
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /eval\(/i,
    /exec\(/i,
    /system\(/i,
    /union.*select/i,
    /select.*from/i,
    /insert.*into/i,
    /delete.*from/i,
    /drop.*table/i,
    /\/etc\/passwd/i,
    /\/proc\/self/i,
  ]

  for (const [key, value] of searchParams.entries()) {
    if (suspiciousValues.some(pattern => pattern.test(value))) {
      return true
    }
    // Проверяем длинные параметры (возможная инъекция)
    if (value.length > 1000) {
      return true
    }
  }

  return false
}

/**
 * Проверяет размер тела запроса
 */
export function validateRequestSize(contentLength: string | null, maxSize: number = 10 * 1024 * 1024): boolean {
  if (!contentLength) return true
  const size = parseInt(contentLength, 10)
  return !isNaN(size) && size <= maxSize
}

/**
 * Rate Limiter с защитой от DDoS
 */
export interface RateLimitOptions {
  windowMs?: number // Окно времени в миллисекундах (по умолчанию 1 минута)
  maxRequests?: number // Максимальное количество запросов (по умолчанию 60)
  blockDurationMs?: number // Время блокировки при превышении (по умолчанию 15 минут)
  keyGenerator?: (request: NextRequest) => string // Функция для генерации ключа
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60 * 1000, // 1 минута
    maxRequests = 60,
    blockDurationMs = 24 * 60 * 60 * 1000, // 24 часа по умолчанию
    keyGenerator = (req) => `rate_limit:${getClientIP(req)}:${req.nextUrl.pathname}`,
  } = options

  return (request: NextRequest): NextResponse | null => {
    const key = keyGenerator(request)
    const now = Date.now()
    let entry = rateLimitStore.get(key)

    // Проверяем, не заблокирован ли IP
    if (entry?.blocked && entry.blockUntil && entry.blockUntil > now) {
      const remainingBlockTime = Math.ceil((entry.blockUntil - now) / 1000)
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `IP temporarily blocked. Try again in ${remainingBlockTime} seconds.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': remainingBlockTime.toString(),
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(entry.blockUntil).toISOString(),
          },
        }
      )
    }

    // Создаем новую запись или сбрасываем счетчик
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
        blocked: false,
      }
    }

    // Увеличиваем счетчик
    entry.count++

    // Проверяем превышение лимита
    if (entry.count > maxRequests) {
      entry.blocked = true
      entry.blockUntil = now + blockDurationMs
      rateLimitStore.set(key, entry)

      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Your IP has been temporarily blocked.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(blockDurationMs / 1000).toString(),
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(entry.blockUntil).toISOString(),
          },
        }
      )
    }

    // Сохраняем обновленную запись
    rateLimitStore.set(key, entry)

    // Добавляем заголовки rate limit
    const remaining = Math.max(0, maxRequests - entry.count)
    const resetTime = Math.ceil((entry.resetTime - now) / 1000)

    // Возвращаем null, если все в порядке (продолжаем обработку)
    return null
  }
}

/**
 * Проверяет Cloudflare защиту (только для продакшена)
 */
export function validateCloudflareHeaders(request: NextRequest): boolean {
  // В продакшене проверяем наличие Cloudflare заголовков
  if (process.env.NODE_ENV === 'production') {
    const cfRay = request.headers.get('cf-ray')
    const cfCountry = request.headers.get('cf-ipcountry')
    
    // Если запрос идет через Cloudflare, должны быть эти заголовки
    // Если их нет, возможно прямой доступ к серверу (блокируем)
    if (!cfRay && !cfCountry) {
      // Разрешаем только если это внутренний запрос (localhost)
      const ip = getClientIP(request)
      return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')
    }
  }
  
  return true
}

/**
 * Валидация входных данных для защиты от инъекций
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Удаляем потенциально опасные символы
    return input
      .replace(/[<>]/g, '') // Удаляем HTML теги
      .replace(/['";\\]/g, '') // Удаляем SQL инъекции
      .trim()
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput)
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value)
    }
    return sanitized
  }
  
  return input
}

/**
 * Проверяет наличие SQL инъекций в строке
 */
export function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
    /(--|#|\/\*|\*\/|;)/,
    /(\bOR\b.*=.*=)/i,
    /(\bAND\b.*=.*=)/i,
    /('|"|`).*(\bOR\b|\bAND\b).*('|"|`)/i,
  ]
  
  return sqlPatterns.some(pattern => pattern.test(input))
}

/**
 * Проверяет наличие XSS в строке
 */
export function containsXSS(input: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /onclick=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ]
  
  return xssPatterns.some(pattern => pattern.test(input))
}

/**
 * Комплексная защита для API endpoints
 */
export function protectAPI(request: NextRequest): NextResponse | null {
  const ip = getClientIP(request)
  const url = request.nextUrl.pathname + request.nextUrl.search

  // 0. Пропускаем внутренние запросы (localhost, внутренние IP)
  const isInternalRequest = ip === '127.0.0.1' || 
                            ip === '::1' || 
                            ip === 'localhost' ||
                            ip.startsWith('192.168.') || 
                            ip.startsWith('10.') ||
                            ip.startsWith('172.16.') ||
                            ip.startsWith('172.17.') ||
                            ip.startsWith('172.18.') ||
                            ip.startsWith('172.19.') ||
                            ip.startsWith('172.20.') ||
                            ip.startsWith('172.21.') ||
                            ip.startsWith('172.22.') ||
                            ip.startsWith('172.23.') ||
                            ip.startsWith('172.24.') ||
                            ip.startsWith('172.25.') ||
                            ip.startsWith('172.26.') ||
                            ip.startsWith('172.27.') ||
                            ip.startsWith('172.28.') ||
                            ip.startsWith('172.29.') ||
                            ip.startsWith('172.30.') ||
                            ip.startsWith('172.31.')
  
  if (isInternalRequest) {
    // Для внутренних запросов пропускаем все проверки кроме базовых
    return null
  }

  // 1. Проверка блокировки IP
  if (isIPBlocked(ip)) {
    console.warn(`🚫 Blocked IP attempt: ${ip} accessing ${url}`)
    return NextResponse.json(
      { error: 'Forbidden', message: 'Access denied' },
      { status: 403 }
    )
  }

  // 2. Проверка User-Agent
  const userAgent = request.headers.get('user-agent')
  if (isSuspiciousUserAgent(userAgent)) {
    console.warn(`🚫 Suspicious User-Agent blocked: ${userAgent} from ${ip}`)
    blockIP(ip, 24 * 60 * 60 * 1000) // Блокируем на 24 часа
    return NextResponse.json(
      { error: 'Forbidden', message: 'Invalid request' },
      { status: 403 }
    )
  }

  // 3. Проверка подозрительных URL паттернов
  if (isSuspiciousURL(url)) {
    console.warn(`🚫 Suspicious URL blocked: ${url} from ${ip}`)
    blockIP(ip, 24 * 60 * 60 * 1000) // Блокируем на 24 часа
    return NextResponse.json(
      { error: 'Forbidden', message: 'Invalid request' },
      { status: 403 }
    )
  }

  // 4. Проверка подозрительных заголовков
  if (hasSuspiciousHeaders(request)) {
    console.warn(`🚫 Suspicious headers blocked from ${ip}`)
    blockIP(ip, 24 * 60 * 60 * 1000) // Блокируем на 24 часа
    return NextResponse.json(
      { error: 'Forbidden', message: 'Invalid request' },
      { status: 403 }
    )
  }

  // 5. Проверка параметров запроса
  if (hasSuspiciousParams(request.nextUrl.searchParams)) {
    console.warn(`🚫 Suspicious params blocked from ${ip}`)
    blockIP(ip, 24 * 60 * 60 * 1000) // Блокируем на 24 часа
    return NextResponse.json(
      { error: 'Forbidden', message: 'Invalid request' },
      { status: 403 }
    )
  }

  // 6. Проверка размера запроса
  const contentLength = request.headers.get('content-length')
  if (!validateRequestSize(contentLength, 5 * 1024 * 1024)) { // Уменьшили до 5MB
    console.warn(`🚫 Request too large from ${ip}`)
    return NextResponse.json(
      { error: 'Payload too large', message: 'Request body exceeds maximum size' },
      { status: 413 }
    )
  }

  // 7. Проверка Cloudflare (только в продакшене)
  if (!validateCloudflareHeaders(request)) {
    console.warn(`🚫 Direct access attempt blocked from ${ip}`)
    blockIP(ip, 24 * 60 * 60 * 1000) // Блокируем на 24 часа
    return NextResponse.json(
      { error: 'Forbidden', message: 'Direct access not allowed' },
      { status: 403 }
    )
  }

  // 8. Проверка метода запроса (только разрешенные методы)
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
  if (!allowedMethods.includes(request.method)) {
    console.warn(`🚫 Invalid method ${request.method} from ${ip}`)
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    )
  }

  // Все проверки пройдены
  return null
}

/**
 * Блокирует IP адрес
 * @param ip - IP адрес для блокировки
 * @param durationMs - Длительность блокировки в миллисекундах. 0 = постоянная блокировка
 */
export function blockIP(ip: string, durationMs: number = 24 * 60 * 60 * 1000): void {
  const key = `blocked:${ip}`
  // Если durationMs = 0, блокируем навсегда (используем очень большое число)
  const blockUntil = durationMs === 0 
    ? Number.MAX_SAFE_INTEGER 
    : Date.now() + durationMs
  
  const entry: RateLimitEntry = {
    count: 0,
    resetTime: blockUntil,
    blocked: true,
    blockUntil: blockUntil,
  }
  rateLimitStore.set(key, entry)
  const durationText = durationMs === 0 
    ? 'PERMANENTLY' 
    : `${Math.round(durationMs / (60 * 60 * 1000))} hours`
  console.warn(`🔒 IP ${ip} blocked ${durationText} until ${new Date(blockUntil).toISOString()}`)
}

/**
 * Блокирует IP адрес навсегда (постоянная блокировка)
 */
export function blockIPPermanently(ip: string): void {
  blockIP(ip, 0)
}

/**
 * Разблокирует IP адрес
 */
export function unblockIP(ip: string): void {
  const key = `blocked:${ip}`
  rateLimitStore.delete(key)
  console.log(`✅ IP ${ip} unblocked`)
}

/**
 * Проверяет, заблокирован ли IP
 */
export function isIPBlocked(ip: string): boolean {
  const key = `blocked:${ip}`
  const entry = rateLimitStore.get(key)
  if (!entry) return false
  
  const now = Date.now()
  if (entry.blockUntil && entry.blockUntil > now) {
    return true
  }
  
  // Удаляем истекшую блокировку
  rateLimitStore.delete(key)
  return false
}

/**
 * Получает статистику rate limiting для IP
 */
export function getRateLimitStats(ip: string): {
  count: number
  remaining: number
  resetTime: number
  blocked: boolean
} | null {
  const key = `rate_limit:${ip}`
  const entry = rateLimitStore.get(key)
  if (!entry) return null
  
  const now = Date.now()
  if (entry.resetTime < now) {
    return null
  }
  
  return {
    count: entry.count,
    remaining: Math.max(0, 60 - entry.count),
    resetTime: entry.resetTime,
    blocked: entry.blocked || false,
  }
}

