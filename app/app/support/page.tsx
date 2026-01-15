"use client"
import { useEffect, useState, useRef, useCallback } from 'react'
import { useLanguage } from '../../components/LanguageContext'
import FixedHeaderControls from '../../components/FixedHeaderControls'
import BottomNavigation from '../../components/BottomNavigation'
import { SupportIcon, BackIcon } from '../../components/Icons'
import { getTelegramUserId, getTelegramUser } from '../../utils/telegram'
import { getAdminApiUrl } from '../../config/domains'

interface ReplyTo {
  id: number
  messageText: string | null
  messageType: string
  mediaUrl: string | null
  direction: string
  isDeleted?: boolean
}

interface ChatMessage {
  id: number
  userId: string
  messageText: string | null
  messageType: string
  direction: string
  createdAt: string
  mediaUrl?: string | null
  replyToId?: number | null
  replyTo?: ReplyTo | null
  editedAt?: string | null
  isDeleted?: boolean
}

export default function SupportPage() {
  const { language } = useLanguage()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [replyingToId, setReplyingToId] = useState<number | null>(null)
  const [showRequests, setShowRequests] = useState(false)
  const [requests, setRequests] = useState<any[]>([])
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const translations = {
    ru: {
      title: 'Поддержка',
      subtitle: 'Мы всегда готовы помочь вам',
      responseTime: 'Время ответа: 5-30 минут',
      noMessages: 'Нет сообщений',
      startChat: 'Начните общение',
      enterMessage: 'Введите сообщение...',
      sending: 'Отправка...',
      send: 'Отправить',
      backToMain: 'На главную',
      today: 'Сегодня',
      yesterday: 'Вчера',
      deletedMessage: 'Сообщение удалено',
      photo: 'Фото',
      video: 'Видео',
      audio: 'Голосовое',
      file: 'Файл',
      media: 'Медиа',
      reply: 'Ответить',
      replyingTo: 'Ответ на',
      cancel: 'Отмена',
      edit: 'Редактировать',
      save: 'Сохранить',
      delete: 'Удалить',
      attachRequest: 'Прикрепить заявку',
      selectRequest: 'Выберите заявку',
      noRequests: 'Нет заявок',
      request: 'Заявка',
      deposit: 'Пополнение',
      withdraw: 'Вывод',
    },
    en: {
      title: 'Support',
      subtitle: 'We are always ready to help you',
      responseTime: 'Response time: 5-30 minutes',
      noMessages: 'No messages',
      startChat: 'Start conversation',
      enterMessage: 'Enter message...',
      sending: 'Sending...',
      send: 'Send',
      backToMain: 'Back to main',
      today: 'Today',
      yesterday: 'Yesterday',
      deletedMessage: 'Message deleted',
      photo: 'Photo',
      video: 'Video',
      audio: 'Audio',
      file: 'File',
      media: 'Media',
      reply: 'Reply',
      replyingTo: 'Replying to',
      cancel: 'Cancel',
      edit: 'Edit',
      save: 'Save',
      delete: 'Delete',
      attachRequest: 'Attach request',
      selectRequest: 'Select request',
      noRequests: 'No requests',
      request: 'Request',
      deposit: 'Deposit',
      withdraw: 'Withdrawal',
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const fetchChatData = useCallback(async () => {
    if (!userId) return

    try {
      const apiUrl = getAdminApiUrl()
      const response = await fetch(`${apiUrl}/api/public/chat/${userId}/messages?channel=mini_app&limit=50`)
      const data = await response.json()

      if (data.success && data.data.messages) {
        // Разворачиваем, чтобы старые были сверху
        const reversedMessages = [...data.data.messages].reverse()
        setMessages(reversedMessages)
      } else {
        console.warn('⚠️ Chat: Не удалось загрузить сообщения:', data)
      }
    } catch (error) {
      console.error('Failed to fetch chat data:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    const checkUserId = () => {
      const telegramUserId = getTelegramUserId()
      if (telegramUserId) {
        setUserId(telegramUserId)
      }
      
      // Получаем имя пользователя
      const telegramUser = getTelegramUser()
      if (telegramUser) {
        const name = telegramUser.first_name || ''
        const lastName = telegramUser.last_name || ''
        const fullName = `${name} ${lastName}`.trim() || telegramUser.username || `ID: ${telegramUserId}`
        setUserName(fullName)
      } else {
        // Если нет данных пользователя, используем ID как fallback
        if (telegramUserId) {
          setUserName(`ID: ${telegramUserId}`)
        }
      }
    }
    
    // Проверяем сразу
    checkUserId()
    
    // Периодически проверяем (на случай авторизации через Telegram Login Widget)
    const interval = setInterval(checkUserId, 1000)
    
    // Также слушаем события storage (когда localStorage обновляется)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'telegram_user') {
        checkUserId()
      }
    }
    window.addEventListener('storage', handleStorageChange)
    
    // Слушаем сообщения от Telegram Login Widget
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'telegram_auth_success') {
        checkUserId()
      }
    }
    window.addEventListener('message', handleMessage)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  const fetchRequests = useCallback(async () => {
    if (!userId) return

    try {
      const apiUrl = getAdminApiUrl()
      const response = await fetch(`${apiUrl}/api/public/chat/${userId}/requests?limit=20`)
      const data = await response.json()

      if (data.success && data.data.requests) {
        setRequests(data.data.requests)
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    
    fetchChatData()
    fetchRequests()
    
    // Обновляем чат каждые 3 секунды
    const interval = setInterval(() => {
      fetchChatData()
    }, 3000)
    
    return () => clearInterval(interval)
  }, [userId, fetchChatData, fetchRequests])

  useEffect(() => {
    // Используем setTimeout для корректного скролла после рендера
    setTimeout(() => {
      scrollToBottom()
    }, 100)
  }, [messages, scrollToBottom])

  // Исправление проблемы с клавиатурой на мобильных
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        scrollToBottom()
      }, 300)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [scrollToBottom])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Разрешаем фото, видео, аудио и документы
    if (
      file.type.startsWith('image/') ||
      file.type.startsWith('video/') ||
      file.type.startsWith('audio/') ||
      file.type.startsWith('application/')
    ) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      alert('Пожалуйста, выберите фото, видео, аудио или документ')
    }
  }

  const removeFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile && !selectedRequestId) || sending || !userId) return

    setSending(true)
    try {
      const apiUrl = getAdminApiUrl()
      const formData = new FormData()
      
      // Формируем текст сообщения с информацией о заявке, если она прикреплена
      let messageText = newMessage.trim()
      if (selectedRequestId) {
        const request = requests.find(r => r.id === selectedRequestId)
        if (request) {
          const requestInfo = `📋 ${t.request} #${request.id} (${request.requestType === 'deposit' ? t.deposit : t.withdraw})`
          if (request.amount) {
            messageText = `${requestInfo} - ${request.amount} ${messageText ? '\n' + messageText : ''}`
          } else {
            messageText = `${requestInfo}${messageText ? '\n' + messageText : ''}`
          }
        }
      }
      
      if (messageText) {
        formData.append('message', messageText)
      }
      if (selectedFile) {
        formData.append('file', selectedFile)
        formData.append('fileType', selectedFile.type)
      }
      if (replyingToId) {
        formData.append('replyToId', replyingToId.toString())
      }

      const response = await fetch(
        `${apiUrl}/api/public/chat/${userId}/send?channel=mini_app`,
        {
          method: 'POST',
          body: formData,
        }
      )

      const data = await response.json()

      if (data.success) {
        setNewMessage('')
        setReplyingToId(null)
        setSelectedRequestId(null)
        removeFile()
        // Обновляем чат
        await fetchChatData()
        // Фокус на поле ввода
        inputRef.current?.focus()
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

  const editMessage = async (messageId: number, newText: string) => {
    if (!userId || !newText.trim()) return

    try {
      const apiUrl = getAdminApiUrl()
      const response = await fetch(
        `${apiUrl}/api/public/chat/${userId}/messages/${messageId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageText: newText }),
        }
      )

      const data = await response.json()

      if (data.success) {
        setEditingMessageId(null)
        setEditingText('')
        await fetchChatData()
      } else {
        alert(data.error || 'Ошибка при редактировании сообщения')
      }
    } catch (error) {
      console.error('Failed to edit message:', error)
      alert('Ошибка при редактировании сообщения')
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
      return `${t.yesterday} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  const getReplyPreview = (replyTo: ReplyTo) => {
    if (replyTo.isDeleted) {
      return t.deletedMessage
    }
    if (replyTo.mediaUrl) {
      return `📎 ${replyTo.messageType === 'photo' ? t.photo : replyTo.messageType === 'video' ? t.video : replyTo.messageType === 'voice' || replyTo.messageType === 'audio' ? t.audio : t.file}`
    }
    return replyTo.messageText || t.media
  }

  const getMediaUrl = (mediaUrl: string | null | undefined) => {
    if (!mediaUrl) return null
    if (mediaUrl.startsWith('http')) {
      return mediaUrl
    }
    // Если это относительный URL, добавляем базовый URL админки
    const apiUrl = getAdminApiUrl()
    return `${apiUrl}${mediaUrl}`
  }

  if (!userId) {
    return (
      <main className="space-y-6">
        <FixedHeaderControls />
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <SupportIcon className="w-6 h-6 text-orange-400" />
            <h1 className="text-2xl font-bold text-white pr-20">{t.title}</h1>
          </div>
          <p className="text-sm text-white/70">{t.subtitle}</p>
        </div>
        <div className="card space-y-3">
          <div className="text-center text-white/70">
            Пожалуйста, авторизуйтесь через Telegram
          </div>
          <div className="text-center">
            <a 
              href="/" 
              className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
              Авторизоваться
            </a>
          </div>
        </div>
        <div className="text-center">
          <a 
            href="/" 
            className="inline-flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
          >
            <BackIcon className="w-5 h-5" />
            {t.backToMain}
          </a>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <FixedHeaderControls />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      </main>
    )
  }

  return (
    <>
      {/* Модальное окно для увеличенного фото */}
      {zoomImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 text-white text-2xl font-bold hover:text-gray-300"
          >
            ✕
          </button>
          <div className="relative max-w-full max-h-full">
            <img
              src={zoomImage}
              alt="Zoomed"
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}

      <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-green-950 to-green-900">
        <FixedHeaderControls />
        
        {/* Хедер */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm border-b border-white/10 flex-shrink-0 shadow-lg">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 bg-orange-500/20 rounded-lg flex-shrink-0">
              <SupportIcon className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white truncate">{userName || t.title}</h1>
              <p className="text-xs text-white/60">{t.responseTime}</p>
            </div>
          </div>
          <a 
            href="/" 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          >
            <BackIcon className="w-5 h-5 text-white" />
          </a>
        </div>

        {/* Сообщения */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 space-y-4 min-h-0"
        >
          {messages.length === 0 ? (
            <div className="text-center text-white/60 py-12">
              <p className="text-base font-medium">{t.noMessages}</p>
              <p className="text-sm mt-2 text-white/50">{t.startChat}</p>
            </div>
          ) : (
            messages.map((message) => {
              if (message.isDeleted) {
                return (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === 'in' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="px-4 py-2 rounded-2xl bg-gray-800/60 backdrop-blur-sm text-white/50 text-sm italic border border-gray-700/30">
                      {t.deletedMessage}
                    </div>
                  </div>
                )
              }

              // В мини-приложении: 'in' = от пользователя (зеленые, справа), 'out' = от поддержки (серые, слева)
              const isOutgoing = message.direction === 'in'
              const mediaUrl = getMediaUrl(message.mediaUrl)

              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-2 ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Кнопка ответа для входящих сообщений - всегда видна слева */}
                  {!isOutgoing && (
                    <button
                      onClick={() => setReplyingToId(message.id)}
                      className="mt-1.5 p-2 hover:bg-white/10 active:bg-white/20 rounded-full transition-all flex-shrink-0"
                      title={t.reply}
                    >
                      <svg className="w-5 h-5 text-white/80 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                  )}
                  
                  <div className="relative max-w-[80%] sm:max-w-[70%] md:max-w-md">
                    <div
                      className={`px-4 py-2.5 rounded-2xl shadow-lg transition-all duration-200 ${
                        isOutgoing
                          ? 'bg-gradient-to-br from-green-500 to-green-600 text-black shadow-green-500/30'
                          : 'bg-gray-800/95 backdrop-blur-md text-white border border-gray-700/60 shadow-gray-900/30'
                      }`}
                    >
                      {/* Ответ на сообщение */}
                      {message.replyTo && (
                        <div className={`mb-2 pb-2 border-l-3 ${
                          isOutgoing ? 'border-gray-800/50' : 'border-gray-500/70'
                        } pl-3 pr-2 py-1.5 bg-black/25 rounded-r-lg text-xs backdrop-blur-sm`}>
                          <div className={`font-semibold mb-0.5 ${
                            isOutgoing ? 'text-gray-900' : 'text-white/90'
                          }`}>
                            {message.replyTo.direction === 'in' ? 'Вы' : 'Поддержка'}
                          </div>
                          <div className={`truncate ${
                            isOutgoing ? 'text-gray-700' : 'text-white/70'
                          }`}>{getReplyPreview(message.replyTo)}</div>
                        </div>
                      )}

                      {/* Медиа */}
                      {mediaUrl && (
                        <div className="mb-2 rounded-lg overflow-hidden">
                          {message.messageType === 'photo' ? (
                            <div 
                              className="relative w-full h-64 cursor-pointer"
                              onClick={() => setZoomImage(mediaUrl)}
                            >
                              <img 
                                src={mediaUrl} 
                                alt="Photo" 
                                className="w-full h-full object-cover rounded-lg"
                              />
                            </div>
                          ) : message.messageType === 'video' ? (
                            <div className="relative w-full">
                              <video 
                                src={mediaUrl} 
                                controls 
                                className="w-full max-h-96 rounded-lg"
                                preload="metadata"
                              />
                            </div>
                          ) : message.messageType === 'audio' || message.messageType === 'voice' ? (
                            <div className="flex items-center space-x-2">
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                              </svg>
                              <audio
                                src={mediaUrl}
                                controls
                                className="flex-1"
                              />
                            </div>
                          ) : (
                            <a
                              href={mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center space-x-2 text-sm underline p-2 bg-black/20 rounded"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                              </svg>
                              <span>{t.file}</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Текст сообщения */}
                      {editingMessageId === message.id ? (
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              if (editingText.trim()) {
                                editMessage(message.id, editingText)
                              }
                            }
                            if (e.key === 'Escape') {
                              setEditingMessageId(null)
                              setEditingText('')
                            }
                          }}
                          className="w-full bg-white/10 text-white text-sm rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                          autoFocus
                        />
                      ) : (
                        message.messageText && (
                          <p className="text-sm whitespace-pre-wrap break-words">{message.messageText}</p>
                        )
                      )}
                      <div className="flex items-center justify-between mt-1.5 pt-1">
                        <p className={`text-xs ${isOutgoing ? 'text-gray-700/80' : 'text-white/50'}`}>
                          {formatDate(message.createdAt)}
                          {message.editedAt && ' (изменено)'}
                        </p>
                        {/* Кнопки редактирования для своих сообщений */}
                        {isOutgoing && !message.isDeleted && (
                          <div className="flex items-center gap-1">
                            {editingMessageId === message.id ? (
                              <>
                                <button
                                  onClick={() => {
                                    if (editingText.trim()) {
                                      editMessage(message.id, editingText)
                                    }
                                  }}
                                  className="text-xs px-2 py-0.5 hover:bg-black/20 rounded-md text-green-400 hover:text-green-300"
                                  title={t.save}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMessageId(null)
                                    setEditingText('')
                                  }}
                                  className="text-xs px-2 py-0.5 hover:bg-black/20 rounded-md text-gray-700 hover:text-black"
                                  title={t.cancel}
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingMessageId(message.id)
                                  setEditingText(message.messageText || '')
                                }}
                                className="text-xs px-2 py-0.5 hover:bg-black/20 rounded-md text-gray-700 hover:text-black opacity-70 hover:opacity-100"
                                title={t.edit}
                              >
                                ✎
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Отступ для выравнивания исходящих сообщений */}
                  {isOutgoing && (
                    <div className="mt-1.5 flex-shrink-0 w-10"></div>
                  )}
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Поле ввода */}
        <div className="px-4 py-3 bg-black/70 backdrop-blur-md border-t border-white/15 flex-shrink-0 shadow-2xl">
          {/* Preview ответа */}
          {replyingToId && (() => {
            const replyToMessage = messages.find(m => m.id === replyingToId)
            return replyToMessage ? (
              <div className="mb-2 p-2.5 bg-gray-800/90 backdrop-blur-sm rounded-xl flex items-center justify-between border border-gray-700/60 shadow-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/50 font-medium mb-0.5">{t.replyingTo}:</div>
                  <div className="text-sm text-white truncate">{getReplyPreview(replyToMessage as any)}</div>
                </div>
                <button
                  onClick={() => setReplyingToId(null)}
                  className="ml-2 text-white/60 hover:text-white p-1.5 hover:bg-white/15 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : null
          })()}

          {/* Preview выбранной заявки */}
          {selectedRequestId && (() => {
            const request = requests.find(r => r.id === selectedRequestId)
            return request ? (
              <div className="mb-2 p-2.5 bg-gray-800/90 backdrop-blur-sm rounded-xl flex items-center justify-between border border-gray-700/60 shadow-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/50 font-medium mb-0.5">{t.request}:</div>
                  <div className="text-sm text-white truncate">
                    #{request.id} ({request.requestType === 'deposit' ? t.deposit : t.withdraw})
                    {request.amount && ` - ${request.amount}`}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequestId(null)}
                  className="ml-2 text-white/60 hover:text-white p-1.5 hover:bg-white/15 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : null
          })()}

          {/* Preview выбранного файла */}
          {previewUrl && selectedFile && (
            <div className="mb-2 relative">
              {selectedFile.type.startsWith('image/') ? (
                <div className="relative w-full h-32">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={removeFile}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : selectedFile.type.startsWith('video/') ? (
                <div className="relative">
                  <video 
                    src={previewUrl} 
                    controls 
                    className="w-full max-h-32 rounded-lg"
                  />
                  <button
                    onClick={removeFile}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 hover:bg-white/15 active:bg-white/25 rounded-xl transition-all duration-200 flex-shrink-0 hover:scale-105"
              title="Прикрепить файл"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button 
              onClick={() => setShowRequests(!showRequests)}
              className="p-2.5 hover:bg-white/15 active:bg-white/25 rounded-xl transition-all duration-200 flex-shrink-0 relative hover:scale-105"
              title={t.attachRequest}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {showRequests && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-black/95 backdrop-blur-md rounded-xl border border-white/25 max-h-48 overflow-y-auto z-50 shadow-2xl">
                  <div className="p-2.5 text-xs text-white/70 font-medium border-b border-white/15 bg-white/5">{t.selectRequest}</div>
                  {requests.length === 0 ? (
                    <div className="p-4 text-center text-white/50 text-sm">{t.noRequests}</div>
                  ) : (
                    requests.map((request) => (
                      <button
                        key={request.id}
                        onClick={() => {
                          setSelectedRequestId(request.id)
                          setShowRequests(false)
                        }}
                        className="w-full p-3 text-left hover:bg-white/15 active:bg-white/20 transition-colors border-b border-white/5 last:border-0"
                      >
                        <div className="text-sm text-white font-semibold">
                          {t.request} #{request.id}
                        </div>
                        <div className="text-xs text-white/60 mt-0.5">
                          {request.requestType === 'deposit' ? t.deposit : t.withdraw}
                          {request.amount && ` • ${request.amount}`}
                          {request.status && ` • ${request.status}`}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </button>
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={t.enterMessage}
              className="flex-1 bg-gray-800/95 backdrop-blur-md text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 border border-gray-700/60 placeholder:text-white/40 transition-all duration-200"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={sending || (!newMessage.trim() && !selectedFile && !selectedRequestId)}
              className="p-2.5 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 active:from-green-700 active:to-green-800 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-lg shadow-green-500/30 hover:scale-105 disabled:hover:scale-100 flex items-center justify-center"
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <BottomNavigation />
    </>
  )
}
