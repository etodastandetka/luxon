"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface WithdrawalRequest {
  id: number
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  phoneNumber: string | null
  amount: number
  currency: string
  bookmaker: string
  bookmakerAccountId: string
  paymentMethod: string
  walletDetails: string
  status: string
  adminComment: string | null
  createdAt: string
  updatedAt: string
  processedAt: string | null
}

export default function ReferralWithdrawalsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const url = statusFilter === 'all' 
        ? '/api/referral/withdraw/list'
        : `/api/referral/withdraw/list?status=${statusFilter}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleApprove = async (requestId: number) => {
    if (!confirm('Подтвердить вывод и пополнить баланс игрока?')) {
      return
    }

    try {
      setProcessingId(requestId)
      const response = await fetch(`/api/referral/withdraw/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (data.success) {
        alert('Вывод подтвержден. Баланс игрока пополнен.')
        fetchRequests()
      } else {
        alert(`Ошибка: ${data.error || 'Не удалось подтвердить вывод'}`)
      }
    } catch (error: any) {
      console.error('Error approving withdrawal:', error)
      alert(`Ошибка: ${error.message || 'Не удалось подтвердить вывод'}`)
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Ожидает'
      case 'completed':
        return 'Выполнено'
      case 'rejected':
        return 'Отклонено'
      default:
        return status
    }
  }

  const getBookmakerName = (bookmaker: string) => {
    const names: Record<string, string> = {
      '1xbet': '1xBet',
      '1win': '1WIN',
      'melbet': 'Melbet',
      'mostbet': 'Mostbet',
    }
    return names[bookmaker.toLowerCase()] || bookmaker
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <div className="text-white">Загрузка...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-4 px-4 space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-10">
          <button
            onClick={() => router.push('/dashboard/menu')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-white">Реф. вывод</h1>
        </div>
        <div className="w-10"></div>
      </div>

      {/* Фильтры - горизонтальный скролл для мобильных */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
            statusFilter === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-white/70 hover:bg-gray-600'
          }`}
        >
          Все
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
            statusFilter === 'pending'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-white/70 hover:bg-gray-600'
          }`}
        >
          Ожидают
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
            statusFilter === 'completed'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-white/70 hover:bg-gray-600'
          }`}
        >
          Выполнено
        </button>
      </div>

      {/* Список заявок */}
      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="bg-gray-800/50 rounded-xl p-8 text-center border border-gray-700">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-white/70 text-lg">Нет заявок на вывод</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 backdrop-blur-sm"
            >
              {/* Заголовок карточки */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(request.status)}`}>
                    {getStatusText(request.status)}
                  </div>
                  <div className="text-white font-semibold text-sm">
                    #{request.id}
                  </div>
                </div>
                <div className="text-white/60 text-xs text-right">
                  {new Date(request.createdAt).toLocaleDateString('ru-RU', { 
                    day: '2-digit', 
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>

              {/* Информация о пользователе и сумме */}
              <div className="space-y-3 mb-3">
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-xs">Пользователь</div>
                  <div className="text-white font-medium text-sm">
                    {request.username ? `@${request.username}` : request.firstName || `ID: ${request.userId}`}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-xs">Сумма</div>
                  <div className="text-green-400 font-bold text-lg">
                    {request.amount.toLocaleString()} {request.currency}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-xs">Казино</div>
                  <div className="text-white font-medium text-sm">
                    {getBookmakerName(request.bookmaker)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-xs">ID аккаунта</div>
                  <div className="text-white font-mono text-xs break-all text-right max-w-[60%]">
                    {request.bookmakerAccountId}
                  </div>
                </div>
              </div>

              {/* Комментарий */}
              {request.adminComment && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mb-3">
                  <div className="text-yellow-400 text-xs font-medium mb-1">Комментарий:</div>
                  <div className="text-yellow-400/80 text-xs break-words">{request.adminComment}</div>
                </div>
              )}

              {/* Кнопка подтверждения */}
              {request.status === 'pending' && (
                <button
                  onClick={() => handleApprove(request.id)}
                  disabled={processingId === request.id}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    processingId === request.id
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
                  }`}
                >
                  {processingId === request.id ? 'Обработка...' : 'Подтвердить'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

