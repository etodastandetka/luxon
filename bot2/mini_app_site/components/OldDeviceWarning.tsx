"use client"
import { useEffect, useState } from 'react'
import { checkCompatibility, getDeviceInfo } from '../utils/compatibility'

export default function OldDeviceWarning() {
  const [showWarning, setShowWarning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Проверяем совместимость после загрузки
    const check = () => {
      const compat = checkCompatibility()
      const device = getDeviceInfo()
      
      // Показываем предупреждение только если критичные функции отсутствуют
      if (!compat.supported && compat.missingFeatures.length > 0) {
        setShowWarning(true)
      }
      
      setIsLoading(false)
    }

    // Небольшая задержка для загрузки полифиллов
    setTimeout(check, 100)
  }, [])

  if (isLoading || !showWarning) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: 'white',
        textAlign: 'center',
      }}
    >
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>
          Устаревший браузер
        </h2>
        <p style={{ fontSize: '16px', marginBottom: '20px', lineHeight: '1.5' }}>
          Ваш браузер не поддерживает все необходимые функции.
          <br />
          Пожалуйста, обновите браузер или используйте более новую версию.
        </p>
        <p style={{ fontSize: '14px', color: '#999' }}>
          Рекомендуется использовать последнюю версию Telegram
        </p>
      </div>
    </div>
  )
}

