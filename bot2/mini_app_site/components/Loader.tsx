"use client"
import { useState, useEffect } from 'react'

interface LoaderProps {
  onComplete: () => void
}

export default function Loader({ onComplete }: LoaderProps) {
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer)
          setIsVisible(false)
          setTimeout(onComplete, 300)
          return 100
        }
        return prev + 1
      })
    }, 30)

    return () => clearInterval(timer)
  }, [onComplete])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-green-900/20 to-green-800/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        {/* Логотип LUX ON */}
        <div className="mx-auto">
          <h1 className="text-4xl font-bold flex items-center justify-center">
            <span className="text-white">LUX</span>
            <div className="ml-2 relative h-10 w-16 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-red-400 transition-all duration-1000 ${
                  progress < 50 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                }`}>
                  OFF
                </span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-green-400 transition-all duration-1000 ${
                  progress >= 50 ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
                }`}>
                  ON
                </span>
              </div>
            </div>
          </h1>
        </div>
        
        {/* Прогресс бар */}
        <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Текст загрузки */}
        <p className="text-white/80 text-sm text-center transition-all duration-700 ease-in-out">
          {progress < 15 ? '🚀 Запускаем систему...' :
           progress < 25 ? '💳 Готовим автопополнение...' :
           progress < 35 ? '🏦 Подключаем банки...' :
           progress < 45 ? '📊 Настраиваем статистику...' :
           progress < 55 ? '🔗 Активируем реферальную программу...' :
           progress < 65 ? '📱 Оптимизируем интерфейс...' :
           progress < 75 ? '⚡ Ускоряем обработку...' :
           progress < 85 ? '🔐 Проверяем безопасность...' :
           progress < 90 ? '✨ Применяем магию...' :
           progress < 95 ? '🎯 Финальная настройка...' :
           '🎉 Готово к работе!'}
        </p>
      </div>
    </div>
  )
}
