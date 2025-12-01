'use client'

import './globals.css'
import TelegramInit from '../components/TelegramInit'
import { LanguageProvider } from '../components/LanguageContext'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getApiBase } from '../utils/fetch'

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
          const apiUrl = getApiBase()
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
  // Гарантируем, что title всегда установлен правильно
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'LUX ON'
      // Используем MutationObserver для отслеживания изменений title
      const titleElement = document.querySelector('title')
      if (titleElement) {
        const observer = new MutationObserver(() => {
          if (document.title !== 'LUX ON') {
            document.title = 'LUX ON'
          }
        })
        observer.observe(titleElement, { childList: true, subtree: true, characterData: true })
        
        return () => observer.disconnect()
      }
    }
  }, [])

  return (
    <html lang="ru">
      <head>
        <title>LUX ON</title>
        <meta name="description" content="LUX ON" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
      </head>
      <body style={{ position: 'relative', margin: 0, padding: 0, minHeight: '100vh' }}>
        <LanguageProvider>
          <TelegramInit />
          <BlockedChecker>
            <div className="container" style={{ paddingTop: '1rem', paddingBottom: '1rem', minHeight: '100vh' }}>
              {children}
            </div>
          </BlockedChecker>
        </LanguageProvider>
      </body>
    </html>
  )
}
