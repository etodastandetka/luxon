'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface UserDetail {
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  language: string
  selectedBookmaker: string | null
  note: string | null
  isActive: boolean
  createdAt: string
  transactions: Array<{
    id: number
    transType: string
    amount: string
    status: string
    bookmaker: string | null
    processedBy: string | null
    bank: string | null
    createdAt: string
  }>
  referralMade: Array<{
    referred: {
      userId: string
      username: string | null
      firstName: string | null
    }
    createdAt: string
  }>
  referralEarnings: Array<{
    amount: string
    commissionAmount: string
    bookmaker: string | null
    status: string
    createdAt: string
  }>
  _count: {
    transactions: number
    referralMade: number
    referralEarnings: number
  }
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState<string>('')
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [savingActive, setSavingActive] = useState(false)

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true)
      // Используем кэширование для быстрой загрузки (API кэширует на 5 секунд)
      // При первой загрузке данные будут свежими, при повторных - из кэша
      const [userRes, photoRes] = await Promise.all([
        fetch(`/api/users/${params.userId}`, { 
          cache: 'default', // Используем кэш браузера и сервера для быстрой загрузки
          priority: 'high', // Высокий приоритет для быстрой загрузки
        }),
        fetch(`/api/users/${params.userId}/profile-photo`, {
          cache: 'default',
          priority: 'low', // Фото можно загрузить позже
        })
      ])

      const userData = await userRes.json()
      const photoData = await photoRes.json()

      console.log('📊 User data loaded:', {
        success: userData.success,
        hasUser: !!userData.data,
        transactionsCount: userData.data?.transactions?.length || 0,
        userId: userData.data?.userId
      })

      if (userData.success) {
        console.log('✅ Setting user data:', {
          userId: userData.data.userId,
          transactions: userData.data.transactions?.length || 0,
          deposits: userData.data.transactions?.filter((t: any) => t.transType === 'deposit').length || 0,
          withdrawals: userData.data.transactions?.filter((t: any) => t.transType === 'withdraw').length || 0
        })
        setUser(userData.data)
        setNote(userData.data.note || '')
        setIsActive(userData.data.isActive !== false) // По умолчанию true, если не указано
      } else {
        console.error('❌ Failed to load user data:', userData)
      }

      if (photoData.success && photoData.data.photoUrl) {
        setPhotoUrl(photoData.data.photoUrl)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }, [params.userId])

  useEffect(() => {
    if (params.userId) {
      fetchUser()
    }
  }, [params.userId, fetchUser])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${day}.${month}.${year} • ${hours}:${minutes}`
  }

  const getTypeLabel = (type: string) => {
    return type === 'deposit' ? 'Пополнение' : 'Вывод'
  }

  const getStatusLabel = (status: string) => {
    // Полный маппинг статусов на русские метки (как в истории)
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

  const getStatusTextColor = (status: string) => {
    // Цвет текста статуса (как в истории)
    if (status === 'completed' || status === 'approved' || status === 'auto_completed' || status === 'autodeposit_success') {
      return 'text-green-500'
    }
    if (status === 'rejected' || status === 'declined') {
      return 'text-red-500'
    }
    if (status === 'pending' || status === 'processing') {
      return 'text-yellow-500'
    }
    if (status === 'deferred') {
      return 'text-orange-500'
    }
    if (status === 'manual' || status === 'awaiting_manual') {
      return 'text-red-500'
    }
    return 'text-gray-300'
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
    if (normalized.includes('companion') || normalized.includes('kompanion')) {
      return '/images/companion.png'
    }
    
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-white text-lg font-medium">Пользователь не найден</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
        >
          Назад
        </button>
      </div>
    )
  }

  const displayName = user.firstName || user.username || `ID: ${user.userId}`
  const displayUsername = user.username ? `@${user.username}` : null
  
  // Статусы успешных транзакций
  const successStatuses = ['completed', 'approved', 'auto_completed', 'autodeposit_success']
  
  // Статистика по пополнениям и выводам (только успешные)
  const deposits = user.transactions.filter(t => 
    t.transType === 'deposit' && successStatuses.includes(t.status)
  )
  const withdrawals = user.transactions.filter(t => 
    t.transType === 'withdraw' && successStatuses.includes(t.status)
  )
  const totalDeposits = deposits.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)
  const totalWithdrawals = withdrawals.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)

  // Логирование для отладки
  console.log('📈 Statistics:', {
    totalTransactions: user.transactions.length,
    depositsCount: deposits.length,
    withdrawalsCount: withdrawals.length,
    totalDeposits,
    totalWithdrawals,
    allTransactions: user.transactions.map(t => ({
      type: t.transType,
      amount: t.amount,
      status: t.status
    }))
  })

  return (
    <div className="py-4">
      {/* Хедер */}
      <div className="flex items-center justify-between mb-4 px-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-white">Профиль</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchUser()}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="Обновить данные"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <Link
            href={`/dashboard/users/${user.userId}/chat`}
            prefetch={false}
            className="relative p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Карточка пользователя */}
      <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <div className="flex items-center space-x-4 mb-4">
          {photoUrl ? (
            <div className="w-16 h-16 rounded-full overflow-hidden relative flex-shrink-0 border-2 border-green-500">
              <Image
                src={photoUrl}
                alt={displayName}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center border-2 border-green-500">
              <span className="text-white text-2xl font-bold">{displayName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-1">ID: {user.userId}</h2>
            {displayUsername && (
              <p className="text-sm text-gray-400 mb-1">{displayUsername}</p>
            )}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-xs font-medium ${isActive ? 'text-green-500' : 'text-red-500'}`}>
                {isActive ? 'Активен' : 'Заблокирован'}
              </span>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-700">
          <div>
            <p className="text-xs text-gray-400 mb-1">Пополнений</p>
            <p className="text-sm font-semibold text-white">
              {deposits.length} / {totalDeposits.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Выводов</p>
            <p className="text-sm font-semibold text-white">
              {withdrawals.length} / {totalWithdrawals.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Заметка */}
      <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-white">Заметка</h3>
          <button
            onClick={() => setIsEditingNote(!isEditingNote)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
        {isEditingNote ? (
          <div className="space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Введите заметку о пользователе..."
              className="w-full bg-gray-900 text-white rounded-lg p-3 text-sm border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
              rows={4}
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setSavingNote(true)
                  try {
                    const response = await fetch(`/api/users/${params.userId}/note`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ note: note.trim() || null }),
                    })
                    const data = await response.json()
                    if (data.success) {
                      setIsEditingNote(false)
                      if (user) {
                        setUser({ ...user, note: data.data.note })
                      }
                    } else {
                      alert('Ошибка при сохранении заметки')
                    }
                  } catch (error) {
                    console.error('Failed to save note:', error)
                    alert('Ошибка при сохранении заметки')
                  } finally {
                    setSavingNote(false)
                  }
                }}
                disabled={savingNote}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {savingNote ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={() => {
                  setIsEditingNote(false)
                  setNote(user?.note || '')
                }}
                disabled={savingNote}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 whitespace-pre-wrap">
            {note || 'Нажмите на иконку редактирования, чтобы добавить заметку о пользователе'}
          </p>
        )}
      </div>

      {/* Статус безопасности */}
      <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className={`w-5 h-5 ${isActive ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-white">{isActive ? 'Активен' : 'Заблокирован'}</p>
              <p className="text-xs text-gray-400">{isActive ? 'Все операции доступны' : 'Пользователь заблокирован'}</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={async (e) => {
                const newValue = e.target.checked
                setSavingActive(true)
                try {
                  const response = await fetch(`/api/users/${params.userId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive: newValue }),
                  })
                  const data = await response.json()
                  if (data.success) {
                    setIsActive(newValue)
                    if (user) {
                      setUser({ ...user, isActive: newValue })
                    }
                  } else {
                    alert('Ошибка при обновлении статуса')
                    setIsActive(!newValue) // Откатываем изменение
                  }
                } catch (error) {
                  console.error('Failed to update active status:', error)
                  alert('Ошибка при обновлении статуса')
                  setIsActive(!newValue) // Откатываем изменение
                } finally {
                  setSavingActive(false)
                }
              }}
              disabled={savingActive}
              className="sr-only peer"
            />
            <div className={`w-11 h-6 rounded-full peer peer-focus:outline-none transition-colors ${
              isActive ? 'bg-green-500' : 'bg-gray-700'
            } ${savingActive ? 'opacity-50' : ''}`}>
              <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-all ${
                isActive ? 'translate-x-full' : ''
              }`}></div>
            </div>
          </label>
        </div>
      </div>

      {/* Список транзакций */}
      <div className="mx-4">
        <h3 className="text-lg font-semibold text-white mb-3">
          Транзакции ({user.transactions.length})
        </h3>
        {user.transactions.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {user.transactions.map((tx) => {
              const transactionType = (() => {
                // Если статус pending, показываем "-"
                if (tx.status === 'pending' || tx.status === 'processing') {
                  return '-'
                }
                // Если есть processedBy, показываем его (если автопополнение, то "автопополнение")
                if (tx.processedBy) {
                  return tx.processedBy === 'автопополнение' ? 'автопополнение' : tx.processedBy
                }
                // Если нет processedBy, но статус не pending, показываем "-"
                return '-'
              })()

              return (
                <Link
                  key={tx.id}
                  href={`/dashboard/requests/${tx.id}`}
                  prefetch={false}
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
                          {displayName}
                        </p>
                        <p className="text-xs text-gray-400 mb-2">
                          ID: {user.userId}
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
                        {formatDate(tx.createdAt)}
                      </p>
                      
                      {/* Сумма */}
                      <p
                        className={`text-base font-bold ${
                          tx.transType === 'deposit' ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {tx.transType === 'deposit' ? '+' : '-'}{parseFloat(tx.amount || '0').toFixed(2).replace('.', ',')}
                      </p>
                      
                      {/* Статус */}
                      <span className={`text-xs font-medium whitespace-nowrap ${getStatusTextColor(tx.status)}`}>
                        {getStatusLabel(tx.status)}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
            <p className="text-gray-400">Нет транзакций</p>
          </div>
        )}
      </div>
    </div>
  )
}
