"use client"
import { useEffect, useRef, useState } from 'react'
import { getTelegramUser } from '../utils/telegram'
import { useLanguage } from './LanguageContext'

interface TelegramLoginWidgetProps {
  botName: string
  onAuth?: (user: any) => void
}

export default function TelegramLoginWidget({ botName, onAuth }: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLocalhost, setIsLocalhost] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { language } = useLanguage()

  // Проверяем localhost и авторизацию только на клиенте (для избежания ошибки гидратации)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const localhost = hostname === 'localhost' || 
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.')
      
      setIsLocalhost(localhost)
      
      // Проверяем авторизацию только на клиенте
      const telegramUser = getTelegramUser()
      const auth = !!telegramUser
      setIsAuthenticated(auth)

      // Если авторизован, ничего не делаем
      if (auth) {
        return
      }
    }
  }, [])

  useEffect(() => {
    // Telegram Login Widget не работает на localhost или если уже авторизован
    if (isLocalhost || isAuthenticated) {
      return
    }

    // Проверяем еще раз
    const telegramUser = getTelegramUser()
    if (telegramUser) {
      setIsAuthenticated(true)
      return
    }

    // Загружаем скрипт Telegram Widget
    const scriptId = 'telegram-widget-script'
    if (document.getElementById(scriptId)) {
      setIsLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.onload = () => setIsLoaded(true)
    document.body.appendChild(script)

    return () => {
      const existingScript = document.getElementById(scriptId)
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [isLocalhost, isAuthenticated])

  useEffect(() => {
    if (!containerRef.current) return

    // Если авторизован, очищаем контейнер
    if (isAuthenticated) {
      containerRef.current.innerHTML = ''
      return
    }

    // На localhost показываем сообщение
    if (isLocalhost) {
      containerRef.current.innerHTML = `
        <div style="padding: 1rem; text-align: center; background: rgba(255, 255, 255, 0.1); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.2);">
          <p style="color: rgba(255, 255, 255, 0.8); margin: 0;">
            ${language === 'en' 
              ? 'Telegram login is only available in production (not on localhost)'
              : 'Вход через Telegram доступен только на продакшене (не на localhost)'}
          </p>
        </div>
      `
      return
    }

    if (!isLoaded) return

    // Очищаем контейнер
    containerRef.current.innerHTML = ''

    // Создаем виджет
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName.replace('@', ''))
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-auth-url', `${window.location.origin}/api/auth/telegram`)
    script.setAttribute('data-request-access', 'write')
    
    containerRef.current.appendChild(script)
  }, [isLoaded, botName, isLocalhost, isAuthenticated, language])

  // Всегда рендерим контейнер для избежания ошибки гидратации
  // Содержимое управляется через useEffect (будет пустым если авторизован)
  // suppressHydrationWarning нужен потому что содержимое намеренно отличается на сервере и клиенте
  return (
    <div 
      ref={containerRef} 
      className="telegram-login-widget" 
      suppressHydrationWarning
    />
  )
}
