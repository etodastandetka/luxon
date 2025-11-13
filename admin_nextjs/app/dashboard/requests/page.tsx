'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Request {
  id: number
  userId: string
  username: string | null
  firstName: string | null
  bookmaker: string | null
  amount: string | null
  requestType: string
  status: string
  createdAt: string
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<{ type?: string; status?: string }>({})

  const fetchRequests = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true)
    }
    try {
      const params = new URLSearchParams()
      if (filter.type) params.append('type', filter.type)
      if (filter.status) params.append('status', filter.status)

      const response = await fetch(`/api/requests?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setRequests(data.data.requests || [])
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [filter])

  useEffect(() => {
    fetchRequests()
    
    // Автоматическое обновление каждые 3 секунды
    const interval = setInterval(() => {
      fetchRequests(false) // Не показываем loading при автообновлении
    }, 3000)
    
    // Обновление при фокусе страницы
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchRequests(false)
      }
    }
    
    // Обновление при возврате фокуса
    const handleFocus = () => {
      fetchRequests(false)
    }
    
    // Синхронизация между вкладками через storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'request_updated' && e.newValue) {
        const updatedRequestId = parseInt(e.newValue)
        console.log('🔄 Request updated in another tab:', updatedRequestId)
        fetchRequests(false)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [fetchRequests, filter])

  // Функция для определения типа транзакции (Автопополнение/profile-1)
  const getTransactionType = (status: string, statusDetail: string | null, requestType: string) => {
    if (requestType === 'withdraw') {
      return statusDetail?.match(/profile-\d+/)?.[0] || 'profile-1'
    }
    
    if (requestType === 'deposit') {
      // Автопополнение - если статус autodeposit_success или statusDetail указывает на автопополнение
      if (status === 'autodeposit_success' || statusDetail?.includes('autodeposit')) {
        return 'Автопополнение'
      }
      
      // Проверяем наличие profile-* в statusDetail
      if (statusDetail?.match(/profile-\d+/)) {
        return statusDetail.match(/profile-(\d+)/)?.[0] || 'profile-1'
      }
      
      // Для всех остальных депозитов показываем profile-1
      return 'profile-1'
    }
    
    return requestType === 'deposit' ? 'Пополнение' : 'Вывод'
  }

  // Функция для определения состояния (Успешно/Отклонено/Ожидает)
  const getStatusState = (status: string) => {
    if (status === 'completed' || status === 'approved' || status === 'auto_completed' || status === 'autodeposit_success') {
      return 'Успешно'
    }
    if (status === 'rejected' || status === 'declined') {
      return 'Отклонено'
    }
    if (status === 'pending') {
      return 'Ожидает'
    }
    if (status === 'deferred') {
      return 'Отложено'
    }
    if (status === 'manual' || status === 'awaiting_manual') {
      return 'Ручная'
    }
    return status
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'auto_completed':
      case 'autodeposit_success':
        return 'bg-green-500 text-black'
      case 'pending':
        return 'bg-yellow-500 text-black'
      case 'rejected':
      case 'declined':
        return 'bg-red-500 text-white'
      case 'deferred':
        return 'bg-orange-500 text-white'
      case 'manual':
      case 'awaiting_manual':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-700 text-gray-300'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Ожидает'
      case 'completed':
      case 'approved':
      case 'auto_completed':
      case 'autodeposit_success':
        return 'Успешно'
      case 'rejected':
      case 'declined':
        return 'Отклонено'
      case 'deferred':
        return 'Отложено'
      case 'manual':
      case 'awaiting_manual':
        return 'Ручная'
      default:
        return status
    }
  }

  const getTypeLabel = (type: string) => {
    return type === 'deposit' ? 'Пополнение' : 'Вывод'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}.${month}.${year} • ${hours}:${minutes}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="py-4">
      {/* Хедер с заголовком */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-10"></div>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-white">Заявки</h1>
          <p className="text-xs text-gray-300 mt-1">Актуальные транзакции</p>
        </div>
        <button 
          onClick={() => fetchRequests()}
          className="p-2 bg-gray-800 rounded-lg"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="mb-4 flex items-center space-x-2">
        <button
          onClick={() => setFilter({ ...filter, status: 'pending' })}
          className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
            filter.status === 'pending'
              ? 'bg-green-500 text-black shadow-lg'
              : 'bg-gray-800 text-gray-300'
          }`}
        >
          Ожидающие
        </button>
        <button
          onClick={() => setFilter({ ...filter, status: 'left' })}
          className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
            filter.status === 'left'
              ? 'bg-green-500 text-black shadow-lg'
              : 'bg-gray-800 text-gray-300'
          }`}
        >
          Оставленные
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 bg-green-500 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-white text-lg font-medium">Нет заявок</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/dashboard/requests/${request.id}`}
              className="block bg-gray-800 bg-opacity-50 rounded-xl p-4 border border-gray-700 hover:border-green-500 transition-colors backdrop-blur-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-white">
                      Заявка #{request.id}
                    </span>
                    {/* Бейдж типа транзакции слева */}
                    <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-500 bg-opacity-20 text-blue-300 rounded-md border border-blue-500 border-opacity-30">
                      {getTransactionType(request.status, (request as any).status_detail || null, request.requestType)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">
                    {request.username || request.firstName || request.userId}
                  </p>
                </div>
                {/* Правая часть: Дата, сумма и статус */}
                <div className="flex flex-col items-end space-y-2 ml-4">
                  {/* Дата и время */}
                  <p className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDate(request.createdAt)}
                  </p>
                  {/* Сумма */}
                  <p className={`text-base font-bold ${request.requestType === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                    {request.requestType === 'deposit' ? '+' : '-'}
                    {request.amount ? parseFloat(request.amount).toLocaleString('ru-RU', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).replace('.', ',') : '0,00'}
                  </p>
                  {/* Статус */}
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${getStatusColor(request.status)}`}>
                    {getStatusState(request.status)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

