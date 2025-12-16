'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Snowflakes() {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  
  // Скрываем снежинки на странице блокировки
  if (pathname === '/blocked') {
    return null
  }

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Меньше снежинок на мобильных устройствах
  const snowflakeCount = isMobile ? 12 : 20

  return (
    <div className="snowflakes-container">
      {Array.from({ length: snowflakeCount }, (_, i) => (
        <div 
          key={i} 
          className="snowflake" 
          style={{ 
            left: `${(i * (100 / snowflakeCount)) % 100}%`,
            animationDelay: `${(i * 0.2) % 5}s`,
            animationDuration: `${5 + (i % 3)}s`,
            fontSize: `${0.7 + (i % 2) * 0.15}rem`
          }}
        >
          ❄️
        </div>
      ))}
    </div>
  )
}

