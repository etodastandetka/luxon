'use client'

import { useEffect, useState } from 'react'

interface Broadcast {
  id: number
  title: string
  message: string
  sentAt: string | null
  createdAt: string
  sentCount?: number | null
  totalCount?: number | null
}

export default function BroadcastPage() {
  const [message, setMessage] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [totalUsers, setTotalUsers] = useState(0)
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number; success: number; errors: number } | null>(null)

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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Проверяем что это изображение
      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение')
        return
      }
      
      // Проверяем размер (макс 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Размер изображения не должен превышать 10MB')
        return
      }
      
      setPhoto(file)
      
      // Создаем превью
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removePhoto = () => {
    setPhoto(null)
    setPhotoPreview(null)
  }

  const sendBroadcast = async () => {
    if (!message.trim()) {
      alert('Введите текст сообщения')
      return
    }

    const confirmText = photo 
      ? `Вы уверены, что хотите отправить это сообщение с фото всем ${totalUsers} пользователям бота?`
      : `Вы уверены, что хотите отправить это сообщение всем ${totalUsers} пользователям бота?`
    
    if (!confirm(confirmText)) {
      return
    }

    setSending(true)
    setSendProgress({ current: 0, total: totalUsers, success: 0, errors: 0 })
    
    try {
      let response: Response
      
      if (photo) {
        // Отправка с фото через FormData
        const formData = new FormData()
        formData.append('message', message)
        formData.append('photo', photo)
        
        response = await fetch('/api/broadcast/send', {
          method: 'POST',
          body: formData,
        })
      } else {
        // Отправка только текста через JSON
        response = await fetch('/api/broadcast/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        })
      }

      const data = await response.json()

      if (data.success) {
        const result = data.data
        const successRate = result.successRate ? `${result.successRate}%` : 'N/A'
        const messageText = `Рассылка завершена!\n\n✅ Успешно отправлено: ${result.sentCount || 0} из ${result.totalUsers || 0}\n❌ Ошибок: ${result.errorCount || 0}\n📊 Успешность: ${successRate}`
        alert(messageText)
        setMessage('')
        setPhoto(null)
        setPhotoPreview(null)
        setSendProgress(null)
        fetchHistory()
        fetchStats() // Обновляем статистику
      } else {
        const errorMsg = data.error || 'Ошибка при отправке рассылки'
        console.error('Broadcast error:', data)
        alert(`Ошибка: ${errorMsg}\n\nПроверьте консоль для подробностей.`)
        setSendProgress(null)
      }
    } catch (error) {
      console.error('Failed to send broadcast:', error)
      alert('Ошибка при отправке рассылки')
      setSendProgress(null)
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
            Поддерживается HTML разметка: &lt;b&gt;жирный&lt;/b&gt;, &lt;i&gt;курсив&lt;/i&gt;, &lt;code&gt;код&lt;/code&gt;
            <br />
            <span className="text-green-400">✓ К каждой рассылке автоматически добавляется кнопка &quot;🚀 Открыть приложение&quot;</span>
            <br />
            <span className="text-yellow-400">⚠️ Рассылка может занять некоторое время при большом количестве пользователей</span>
          </p>
        </div>

        {/* Загрузка фото */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Фото (опционально)
          </label>
          {photoPreview ? (
            <div className="relative mb-2">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full max-h-64 object-contain rounded-lg border border-gray-700 bg-gray-900"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors"
                title="Удалить фото"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-900 hover:bg-gray-800 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mb-2 text-sm text-gray-400">
                  <span className="font-semibold">Нажмите для загрузки</span> или перетащите фото
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, GIF до 10MB</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={sending}
              />
            </label>
          )}
        </div>

        {/* Индикатор прогресса */}
        {sendProgress && (
          <div className="mb-4 bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Прогресс отправки</span>
              <span className="text-sm font-medium text-white">
                {sendProgress.current} / {sendProgress.total}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>✓ Успешно: {sendProgress.success}</span>
              <span>✗ Ошибок: {sendProgress.errors}</span>
            </div>
          </div>
        )}

        <button
          onClick={sendBroadcast}
          disabled={sending || !message.trim()}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 text-black px-4 py-3 rounded-xl hover:from-green-600 hover:to-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {sending ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
              <span>Отправка...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Отправить</span>
            </>
          )}
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
                      <span>
                        {broadcast.sentCount !== null && broadcast.sentCount !== undefined 
                          ? broadcast.totalCount 
                            ? `${broadcast.sentCount} из ${broadcast.totalCount} отправлено`
                            : `${broadcast.sentCount} отправлено`
                          : `${totalUsers} отправлено`}
                      </span>
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

