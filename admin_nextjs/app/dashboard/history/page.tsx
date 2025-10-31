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
    if (status === 'completed' || status === 'auto_completed' || status === 'approved' || status === 'autodeposit_success') {
      return { label: 'Успешно', color: 'bg-green-100 text-green-700 border border-green-300' }
    }
    if (status === 'rejected' || status === 'declined') {
      return { label: 'Отклонено', color: 'bg-red-100 text-red-700 border border-red-300' }
    }
    if (status === 'pending' || status === 'processing') {
      return { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-700 border border-yellow-300' }
    }
    if (status === 'manual' || status === 'awaiting_manual' || statusDetail === 'manual') {
      return { label: 'Ручная', color: 'bg-red-100 text-red-700 border border-red-300' }
    }
    if (status === 'deferred') {
      return { label: 'Отложено', color: 'bg-orange-100 text-orange-700 border border-orange-300' }
    }
    return { label: status, color: 'bg-gray-100 text-gray-700 border border-gray-300' }
  }

  const getTransactionType = (tx: Transaction) => {
    // Определяем тип транзакции для отображения
    if (tx.status_detail?.includes('autodeposit') || tx.status === 'autodeposit_success' || tx.status === 'auto_completed') {
      return 'Авто пополнение'
    }
    // Проверяем наличие profile-* в status_detail или других полях
    if (tx.status_detail?.match(/profile-\d+/)) {
      return tx.status_detail.match(/profile-(\d+)/)?.[0] || 'profile-1'
    }
    // Если есть bookmaker и это депозит, показываем "Авто пополнение"
    if (tx.type === 'deposit' && tx.bookmaker) {
      return 'Авто пополнение'
    }
    // Для выводов может быть profile-*
    if (tx.type === 'withdraw') {
      return tx.status_detail?.match(/profile-\d+/)?.[0] || 'profile-1'
    }
    return tx.type === 'deposit' ? 'Пополнение' : 'Вывод'
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
            const statusInfo = getStatusLabel(tx.status, tx.status_detail)
            const transactionType = getTransactionType(tx)

            return (
              <div
                key={tx.id}
                className="block bg-white rounded-xl p-4 shadow-sm border border-gray-200"
              >
                <div className="flex items-start justify-between">
                  {/* Левая часть: Аватар и информация о пользователе */}
                  <div className="flex items-start space-x-3 flex-1">
                    {/* Аватар */}
                    <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Информация о пользователе и транзакции */}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-black mb-0.5">
                        {tx.user_display_name || 'Неизвестный пользователь'}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">
                        ID: {tx.user_id}
                      </p>
                      
                      {/* Тип транзакции */}
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-md mb-1">
                        {transactionType}
                      </span>
                    </div>
                  </div>

                  {/* Правая часть: Дата, сумма и статус */}
                  <div className="flex flex-col items-end space-y-2 ml-4">
                    {/* Дата и время */}
                    <p className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(tx.created_at)}
                    </p>
                    
                    {/* Сумма */}
                    <p
                      className={`text-base font-bold ${
                        isDeposit ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {isDeposit ? '+' : '-'}
                      {tx.amount.toLocaleString('ru-RU', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).replace('.', ',')}
                    </p>
                    
                    {/* Статус */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${statusInfo.color}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        statusInfo.label === 'Успешно' ? 'bg-green-600' :
                        statusInfo.label === 'Отклонено' ? 'bg-red-600' :
                        'bg-yellow-600'
                      }`}></div>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
