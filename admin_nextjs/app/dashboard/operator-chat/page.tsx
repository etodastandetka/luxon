'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface LastMessage {
  id: number
  userId: string
  messageText: string | null
  messageType: string
  direction: string
  createdAt: string
  mediaUrl?: string | null
  replyToId?: number | null
  replyTo?: any | null
  editedAt?: string | null
  isDeleted?: boolean
}

interface UserWithMessage {
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  lastMessage: LastMessage | null
  unreadCount: number
}

export default function OperatorChatPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserWithMessage[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/operator-chat?channel=bot')
      const data = await response.json()

      if (data.success && data.data.users) {
        setUsers(data.data.users)
      } else {
        console.warn('⚠️ Operator chat: Не удалось загрузить пользователей:', data)
      }
    } catch (error) {
      console.error('Failed to fetch operator chat:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    
    // Обновляем список каждые 5 секунд
    const interval = setInterval(() => {
      fetchUsers()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [fetchUsers])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Вчера ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    }
  }

  const getMessagePreview = (message: LastMessage) => {
    if (message.isDeleted) {
      return 'Сообщение удалено'
    }
    if (message.mediaUrl) {
      return `📎 ${message.messageType === 'photo' ? 'Фото' : message.messageType === 'video' ? 'Видео' : message.messageType === 'voice' || message.messageType === 'audio' ? 'Голосовое' : 'Файл'}`
    }
    return message.messageText || 'Медиа'
  }

  const getDisplayName = (user: UserWithMessage) => {
    if (user.firstName) {
      return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName
    }
    if (user.username) {
      return `@${user.username}`
    }
    return `ID: ${user.userId}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="py-4">
      {/* Хедер */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-white">Чат оператора</h1>
          <p className="text-sm text-white/70 mt-1">Сообщения от пользователей</p>
        </div>
      </div>

      {/* Список пользователей */}
      {users.length === 0 ? (
        <div className="text-center text-white/70 py-12">
          <p>Нет сообщений от пользователей</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <Link
              key={user.userId}
              href={`/dashboard/users/${user.userId}/chat?channel=bot`}
              prefetch={false}
              className="block bg-gray-800 bg-opacity-50 rounded-xl p-4 hover:bg-opacity-70 transition-all border border-gray-700"
            >
              <div className="flex items-start space-x-3">
                {/* Аватар */}
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-lg font-bold">
                    {getDisplayName(user).charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Информация */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-semibold truncate">
                        {getDisplayName(user)}
                      </span>
                      {user.unreadCount > 0 && (
                        <span className="bg-green-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                          {user.unreadCount}
                        </span>
                      )}
                    </div>
                    {user.lastMessage && (
                      <span className="text-xs text-white/60 flex-shrink-0 ml-2">
                        {formatDate(user.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  {user.lastMessage && (
                    <p className="text-sm text-white/70 truncate">
                      {getMessagePreview(user.lastMessage)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
