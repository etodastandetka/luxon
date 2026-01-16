"use client"
import { useEffect, useRef } from 'react'

export default function TelegramInit() {
  const initializedRef = useRef(false)

  useEffect(() => {
    // Загружаем скрипт Telegram WebApp только на клиенте
    if (typeof window === 'undefined') return
    
    // Предотвращаем множественную инициализацию
    if (initializedRef.current) return

    // Функция инициализации Telegram WebApp
    const initializeTelegramWebApp = () => {
      try {
        const telegram = (window as any).Telegram
        if (telegram && telegram.WebApp) {
          const tg = telegram.WebApp
          
          // Предотвращаем повторную инициализацию
          if (initializedRef.current) return
          initializedRef.current = true
          
          // Расширяем WebApp на весь экран (только один раз)
          try {
          tg.expand()
          } catch (e) {
            // Игнорируем ошибки, если метод не поддерживается
          }
          
          // Отключаем подтверждение закрытия
          try {
          tg.disableClosingConfirmation()
          } catch (e) {
            // Игнорируем ошибки, если метод не поддерживается
          }
          
          // VIP dark + blue accents
          const bgColor = '#05070c'
          const headerColor = '#05070c'
          const textColor = '#e9efff'
          const hintColor = 'rgba(233, 239, 255, 0.6)'
          const linkColor = '#4ea1ff'
          const buttonColor = '#2f7de0'
          const buttonTextColor = '#0a0f1a'
          const secondaryBgColor = '#0a0f1a'
          
          tg.headerColor = headerColor
          tg.backgroundColor = bgColor
          
          // Обновляем CSS переменные для использования в приложении
          const root = document.documentElement
          root.style.setProperty('--tg-theme-bg-color', bgColor)
          root.style.setProperty('--tg-theme-text-color', textColor)
          root.style.setProperty('--tg-theme-hint-color', hintColor)
          root.style.setProperty('--tg-theme-link-color', linkColor)
          root.style.setProperty('--tg-theme-button-color', buttonColor)
          root.style.setProperty('--tg-theme-button-text-color', buttonTextColor)
          root.style.setProperty('--tg-theme-secondary-bg-color', secondaryBgColor)
          
          // Принудительно устанавливаем темную тему для body
          document.documentElement.style.colorScheme = 'dark'
          document.body.style.backgroundColor = bgColor
          document.body.style.color = textColor
          
          // Слушаем изменения темы и принудительно возвращаем фирменные цвета
          tg.onEvent('themeChanged', () => {
            root.style.setProperty('--tg-theme-bg-color', bgColor)
            root.style.setProperty('--tg-theme-text-color', textColor)
            root.style.setProperty('--tg-theme-hint-color', hintColor)
            root.style.setProperty('--tg-theme-link-color', linkColor)
            root.style.setProperty('--tg-theme-button-color', buttonColor)
            root.style.setProperty('--tg-theme-button-text-color', buttonTextColor)
            root.style.setProperty('--tg-theme-secondary-bg-color', secondaryBgColor)
            document.documentElement.style.colorScheme = 'dark'
            document.body.style.backgroundColor = bgColor
            document.body.style.color = textColor
          })
          
          // Готовим WebApp (только один раз)
          try {
          tg.ready()
          } catch (e) {
            // Игнорируем ошибки
          }
          
          // Сохраняем данные пользователя в localStorage для быстрого доступа
          try {
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
              const userData = tg.initDataUnsafe.user
              localStorage.setItem('telegram_user', JSON.stringify(userData))
              console.log('✅ Данные пользователя сохранены в localStorage:', {
                id: userData.id,
                username: userData.username,
                first_name: userData.first_name
              })
            }
          } catch (e) {
            console.warn('⚠️ Не удалось сохранить данные пользователя:', e)
          }
          
          // Логируем информацию о hash для диагностики
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 Telegram WebApp Debug:', {
              hasInitData: !!tg.initData,
              hasInitDataUnsafe: !!tg.initDataUnsafe,
              hasUser: !!(tg.initDataUnsafe?.user),
              userId: tg.initDataUnsafe?.user?.id || 'N/A',
              hasHash: !!(tg.initDataUnsafe?.hash),
              hash: tg.initDataUnsafe?.hash || 'N/A',
              initDataLength: tg.initData?.length || 0,
              initDataPreview: tg.initData ? tg.initData.substring(0, 100) + '...' : 'N/A'
            })
          }
        }
      } catch (error) {
        // Логируем ошибки инициализации для диагностики
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Telegram WebApp initialization error:', error)
        }
      }
    }

    // Проверяем, не загружен ли уже скрипт
    if ((window as any).Telegram?.WebApp) {
      // Скрипт уже загружен, инициализируем
      if (!initializedRef.current) {
      initializeTelegramWebApp()
      }
      return
    }

    // Загружаем скрипт динамически
    const scriptId = 'telegram-web-app-script'
    if (document.getElementById(scriptId)) {
      // Скрипт уже в процессе загрузки, ждем
      const checkInterval = setInterval(() => {
        if ((window as any).Telegram?.WebApp) {
          clearInterval(checkInterval)
          initializeTelegramWebApp()
        }
      }, 50)
      return () => clearInterval(checkInterval)
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://telegram.org/js/telegram-web-app.js'
    script.async = true
    script.onload = () => {
      initializeTelegramWebApp()
    }
    document.head.appendChild(script)

    return () => {
      const existingScript = document.getElementById(scriptId)
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [])

  return null
}
