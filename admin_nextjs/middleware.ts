import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { 
  protectAPI, 
  rateLimit, 
  getClientIP, 
  isIPBlocked,
  blockIP 
} from './lib/security'
import { verifyToken } from './lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const ip = getClientIP(request)
  const pathname = request.nextUrl.pathname
  
  // Детальное логирование для отладки 2FA
  if (pathname === '/dashboard' || pathname === '/login/2fa') {
    console.log(`🔍 Middleware: path=${pathname}, hasToken=${!!token}, tokenPreview=${token ? token.substring(0, 20) + '...' : 'none'}, IP=${ip}`)
  }

  // 🛡️ ЗАЩИТА ОТ DDoS И АТАК

  // 0. Пропускаем страницу геолокации и API геолокации
  if (pathname === '/geolocation' || pathname.startsWith('/api/geolocation')) {
    return NextResponse.next()
  }

  // Определяем публичные маршруты (которые должны быть доступны даже при блокировке IP)
  const publicRoutes = ['/login', '/api/auth/login', '/api/auth/2fa']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Публичные страницы (не API)
  const isPublicPage = pathname === '/login' || pathname === '/login/2fa' || pathname === '/geolocation'

  // 1. Проверка блокировки IP (пропускаем внутренние IP, геолокацию и публичные маршруты)
  const isInternalRequest = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' ||
                            ip === '::ffff:127.0.0.1' || ip.startsWith('192.168.') || 
                            ip.startsWith('10.') || ip.startsWith('172.16.')
  
  // Не блокируем публичные маршруты и страницы (login должен быть доступен всегда)
  // Также не блокируем если есть валидный токен (пользователь уже авторизован)
  if (!isInternalRequest && !isPublicRoute && !isPublicPage && !pathname.startsWith('/api/geolocation') && !token && isIPBlocked(ip)) {
    console.warn(`🚫 Blocked IP attempt: ${ip} accessing ${pathname}`)
    return NextResponse.json(
      { error: 'Forbidden', message: 'Access denied' },
      { status: 403 }
    )
  }

  // 2. Защита API endpoints (пропускаем публичные API)
  if (pathname.startsWith('/api/') && !isPublicRoute) {
    const protectionResult = protectAPI(request)
    if (protectionResult) {
      return protectionResult
    }

    // 3. Rate limiting для API (более строгий для публичных endpoints)
    const publicApiRoutes = [
      '/api/auth', 
      '/api/payment', 
      '/api/transaction-history', 
      '/api/public', 
      '/api/withdraw-check', 
      '/api/withdraw-check-exists', 
      '/api/withdraw-execute', 
      '/api/incoming-payment', 
      '/api/referral/register', 
      '/api/users', 
      '/api/crypto-pay', 
      '/api/requests', 
      '/api/channel'
    ]
    
    const isPublicApiRoute = publicApiRoutes.some(route => pathname.startsWith(route))
    
    // Для внутренних запросов (localhost) - более мягкий rate limit
    // (isInternalRequest уже определен выше)
    
    // Более строгий rate limit для публичных API
    let rateLimitOptions
    if (isInternalRequest) {
      // Внутренние запросы - очень мягкий лимит
      rateLimitOptions = { maxRequests: 1000, windowMs: 60 * 1000 }
    } else if (isPublicApiRoute) {
      // Публичные API - строгий лимит
      rateLimitOptions = { maxRequests: 30, windowMs: 60 * 1000 }
    } else {
      // Защищенные API
      rateLimitOptions = { maxRequests: 100, windowMs: 60 * 1000 }
    }
    
    const rateLimitResult = rateLimit(rateLimitOptions)(request)
    if (rateLimitResult) {
      // При превышении лимита блокируем IP на 24 часа (только для внешних запросов)
      if (rateLimitResult.status === 429 && !isInternalRequest) {
        blockIP(ip, 24 * 60 * 60 * 1000)
      }
      return rateLimitResult
    }

    // 4. CORS headers для публичных API
    if (isPublicApiRoute && request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 })
      response.headers.set('Access-Control-Allow-Origin', '*')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      response.headers.set('Access-Control-Max-Age', '86400')
      return response
    }

    if (isPublicApiRoute) {
      const response = NextResponse.next()
      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      // Security headers
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('X-Frame-Options', 'DENY')
      response.headers.set('X-XSS-Protection', '1; mode=block')
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      return response
    }

    // 5. Защита приватных API endpoints
    if (!isPublicApiRoute && !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

         // 6. 🗺️ ГЕОЛОКАЦИОННАЯ ЗАЩИТА (для всех страниц кроме геолокации и API)
         // Проверяем, прошла ли проверка геолокации
         // Исключаем: API endpoints, страницу геолокации, статические файлы, страницу 2FA
         // Можно отключить через .env: GEOLOCATION_ENABLED=false
         const geolocationEnvValue = process.env.GEOLOCATION_ENABLED
         // Проверяем явно: если переменная установлена в 'false' (строка), отключаем
         // Если переменная не установлена или установлена в 'true', включаем
         const isGeolocationEnabled = geolocationEnvValue !== 'false' && geolocationEnvValue !== '0'
         
         const isGeolocationPage = pathname === '/geolocation'
         const is2FAPage = pathname === '/login/2fa'
         const isApiRoute = pathname.startsWith('/api/')
         const isStaticFile = pathname.startsWith('/_next/') || pathname.startsWith('/favicon')
         
         // Логируем только при первом запросе или если геолокация отключена (для отладки)
         if (pathname === '/dashboard' || pathname === '/') {
           console.log(`🗺️  Геолокация: enabled=${isGeolocationEnabled}, env=${geolocationEnvValue || 'не установлено'}, path=${pathname}, token=${token ? 'yes' : 'no'}`)
         }
         
         // Пропускаем проверку геолокации для страницы 2FA и если есть валидный токен (пользователь уже авторизован)
         if (isGeolocationEnabled && !isApiRoute && !isGeolocationPage && !is2FAPage && !isStaticFile && !token) {
           const geolocationVerified = request.cookies.get('geolocation_verified')?.value
           
           // Если геолокация не проверена, редиректим на страницу проверки
           if (!geolocationVerified || geolocationVerified !== 'true') {
             const geolocationUrl = new URL('/geolocation', request.url)
             geolocationUrl.searchParams.set('return', pathname)
             return NextResponse.redirect(geolocationUrl)
           }
         } else if (!isGeolocationEnabled && !isApiRoute && !isGeolocationPage && !isStaticFile) {
           // Если геолокация отключена, пропускаем проверку
           console.log(`✅ Геолокация отключена, пропускаем проверку для ${pathname}`)
         }

  // 7. Rate limiting для страниц (менее строгий)
  if (pathname.startsWith('/dashboard') || pathname === '/') {
    const rateLimitResult = rateLimit({ maxRequests: 120, windowMs: 60 * 1000 })(request)
    if (rateLimitResult) {
      return rateLimitResult
    }

    if (!token) {
      console.log(`⚠️  No token found for ${pathname}, redirecting to login. IP: ${ip}`)
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // Проверяем валидность токена
    try {
      const payload = verifyToken(token)
      if (!payload) {
        console.log(`⚠️  Invalid token for ${pathname}, redirecting to login. IP: ${ip}, token: ${token.substring(0, 20)}...`)
        return NextResponse.redirect(new URL('/login', request.url))
      }
      console.log(`✅ Valid token for ${pathname}, user: ${payload.username}, IP: ${ip}`)
    } catch (error) {
      console.log(`⚠️  Token verification error for ${pathname}, redirecting to login. IP: ${ip}`, error)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // 8. Public routes (login, etc.) - isPublicRoute уже определен выше
  if (isPublicRoute) {
    // Rate limiting для публичных страниц (защита от брутфорса)
    const rateLimitResult = rateLimit({ maxRequests: 20, windowMs: 60 * 1000 })(request)
    if (rateLimitResult) {
      return rateLimitResult
    }
  }

  // 9. Security headers для всех ответов
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // HSTS (только для HTTPS)
  if (request.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

