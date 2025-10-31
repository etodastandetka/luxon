'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface RequestDetail {
  id: number
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  bookmaker: string | null
  accountId: string | null
  amount: string | null
  requestType: string
  status: string
  statusDetail: string | null
  bank: string | null
  phone: string | null
  createdAt: string
  updatedAt: string
  processedAt: string | null
  incomingPayments: any[]
}

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [newStatus, setNewStatus] = useState('')

  useEffect(() => {
    if (params.id) {
      fetchRequest()
    }
  }, [params.id])

  const fetchRequest = async () => {
    try {
      const response = await fetch(`/api/requests/${params.id}`)
      const data = await response.json()

      if (data.success) {
        setRequest(data.data)
        setNewStatus(data.data.status)
      }
    } catch (error) {
      console.error('Failed to fetch request:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async () => {
    try {
      const response = await fetch(`/api/requests/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (data.success) {
        setRequest(data.data)
        alert('Статус обновлен')
      }
    } catch (error) {
      console.error('Failed to update request:', error)
      alert('Ошибка при обновлении статуса')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!request) {
    return <div className="text-center text-gray-500">Заявка не найдена</div>
  }

  return (
    <div className="px-4 py-6">
      <button
        onClick={() => router.back()}
        className="mb-4 text-primary-600 hover:text-primary-700"
      >
        ← Назад
      </button>

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Заявка #{request.id}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Тип заявки
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {request.requestType === 'deposit' ? 'Пополнение' : 'Вывод'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Статус
            </label>
            <p className="mt-1 text-sm text-gray-900">{request.status}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Сумма
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {request.amount ? `${parseFloat(request.amount).toLocaleString()} KGS` : 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Букмекер
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {request.bookmaker || 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Пользователь
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {request.username || request.firstName || request.userId}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              ID счета
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {request.accountId || 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Банк
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {request.bank || 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Телефон
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {request.phone || 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Создано
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(request.createdAt).toLocaleString('ru-RU')}
            </p>
          </div>

          {request.processedAt && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Обработано
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(request.processedAt).toLocaleString('ru-RU')}
              </p>
            </div>
          )}
        </div>

        <div className="border-t pt-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Изменить статус
          </h2>
          <div className="flex space-x-4">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="pending">Ожидает</option>
              <option value="processing">В обработке</option>
              <option value="completed">Завершено</option>
              <option value="approved">Одобрено</option>
              <option value="rejected">Отклонено</option>
            </select>
            <button
              onClick={handleStatusUpdate}
              className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
            >
              Обновить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

