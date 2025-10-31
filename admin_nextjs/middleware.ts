import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/api/auth/login']
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // API routes that don't require authentication (for external integrations)
  const publicApiRoutes = ['/api/auth', '/api/payment', '/api/transaction-history']
  const isPublicApiRoute = publicApiRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  if (isPublicRoute || isPublicApiRoute) {
    return NextResponse.next()
  }

  // Protect API routes
  if (request.nextUrl.pathname.startsWith('/api/') && !isPublicApiRoute) {
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Protect dashboard pages
  if (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname === '/') {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

