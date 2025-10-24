"use client"
import { useEffect, useState } from 'react'

interface PageTransitionProps {
  children: React.ReactNode
  direction?: 'forward' | 'backward'
}

export default function PageTransition({ children, direction = 'forward' }: PageTransitionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Небольшая задержка для плавного перехода
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 50)

    return () => clearTimeout(timer)
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

  const getAnimationClass = () => {
    if (isExiting) {
      return direction === 'forward' 
        ? 'opacity-0 -translate-x-full' 
        : 'opacity-0 translate-x-full'
    }
    if (!isVisible) {
      return direction === 'forward' 
        ? 'opacity-0 translate-x-full' 
        : 'opacity-0 -translate-x-full'
    }
    return 'opacity-100 translate-x-0'
  }

  return (
    <div 
      className="transition-all duration-500 ease-in-out"
      style={{
        opacity: isVisible && !isExiting ? 1 : 0,
        transform: isVisible && !isExiting
          ? 'translateX(0)' 
          : isExiting
            ? direction === 'forward' 
              ? 'translateX(-30%)'  // При выходе из forward - влево
              : 'translateX(30%)'   // При выходе из backward - вправо
            : direction === 'forward' 
              ? 'translateX(30%)'   // При входе forward - справа
              : 'translateX(-30%)'  // При входе backward - слева
      }}
    >
      {children}
    </div>
  )
}
