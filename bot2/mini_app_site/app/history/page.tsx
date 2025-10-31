"use client"
import { useState, useEffect } from 'react'
import { useLanguage } from '../../components/LanguageContext'
import { getTelegramUserId } from '../../utils/telegram'

interface Transaction {
  id: string
  type: 'deposit' | 'withdraw'
  bookmaker: string
  amount: number
  status: 'pending' | 'completed' | 'failed'
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
      failed: 'Ошибка',
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
      failed: 'Failed',
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
      failed: 'Ката',
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
      failed: 'Xatolik',
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400'
      case 'pending': return 'text-yellow-400'
      case 'failed': return 'text-red-400'
      default: return 'text-white/60'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return t.completed
      case 'pending': return t.pending
      case 'failed': return t.failed
      default: return status
    }
  }

  const getTypeText = (type: string) => {
    return type === 'deposit' ? t.deposit : t.withdraw
  }

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-bold">{t.title}</h1>
      
      <section className="card space-y-3">
        {loading ? (
          <div className="text-center text-white/60">
            {t.loading}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center text-white/60">
            {t.empty}
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="card">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {getTypeText(transaction.type)} • {transaction.bookmaker}
                    </div>
                    <div className="text-sm text-white/60">
                      {transaction.date}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-semibold">
                      {transaction.amount.toLocaleString()} ₽
                    </div>
                    <div className={`text-sm ${getStatusColor(transaction.status)}`}>
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
