"use client"
import { useEffect, useState, memo } from 'react'

interface PageTransitionProps {
  children: React.ReactNode
  direction?: 'forward' | 'backward'
}

function PageTransition({ children, direction = 'forward' }: PageTransitionProps) {
  // Показываем контент сразу, без задержки
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Небольшая задержка только для анимации появления (опционально)
    // Но контент уже виден благодаря useState(true)
    const rafId = requestAnimationFrame(() => {
      // Контент уже виден, просто обновляем для анимации
      setIsVisible(true)
    })

    return () => cancelAnimationFrame(rafId)
  }, [])

  // Функция для выхода (исчезновения)
  const exit = () => {
    setIsExiting(true)
    setIsVisible(false)
  }

  // Экспортируем функцию выхода для использования в компонентах
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).pageTransitionExit = exit
    }
    
    // Очищаем при размонтировании
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).pageTransitionExit
      }
    }
  }, [])

  // Используем CSS transforms для лучшей производительности
  const transform = isVisible && !isExiting
    ? 'translateX(0)' 
    : isExiting
      ? direction === 'forward' 
        ? 'translateX(-30%)'
        : 'translateX(30%)'
      : direction === 'forward' 
        ? 'translateX(30%)'
        : 'translateX(-30%)'

  return (
    <div 
      className="transition-transform duration-200 ease-out"
      style={{
        opacity: isVisible && !isExiting ? 1 : 1, // Всегда видим, если не выходим
        transform: isVisible && !isExiting ? 'translateX(0)' : transform,
        willChange: 'transform, opacity'
      }}
    >
      {children}
    </div>
  )
}

export default memo(PageTransition)
