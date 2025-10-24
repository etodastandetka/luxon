"use client"
import { useEffect } from 'react'
import { initTelegramWebApp, getTelegramUser, syncWithBot } from '../utils/telegram'

export default function TelegramInit() {
  useEffect(() => {
    // Инициализируем Telegram WebApp при загрузке приложения
    const telegramUser = initTelegramWebApp()
    
    if (telegramUser) {
      // Синхронизируем с ботом при инициализации
      syncWithBot(telegramUser, 'app_initialized', {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform
      })
    }
  }, [])

  return null // Этот компонент не рендерит ничего видимого
}