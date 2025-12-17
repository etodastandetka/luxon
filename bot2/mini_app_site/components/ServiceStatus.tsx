"use client"

import { useBotSettings } from './SettingsLoader'

interface ServiceStatusProps {
  service: 'deposits' | 'withdrawals' | 'casinos'
  children: React.ReactNode
}

export default function ServiceStatus({ service, children }: ServiceStatusProps) {
  const { settings, loading, error } = useBotSettings()

  const resolveServiceEnabled = () => {
    const s = settings as any
    if (!s) return true

    if (service === 'deposits') {
      return s.deposits?.enabled ?? s.deposits_enabled ?? true
    }
    if (service === 'withdrawals') {
      return s.withdrawals?.enabled ?? s.withdrawals_enabled ?? true
    }
    const enabledSites = s.enabled_deposit_banks || []
    return Array.isArray(enabledSites) ? enabledSites.length > 0 : true
  }

  if (loading) {
    return (
      <div className="card text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-2"></div>
        <p className="text-white/70">Загрузка...</p>
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className="card text-center bg-red-900/20 border-red-500">
        <p className="text-red-400">Ошибка загрузки настроек</p>
      </div>
    )
  }

  if (!resolveServiceEnabled()) {
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

