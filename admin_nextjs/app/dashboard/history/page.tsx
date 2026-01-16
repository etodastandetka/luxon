'use client'

import { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'deposit' | 'withdraw' | 'manual'>('all')
  const [isInitialLoad, setIsInitialLoad] = useState(true) // Флаг первой загрузки
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortByAmountDesc, setSortByAmountDesc] = useState(true)
  const [appliedAmountMin, setAppliedAmountMin] = useState('')
  const [appliedAmountMax, setAppliedAmountMax] = useState('')
  const [appliedDateFrom, setAppliedDateFrom] = useState('')
  const [appliedDateTo, setAppliedDateTo] = useState('')
  const [appliedSortByAmountDesc, setAppliedSortByAmountDesc] = useState(true)
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const calendarRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const limit = 300 // Крупные порции для быстрой первой отрисовки
  const loadTokenRef = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (dateFrom && dateTo) {
      setSelectedDates([new Date(dateFrom), new Date(dateTo)])
    } else if (!dateFrom && !dateTo) {
      setSelectedDates([])
    }
  }, [dateFrom, dateTo])

  const handleDateClick = (date: Date) => {
    if (selectedDates.length === 0) {
      setSelectedDates([date])
    } else if (selectedDates.length === 1) {
      const firstDate = selectedDates[0]
      if (date < firstDate) {
        setSelectedDates([date, firstDate])
      } else {
        setSelectedDates([firstDate, date])
      }
    } else {
      setSelectedDates([date])
    }
  }

  const handleApplyPeriod = () => {
    if (selectedDates.length >= 1) {
      const start = selectedDates[0].toISOString().split('T')[0]
      const end = selectedDates.length === 2 ? selectedDates[1].toISOString().split('T')[0] : start
      setDateFrom(start)
      setDateTo(end)
      setShowCalendar(false)
    }
  }

  const handleClearPeriod = () => {
    setSelectedDates([])
    setDateFrom('')
    setDateTo('')
    setShowCalendar(false)
  }

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const generateCalendar = () => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentYear, currentMonth, day))
    }

    return days
  }

  const getMonthName = () => {
    return new Date(currentYear, currentMonth).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  }

  const isDateInRange = (date: Date) => {
    if (selectedDates.length === 0) return false
    if (selectedDates.length === 1) {
      return date.toDateString() === selectedDates[0].toDateString()
    }
    return date >= selectedDates[0] && date <= selectedDates[1]
  }

  const isDateSelected = (date: Date) => {
    return selectedDates.some(d => d.toDateString() === date.toDateString())
  }

  const formatDateRange = () => {
    if (dateFrom && dateTo) {
      return `${dateFrom} — ${dateTo}`
    }
    return 'Выберите период'
  }

  const fetchHistory = useCallback(async (reset = false) => {
    // При первой загрузке не показываем лоадер - данные загружаются в фоне
    const isFirstLoad = isInitialLoad && reset
    
    if (reset) {
      setOffset(0)
      setTransactions([])
      setHasMore(true)
      if (!isInitialLoad) {
        setLoading(true)
      }
    } else {
      setLoadingMore(true)
    }
    
    try {
      const buildParams = (offsetValue: number) => {
        const params = new URLSearchParams()
        if (activeTab === 'manual') {
          params.append('manual', 'true')
        } else if (activeTab !== 'all') {
          params.append('type', activeTab === 'deposit' ? 'deposit' : 'withdraw')
        }
        params.append('limit', limit.toString())
        params.append('offset', offsetValue.toString())
        return params
      }

      const fetchPage = async (offsetValue: number) => {
        const params = buildParams(offsetValue)
        const response = await fetch(`/api/transaction-history?${params.toString()}`, {
          cache: 'default',
          priority: 'high',
        })

        if (response.status === 429) {
          console.warn('⚠️ Rate limit exceeded for history API')
          return { success: false, data: null }
        }

        const data = await response.json()
        if (!data.success) {
          console.error('❌ [History] Ошибка загрузки:', data.error)
        }
        return data
      }

      if (reset) {
        const token = ++loadTokenRef.current

        // Быстро грузим первую порцию и показываем сразу
        const firstPage = await fetchPage(0)
        if (!firstPage?.success || loadTokenRef.current !== token) return

        const firstTransactions = firstPage.data?.transactions || []
        setTransactions(firstTransactions)
        setOffset(firstTransactions.length)
        setHasMore(firstPage.data?.pagination?.hasMore || false)

        // Догружаем остальное в фоне, не блокируя UI
        let currentOffset = firstTransactions.length
        let more = firstPage.data?.pagination?.hasMore || false
        while (more && loadTokenRef.current === token) {
          const nextPage = await fetchPage(currentOffset)
          if (!nextPage?.success || loadTokenRef.current !== token) break

          const nextTransactions = nextPage.data?.transactions || []
          if (nextTransactions.length === 0) {
            more = false
            break
          }

          setTransactions(prev => [...prev, ...nextTransactions])
          currentOffset += nextTransactions.length
          setOffset(currentOffset)
          more = nextPage.data?.pagination?.hasMore || false
        }

        setHasMore(false)
      } else {
        const data = await fetchPage(offset)
        if (!data?.success) return

        const newTransactions = data.data?.transactions || []
        console.log('✅ [History] Загружено транзакций:', newTransactions.length, 'для таба:', activeTab)
        setTransactions(prev => {
          const combined = [...prev, ...newTransactions]
          setOffset(combined.length)
          return combined
        })
        setHasMore(data.data?.pagination?.hasMore || false)
      }
      
      // Сбрасываем флаг первой загрузки после успешной загрузки
      if (isFirstLoad) {
        setIsInitialLoad(false)
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeTab, isInitialLoad, limit, offset])

  // Загружаем данные при монтировании и при изменении таба
  useEffect(() => {
    console.log('📋 [History] Загрузка данных для таба:', activeTab, 'isInitialLoad:', isInitialLoad)
    // Сбрасываем и загружаем первую порцию данных
    fetchHistory(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Автоматическая подгрузка при скролле вниз
  useEffect(() => {
    const handleScroll = () => {
      // Проверяем, достигли ли мы 80% от конца страницы
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      
      const scrollPercentage = (scrollTop + windowHeight) / documentHeight
      
      if (scrollPercentage > 0.8 && hasMore && !loadingMore && !loading) {
        fetchHistory(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasMore, loadingMore, loading, fetchHistory])

  // Мемоизируем функции форматирования
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}.${month}.${year} • ${hours}:${minutes}`
  }, [])

  // Функция для определения кто обработал транзакцию (логин админа или "автопополнение")
  const getProcessedBy = useCallback((processedBy: string | null | undefined) => {
    if (!processedBy) {
      return null
    }
    return processedBy === 'автопополнение' ? 'автопополнение' : processedBy
  }, [])

  // Функция для определения состояния (Успешно/Отклонено/Ожидает)
  const getStatusState = useCallback((status: string) => {
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
  }, [])

  const getStatusLabel = useCallback((status: string, statusDetail: string | null) => {
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
  }, [])

  const getBankImage = useCallback((bank: string | null) => {
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
    if (normalized.includes('optima')) {
      return '/images/optima.jpg'
    }
    if (normalized.includes('companion')) {
      return '/images/companion.png'
    }
    
    return null
  }, [])

  // Мемоизируем обработанные транзакции для оптимизации рендеринга
  const processedTransactions = useMemo(() => {
    return transactions.map((tx) => {
      const isDeposit = tx.type === 'deposit'
      const statusInfo = getStatusLabel(tx.status, tx.status_detail)
      const processedBy = getProcessedBy((tx as any).processedBy)
      const transactionType = processedBy ? (processedBy === 'автопополнение' ? 'автопополнение' : processedBy) : '-'
      const statusState = getStatusState(tx.status)
      const bankImage = getBankImage(tx.bank)
      const formattedDate = formatDate(tx.created_at)
      const formattedAmount = tx.amount.toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).replace('.', ',')

      return {
        ...tx,
        isDeposit,
        statusInfo,
        transactionType,
        statusState,
        bankImage,
        formattedDate,
        formattedAmount,
      }
    })
  }, [transactions, getStatusLabel, getProcessedBy, getStatusState, getBankImage, formatDate])

  const filteredTransactions = useMemo(() => {
    const minValue = appliedAmountMin.trim() ? parseFloat(appliedAmountMin.replace(',', '.')) : null
    const maxValue = appliedAmountMax.trim() ? parseFloat(appliedAmountMax.replace(',', '.')) : null
    const fromDate = appliedDateFrom ? new Date(`${appliedDateFrom}T00:00:00`) : null
    const toDate = appliedDateTo ? new Date(`${appliedDateTo}T23:59:59`) : null

    const filtered = processedTransactions.filter((tx) => {
      if (minValue !== null && !Number.isNaN(minValue) && tx.amount < minValue) return false
      if (maxValue !== null && !Number.isNaN(maxValue) && tx.amount > maxValue) return false

      const txDate = new Date(tx.created_at)
      if (fromDate && txDate < fromDate) return false
      if (toDate && txDate > toDate) return false

      return true
    })

    if (appliedSortByAmountDesc) {
      return [...filtered].sort((a, b) => {
        const amountDiff = b.amount - a.amount
        if (amountDiff !== 0) return amountDiff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }

    return filtered
  }, [
    processedTransactions,
    appliedAmountMin,
    appliedAmountMax,
    appliedDateFrom,
    appliedDateTo,
    appliedSortByAmountDesc,
  ])

  // Показываем скелетон только если нет данных И идет загрузка (не при первой загрузке)
  const showSkeleton = transactions.length === 0 && loading && !isInitialLoad

  // Мемоизированный компонент для элемента списка транзакций
  const TransactionItem = memo(({ tx }: { tx: typeof processedTransactions[0] }) => {
    const bankImage = tx.bankImage
    const isDeposit = tx.isDeposit
    const statusInfo = tx.statusInfo
    const transactionType = tx.transactionType
    const statusState = tx.statusState
    const formattedDate = tx.formattedDate
    const formattedAmount = tx.formattedAmount

    return (
      <Link
        href={`/dashboard/requests/${tx.id}`}
        prefetch={false}
        className="block bg-gray-800 bg-opacity-50 rounded-xl p-4 border border-gray-700 hover:border-green-500 transition-colors backdrop-blur-sm cursor-pointer"
      >
        <div className="flex items-start justify-between">
          {/* Левая часть: Аватар и информация о пользователе */}
          <div className="flex items-start space-x-3 flex-1">
            {/* Иконка банка */}
            {bankImage ? (
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-600 bg-gray-900 relative">
                <Image
                  src={bankImage}
                  alt={tx.bank || 'Bank'}
                  fill
                  className="object-cover"
                  loading="lazy"
                  sizes="48px"
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
                {transactionType}
              </span>
            </div>
          </div>

          {/* Правая часть: Дата, сумма и статус */}
          <div className="flex flex-col items-end space-y-2 ml-4">
            {/* Дата и время */}
            <p className="text-xs text-gray-400 whitespace-nowrap">
              {formattedDate}
            </p>
            
            {/* Сумма */}
            <p
              className={`text-base font-bold ${
                isDeposit ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {isDeposit ? '+' : '-'}{formattedAmount}
            </p>
            
            {/* Статус - используем русский текст из statusInfo.label */}
            <span className={`text-xs font-medium whitespace-nowrap ${statusInfo.textColor || 'text-gray-300'}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>
      </Link>
    )
  })
  TransactionItem.displayName = 'TransactionItem'

  return (
    <div className="py-4 overflow-x-hidden">
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

      {/* Фильтры по сумме и датам */}
      <div className="mb-4 bg-gray-800/60 rounded-xl p-3 border border-gray-700">
        <div className="grid grid-cols-1 gap-2 mb-2">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Мин сумма"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="Макс сумма"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
          </div>
          <div className="relative" ref={calendarRef}>
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center justify-between"
            >
              <span className={dateFrom && dateTo ? 'text-white' : 'text-gray-400'}>
                {formatDateRange()}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            {mounted && showCalendar && createPortal(
              <>
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowCalendar(false)}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}
                />
                <div
                  className="fixed flex items-start justify-center pt-16 px-4 pointer-events-none"
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, pointerEvents: 'none' }}
                >
                  <div
                    className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-2xl max-w-xs w-full relative"
                    onClick={(e) => e.stopPropagation()}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <button
                          type="button"
                          onClick={goToPreviousMonth}
                          className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <h3 className="text-white font-semibold text-sm">{getMonthName()}</h3>
                        <button
                          type="button"
                          onClick={goToNextMonth}
                          className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-0.5 mb-1">
                        {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((day) => (
                          <div key={day} className="text-center text-[10px] text-gray-400 py-0.5">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-0.5">
                        {generateCalendar().map((date, index) => {
                          if (!date) {
                            return <div key={index} className="aspect-square" />
                          }
                          const inRange = isDateInRange(date)
                          const isSelected = isDateSelected(date)
                          const isToday = date.toDateString() === new Date().toDateString()

                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleDateClick(date)}
                              className={`aspect-square rounded text-xs transition-colors ${
                                isSelected
                                  ? 'bg-green-500 text-black font-bold'
                                  : inRange
                                  ? 'bg-green-500/30 text-white'
                                  : isToday
                                  ? 'bg-gray-700 text-white font-semibold'
                                  : 'text-white hover:bg-gray-700'
                              }`}
                            >
                              {date.getDate()}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleClearPeriod}
                        className="text-xs text-gray-300 hover:text-white"
                      >
                        Сбросить
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyPeriod}
                        className="px-3 py-1 bg-green-500 text-black text-xs font-medium rounded-md hover:bg-green-600"
                      >
                        Готово
                      </button>
                    </div>
                  </div>
                </div>
              </>
            , document.body)}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sortByAmountDesc}
              onChange={(e) => setSortByAmountDesc(e.target.checked)}
              className="w-3.5 h-3.5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-xs text-gray-300">Сортировать по сумме ↓</span>
          </label>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setAppliedAmountMin(amountMin)
                setAppliedAmountMax(amountMax)
                setAppliedDateFrom(dateFrom)
                setAppliedDateTo(dateTo)
                setAppliedSortByAmountDesc(sortByAmountDesc)
              }}
              className="text-xs text-green-400 hover:text-green-300"
            >
              Применить
            </button>
            <button
              onClick={() => {
                setAmountMin('')
                setAmountMax('')
                setDateFrom('')
                setDateTo('')
                setSortByAmountDesc(true)
                setAppliedAmountMin('')
                setAppliedAmountMax('')
                setAppliedDateFrom('')
                setAppliedDateTo('')
                setAppliedSortByAmountDesc(true)
              }}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>

      {/* Список транзакций */}
      {transactions.length === 0 && !loading && !isInitialLoad ? (
        // Показываем пустое состояние только если данных нет, не идет загрузка И не первая загрузка
        <div className="text-center py-12 text-gray-400">
          <p>История транзакций пуста</p>
        </div>
      ) : transactions.length === 0 && isInitialLoad ? (
        // При первой загрузке показываем скелетон (данные загружаются в фоне)
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-800 bg-opacity-50 rounded-xl p-4 border border-gray-700 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-700 rounded w-24"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-gray-700 rounded w-20 mb-2"></div>
                  <div className="h-3 bg-gray-700 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
            {filteredTransactions.map((tx) => (
            <TransactionItem key={tx.id} tx={tx} />
          ))}
          {/* Индикатор загрузки при подгрузке дополнительных данных */}
          {loadingMore && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm">Загрузка...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
