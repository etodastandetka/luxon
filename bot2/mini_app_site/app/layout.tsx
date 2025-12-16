'use client'

import './globals.css'
import TelegramInit from '../components/TelegramInit'
import { LanguageProvider } from '../components/LanguageContext'
import BottomNavigation from '../components/BottomNavigation'
import Snowflakes from '../components/Snowflakes'
import VersionChecker from '../components/VersionChecker'
import { useEffect, useState } from 'react'
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

    // Проверяем статус пользователя и регистрируем реферала (если есть реферальный код)
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
      
      // Регистрируем реферала, если есть реферальный код в start_param
      const registerReferral = async () => {
        try {
          const tg = (window as any).Telegram?.WebApp
          
          // Пробуем получить startParam из разных источников
          const startParam = tg?.startParam || 
                           tg?.initDataUnsafe?.start_param ||
                           (() => {
                             // Пробуем получить из URL параметров (если мини-приложение открыто через ссылку)
                             const urlParams = new URLSearchParams(window.location.search)
                             return urlParams.get('start_param') || urlParams.get('ref')
                           })()
          
          console.log('🔍 Проверка реферального кода:', {
            startParam,
            tgStartParam: tg?.startParam,
            initDataUnsafeStartParam: tg?.initDataUnsafe?.start_param,
            userId,
            tgObject: tg ? 'exists' : 'missing'
          })
          
          if (startParam && startParam.startsWith('ref')) {
            const referralCode = startParam.substring(3) // Убираем 'ref'
            const referrerId = referralCode.replace(/^_/, '') // Убираем '_' если есть
            
            console.log('🔍 Обработка реферального кода:', { referralCode, referrerId, userId })
            
            if (referrerId && referrerId !== userId && /^\d+$/.test(referrerId)) {
              const apiUrl = getApiBase()
              const user = tg?.initDataUnsafe?.user
              
              console.log('🔄 Регистрация реферала:', { 
                referrerId, 
                referredId: userId,
                apiUrl: `${apiUrl}/api/referral/register`,
                user: user ? { id: user.id, username: user.username } : 'no user data'
              })
              
              const response = await fetch(`${apiUrl}/api/referral/register`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  referrer_id: referrerId,
                  referred_id: userId,
                  username: user?.username || null,
                  first_name: user?.first_name || null,
                  last_name: user?.last_name || null,
                }),
              })
              
              const data = await response.json()
              console.log('📋 Ответ API регистрации реферала:', data)
              
              if (data.success) {
                console.log('✅ Реферал успешно зарегистрирован')
              } else {
                console.log('⚠️ Ошибка регистрации реферала:', data.error)
              }
            } else {
              console.log('⚠️ Некорректный реферальный код:', { referrerId, userId, isValid: referrerId && referrerId !== userId && /^\d+$/.test(referrerId) })
            }
          } else {
            console.log('ℹ️ Реферальный код не найден или не начинается с "ref"')
          }
        } catch (error) {
          console.error('❌ Error registering referral:', error)
          // В случае ошибки продолжаем работу
        }
      }
      
      checkUserStatus()
      registerReferral()
    }
  }, [pathname, router])

  return <>{children}</>
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
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

  // Подстраховка: если где-то остался loading-active — убираем и возвращаем меню
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.remove('loading-active')
    const nav = document.querySelector('.bottom-navigation') as HTMLElement | null
    const garlands = document.querySelector('.new-year-garlands') as HTMLElement | null
    if (nav) {
      nav.style.removeProperty('display')
      nav.style.removeProperty('visibility')
      nav.style.removeProperty('opacity')
      nav.style.removeProperty('z-index')
    }
    if (garlands) {
      garlands.style.removeProperty('display')
      garlands.style.removeProperty('visibility')
      garlands.style.removeProperty('opacity')
      garlands.style.removeProperty('z-index')
    }
  }, [pathname])

  // Скрываем меню и гирлянды на странице блокировки
  const shouldHideUI = pathname === '/blocked'

  return (
    <html lang="ru">
      <head>
        <title>LUX ON</title>
        <meta name="description" content="LUX ON" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta name="app-version" content={process.env.NEXT_PUBLIC_APP_VERSION || Date.now().toString()} />
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        {/* Preload критических изображений казино для быстрой загрузки */}
        <link rel="preload" as="image" href="/images/1xbet.jpg" />
        <link rel="preload" as="image" href="/images/1win.jpg" />
        <link rel="preload" as="image" href="/images/melbet.jpg" />
      </head>
      <body style={{ position: 'relative', margin: 0, padding: 0, minHeight: '100vh' }}>
        <LanguageProvider>
          <VersionChecker />
          <TelegramInit />
          {!shouldHideUI && <Snowflakes />}
          <BlockedChecker>
            <div className="container" style={{ paddingTop: '0', paddingBottom: '100px', minHeight: '100vh' }}>
              {children}
            </div>
          </BlockedChecker>
          {!shouldHideUI && <BottomNavigation />}
        </LanguageProvider>
      </body>
    </html>
  )
}
