'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface ThreadItem {
  userId: string
  username?: string | null
  firstName?: string | null
  lastName?: string | null
  lastMessageText?: string | null
  lastMessageType: string
  direction: string
  createdAt: string
}

const typeLabel: Record<string, string> = {
  photo: '📷 Фото',
  video: '🎬 Видео',
  audio: '🎵 Аудио',
  voice: '🎙️ Голосовое',
  document: '📎 Документ',
  text: '',
}

export default function ChatsPage() {
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/threads', { cache: 'no-store' })
      const data = await res.json()
      if (data.success && data.data?.threads) {
        setThreads(data.data.threads)
      }
    } catch (error) {
      console.error('Failed to load threads:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadThreads()
    const id = setInterval(loadThreads, 5000)
    return () => clearInterval(id)
  }, [loadThreads])

  const formatName = (t: ThreadItem) =>
    t.firstName || t.username || `ID: ${t.userId}`

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Чаты</h1>
        <button
          onClick={loadThreads}
          className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-500"
        >
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-gray-400">Загрузка...</div>
      ) : threads.length === 0 ? (
        <div className="text-center text-gray-400 py-10">Нет переписок</div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => {
            const ts = new Date(t.createdAt)
            const snippet =
              t.lastMessageType === 'text'
                ? t.lastMessageText || ''
                : typeLabel[t.lastMessageType] || 'Медиа'

            return (
              <Link
                key={t.userId}
                href={`/dashboard/users/${t.userId}/chat`}
                className="block bg-gray-800 border border-gray-700 rounded-xl p-3 hover:border-green-500 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="text-white font-semibold">{formatName(t)}</div>
                    {t.username && (
                      <div className="text-xs text-gray-400">@{t.username}</div>
                    )}
                    <div className="text-sm text-gray-300 line-clamp-2">
                      {snippet || 'Без текста'}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-gray-400">
                      {ts.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        t.direction === 'in'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-green-500/20 text-green-300'
                      }`}
                    >
                      {t.direction === 'in' ? 'Входящее' : 'Исходящее'}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}


