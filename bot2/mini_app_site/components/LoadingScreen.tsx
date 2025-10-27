"use client"
import { useState, useEffect } from 'react'
import ThreeLuxonIntro from './ThreeLuxonIntro'

interface LoadingScreenProps {
  message?: string
  showProgress?: boolean
  progress?: number
}

export default function LoadingScreen({ 
  message = 'Загрузка...', 
  showProgress = false, 
  progress = 0
}: LoadingScreenProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-50">
      {/* 3D фон на всю страницу */}
      <ThreeLuxonIntro />
      
      {/* Контент поверх фона */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-8">

          {/* Сообщение */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white drop-shadow-2xl tracking-wider">
              {message}{dots}
            </h2>
            
            {/* Прогресс бар - космический стиль */}
            {showProgress && (
              <div className="w-80 mx-auto">
                <div className="relative">
                  {/* Внешнее свечение */}
                  <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                  
                  {/* Основной бар */}
                  <div className="relative bg-black/60 backdrop-blur-md rounded-full h-2 overflow-hidden border border-blue-400/30 shadow-lg">
                    <div 
                      className="bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 h-full transition-all duration-500 ease-out relative"
                      style={{ width: `${progress}%` }}
                    >
                      {/* Анимированное свечение */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse"></div>
                      
                      {/* Движущийся блик */}
                      <div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                        style={{
                          animation: 'shimmer 2s infinite',
                          backgroundSize: '200% 100%'
                        }}
                      ></div>
                    </div>
                    
                    {/* Звездочки на полосе */}
                    <div className="absolute inset-0 overflow-hidden">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                          style={{
                            left: `${20 + i * 15}%`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            animationDelay: `${i * 0.2}s`
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                <p className="text-base text-cyan-300 mt-3 font-mono drop-shadow-lg tracking-wider">
                  {Math.round(progress)}%
                </p>
              </div>
            )}
          </div>

          {/* Дополнительная информация */}
          <div className="text-gray-300 text-base drop-shadow-lg space-y-1">
            <p className="font-semibold text-cyan-300">LUX ON Platform</p>
            <p className="text-xs text-gray-400">Платформа пополнений и выводов</p>
          </div>
          
          {/* Добавляем CSS для анимации */}
          <style jsx>{`
            @keyframes shimmer {
              0% {
                background-position: -200% 0;
              }
              100% {
                background-position: 200% 0;
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  )
}
