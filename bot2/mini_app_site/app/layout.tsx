'use client'

import './globals.css'
import TelegramInit from '../components/TelegramInit'
import { LanguageProvider } from '../components/LanguageContext'
import NotificationSystem from '../components/NotificationSystem'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

function BlockedChecker({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // Пропускаем проверку на странице блокировки
    if (pathname === '/blocked') {
      return
    }

    // Получаем ID пользователя из Telegram WebApp
    const tg = (window as any).Telegram?.WebApp
    let userId: string | null = null
    
    if (tg?.initDataUnsafe?.user?.id) {
      userId = String(tg.initDataUnsafe.user.id)
    } else if (tg?.initData) {
      try {
        const params = new URLSearchParams(tg.initData)
        const userParam = params.get('user')
        if (userParam) {
          const user = JSON.parse(decodeURIComponent(userParam))
          userId = String(user.id)
        }
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }

    // Проверяем статус пользователя
    if (userId) {
      const checkUserStatus = async () => {
        try {
          const apiUrl = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3001' 
            : 'https://xendro.pro'
          const response = await fetch(`${apiUrl}/api/public/check-user-status?user_id=${userId}`)
          const data = await response.json()
          
          if (data.success && data.data.isBlocked) {
            router.push('/blocked')
            return
          }
        } catch (error) {
          console.error('Error checking user status:', error)
          // В случае ошибки продолжаем работу
        }
      }
      
      checkUserStatus()
    }
  }, [pathname, router])

  return <>{children}</>
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
      </head>
      <body style={{ position: 'relative' }}>
        <LanguageProvider>
          <TelegramInit />
          <BlockedChecker>
            <div className="container py-4">
              {children}
            </div>
          </BlockedChecker>
          <NotificationSystem />
        </LanguageProvider>
      </body>
    </html>
  )
}
