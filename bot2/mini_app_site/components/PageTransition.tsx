"use client"
import { useEffect, useState, memo } from 'react'

interface PageTransitionProps {
  children: React.ReactNode
  direction?: 'forward' | 'backward'
}

function PageTransition({ children, direction = 'forward' }: PageTransitionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Используем requestAnimationFrame для более плавного перехода
    const rafId = requestAnimationFrame(() => {
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
      className="transition-transform duration-300 ease-out"
      style={{
        opacity: isVisible && !isExiting ? 1 : 0,
        transform,
        willChange: 'transform, opacity'
      }}
    >
      {children}
    </div>
  )
}

export default memo(PageTransition)
