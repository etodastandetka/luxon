"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTelegramUser, getTelegramUserId } from '../utils/telegram'

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
      // Редиректим на главную страницу
      router.replace('/')
    }
  }, [router])

  return isAuthorized
}

