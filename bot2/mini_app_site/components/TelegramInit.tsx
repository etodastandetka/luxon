"use client"
import { useEffect } from 'react'

export default function TelegramInit() {
  useEffect(() => {
    // Инициализация Telegram WebApp
    if (typeof window !== 'undefined') {
      try {
        const telegram = (window as any).Telegram
        if (telegram && telegram.WebApp) {
          const tg = telegram.WebApp
          
          // Расширяем WebApp на весь экран
          tg.expand()
          
          // Отключаем подтверждение закрытия
          tg.disableClosingConfirmation()
          
          // Используем цвета из themeParams Telegram (если доступны)
          // Это важно для iOS, чтобы цвета соответствовали теме Telegram
          const themeParams = tg.themeParams || {}
          const colorScheme = tg.colorScheme || 'dark'
          
          // Устанавливаем цвета фона и заголовка
          // Используем цвета из themeParams или fallback на темные цвета
          const bgColor = themeParams.bg_color || '#111827'
          const headerColor = themeParams.bg_color || '#1f2937'
          const textColor = themeParams.text_color || '#ffffff'
          const hintColor = themeParams.hint_color || '#999999'
          const linkColor = themeParams.link_color || '#2481cc'
          const buttonColor = themeParams.button_color || '#2481cc'
          const buttonTextColor = themeParams.button_text_color || '#ffffff'
          const secondaryBgColor = themeParams.secondary_bg_color || '#1e2732'
          
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
          if (colorScheme === 'dark') {
            document.body.style.backgroundColor = bgColor
            document.body.style.color = textColor
          }
          
          // Слушаем изменения темы
          tg.onEvent('themeChanged', () => {
            const newThemeParams = tg.themeParams || {}
            const newBgColor = newThemeParams.bg_color || bgColor
            const newTextColor = newThemeParams.text_color || textColor
            
            root.style.setProperty('--tg-theme-bg-color', newBgColor)
            root.style.setProperty('--tg-theme-text-color', newTextColor)
            document.body.style.backgroundColor = newBgColor
            document.body.style.color = newTextColor
          })
          
          // Готовим WebApp
          tg.ready()
          
          // Логируем информацию о hash для диагностики
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 Telegram WebApp Debug:', {
              hasInitData: !!tg.initData,
              hasInitDataUnsafe: !!tg.initDataUnsafe,
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
  }, [])

  return null
}