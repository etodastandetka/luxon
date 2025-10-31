'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserDetail {
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  language: string
  selectedBookmaker: string | null
  createdAt: string
  transactions: Array<{
    id: number
    transType: string
    amount: string
    status: string
    bookmaker: string | null
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

  useEffect(() => {
    if (params.userId) {
      fetchUser()
    }
  }, [params.userId])

  const fetchUser = async () => {
    try {
      const [userRes, photoRes] = await Promise.all([
        fetch(`/api/users/${params.userId}`),
        fetch(`/api/users/${params.userId}/profile-photo`)
      ])

      const userData = await userRes.json()
      const photoData = await photoRes.json()

      if (userData.success) {
        setUser(userData.data)
      }

      if (photoData.success && photoData.data.photoUrl) {
        setPhotoUrl(photoData.data.photoUrl)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }

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
    switch (status) {
      case 'completed':
      case 'approved':
        return 'Успешно'
      case 'pending':
        return 'Ожидает'
      case 'rejected':
        return 'Отклонено'
      default:
        return status
    }
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
  
  // Статистика по пополнениям и выводам
  const deposits = user.transactions.filter(t => t.transType === 'deposit')
  const withdrawals = user.transactions.filter(t => t.transType === 'withdraw')
  const totalDeposits = deposits.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)
  const totalWithdrawals = withdrawals.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)

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
        <Link
          href={`/dashboard/users/${user.userId}/chat`}
          className="relative p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </Link>
      </div>

      {/* Карточка пользователя */}
      <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <div className="flex items-center space-x-4 mb-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-green-500"
            />
          ) : (
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center border-2 border-green-500">
              <span className="text-white text-2xl font-bold">{displayName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-1">{displayName}</h2>
            {displayUsername && (
              <p className="text-sm text-gray-400 mb-1">{displayUsername}</p>
            )}
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-500 font-medium">Активен</span>
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
          <button className="p-1 hover:bg-gray-700 rounded transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Нажмите на иконку редактирования, чтобы добавить заметку о пользователе
        </p>
      </div>

      {/* Статус безопасности */}
      <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-white">Активен</p>
              <p className="text-xs text-gray-400">Все операции доступны</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
          </label>
        </div>
      </div>

      {/* Список транзакций */}
      <div className="mx-4">
        <h3 className="text-lg font-semibold text-white mb-3">Транзакции</h3>
        {user.transactions.length > 0 ? (
          <div className="space-y-2">
            {user.transactions.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-green-500 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    tx.transType === 'deposit' ? 'bg-purple-600' : 'bg-pink-600'
                  }`}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {tx.transType === 'deposit' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      )}
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-white">{displayName}</p>
                      <span className="text-xs text-gray-400">ID: {user.userId}</span>
                    </div>
                    {tx.bookmaker && (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded mb-1">
                        {tx.transType === 'deposit' ? 'Авто пополнение' : 'profile-6'}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-1">{formatDate(tx.createdAt)}</p>
                    <p className={`text-lg font-bold ${
                      tx.transType === 'deposit' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {tx.transType === 'deposit' ? '+' : '-'}{parseFloat(tx.amount || '0').toFixed(2).replace('.', ',')}
                    </p>
                    <div className="flex items-center space-x-1 mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-green-500">{getStatusLabel(tx.status)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
