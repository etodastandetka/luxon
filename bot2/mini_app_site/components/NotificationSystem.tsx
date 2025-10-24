"use client"
import { useEffect, useState } from 'react'
import { getTelegramWebApp } from '../utils/telegram'

interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Загружаем уведомления из localStorage
    const savedNotifications = localStorage.getItem('notifications')
    if (savedNotifications) {
      try {
        const parsed = JSON.parse(savedNotifications)
        setNotifications(parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        })))
      } catch (error) {
        console.error('Error loading notifications:', error)
      }
    }

    // Слушаем события от Telegram WebApp
    const tg = getTelegramWebApp()
    if (tg) {
      // Слушаем события от бота
      tg.onEvent('notification', handleNotification)
    }

    return () => {
      if (tg) {
        tg.offEvent('notification', handleNotification)
      }
    }
  }, [])

  const handleNotification = (data: any) => {
    const notification: Notification = {
      id: Date.now().toString(),
      type: data.type || 'info',
      title: data.title || 'Уведомление',
      message: data.message || '',
      timestamp: new Date(),
      read: false
    }

    addNotification(notification)
  }

  const addNotification = (notification: Notification) => {
    setNotifications(prev => {
      const updated = [notification, ...prev].slice(0, 10) // Храним только последние 10
      localStorage.setItem('notifications', JSON.stringify(updated))
      return updated
    })

    // Показываем уведомление через Telegram WebApp
    const tg = getTelegramWebApp()
    if (tg) {
      switch (notification.type) {
        case 'success':
          tg.showAlert(notification.message)
          break
        case 'error':
          tg.showAlert(notification.message)
          break
        case 'warning':
          tg.showAlert(notification.message)
          break
        default:
          tg.showAlert(notification.message)
      }
    }
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      )
      localStorage.setItem('notifications', JSON.stringify(updated))
      return updated
    })
  }

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      localStorage.setItem('notifications', JSON.stringify(updated))
      return updated
    })
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id)
      localStorage.setItem('notifications', JSON.stringify(updated))
      return updated
    })
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {/* Кнопка уведомлений */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="relative bg-black/20 backdrop-blur border border-white/20 rounded-full p-3 hover:bg-black/30 transition-all"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Список уведомлений */}
      {isVisible && (
        <div className="bg-black/20 backdrop-blur border border-white/20 rounded-xl p-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-semibold">Уведомления</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-green-400 text-sm hover:text-green-300"
              >
                Отметить все как прочитанные
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-white/70 text-center py-4">
              Нет уведомлений
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border transition-all ${
                    notification.read 
                      ? 'bg-white/5 border-white/10' 
                      : 'bg-green-500/10 border-green-500/30'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${
                          notification.type === 'success' ? 'bg-green-500' :
                          notification.type === 'error' ? 'bg-red-500' :
                          notification.type === 'warning' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`} />
                        <span className="text-white font-medium text-sm">
                          {notification.title}
                        </span>
                      </div>
                      <p className="text-white/80 text-sm">
                        {notification.message}
                      </p>
                      <p className="text-white/50 text-xs mt-1">
                        {notification.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-green-400 hover:text-green-300 text-xs"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={() => removeNotification(notification.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}





