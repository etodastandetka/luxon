'use client'

import { useEffect, useState } from 'react'

interface Broadcast {
  id: number
  title: string
  message: string
  sentAt: string | null
  createdAt: string
  sentCount?: number
}

export default function BroadcastPage() {
  const [message, setMessage] = useState('')
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [totalUsers, setTotalUsers] = useState(0)

  useEffect(() => {
    fetchHistory()
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/broadcast/stats')
      const data = await response.json()
      if (data.success) {
        setTotalUsers(data.data.totalUsers)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/broadcast/history')
      const data = await response.json()

      if (data.success) {
        setBroadcasts(data.data.broadcasts)
      }
    } catch (error) {
      console.error('Failed to fetch broadcast history:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendBroadcast = async () => {
    if (!message.trim()) {
      alert('Введите текст сообщения')
      return
    }

    if (!confirm(`Вы уверены, что хотите отправить это сообщение всем ${totalUsers} пользователям бота?`)) {
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      const data = await response.json()

      if (data.success) {
        const result = data.data
        const messageText = result.message || 'Рассылка завершена'
        alert(messageText)
        setMessage('')
        fetchHistory()
        fetchStats() // Обновляем статистику
      } else {
        const errorMsg = data.error || 'Ошибка при отправке рассылки'
        console.error('Broadcast error:', data)
        alert(`Ошибка: ${errorMsg}\n\nПроверьте консоль для подробностей.`)
      }
    } catch (error) {
      console.error('Failed to send broadcast:', error)
      alert('Ошибка при отправке рассылки')
    } finally {
      setSending(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${day}.${month}.${year} • ${hours}:${minutes}`
  }

  return (
    <div className="py-4">
      {/* Хедер */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="w-10"></div>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-white">Управление рассылками</h1>
          <p className="text-xs text-gray-300 mt-1">Отправка сообщений и управление пользователями</p>
        </div>
        <div className="w-10"></div>
      </div>

      {/* Новая рассылка */}
      <div className="mx-4 mb-6 bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <div className="flex items-center space-x-2 mb-4">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <h2 className="text-lg font-bold text-white">Новая рассылка</h2>
        </div>

        <div className="mb-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white">
            <div className="flex items-center justify-between">
              <span className="text-sm">Получателей: {totalUsers}</span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Текст сообщения..."
            rows={6}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-2">
            Поддерживается HTML разметка: &lt;b&gt;жирный&lt;/b&gt;, &lt;i&gt;курсив&lt;/i&gt;
            <br />
            <span className="text-green-400">✓ К каждой рассылке автоматически добавляется кнопка &quot;🚀 Открыть приложение&quot;</span>
          </p>
        </div>

        <button
          onClick={sendBroadcast}
          disabled={sending || !message.trim()}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 text-black px-4 py-3 rounded-xl hover:from-green-600 hover:to-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <span>{sending ? 'Отправка...' : 'Отправить'}</span>
        </button>
      </div>

      {/* История рассылок */}
      <div className="mx-4">
        <h2 className="text-lg font-bold text-white mb-4">История рассылок</h2>
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
            <p className="text-gray-400">Нет отправленных рассылок</p>
          </div>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((broadcast) => (
              <div
                key={broadcast.id}
                className="bg-gray-800 rounded-xl p-4 border border-gray-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white mb-1">
                      {broadcast.title || `Рассылка #${broadcast.id}`}
                    </p>
                    <div className="text-sm text-gray-300 whitespace-pre-wrap">
                      {broadcast.message}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>{broadcast.sentCount || totalUsers} отправлено</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(broadcast.sentAt || broadcast.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

