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
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    
    // Безопасное обновление состояния
    const safeSetState = (value: boolean) => {
      if (mountedRef.current) {
        setIsAuthorized(value)
      }
    }
    
    // Проверяем авторизацию
    const checkAuth = (): boolean => {
      // В Mini App пользователь всегда авторизован, если есть WebApp
      if (typeof window !== 'undefined') {
        const tg = getTelegramWebApp()
        if (tg) {
          // Если это Mini App - разрешаем доступ (даже если данные еще не загружены)
          // Telegram Mini App всегда предоставляет данные пользователя
          safeSetState(true)
          return true
        }
      }
      
      // Для обычного сайта проверяем наличие пользователя
      const user = getTelegramUser()
      const userId = getTelegramUserId()
      
      // Если есть пользователь или ID - авторизован
      if (user || userId) {
        safeSetState(true)
        return true
      }
      
      // Если нет - не авторизован
      safeSetState(false)
      return false
    }

    // Первая проверка
    const isAuth = checkAuth()
    
    if (!isAuth) {
      // Даем небольшую задержку для загрузки данных в Mini App
      timeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return
        
        // Повторная проверка после задержки
        const isAuthRetry = checkAuth()
        if (!isAuthRetry && mountedRef.current) {
          // Редиректим на главную страницу только если точно не авторизован
          // Используем setTimeout для асинхронного редиректа, чтобы избежать ошибок
          setTimeout(() => {
            if (mountedRef.current) {
              try {
                router.replace('/')
              } catch (error) {
                // Игнорируем ошибки роутера
                console.error('Router error:', error)
              }
            }
          }, 0)
        }
      }, 100)
    }
    
    // Всегда возвращаем функцию очистки
    return () => {
      mountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [router])

  return isAuthorized
}

