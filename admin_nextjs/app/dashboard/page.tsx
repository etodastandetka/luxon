'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Request {
  id: number
  userId: string
  username: string | null
  firstName: string | null
  bookmaker: string | null
  amount: string | null
  requestType: string
  status: string
  createdAt: string
}

export default function DashboardPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending')

  useEffect(() => {
    fetchRequests()
  }, [activeTab])

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab === 'pending') {
        params.append('status', 'pending')
      } else if (activeTab === 'all') {
        // Для "Оставленные" показываем заявки со статусами не pending (включая deferred)
        params.append('status', 'left')
      }

      const response = await fetch(`/api/requests?${params.toString()}`)
      const data = await response.json()

      console.log('📋 Fetched requests data:', data)

      if (data.success) {
        const requestsList = data.data.requests || []
        
        console.log(`✅ Loaded ${requestsList.length} requests for tab: ${activeTab}`)
        setRequests(requestsList)
      } else {
        console.error('❌ Failed to fetch requests:', data.error || data)
        setRequests([])
      }
    } catch (error) {
      console.error('❌ Failed to fetch requests:', error)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  const getTypeLabel = (type: string) => {
    return type === 'deposit' ? 'Пополнение' : 'Вывод'
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
          onClick={() => fetchRequests()}
          className="p-2 bg-gray-800 rounded-lg"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Табы */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'pending'
              ? 'bg-green-500 text-black shadow-lg'
              : 'bg-gray-800 text-gray-300'
          }`}
        >
          Ожидающие
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'all'
              ? 'bg-green-500 text-black shadow-lg'
              : 'bg-gray-800 text-gray-300'
          }`}
        >
          Оставленные
        </button>
      </div>

      {/* Контент заявок */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-green-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <svg className="w-16 h-16 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-white text-lg font-medium">Нет заявок</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/dashboard/requests/${request.id}`}
              className="block bg-gray-800 bg-opacity-50 rounded-xl p-4 border border-gray-700 hover:border-green-500 transition-colors backdrop-blur-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-white">
                      Заявка #{request.id}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500 text-black">
                      {request.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {getTypeLabel(request.requestType)}
                  </p>
                </div>
                <p className="text-base font-bold text-white">
                  {request.amount ? `${parseFloat(request.amount).toLocaleString()} KGS` : 'N/A'}
                </p>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                <span>{request.username || request.firstName || request.userId}</span>
                {request.bookmaker && <span>{request.bookmaker}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
