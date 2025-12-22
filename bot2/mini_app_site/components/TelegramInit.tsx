"use client"
import { useEffect } from 'react'

export default function TelegramInit() {
  useEffect(() => {
    // Инициализация Telegram WebApp
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      
      // Расширяем WebApp на весь экран
      tg.expand()
      
      // Отключаем подтверждение закрытия (чтобы не показывалось предупреждение)
      tg.disableClosingConfirmation()
      
      // Настраиваем тему
      tg.headerColor = '#1f2937'
      tg.backgroundColor = '#111827'
      
      // Готовим WebApp
      tg.ready()
      
      console.log('=== TelegramInit: WebApp initialized ===')
      console.log('Telegram object:', tg)
      console.log('initDataUnsafe:', tg.initDataUnsafe)
      console.log('initData:', tg.initData)
      console.log('User data:', tg.initDataUnsafe?.user)
      console.log('User ID:', tg.initDataUnsafe?.user?.id)
      console.log('Platform:', tg.platform)
      console.log('Version:', tg.version)
      console.log('=========================================')
    } else {
      console.log('❌ Telegram WebApp not available')
    }
  }, [])

  return null
}