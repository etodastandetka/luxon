"use client"
import { useState, useEffect } from 'react'
import Loader3D from './Loader3D'
import Loader3DAdvanced from './Loader3DAdvanced'

interface LoadingScreenProps {
  message?: string
  showProgress?: boolean
  progress?: number
  variant?: 'simple' | 'advanced'
}

export default function LoadingScreen({ 
  message = 'Загрузка...', 
  showProgress = false, 
  progress = 0,
  variant = 'advanced'
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
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center space-y-8">
        {/* 3D Лоадер */}
        <div className="relative">
          {variant === 'advanced' ? (
            <Loader3DAdvanced size={150} color="#22c55e" />
          ) : (
            <Loader3D size={120} color="#22c55e" />
          )}
        </div>

        {/* Сообщение */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">
            {message}{dots}
          </h2>
          
          {/* Прогресс бар */}
          {showProgress && (
            <div className="w-64 mx-auto">
              <div className="bg-gray-700 rounded-full h-3 overflow-hidden relative">
                <div 
                  className="bg-gradient-to-r from-red-500 via-yellow-500 via-blue-500 via-purple-500 to-green-500 h-full transition-all duration-300 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
              </div>
              <p className="text-sm text-gray-400 mt-2 font-mono">{Math.round(progress)}%</p>
            </div>
          )}
        </div>

        {/* Дополнительная информация */}
        <div className="text-gray-400 text-sm">
          <p>LUX ON Platform</p>
          <p className="text-xs mt-1">Платформа пополнений и выводов</p>
        </div>
      </div>
    </div>
  )
}
