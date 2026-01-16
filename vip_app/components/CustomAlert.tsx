'use client'

import { useEffect, useState } from 'react'

interface CustomAlertProps {
  show: boolean
  title?: string
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  onClose: () => void
  autoClose?: number // milliseconds
}

export default function CustomAlert({
  show,
  title,
  message,
  type = 'info',
  onClose,
  autoClose
}: CustomAlertProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      
      // Автоматическое закрытие
      if (autoClose) {
        const timer = setTimeout(() => {
          handleClose()
        }, autoClose)
        
        return () => clearTimeout(timer)
      }
    }
  }, [show, autoClose])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose()
    }, 300) // Ждем окончания анимации
  }

  if (!show) return null

  // Иконки и цвета в зависимости от типа
  const typeConfig = {
    success: {
      icon: '✅',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/50',
      textColor: 'text-sky-300',
      iconBg: 'bg-sky-500/20'
    },
    error: {
      icon: '❌',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/50',
      textColor: 'text-red-400',
      iconBg: 'bg-red-500/20'
    },
    warning: {
      icon: '⚠️',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/50',
      textColor: 'text-yellow-400',
      iconBg: 'bg-yellow-500/20'
    },
    info: {
      icon: 'ℹ️',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/50',
      textColor: 'text-blue-400',
      iconBg: 'bg-blue-500/20'
    }
  }

  const config = typeConfig[type]

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`pointer-events-auto max-w-sm w-full transform transition-all duration-300 ${
            isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          <div
            className={`relative rounded-2xl border ${config.bgColor} ${config.borderColor} backdrop-blur-md shadow-2xl overflow-hidden`}
          >
            {/* Декоративный градиент сверху */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${config.textColor} opacity-50`} />

            <div className="p-6 space-y-4">
              {/* Иконка */}
              <div className="flex justify-center">
                <div
                  className={`w-16 h-16 rounded-full ${config.iconBg} flex items-center justify-center text-3xl animate-bounce`}
                  style={{ animationDuration: '1s', animationIterationCount: '1' }}
                >
                  {config.icon}
                </div>
              </div>

              {/* Заголовок */}
              {title && (
                <h3 className={`text-xl font-bold text-center ${config.textColor}`}>
                  {title}
                </h3>
              )}

              {/* Сообщение */}
              <div className="text-center space-y-2">
                {message.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-white/90 text-sm leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Кнопка закрытия */}
              <button
                onClick={handleClose}
                className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 ${
                  type === 'success'
                    ? 'bg-sky-500 hover:bg-sky-600 text-white'
                    : type === 'error'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : type === 'warning'
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                } active:scale-95`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}


