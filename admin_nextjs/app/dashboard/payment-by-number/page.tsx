'use client'

import { useEffect, useState } from 'react'

interface PaymentByNumberSettings {
  phoneNumber: string
  recipientName: string
}

export default function PaymentByNumberPage() {
  const [settings, setSettings] = useState<PaymentByNumberSettings>({
    phoneNumber: '',
    recipientName: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/payment-by-number')
      const data = await response.json()

      if (data.success && data.data) {
        setSettings({
          phoneNumber: data.data.phoneNumber || '',
          recipientName: data.data.recipientName || ''
        })
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!settings.phoneNumber.trim() || !settings.recipientName.trim()) {
      alert('Пожалуйста, заполните все поля')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/payment-by-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await response.json()
      if (data.success) {
        alert('Настройки сохранены успешно')
      } else {
        alert(data.error || 'Ошибка при сохранении')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Ошибка при сохранении настроек')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Пополнение по номеру
        </h1>

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Номер телефона получателя
              </label>
              <input
                type="text"
                id="phoneNumber"
                value={settings.phoneNumber}
                onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })}
                placeholder="Например: +996 555 123456"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Номер телефона, на который будут переводить средства
              </p>
            </div>

            <div>
              <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-2">
                Имя и фамилия получателя
              </label>
              <input
                type="text"
                id="recipientName"
                value={settings.recipientName}
                onChange={(e) => setSettings({ ...settings, recipientName: e.target.value })}
                placeholder="Например: Иван Иванов"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Полное имя получателя для отображения в форме оплаты
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => fetchSettings()}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            Информация
          </h3>
          <p className="text-sm text-blue-800">
            Эти настройки используются для отображения информации о пополнении по номеру телефона в форме оплаты.
            Пользователи увидят номер телефона и имя получателя, а также ссылки на банки для перевода средств.
          </p>
        </div>
      </div>
    </div>
  )
}

