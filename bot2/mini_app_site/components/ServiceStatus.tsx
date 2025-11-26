"use client"

import { useState, useEffect } from 'react'
import { getApiBase } from '../utils/fetch'

interface ServiceStatusProps {
  service: 'deposits' | 'withdrawals' | 'casinos'
  children: React.ReactNode
}

export default function ServiceStatus({ service, children }: ServiceStatusProps) {
  const [isEnabled, setIsEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkServiceStatus = async () => {
      try {
        const apiUrl = getApiBase()
        const response = await fetch(`${apiUrl}/api/public/payment-settings`)
        if (response.ok) {
          const data = await response.json()
          
          // Админ-панель возвращает данные напрямую
          const settings = data

          if (service === 'deposits') {
            setIsEnabled(settings.deposits?.enabled ?? settings.deposits_enabled ?? true)
          } else if (service === 'withdrawals') {
            setIsEnabled(settings.withdrawals?.enabled ?? settings.withdrawals_enabled ?? true)
          } else if (service === 'casinos') {
            // Проверяем, есть ли включенные казино
            const enabledSites = settings.enabled_deposit_banks || []
            setIsEnabled(enabledSites.length > 0)
          }
        } else {
          setError('Failed to load service status')
        }
      } catch (err) {
        setError('Failed to load service status')
        console.error('Error checking service status:', err)
      } finally {
        setIsLoading(false)
      }
    }

    checkServiceStatus()
  }, [service])

  if (isLoading) {
    return (
      <div className="card text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-2"></div>
        <p className="text-white/70">Загрузка...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card text-center bg-red-900/20 border-red-500">
        <p className="text-red-400">Ошибка загрузки настроек</p>
      </div>
    )
  }

  if (!isEnabled) {
    const messages = {
      deposits: 'Пополнение временно недоступно',
      withdrawals: 'Вывод временно недоступен',
      casinos: 'Казино временно недоступны'
    }

    return (
      <div className="card text-center bg-yellow-900/20 border-yellow-500">
        <div className="text-yellow-400 text-lg font-semibold mb-2">
          ⚠️ {messages[service]}
        </div>
        <p className="text-sm text-white/70">
          Обратитесь к администратору для получения дополнительной информации
        </p>
      </div>
    )
  }

  return <>{children}</>
}

