"use client"
import { useState, useEffect } from 'react'
import { useLanguage } from '../../components/LanguageContext'
import { getTelegramUserId } from '../../utils/telegram'

interface Transaction {
  id: string
  type: 'deposit' | 'withdraw'
  bookmaker: string
  amount: number
  status: string
  date: string
}

export default function HistoryPage(){
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const { language } = useLanguage()

  useEffect(() => {
    loadTransactions()
  }, [])

  const translations = {
    ru: {
      title: 'История операций',
      empty: 'История операций пуста',
      deposit: 'Пополнение',
      withdraw: 'Вывод',
      pending: 'Ожидает',
      completed: 'Завершено',
      approved: 'Подтверждено',
      rejected: 'Отклонено',
      failed: 'Ошибка',
      deferred: 'Отложено',
      auto_completed: 'Автозавершено',
      autodeposit_success: 'Автопополнение',
      loading: 'Загружаем...',
      amount: 'Сумма',
      status: 'Статус',
      date: 'Дата',
      bookmaker: 'Букмекер'
    },
    en: {
      title: 'Transaction History',
      empty: 'Transaction history is empty',
      deposit: 'Deposit',
      withdraw: 'Withdraw',
      pending: 'Pending',
      completed: 'Completed',
      approved: 'Approved',
      rejected: 'Rejected',
      failed: 'Failed',
      deferred: 'Deferred',
      auto_completed: 'Auto Completed',
      autodeposit_success: 'Auto Deposit',
      loading: 'Loading...',
      amount: 'Amount',
      status: 'Status',
      date: 'Date',
      bookmaker: 'Bookmaker'
    },
    ky: {
      title: 'Операциялар тарыхы',
      empty: 'Операциялар тарыхы бош',
      deposit: 'Депозит',
      withdraw: 'Чыгаруу',
      pending: 'Күтүүдө',
      completed: 'Аякталды',
      approved: 'Ырасталды',
      rejected: 'Токтотулду',
      failed: 'Ката',
      deferred: 'Кечиктирилди',
      auto_completed: 'Авто аякталды',
      autodeposit_success: 'Авто депозит',
      loading: 'Жүктөөдө...',
      amount: 'Сумма',
      status: 'Статус',
      date: 'Күн',
      bookmaker: 'Букмекер'
    },
    uz: {
      title: 'Operatsiyalar tarixi',
      empty: 'Operatsiyalar tarixi bo\'sh',
      deposit: 'Depozit',
      withdraw: 'Chiqarish',
      pending: 'Kutilmoqda',
      completed: 'Tugallandi',
      approved: 'Tasdiqlandi',
      rejected: 'Rad etildi',
      failed: 'Xatolik',
      deferred: 'Keiktirildi',
      auto_completed: 'Avto tugallandi',
      autodeposit_success: 'Avto depozit',
      loading: 'Yuklanmoqda...',
      amount: 'Miqdor',
      status: 'Holat',
      date: 'Sana',
      bookmaker: 'Bukmeker'
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
      const response = await fetch(`${apiUrl}/api/transaction-history?user_id=${finalUserId}`)
      const data = await response.json()
      
      // Админ-панель возвращает данные в формате { success: true, data: { transactions: [...] } }
      const transactionsData = data.data?.transactions || data.transactions || []
      
      if (data.success !== false && transactionsData.length >= 0) {
        // Преобразуем данные в формат для отображения
        const formattedTransactions = transactionsData.map((tx: any) => ({
          id: tx.id?.toString() || '',
          type: tx.type || tx.request_type || 'deposit',
          bookmaker: tx.bookmaker || '',
          amount: tx.amount || 0,
          status: tx.status || 'pending',
          date: tx.date || tx.created_at || new Date().toISOString()
        }))
        
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
    switch (status.toLowerCase()) {
      case 'completed':
      case 'approved':
      case 'auto_completed':
      case 'autodeposit_success':
        return 'text-green-400'
      case 'pending':
      case 'deferred':
        return 'text-yellow-400'
      case 'failed':
      case 'rejected':
        return 'text-red-400'
      default:
        return 'text-white/60'
    }
  }

  const getStatusText = (status: string) => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'completed':
        return t.completed
      case 'approved':
        return t.approved
      case 'pending':
        return t.pending
      case 'rejected':
        return t.rejected
      case 'failed':
        return t.failed
      case 'deferred':
        return t.deferred
      case 'auto_completed':
        return t.auto_completed
      case 'autodeposit_success':
        return t.autodeposit_success
      default:
        // Если статус не найден, возвращаем первую букву заглавной
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
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
    }
    return names[bookmaker?.toLowerCase()] || bookmaker || 'N/A'
  }

  return (
    <main className="space-y-6">
      {/* Заголовок */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        </div>
        <div className="flex justify-center">
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
            {transactions.map((transaction) => (
              <div key={transaction.id} className="card hover:bg-white/5 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        transaction.type === 'deposit' ? 'bg-green-400' : 'bg-red-400'
                      }`}></div>
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
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
