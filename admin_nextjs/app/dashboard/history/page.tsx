'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

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
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'deposit' | 'withdraw' | 'manual'>('all')
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 20 // Увеличиваем лимит для быстрой загрузки

  const fetchHistory = useCallback(async (reset = false) => {
    if (reset) {
      setOffset(0)
      setTransactions([])
      setHasMore(true)
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    
    try {
      const params = new URLSearchParams()
      if (activeTab === 'manual') {
        params.append('manual', 'true')
      } else if (activeTab !== 'all') {
        params.append('type', activeTab === 'deposit' ? 'deposit' : 'withdraw')
      }
      params.append('limit', limit.toString())
      params.append('offset', reset ? '0' : offset.toString())

      // Используем кеширование для ускорения загрузки
      const response = await fetch(`/api/transaction-history?${params.toString()}`, {
        cache: reset ? 'no-store' : 'default', // При первой загрузке не кешируем
      })
      const data = await response.json()

      if (data.success) {
        const newTransactions = data.data.transactions || []
        if (reset) {
          setTransactions(newTransactions)
        } else {
          setTransactions(prev => [...prev, ...newTransactions])
        }
        setHasMore(data.data.pagination?.hasMore || false)
        setOffset(reset ? newTransactions.length : offset + newTransactions.length)
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeTab, offset, limit])

  useEffect(() => {
    fetchHistory(true) // Сбрасываем при изменении таба
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchHistory(false)
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

  // Функция для определения кто обработал транзакцию (логин админа или "автопополнение")
  const getProcessedBy = (processedBy: string | null | undefined) => {
    if (!processedBy) {
      return null
    }
    return processedBy === 'автопополнение' ? 'автопополнение' : processedBy
  }

  // Функция для определения состояния (Успешно/Отклонено/Ожидает)
  const getStatusState = (status: string) => {
    if (status === 'completed' || status === 'approved' || status === 'auto_completed' || status === 'autodeposit_success') {
      return 'Успешно'
    }
    if (status === 'rejected' || status === 'declined') {
      return 'Отклонено'
    }
    if (status === 'pending' || status === 'processing') {
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

  const getStatusLabel = (status: string, statusDetail: string | null) => {
    // Маппинг статусов на русские метки (темная тема)
    if (status === 'completed' || status === 'auto_completed' || status === 'approved' || status === 'autodeposit_success') {
      return { label: 'Успешно', color: 'bg-green-500 text-black border border-green-400', textColor: 'text-green-500' }
    }
    if (status === 'rejected' || status === 'declined') {
      return { label: 'Отклонено', color: 'bg-red-500 text-white border border-red-400', textColor: 'text-red-500' }
    }
    if (status === 'pending' || status === 'processing') {
      return { label: 'Ожидает', color: 'bg-yellow-500 text-black border border-yellow-400', textColor: 'text-yellow-500' }
    }
    if (status === 'manual' || status === 'awaiting_manual' || statusDetail === 'manual') {
      return { label: 'Ручная', color: 'bg-red-500 text-white border border-red-400', textColor: 'text-red-500' }
    }
    if (status === 'deferred') {
      return { label: 'Отложено', color: 'bg-orange-500 text-white border border-orange-400', textColor: 'text-orange-500' }
    }
    return { label: status, color: 'bg-gray-700 text-gray-300 border border-gray-600', textColor: 'text-gray-300' }
  }

  const getTransactionType = (tx: Transaction) => {
    // Если статус "Ожидает", показываем "-"
    if (tx.status === 'pending' || tx.status === 'processing') {
      return '-'
    }
    
    // Используем processedBy если доступно
    const processedBy = getProcessedBy((tx as any).processedBy)
    if (processedBy) {
      return processedBy === 'автопополнение' ? 'автопополнение' : processedBy
    }
    
    // Если processedBy нет, показываем "-"
    return '-'
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

  const getBankImage = (bank: string | null) => {
    if (!bank) return null
    const normalized = bank.toLowerCase()
    
    // Маппинг банков на изображения
    if (normalized.includes('demirbank') || normalized.includes('demir')) {
      return '/images/demirbank.jpg'
    }
    if (normalized.includes('omoney') || normalized.includes('o!money')) {
      return '/images/omoney.jpg'
    }
    if (normalized.includes('balance')) {
      return '/images/balance.jpg'
    }
    if (normalized.includes('bakai')) {
      return '/images/bakai.jpg'
    }
    if (normalized.includes('megapay')) {
      return '/images/megapay.jpg'
    }
    if (normalized.includes('mbank')) {
      return '/images/mbank.png'
    }
    if (normalized.includes('optima')) {
      return '/images/optima.jpg'
    }
    if (normalized.includes('companion')) {
      return '/images/companion.png'
    }
    
    return null
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
          onClick={() => fetchHistory(true)}
          className="p-2 bg-gray-800 rounded-lg"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Табы фильтрации */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl font-medium text-xs transition-all whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 bg-opacity-50 text-gray-300 border border-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Все</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl font-medium text-xs transition-all whitespace-nowrap ${
            activeTab === 'deposit'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 bg-opacity-50 text-gray-300 border border-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span>Пополнения</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl font-medium text-xs transition-all whitespace-nowrap ${
            activeTab === 'withdraw'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 bg-opacity-50 text-gray-300 border border-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7 7V3" />
            </svg>
            <span>Выводы</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl font-medium text-xs transition-all whitespace-nowrap ${
            activeTab === 'manual'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 bg-opacity-50 text-gray-300 border border-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Ручное</span>
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
            const processedBy = getProcessedBy((tx as any).processedBy)
            const transactionType = processedBy ? (processedBy === 'автопополнение' ? 'автопополнение' : processedBy) : '-'
            const transactionTypeLabel = processedBy ? (processedBy === 'автопополнение' ? 'автопополнение' : processedBy) : '-'
            const statusState = getStatusState(tx.status)

            return (
              <Link
                key={tx.id}
                href={`/dashboard/requests/${tx.id}`}
                className="block bg-gray-800 bg-opacity-50 rounded-xl p-4 border border-gray-700 hover:border-green-500 transition-colors backdrop-blur-sm cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  {/* Левая часть: Аватар и информация о пользователе */}
                  <div className="flex items-start space-x-3 flex-1">
                    {/* Иконка банка */}
                    {getBankImage(tx.bank) ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-600 bg-gray-900 relative">
                        <Image
                          src={getBankImage(tx.bank) || ''}
                          alt={tx.bank || 'Bank'}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Информация о пользователе и транзакции */}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-white mb-0.5">
                        {tx.user_display_name || 'Неизвестный пользователь'}
                      </p>
                      <p className="text-xs text-gray-400 mb-2">
                        ID: {tx.user_id}
                      </p>
                      
                      {/* Тип транзакции */}
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-500 bg-opacity-20 text-blue-300 rounded-md mb-1 border border-blue-500 border-opacity-30">
                        {transactionTypeLabel}
                      </span>
                    </div>
                  </div>

                  {/* Правая часть: Дата, сумма и статус */}
                  <div className="flex flex-col items-end space-y-2 ml-4">
                    {/* Дата и время */}
                    <p className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(tx.created_at)}
                    </p>
                    
                    {/* Сумма */}
                    <p
                      className={`text-base font-bold ${
                        isDeposit ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {isDeposit ? '+' : '-'}
                      {tx.amount.toLocaleString('ru-RU', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).replace('.', ',')}
                    </p>
                    
                    {/* Статус */}
                    <span className={`text-xs font-medium whitespace-nowrap ${statusInfo.textColor || 'text-gray-300'}`}>
                      {statusState}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Кнопка "Загрузить еще" */}
      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? 'Загрузка...' : 'Загрузить еще'}
          </button>
        </div>
      )}
    </div>
  )
}
