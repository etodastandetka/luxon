'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: number
  username: string
  email: string | null
  isSuperAdmin: boolean
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()

      if (data.success && data.data) {
        setUser(data.data)
      } else {
        router.push('/login')
      }
    } catch (error) {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const bottomNavItems = [
    { 
      href: '/dashboard', 
      label: 'ГЛАВНАЯ', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      href: '/dashboard/history', 
      label: 'ИСТОРИЯ', 
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.9 1.57h1.52c0-1.5-1.08-2.86-3.42-2.86-2.07 0-3.62 1.17-3.62 3.06 0 1.92 1.47 2.71 3.29 3.16 1.95.47 2.33 1.11 2.33 1.8 0 .8-.63 1.5-1.95 1.5-1.64 0-2.17-.68-2.17-1.55H8.04c0 1.63 1.18 2.77 3.94 2.77 2.23 0 3.88-1.14 3.88-3.19 0-2.06-1.51-2.78-3.55-3.19z"/>
        </svg>
      )
    },
    { 
      href: '/dashboard/wallet', 
      label: 'КОШЕЛЕК', 
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H3V8h18v10zm-8-1c0 .55-.45 1-1 1s-1-.45-1-1v-3h-2v3c0 .55-.45 1-1 1s-1-.45-1-1v-3H7v3c0 .55-.45 1-1 1s-1-.45-1-1v-2H3v2c0 .55-.45 1-1 1s-1-.45-1-1v-4c0-.55.45-1 1-1h20c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1s-1-.45-1-1v-2h-2v2z"/>
        </svg>
      )
    },
    { 
      href: '/dashboard/limits', 
      label: 'ЛИМИТЫ', 
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="6" cy="6" r="2" fill="currentColor"/>
          <line x1="6" y1="10" x2="6" y2="18" stroke="currentColor" strokeWidth="2"/>
          <circle cx="6" cy="18" r="2" fill="currentColor"/>
          <circle cx="12" cy="6" r="2" fill="currentColor"/>
          <line x1="12" y1="10" x2="12" y2="18" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="18" r="2" fill="currentColor"/>
          <circle cx="18" cy="6" r="2" fill="currentColor"/>
          <line x1="18" y1="10" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
          <circle cx="18" cy="18" r="2" fill="currentColor"/>
        </svg>
      )
    },
    { 
      href: '/dashboard/menu', 
      label: 'МЕНЮ', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )
    },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="h-screen bg-gradient-to-b from-green-950 to-green-900 flex justify-center items-center overflow-hidden">
      <div className="mobile-container w-full max-w-[414px] h-full">
        {/* Основной контент */}
        <main className="px-4 py-4 pb-24 bg-transparent overflow-y-auto h-full">
          {children}
        </main>

        {/* Нижнее меню навигации */}
        <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-[414px] bg-gray-800 border-t border-gray-700 rounded-t-3xl z-50 shadow-2xl">
          <div className="flex justify-around items-center py-2 px-2">
            {bottomNavItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center px-2 py-2 rounded-xl transition-all duration-200 relative ${
                    active
                      ? 'text-green-500 bg-green-500 bg-opacity-20'
                      : 'text-gray-400'
                  }`}
                >
                  <div className={`mb-1 ${active ? 'transform scale-110' : ''}`}>
                    {item.icon}
                  </div>
                  <span className={`text-[9px] font-medium uppercase tracking-wider ${
                    active ? 'text-green-500' : 'text-gray-400'
                  }`}>
                    {item.label}
                  </span>
                  {active && (
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}

