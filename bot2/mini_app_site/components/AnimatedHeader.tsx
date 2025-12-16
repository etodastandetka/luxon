"use client"
import { useEffect, useState } from 'react'

export default function AnimatedHeader() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="relative overflow-hidden">
      {/* Декоративные элементы */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-green-500/10 to-transparent"></div>
      
      {/* Анимированные частицы */}
      <div className="absolute top-4 left-1/4 w-1 h-1 bg-green-400/60 rounded-full gentle-float" style={{ animationDelay: '0s' }}></div>
      <div className="absolute top-8 right-1/4 w-0.5 h-0.5 bg-green-300/60 rounded-full gentle-float" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-12 left-1/2 w-1 h-1 bg-green-500/60 rounded-full gentle-float" style={{ animationDelay: '4s' }}></div>
      
      {/* Волны */}
      <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-green-500/5 to-transparent"></div>
      
      {/* Светящиеся линии */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-50"></div>
      <div className="absolute top-4 left-0 w-full h-px bg-gradient-to-r from-transparent via-green-300 to-transparent opacity-30"></div>
    </div>
  )
}
