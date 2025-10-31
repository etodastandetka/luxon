'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface ChatMessage {
  id: number
  userId: string
  messageText: string | null
  messageType: string
  direction: string
  createdAt: string
}

interface UserInfo {
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [user, setUser] = useState<UserInfo | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (params.userId) {
      fetchChatData()
      // Обновляем чат каждые 3 секунды
      const interval = setInterval(fetchChatData, 3000)
      return () => clearInterval(interval)
    }
  }, [params.userId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchChatData = async () => {
    try {
      const [chatRes, userRes, photoRes] = await Promise.all([
        fetch(`/api/users/${params.userId}/chat`),
        fetch(`/api/users/${params.userId}`),
        fetch(`/api/users/${params.userId}/profile-photo`)
      ])

      const chatData = await chatRes.json()
      const userData = await userRes.json()
      const photoData = await photoRes.json()

      if (chatData.success) {
        setMessages(chatData.data.messages.reverse()) // Разворачиваем, чтобы старые были сверху
      }

      if (userData.success) {
        const userInfo = userData.data
        setUser({
          userId: userInfo.userId,
          username: userInfo.username,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          photoUrl: photoData.success ? photoData.data.photoUrl : null,
        })
      }
    } catch (error) {
      console.error('Failed to fetch chat data:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const response = await fetch(`/api/users/${params.userId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      })

      const data = await response.json()

      if (data.success) {
        setNewMessage('')
        // Обновляем чат
        await fetchChatData()
      } else {
        alert(data.error || 'Ошибка при отправке сообщения')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Ошибка при отправке сообщения')
    } finally {
      setSending(false)
    }
  }

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
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center text-gray-400 py-12">Пользователь не найден</div>
    )
  }

  const displayName = user.firstName || user.username || `ID: ${user.userId}`

  return (
    <div className="flex flex-col h-screen">
      {/* Хедер */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Link
          href={`/dashboard/users/${user.userId}`}
          className="flex items-center space-x-3 flex-1 ml-4"
        >
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">{displayName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{displayName}</p>
            {user.username && (
              <p className="text-xs text-gray-400">@{user.username}</p>
            )}
            <p className="text-xs text-green-500">онлайн</p>
          </div>
        </Link>
        <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-green-950 to-green-900">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p>Нет сообщений</p>
            <p className="text-sm mt-2">Начните общение</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.direction === 'out' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  message.direction === 'out'
                    ? 'bg-green-500 text-black'
                    : 'bg-gray-700 text-white'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.messageText}</p>
                <p className={`text-xs mt-1 ${message.direction === 'out' ? 'text-gray-800' : 'text-gray-400'}`}>
                  {formatDate(message.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Введите сообщение..."
            className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim()}
            className="p-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

