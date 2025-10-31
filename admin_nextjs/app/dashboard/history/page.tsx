'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Transaction {
  id: number
  user_id: string
  account_id: string
  user_display_name: string
  type: string
  amount: number
  status: string
  status_detail: string | null
  bookmaker: string
  bank: string
  created_at: string
}

export default function HistoryPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'deposit' | 'withdraw'>('all')

  useEffect(() => {
    fetchHistory()
  }, [activeTab])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab !== 'all') {
        params.append('type', activeTab === 'deposit' ? 'deposit' : 'withdraw')
      }

      const response = await fetch(`/api/transaction-history?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setTransactions(data.data.transactions || [])
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    } finally {
      setLoading(false)
    }
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

  const getStatusLabel = (status: string, statusDetail: string | null) => {
    // Маппинг статусов на русские метки
    if (status === 'manual' || status === 'awaiting_manual' || statusDetail === 'manual') {
      return { label: 'РУЧНАЯ', color: 'bg-red-500 text-white' }
    }
    if (status === 'rejected' || status === 'declined') {
      return { label: 'ОТКЛОНЕНО', color: 'bg-red-500 text-white' }
    }
    if (status === 'completed' || status === 'auto_completed' || status === 'approved') {
      return { label: 'ЗАВЕРШЕНО', color: 'bg-green-500 text-white' }
    }
    if (status === 'pending' || status === 'processing') {
      return { label: 'ОЖИДАЕТ', color: 'bg-yellow-500 text-black' }
    }
    return { label: status.toUpperCase(), color: 'bg-gray-700 text-gray-300' }
  }

  const getBookmakerName = (bookmaker: string | null) => {
    if (!bookmaker) return ''
    const normalized = bookmaker.toLowerCase()
    if (normalized.includes('1xbet') || normalized.includes('xbet')) return '1xbet'
    if (normalized.includes('melbet')) return 'Melbet'
    if (normalized.includes('mostbet')) return 'Mostbet'
    if (normalized.includes('1win') || normalized.includes('onewin')) return '1win'
    return bookmaker
  }

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="py-4">
      {/* Хедер */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-10"></div>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-white">История</h1>
          <p className="text-xs text-gray-300 mt-1">Все транзакции</p>
        </div>
        <button
          onClick={() => fetchHistory()}
          className="p-2 bg-gray-800 rounded-lg"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Табы фильтрации */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'all'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 bg-opacity-50 text-gray-300 border border-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Все</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'deposit'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 bg-opacity-50 text-gray-300 border border-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span>Пополнения</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'withdraw'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 bg-opacity-50 text-gray-300 border border-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7 7V3" />
            </svg>
            <span>Выводы</span>
          </div>
        </button>
      </div>

      {/* Список транзакций */}
      {transactions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>История транзакций пуста</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => {
            const isDeposit = tx.type === 'deposit'
            const statusInfo = getStatusLabel(tx.status, tx.statusDetail)
            const bookmakerName = getBookmakerName(tx.bookmaker)

            return (
              <Link
                key={tx.id}
                href={`/dashboard/history/${tx.id}`}
                className="block bg-gray-800 bg-opacity-50 rounded-xl p-4 border border-gray-700 backdrop-blur-sm active:bg-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Тип и платформа */}
                    <div className="mb-2">
                      <p className="text-sm font-medium text-white mb-1">
                        {isDeposit ? 'Пополнение' : 'Вывод'}
                      </p>
                      {bookmakerName && (
                        <p className="text-sm text-green-500 font-medium">{bookmakerName}</p>
                      )}
                    </div>

                    {/* Сумма и дата */}
                    <div className="mt-3">
                      <p
                        className={`text-lg font-bold mb-1 ${
                          isDeposit ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {isDeposit ? '+' : '-'}
                        {tx.amount.toLocaleString('ru-RU', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}{' '}
                        сом
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>

                  {/* Статус и стрелка */}
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
