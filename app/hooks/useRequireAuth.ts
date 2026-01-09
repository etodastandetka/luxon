"use client"
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getTelegramUser, getTelegramUserId, getTelegramWebApp } from '../utils/telegram'

/**
 * Хук для защиты страниц - требует авторизации через Telegram
 * Редиректит на главную страницу, если пользователь не авторизован
 */
export function useRequireAuth() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null) // null = проверка, true = авторизован, false = не авторизован
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let mounted = true
    
    // Проверяем авторизацию
    const checkAuth = (): boolean => {
      // В Mini App пользователь всегда авторизован, если есть WebApp
      if (typeof window !== 'undefined') {
        const tg = getTelegramWebApp()
        if (tg) {
          // Если это Mini App - разрешаем доступ (даже если данные еще не загружены)
          // Telegram Mini App всегда предоставляет данные пользователя
          if (mounted) {
            setIsAuthorized(true)
          }
          return true
        }
      }
      
      // Для обычного сайта проверяем наличие пользователя
      const user = getTelegramUser()
      const userId = getTelegramUserId()
      
      // Если есть пользователь или ID - авторизован
      if (user || userId) {
        if (mounted) {
          setIsAuthorized(true)
        }
        return true
      }
      
      // Если нет - не авторизован
      if (mounted) {
        setIsAuthorized(false)
      }
      return false
    }

    // Первая проверка
    const isAuth = checkAuth()
    
    if (!isAuth) {
      // Даем небольшую задержку для загрузки данных в Mini App
      timeoutRef.current = setTimeout(() => {
        if (!mounted) return
        
        // Повторная проверка после задержки
        const isAuthRetry = checkAuth()
        if (!isAuthRetry && mounted) {
          // Редиректим на главную страницу только если точно не авторизован
          router.replace('/')
        }
      }, 100)
    }
    
    // Всегда возвращаем функцию очистки
    return () => {
      mounted = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [router])

  return isAuthorized
}

