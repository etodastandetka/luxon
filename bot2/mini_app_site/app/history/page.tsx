"use client"
import { useState, useEffect } from 'react'
import { useLanguage } from '../../components/LanguageContext'
import FixedHeaderControls from '../../components/FixedHeaderControls'
import { getTelegramUserId } from '../../utils/telegram'

interface Transaction {
  id: string
  type: 'deposit' | 'withdraw'
  bookmaker: string
  bank?: string
  amount: number
  status: string
  date: string
}

export default function HistoryPage(){
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdraw' | 'manual'>('all')
  const { language } = useLanguage()

  useEffect(() => {
    loadTransactions()
  }, [filter])

  const translations = {
    ru: {
      title: 'История операций',
      empty: 'История операций пуста',
      deposit: 'Пополнение',
      withdraw: 'Вывод',
      pending: 'Отменено',
      completed: 'Успешно',
      approved: 'Успешно',
      rejected: 'Отклонено',
      failed: 'Отклонено',
      deferred: 'Отменено',
      auto_completed: 'Успешно',
      autodeposit_success: 'Успешно',
      cancelled: 'Отменено',
      'profile-5': 'Отклонено',
      loading: 'Загружаем...',
      amount: 'Сумма',
      status: 'Статус',
      date: 'Дата',
      bookmaker: 'Букмекер',
      backToMain: '🔙 На главную',
      all: 'Все',
      manual: 'Ручное'
    },
    en: {
      title: 'Transaction History',
      empty: 'Transaction history is empty',
      deposit: 'Deposit',
      withdraw: 'Withdraw',
      pending: 'Cancelled',
      completed: 'Success',
      approved: 'Success',
      rejected: 'Rejected',
      failed: 'Rejected',
      deferred: 'Cancelled',
      auto_completed: 'Success',
      autodeposit_success: 'Success',
      cancelled: 'Cancelled',
      'profile-5': 'Rejected',
      loading: 'Loading...',
      amount: 'Amount',
      status: 'Status',
      date: 'Date',
      bookmaker: 'Bookmaker',
      backToMain: '🔙 Back to main',
      all: 'All',
      manual: 'Manual'
    },
    ky: {
      title: 'Операциялар тарыхы',
      empty: 'Операциялар тарыхы бош',
      deposit: 'Депозит',
      withdraw: 'Чыгаруу',
      pending: 'Жокко чыгарылды',
      completed: 'Ийгиликтүү',
      approved: 'Ийгиликтүү',
      rejected: 'Токтотулду',
      failed: 'Токтотулду',
      deferred: 'Жокко чыгарылды',
      auto_completed: 'Ийгиликтүү',
      autodeposit_success: 'Ийгиликтүү',
      cancelled: 'Жокко чыгарылды',
      'profile-5': 'Токтотулду',
      loading: 'Жүктөөдө...',
      amount: 'Сумма',
      status: 'Статус',
      date: 'Күн',
      bookmaker: 'Букмекер',
      backToMain: '🔙 Башкы менюга',
      all: 'Баары',
      manual: 'Кол менен'
    },
    uz: {
      title: 'Operatsiyalar tarixi',
      empty: 'Operatsiyalar tarixi bo\'sh',
      deposit: 'Depozit',
      withdraw: 'Chiqarish',
      pending: 'Bekor qilindi',
      completed: 'Muvaffaqiyatli',
      approved: 'Muvaffaqiyatli',
      rejected: 'Rad etildi',
      failed: 'Rad etildi',
      deferred: 'Bekor qilindi',
      auto_completed: 'Muvaffaqiyatli',
      autodeposit_success: 'Muvaffaqiyatli',
      cancelled: 'Bekor qilindi',
      'profile-5': 'Rad etildi',
      loading: 'Yuklanmoqda...',
      amount: 'Miqdor',
      status: 'Holat',
      date: 'Sana',
      bookmaker: 'Bukmeker',
      backToMain: '🔙 Asosiy menyuga',
      all: 'Barchasi',
      manual: 'Qo\'lda'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  const loadTransactions = async () => {
    setLoading(true)
    try {
      // Получаем ID пользователя из Telegram WebApp
      const userId = getTelegramUserId()
      
      console.log('=== DEBUG: History - User ID ===')
      console.log('User ID:', userId)
      console.log('================================')
      
      const finalUserId = userId || 'test_user_123'
      
      if (!userId) {
        console.log('❌ User ID not found, using test user ID')
      }

      // Запрашиваем историю транзакций пользователя с админ-панели API
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'
      
      // Формируем параметры запроса в зависимости от фильтра
      let url = `${apiUrl}/api/transaction-history?user_id=${finalUserId}`
      if (filter === 'deposit') {
        url += '&type=deposit'
      } else if (filter === 'withdraw') {
        url += '&type=withdraw'
      } else if (filter === 'manual') {
        url += '&manual=true' // Специальный параметр для ручных заявок
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      // Админ-панель возвращает данные в формате { success: true, data: { transactions: [...] } }
      const transactionsData = data.data?.transactions || data.transactions || []
      
      if (data.success !== false && transactionsData.length >= 0) {
        // Преобразуем данные в формат для отображения
        const formattedTransactions = transactionsData.map((tx: any) => {
          // Определяем статус: если pending/deferred и прошло больше 5 минут - это отменено
          let finalStatus = tx.status || 'pending'
          if ((finalStatus === 'pending' || finalStatus === 'deferred') && tx.date) {
            const txDate = new Date(tx.date || tx.created_at)
            const now = new Date()
            const diffMinutes = (now.getTime() - txDate.getTime()) / (1000 * 60)
            // Если прошло больше 5 минут и статус pending - это отменено
            if (diffMinutes > 5 && finalStatus === 'pending') {
              finalStatus = 'cancelled'
            }
          }
          
          return {
            id: tx.id?.toString() || '',
            type: tx.type || tx.request_type || 'deposit',
            bookmaker: tx.bookmaker || '',
            bank: tx.bank || '',
            amount: tx.amount || 0,
            status: finalStatus,
            date: tx.date || tx.created_at || new Date().toISOString()
          }
        })
        
        setTransactions(formattedTransactions)
      } else {
        console.error('Error loading transactions:', data.error || data)
        setTransactions([])
      }
    } catch (error) {
      console.error('Error loading transactions:', error)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  // Функция для совместимости с HTML шаблоном
  const displayRealTransactions = () => {
    loadTransactions()
  }

  // Делаем функцию доступной глобально для HTML шаблона
  useEffect(() => {
    (window as any).displayRealTransactions = displayRealTransactions
  }, [])

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      // Проверяем, сегодня ли это
      if (date.toDateString() === today.toDateString()) {
        return `Сегодня ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
      }
      // Проверяем, вчера ли это
      else if (date.toDateString() === yesterday.toDateString()) {
        return `Вчера ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
      }
      // Иначе показываем полную дату
      else {
        return date.toLocaleDateString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    } catch (error) {
      // Если не удалось распарсить дату, возвращаем как есть
      return dateString
    }
  }

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'completed':
      case 'approved':
      case 'auto_completed':
      case 'autodeposit_success':
        return 'text-green-400'
      case 'pending':
      case 'deferred':
      case 'cancelled':
        return 'text-yellow-400'
      case 'failed':
      case 'rejected':
      case 'profile-5':
        return 'text-red-400'
      default:
        // Для неизвестных статусов проверяем, содержит ли он "profile"
        if (statusLower.includes('profile')) {
          return 'text-red-400' // Отклонено
        }
        return 'text-yellow-400' // По умолчанию отменено
    }
  }

  const getStatusText = (status: string) => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      // Успешно
      case 'completed':
      case 'approved':
      case 'auto_completed':
      case 'autodeposit_success':
        return t.completed // "Успешно"
      // Отклонено
      case 'rejected':
      case 'failed':
      case 'profile-5':
        return t.rejected // "Отклонено"
      // Отменено (таймер истек, не нажал "Я оплатил")
      case 'pending':
      case 'deferred':
      case 'cancelled':
        return t.pending // "Отменено"
      default:
        // Для неизвестных статусов проверяем, содержит ли он "profile" или другие ошибки
        if (statusLower.includes('profile') || statusLower.includes('error') || statusLower.includes('fail')) {
          return t.rejected // "Отклонено"
        }
        // По умолчанию считаем отменено
        return t.pending // "Отменено"
    }
  }

  const getTypeText = (type: string) => {
    return type === 'deposit' ? t.deposit : t.withdraw
  }

  const getBookmakerName = (bookmaker: string) => {
    const names: Record<string, string> = {
      '1xbet': '1xBet',
      '1win': '1WIN',
      'melbet': 'Melbet',
      'mostbet': 'Mostbet',
      'winwin': 'Winwin',
      '888starz': '888starz',
    }
    return names[bookmaker?.toLowerCase()] || bookmaker || 'N/A'
  }

  const getBankIcon = (bankCode: string) => {
    if (!bankCode) return null
    
    // Маппинг кодов банков из API в коды для иконок
    const bankMapping: Record<string, { image?: string; emoji?: string; name: string }> = {
      'kompanion': { image: '/images/companion.png', name: 'Компаньон' },
      'demirbank': { image: '/images/demirbank.jpg', name: 'DemirBank' },
      'demir': { image: '/images/demirbank.jpg', name: 'DemirBank' },
      'omoney': { image: '/images/omoney.jpg', name: 'O!Money' },
      'odengi': { image: '/images/omoney.jpg', name: 'O!Money' },
      'balance': { image: '/images/balance.jpg', name: 'Balance.kg' },
      'bakai': { image: '/images/bakai.jpg', name: 'Bakai' },
      'megapay': { image: '/images/megapay.jpg', name: 'MegaPay' },
      'mbank': { image: '/images/mbank.png', name: 'MBank' },
    }
    
    const bank = bankMapping[bankCode.toLowerCase()]
    return bank || null
  }

  return (
    <main className="space-y-6">
      <FixedHeaderControls />
      {/* Заголовок */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white pr-20">{t.title}</h1>
        </div>
        <div className="px-4 overflow-x-auto -mx-4">
          <div className="flex justify-start gap-1.5 min-w-max px-4 pb-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-0.5 whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {t.all}
            </button>
            <button
              onClick={() => setFilter('deposit')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-0.5 whitespace-nowrap ${
                filter === 'deposit'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              {t.deposit}
            </button>
            <button
              onClick={() => setFilter('withdraw')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-0.5 whitespace-nowrap ${
                filter === 'withdraw'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {t.withdraw}
            </button>
            <button
              onClick={() => setFilter('manual')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-0.5 whitespace-nowrap ${
                filter === 'manual'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t.manual}
            </button>
          </div>
        </div>
      </div>

      {/* Список транзакций */}
      <section className="space-y-3">
        {loading ? (
          <div className="card text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <div className="text-white/70">{t.loading}</div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-white/70 text-lg">{t.empty}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => {
              const bankIcon = getBankIcon(transaction.bank || '')
              return (
              <div key={transaction.id} className="card hover:bg-white/5 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-2">
                      {bankIcon ? (
                        bankIcon.image ? (
                          <img 
                            src={bankIcon.image} 
                            alt={bankIcon.name}
                            className="w-8 h-8 object-contain rounded flex-shrink-0"
                          />
                        ) : (
                          <span className="text-xl flex-shrink-0">{bankIcon.emoji}</span>
                        )
                      ) : (
                        <div className={`w-2 h-2 rounded-full ${
                          transaction.type === 'deposit' ? 'bg-green-400' : 'bg-red-400'
                        }`}></div>
                      )}
                      <div className="font-semibold text-white text-base">
                        {getTypeText(transaction.type)}
                      </div>
                      <div className="text-white/60 text-sm">
                        • {getBookmakerName(transaction.bookmaker)}
                      </div>
                    </div>
                    <div className="text-xs text-white/50">
                      {formatDate(transaction.date)}
                    </div>
                  </div>
                  <div className="text-right space-y-1 ml-4">
                    <div className={`font-bold text-lg ${
                      transaction.type === 'deposit' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {transaction.type === 'deposit' ? '+' : '-'}{transaction.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} сом
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${
                      (() => {
                        const color = getStatusColor(transaction.status)
                        const bgColor = color.replace('text-green-400', 'bg-green-500/20').replace('text-yellow-400', 'bg-yellow-500/20').replace('text-red-400', 'bg-red-500/20').replace('text-white/60', 'bg-gray-500/20')
                        return `${bgColor} ${color} border ${color.replace('text-', 'border-').replace('400', '500/30')}`
                      })()
                    }`}>
                      {getStatusText(transaction.status)}
                    </div>
                  </div>
                </div>
              </div>
            )
            })}
          </div>
        )}
      </section>

      {/* Навигация */}
      <div className="text-center px-4 pb-6">
        <a 
          href="/" 
          className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
        >
          {t.backToMain}
        </a>
      </div>
    </main>
  )
}

