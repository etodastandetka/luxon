"use client"

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    fetchRequests()
  }, [statusFilter])

  const fetchRequests = async () => {
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
  }

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Выводы из рефералки</h1>
          <p className="text-sm text-white/70 mt-1">Управление заявками на вывод реферальных средств</p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Назад
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-white/70 hover:bg-gray-600'
          }`}
        >
          Все
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === 'pending'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-white/70 hover:bg-gray-600'
          }`}
        >
          Ожидают
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === 'completed'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-white/70 hover:bg-gray-600'
          }`}
        >
          Выполнено
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === 'rejected'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-white/70 hover:bg-gray-600'
          }`}
        >
          Отклонено
        </button>
      </div>

      {/* Список заявок */}
      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-white/70">Нет заявок на вывод</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(request.status)}`}>
                      {getStatusText(request.status)}
                    </div>
                    <div className="text-white font-semibold">
                      Заявка #{request.id}
                    </div>
                    <div className="text-white/70 text-sm">
                      {new Date(request.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-white/70 text-sm">Пользователь</div>
                      <div className="text-white font-medium">
                        {request.username ? `@${request.username}` : request.firstName || `ID: ${request.userId}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/70 text-sm">Сумма</div>
                      <div className="text-green-400 font-bold text-lg">
                        {request.amount.toLocaleString()} {request.currency}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/70 text-sm">Казино</div>
                      <div className="text-white font-medium">
                        {getBookmakerName(request.bookmaker)}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/70 text-sm">ID аккаунта</div>
                      <div className="text-white font-mono text-sm">
                        {request.bookmakerAccountId}
                      </div>
                    </div>
                  </div>

                  {request.adminComment && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-3">
                      <div className="text-yellow-400 text-sm font-medium">Комментарий:</div>
                      <div className="text-yellow-400/80 text-sm">{request.adminComment}</div>
                    </div>
                  )}
                </div>

                <div className="ml-4">
                  {request.status === 'pending' && (
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={processingId === request.id}
                      className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                        processingId === request.id
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {processingId === request.id ? 'Обработка...' : 'Подтвердить'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

