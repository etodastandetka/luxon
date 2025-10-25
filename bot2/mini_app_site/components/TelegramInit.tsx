"use client"
import { useEffect } from 'react'

export default function TelegramInit() {
  useEffect(() => {
    // Инициализация Telegram WebApp
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      
      // Расширяем WebApp на весь экран
      tg.expand()
      
      // Включаем кнопку закрытия
      tg.enableClosingConfirmation()
      
      // Настраиваем тему
      tg.setHeaderColor('#1f2937')
      tg.setBackgroundColor('#111827')
      
      console.log('Telegram WebApp initialized')
      console.log('User data:', tg.initDataUnsafe)
      console.log('User ID:', tg.initDataUnsafe?.user?.id)
    }
  }, [])

  return null
}