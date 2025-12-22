'use client'

import { useEffect, useState } from 'react'

interface PaymentByNumberSettings {
  phoneNumber: string
  recipientName: string
  bankName: string
}

export default function PaymentByNumberPage() {
  const [settings, setSettings] = useState<PaymentByNumberSettings>({
    phoneNumber: '',
    recipientName: '',
    bankName: ''
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
          recipientName: data.data.recipientName || '',
          bankName: data.data.bankName || ''
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
      alert('Пожалуйста, заполните номер телефона и имя получателя')
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
        <h1 className="text-2xl font-bold text-white mb-6">
          Пополнение по номеру
        </h1>

        <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-300 mb-2">
                Номер телефона получателя
              </label>
              <input
                type="text"
                id="phoneNumber"
                value={settings.phoneNumber}
                onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })}
                placeholder="Например: +996 555 123456"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                required
              />
              <p className="mt-1 text-sm text-gray-400">
                Номер телефона, на который будут переводить средства
              </p>
            </div>

            <div>
              <label htmlFor="recipientName" className="block text-sm font-medium text-gray-300 mb-2">
                Имя и фамилия получателя
              </label>
              <input
                type="text"
                id="recipientName"
                value={settings.recipientName}
                onChange={(e) => setSettings({ ...settings, recipientName: e.target.value })}
                placeholder="Например: Иван Иванов"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                required
              />
              <p className="mt-1 text-sm text-gray-400">
                Полное имя получателя для отображения в форме оплаты
              </p>
            </div>

            <div>
              <label htmlFor="bankName" className="block text-sm font-medium text-gray-300 mb-2">
                Название банка
              </label>
              <input
                type="text"
                id="bankName"
                value={settings.bankName}
                onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                placeholder="Например: DemirBank, O!Money, Balance.kg"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-400">
                Название банка для отображения в форме оплаты (необязательно)
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => fetchSettings()}
                className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">
            Информация
          </h3>
          <p className="text-sm text-gray-400">
            Эти настройки используются для отображения информации о пополнении по номеру телефона в форме оплаты.
            Пользователи увидят номер телефона, имя получателя, название банка (если указано), а также ссылки на банки для перевода средств.
          </p>
        </div>
      </div>
    </div>
  )
}

