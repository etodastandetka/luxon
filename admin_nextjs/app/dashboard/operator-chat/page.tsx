'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { CHAT_CONFIG } from '@/config/app'

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
  admin?: {
    id: number
    username: string
    email: string | null
  } | null
}

export default function OperatorChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [replyingToId, setReplyingToId] = useState<number | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const fetchChatData = useCallback(async () => {
    try {
      const response = await fetch('/api/operator-chat?limit=100')
      const data = await response.json()

      if (data.success && data.data.messages) {
        setMessages(data.data.messages)
      } else {
        console.warn('⚠️ Operator chat: Не удалось загрузить сообщения:', data)
      }
    } catch (error) {
      console.error('Failed to fetch operator chat:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChatData()
    
    // Обновляем сообщения каждые 3 секунды
    const interval = setInterval(() => {
      fetchChatData()
    }, 3000)
    
    return () => clearInterval(interval)
  }, [fetchChatData])

  useEffect(() => {
    setTimeout(() => {
      scrollToBottom()
    }, 100)
  }, [messages, scrollToBottom])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
    if ((!newMessage.trim() && !selectedFile) || sending) return

    setSending(true)
    try {
      const formData = new FormData()
      if (newMessage.trim()) {
        formData.append('message', newMessage)
      }
      if (selectedFile) {
        formData.append('file', selectedFile)
        formData.append('fileType', selectedFile.type)
      }
      if (replyingToId) {
        formData.append('replyToId', replyingToId.toString())
      }

      const response = await fetch('/api/operator-chat', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setNewMessage('')
        setReplyingToId(null)
        removeFile()
        await fetchChatData()
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

  const getReplyPreview = (replyTo: ReplyTo) => {
    if (replyTo.isDeleted) {
      return 'Сообщение удалено'
    }
    if (replyTo.mediaUrl) {
      return `📎 ${replyTo.messageType === 'photo' ? 'Фото' : replyTo.messageType === 'video' ? 'Видео' : replyTo.messageType === 'voice' || replyTo.messageType === 'audio' ? 'Голосовое' : 'Файл'}`
    }
    return replyTo.messageText || 'Медиа'
  }

  const getMediaUrl = (mediaUrl: string | null | undefined) => {
    if (!mediaUrl) return null
    if (mediaUrl.startsWith('http')) {
      return mediaUrl
    }
    return mediaUrl
  }

  const getAdminDisplayName = (message: ChatMessage) => {
    if (message.admin) {
      return message.admin.username || message.admin.email || `ID: ${message.admin.id}`
    }
    return `ID: ${message.userId}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  const replyToMessage = replyingToId ? messages.find(m => m.id === replyingToId) : null

  return (
    <>
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

      <div className="flex flex-col h-full">
        {/* Хедер */}
        <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-white">Чат операторов</h1>
            <p className="text-sm text-white/70 mt-1">Общий чат для операторов</p>
          </div>
        </div>

        {/* Сообщения */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-green-950/50 to-green-900/50 min-h-0"
        >
          {messages.length === 0 ? (
            <div className="text-center text-white/70 py-12">
              <p>Нет сообщений</p>
              <p className="text-sm mt-2">Начните общение</p>
            </div>
          ) : (
            messages.map((message) => {
              if (message.isDeleted) {
                return (
                  <div
                    key={message.id}
                    className="flex justify-start"
                  >
                    <div className="px-4 py-2 rounded-2xl bg-gray-800/50 text-white/50 text-sm italic">
                      Сообщение удалено
                    </div>
                  </div>
                )
              }

              const mediaUrl = getMediaUrl(message.mediaUrl)

              return (
                <div
                  key={message.id}
                  className="flex justify-start group"
                >
                  <div className="relative">
                    <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-2xl bg-black/40 backdrop-blur text-white border border-white/20">
                      <div className="text-xs text-white/60 mb-1">
                        {getAdminDisplayName(message)}
                      </div>
                      
                      {message.replyTo && (
                        <div className="mb-2 pb-2 border-l-2 border-white/30 pl-2 text-xs opacity-75">
                          <div className="font-semibold">Ответ на:</div>
                          <div className="truncate">{getReplyPreview(message.replyTo)}</div>
                        </div>
                      )}

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
                              <span>Файл</span>
                            </a>
                          )}
                        </div>
                      )}

                      {message.messageText && (
                        <p className="text-sm whitespace-pre-wrap break-words">{message.messageText}</p>
                      )}
                      
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-white/60">
                          {formatDate(message.createdAt)}
                          {message.editedAt && ' (изменено)'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setReplyingToId(message.id)}
                      className="absolute -right-8 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/40 backdrop-blur rounded hover:bg-white/10 border border-white/20"
                      title="Ответить"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Ввод сообщения */}
        <div className="p-4 bg-black/40 backdrop-blur border-t border-white/20 flex-shrink-0">
          {replyToMessage && (
            <div className="mb-2 p-2 bg-black/40 backdrop-blur rounded-lg flex items-center justify-between border border-white/20">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/60">Ответ на:</div>
                <div className="text-sm text-white truncate">{getReplyPreview(replyToMessage as any)}</div>
              </div>
              <button
                onClick={() => setReplyingToId(null)}
                className="ml-2 text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

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
          
          <div className="flex items-end space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              title="Прикрепить файл"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
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
              placeholder="Введите сообщение..."
              className="flex-1 bg-black/40 backdrop-blur text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 border border-white/20"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={sending || (!newMessage.trim() && !selectedFile)}
              className="p-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
