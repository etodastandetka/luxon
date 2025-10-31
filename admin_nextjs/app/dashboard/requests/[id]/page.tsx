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
  status_detail: string | null
  bank: string | null
  phone: string | null
  createdAt: string
  updatedAt: string
  processedAt: string | null
  incomingPayments: any[]
}

interface Payment {
  id: number
  amount: string
  createdAt: string
  description?: string
}

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchAmount, setSearchAmount] = useState('')
  const [exactAmount, setExactAmount] = useState(false)
  const [processedOnly, setProcessedOnly] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchRequest()
    }
  }, [params.id])

  const fetchRequest = async () => {
    try {
      const response = await fetch(`/api/requests/${params.id}`)
      const data = await response.json()

      console.log('📋 Request detail data:', data)

      if (data.success) {
        setRequest(data.data)
      } else {
        console.error('❌ Failed to fetch request:', data.error)
      }
    } catch (error) {
      console.error('❌ Failed to fetch request:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Скопировано в буфер обмена')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${day}.${month}.${year} • ${hours}:${minutes}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'Ожидает':
        return 'bg-yellow-500 text-black'
      case 'completed':
      case 'approved':
      case 'Успешно':
        return 'bg-green-500 text-black'
      case 'rejected':
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
        return 'Успешно'
      case 'rejected':
        return 'Отклонено'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-24 h-24 bg-red-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
          <svg className="w-16 h-16 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-white text-lg font-medium">Заявка не найдена</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
        >
          Назад
        </button>
      </div>
    )
  }

  const displayAmount = request.amount ? parseFloat(request.amount).toFixed(2).replace('.', ',') : '0,00'
  const isDeposit = request.requestType === 'deposit'
  const userName = request.username 
    ? `@${request.username}` 
    : request.firstName 
      ? `${request.firstName}${request.lastName ? ' ' + request.lastName : ''}` 
      : `ID: ${request.userId}`

  // Фильтруем платежи если есть
  const payments: Payment[] = request.incomingPayments?.map(p => ({
    id: p.id,
    amount: parseFloat(p.amount || '0').toFixed(2).replace('.', ','),
    createdAt: p.createdAt || p.created_at,
    description: p.description || 'Перевод по QR'
  })) || []

  return (
    <div className="py-4">
      {/* Хедер с навигацией */}
      <div className="flex items-center justify-between mb-4 px-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1"></div>
      </div>

      {/* Основная карточка с номером заявки и суммой */}
      <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-white">{request.id}</span>
            <button
              onClick={() => copyToClipboard(request.id.toString())}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getStatusColor(request.status)}`}>
            <div className="w-2 h-2 rounded-full bg-current"></div>
            <span className="text-xs font-medium">{getStatusLabel(request.status)}</span>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-6">{formatDate(request.createdAt)}</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-1">
              {isDeposit ? 'Пополнение' : 'Вывод'}
            </p>
            <p className={`text-3xl font-bold ${isDeposit ? 'text-green-500' : 'text-red-500'}`}>
              {isDeposit ? '+' : '-'}{displayAmount}
            </p>
          </div>
          <div className="flex space-x-2">
            <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Информация о сайте и пользователе */}
      <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-4 border border-gray-700">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Сайт:</span>
            <span className="text-sm font-medium text-white">{request.bookmaker || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">ID:</span>
            <span className="text-sm font-medium text-white">{request.id}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Дата создания:</span>
            <span className="text-sm font-medium text-white">{formatDate(request.createdAt)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Пользователь:</span>
            <span className="text-sm font-medium text-white">{userName}</span>
          </div>
          {request.accountId && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">ID счета:</span>
              <span className="text-sm font-medium text-white">{request.accountId}</span>
            </div>
          )}
          {request.bank && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Банк:</span>
              <span className="text-sm font-medium text-white">{request.bank}</span>
            </div>
          )}
        </div>
      </div>

      {/* Поиск */}
      <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-4 border border-gray-700">
        <div className="flex space-x-2 mb-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Поиск по сумме..."
              value={searchAmount}
              onChange={(e) => setSearchAmount(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
          </div>
          <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Найти
          </button>
        </div>
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={exactAmount}
              onChange={(e) => setExactAmount(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">Точная сумма</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={processedOnly}
              onChange={(e) => setProcessedOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">Обработанные</span>
          </label>
        </div>
      </div>

      {/* Список платежей/транзакций */}
      <div className="mx-4">
        <h3 className="text-lg font-semibold text-white mb-3">Транзакции</h3>
        {payments.length > 0 ? (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-green-500 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-12 bg-gray-600 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white mb-1">
                      {payment.description || 'Перевод по QR'}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(payment.createdAt)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <p className="text-lg font-bold text-green-500">+{payment.amount}</p>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
            <p className="text-gray-400">Нет транзакций</p>
          </div>
        )}
      </div>
    </div>
  )
}
