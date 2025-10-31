'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.userId) {
      fetchUser()
    }
  }, [params.userId])

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/users/${params.userId}`)
      const data = await response.json()

      if (data.success) {
        setUser(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return <div className="text-center text-gray-500">Пользователь не найден</div>
  }

  return (
    <div className="px-4 py-6">
      <button
        onClick={() => router.back()}
        className="mb-4 text-primary-600 hover:text-primary-700"
      >
        ← Назад
      </button>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Пользователь #{user.userId}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <p className="mt-1 text-sm text-gray-900">
              {user.username ? `@${user.username}` : 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Имя</label>
            <p className="mt-1 text-sm text-gray-900">
              {user.firstName || user.lastName
                ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                : 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Язык</label>
            <p className="mt-1 text-sm text-gray-900">{user.language}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Букмекер</label>
            <p className="mt-1 text-sm text-gray-900">
              {user.selectedBookmaker || 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Регистрация</label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(user.createdAt).toLocaleString('ru-RU')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Транзакции</p>
            <p className="text-2xl font-bold text-gray-900">{user._count.transactions}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Рефералы</p>
            <p className="text-2xl font-bold text-gray-900">{user._count.referralMade}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Заработок</p>
            <p className="text-2xl font-bold text-gray-900">
              {user.referralEarnings
                .filter((e) => e.status === 'completed')
                .reduce((sum, e) => sum + parseFloat(e.commissionAmount), 0)
                .toLocaleString()}{' '}
              KGS
            </p>
          </div>
        </div>
      </div>

      {user.transactions.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Последние транзакции
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Тип
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сумма
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Дата
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {user.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tx.transType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {parseFloat(tx.amount).toLocaleString()} KGS
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          tx.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tx.createdAt).toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user.referralMade.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Рефералы</h2>
          <div className="space-y-2">
            {user.referralMade.map((ref, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {ref.referred.username
                      ? `@${ref.referred.username}`
                      : ref.referred.firstName || ref.referred.userId}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(ref.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

