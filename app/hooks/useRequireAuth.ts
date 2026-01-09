"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTelegramUser, getTelegramUserId, getTelegramWebApp } from '../utils/telegram'

/**
 * Хук для защиты страниц - требует авторизации через Telegram
 * Редиректит на главную страницу, если пользователь не авторизован
 */
export function useRequireAuth() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null) // null = проверка, true = авторизован, false = не авторизован

  useEffect(() => {
    // Проверяем авторизацию
    const checkAuth = () => {
      // В Mini App пользователь всегда авторизован, если есть WebApp
      if (typeof window !== 'undefined') {
        const tg = getTelegramWebApp()
        if (tg) {
          // Если это Mini App - разрешаем доступ (даже если данные еще не загружены)
          // Telegram Mini App всегда предоставляет данные пользователя
          setIsAuthorized(true)
          return true
        }
      }
      
      // Для обычного сайта проверяем наличие пользователя
      const user = getTelegramUser()
      const userId = getTelegramUserId()
      
      // Если есть пользователь или ID - авторизован
      if (user || userId) {
        setIsAuthorized(true)
        return true
      }
      
      // Если нет - не авторизован
      setIsAuthorized(false)
      return false
    }

    // Первая проверка
    if (!checkAuth()) {
      // Даем небольшую задержку для загрузки данных в Mini App
      const timeout = setTimeout(() => {
        // Повторная проверка после задержки
        if (!checkAuth()) {
          // Редиректим на главную страницу только если точно не авторизован
          router.replace('/')
        }
      }, 100)
      
      return () => clearTimeout(timeout)
    }
  }, [router])

  return isAuthorized
}

