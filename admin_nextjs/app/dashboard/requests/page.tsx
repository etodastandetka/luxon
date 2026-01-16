'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Request {
  id: number
  userId: string
  username: string | null
  firstName: string | null
  bookmaker: string | null
  amount: string | null
  requestType: string
  status: string
  processedBy: string | null
  bank: string | null
  createdAt: string
  isVip?: boolean
  is_vip?: boolean
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState<{ type?: string; status?: string }>({})
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const limit = 10

  const isVipRequest = (request: Request) => {
    return Boolean((request as any).is_vip ?? (request as any).isVip)
  }

  const sortRequests = (items: Request[]) => {
    return [...items].sort((a, b) => {
      const vipDiff = Number(isVipRequest(b)) - Number(isVipRequest(a))
      if (vipDiff !== 0) return vipDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }

  const fetchRequests = useCallback(async (showLoading = true, reset = false) => {
    if (reset) {
      setPage(1)
      setRequests([])
      setHasMore(true)
    }
    
    if (showLoading && reset) {
      setLoading(true)
    } else if (!reset) {
      setLoadingMore(true)
    }
    
    try {
      const params = new URLSearchParams()
      if (filter.type) params.append('type', filter.type)
      if (filter.status) params.append('status', filter.status)
      params.append('page', reset ? '1' : page.toString())
      params.append('limit', limit.toString())

      // Используем кэширование для более быстрой загрузки
      const response = await fetch(`/api/requests?${params.toString()}`, {
        cache: 'default',
        next: { revalidate: 3 } // Перевалидируем каждые 3 секунды
      })
      const data = await response.json()

      if (data.success) {
        const newRequests = data.data.requests || []
        if (reset) {
          setRequests(sortRequests(newRequests))
        } else {
          setRequests(prev => sortRequests([...prev, ...newRequests]))
        }
        setHasMore(data.data.pagination?.totalPages > page)
        if (!reset) {
          setPage(prev => prev + 1)
        }
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    } finally {
      if (showLoading && reset) {
        setLoading(false)
      }
      setLoadingMore(false)
    }
  }, [filter, page, limit])

  useEffect(() => {
    fetchRequests(true, true) // Первая загрузка с сбросом
    
    // Автоматическое обновление каждые 5 секунд (увеличено для снижения нагрузки)
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchRequests(false, true) // Обновляем только первую страницу
      }
    }, 5000)
    
    // Обновление при фокусе страницы
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchRequests(false, true)
      }
    }
    
    // Обновление при возврате фокуса
    const handleFocus = () => {
      fetchRequests(false, true)
    }
    
    // Синхронизация между вкладками через storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'request_updated' && e.newValue) {
        const updatedRequestId = parseInt(e.newValue)
        console.log('🔄 Request updated in another tab:', updatedRequestId)
        fetchRequests(false, true)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]) // Убрали fetchRequests из зависимостей, чтобы избежать лишних перезагрузок

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchRequests(false, false)
    }
  }

  // Функция для определения кто обработал заявку (логин админа или "автопополнение")
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

  // Функция для получения цвета текста статуса (без фона)
  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'auto_completed':
      case 'autodeposit_success':
        return 'text-green-500'
      case 'pending':
        return 'text-yellow-500'
      case 'rejected':
      case 'declined':
        return 'text-red-500'
      case 'deferred':
        return 'text-orange-500'
      case 'manual':
      case 'awaiting_manual':
        return 'text-red-500'
      default:
        return 'text-gray-300'
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

  const getBankImage = (bank: string | null) => {
    if (!bank) return null
    const normalized = bank.toLowerCase().trim()
    
    // Маппинг банков на изображения (проверяем точные совпадения и варианты)
    if (normalized === 'demirbank' || normalized === 'demir' || normalized.includes('demirbank') || normalized.includes('demir')) {
      return '/images/demirbank.jpg'
    }
    if (normalized === 'omoney' || normalized === 'o!money' || normalized === 'odengi' || normalized === 'o! bank' || normalized === 'obank' || normalized.includes('omoney') || normalized.includes('odengi')) {
      return '/images/omoney.jpg'
    }
    if (normalized === 'balance' || normalized === 'balance.kg' || normalized.includes('balance')) {
      return '/images/balance.jpg'
    }
    if (normalized === 'bakai' || normalized.includes('bakai')) {
      return '/images/bakai.jpg'
    }
    if (normalized === 'megapay' || normalized.includes('megapay')) {
      return '/images/megapay.jpg'
    }
    if (normalized === 'mbank' || normalized.includes('mbank')) {
      return '/images/mbank.png'
    }
    if (normalized === 'optima' || normalized.includes('optima')) {
      return '/images/optima.jpg'
    }
    if (normalized === 'kompanion' || normalized === 'companion' || normalized.includes('kompanion') || normalized.includes('companion')) {
      return '/images/companion.png'
    }
    
    return null
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
          onClick={() => fetchRequests(true, true)}
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
          {requests.map((request) => {
            const isVip = isVipRequest(request)
            return (
            <Link
              key={request.id}
              href={`/dashboard/requests/${request.id}`}
              prefetch={false}
              className={`block rounded-xl p-4 border transition-colors backdrop-blur-sm ${
                isVip
                  ? 'bg-[#0b0f1a]/90 border-blue-500/40 hover:border-blue-400/70 shadow-[0_0_0_1px_rgba(78,161,255,0.08)]'
                  : 'bg-gray-800 bg-opacity-50 border-gray-700 hover:border-green-500'
              }`}
            >
              <div className="flex items-start justify-between">
                {/* Левая часть: Иконка банка и информация */}
                <div className="flex items-start space-x-3 flex-1">
                  {/* Иконка банка */}
                  {getBankImage(request.bank) ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-600 bg-gray-900 relative">
                      <Image
                        src={getBankImage(request.bank) || ''}
                        alt={request.bank || 'Bank'}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <div className={`w-10 h-10 ${request.requestType === 'deposit' ? 'bg-green-500' : 'bg-red-500'} rounded-full flex items-center justify-center`}>
                        <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {request.requestType === 'deposit' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          )}
                        </svg>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-white">
                        {request.username || request.firstName || request.userId}
                      </span>
                      {isVip && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          VIP
                        </span>
                      )}
                      {/* Бейдж статуса */}
                      <span className={`text-xs font-medium whitespace-nowrap px-2 py-0.5 rounded-md ${getStatusTextColor(request.status)}`}>
                        {getStatusState(request.status)}
                      </span>
                      {/* Бейдж кто обработал */}
                      {getProcessedBy(request.processedBy) && (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-300 rounded-md">
                          {getProcessedBy(request.processedBy) === 'автопополнение' ? 'автопополнение' : getProcessedBy(request.processedBy)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Заявка #{request.id}
                    </p>
                  </div>
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
                </div>
              </div>
            </Link>
          )})}
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

