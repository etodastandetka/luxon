"use client"
import { useEffect, useState } from 'react'
import { getTelegramWebApp, getTelegramUserId } from '../utils/telegram'
import LanguageSelector from './LanguageSelector'
import { getApiBase } from '../utils/fetch'

interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  timestamp: Date
  read: boolean
  transaction?: {
    id: string
    type: 'deposit' | 'withdraw'
    bookmaker: string
    amount: number
    status: string
  }
}

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [lastTransactions, setLastTransactions] = useState<any[]>([])
  const [languageSelectorOpen, setLanguageSelectorOpen] = useState(false)

  // Загружаем последние операции
  const loadRecentTransactions = async () => {
    try {
      const userId = getTelegramUserId()
      if (!userId) return

      const apiUrl = getApiBase()
      
      const response = await fetch(`${apiUrl}/api/transaction-history?user_id=${userId}&limit=5`)
      const data = await response.json()
      
      const transactionsData = data.data?.transactions || data.transactions || []
      
      if (transactionsData.length > 0) {
        // Проверяем, есть ли новые транзакции
        const savedNotifications = localStorage.getItem('notifications')
        const existingNotifications = savedNotifications ? JSON.parse(savedNotifications) : []
        
        const newTransactions = transactionsData.filter((tx: any) => {
          // Проверяем, не было ли уже уведомления об этой транзакции
          const existingNotification = existingNotifications.find((n: any) => 
            n.transaction?.id === tx.id?.toString()
          )
          return !existingNotification
        })

        // Создаем уведомления для новых транзакций
        newTransactions.forEach((tx: any) => {
          const statusMessages: Record<string, { type: 'success' | 'error' | 'info' | 'warning', title: string }> = {
            'completed': { type: 'success', title: 'Операция завершена' },
            'approved': { type: 'success', title: 'Операция одобрена' },
            'auto_completed': { type: 'success', title: 'Автозавершение' },
            'autodeposit_success': { type: 'success', title: 'Автопополнение' },
            'rejected': { type: 'error', title: 'Операция отклонена' },
            'failed': { type: 'error', title: 'Ошибка операции' },
            'pending': { type: 'info', title: 'Ожидает обработки' },
            'deferred': { type: 'warning', title: 'Операция отложена' }
          }

          const statusInfo = statusMessages[tx.status?.toLowerCase()] || { type: 'info' as const, title: 'Обновление операции' }
          
          const bookmakerNames: Record<string, string> = {
            '1xbet': '1xBet',
            '1win': '1WIN',
            'melbet': 'Melbet',
            'mostbet': 'Mostbet',
            'winwin': 'Winwin',
            '888starz': '888starz',
          }

          const notification: Notification = {
            id: `tx_${tx.id}_${Date.now()}`,
            type: statusInfo.type,
            title: statusInfo.title,
            message: `${tx.type === 'deposit' ? 'Пополнение' : 'Вывод'} ${tx.amount} сом в ${bookmakerNames[tx.bookmaker?.toLowerCase()] || tx.bookmaker}`,
            timestamp: new Date(tx.created_at || tx.date || Date.now()),
            read: false,
            transaction: {
              id: tx.id?.toString() || '',
              type: tx.type || tx.request_type || 'deposit',
              bookmaker: tx.bookmaker || '',
              amount: tx.amount || 0,
              status: tx.status || 'pending'
            }
          }

          addNotification(notification)
        })

        setLastTransactions(transactionsData)
      }
    } catch (error) {
      console.error('Error loading recent transactions:', error)
    }
  }

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

    // Загружаем последние операции
    loadRecentTransactions()

    // Обновляем каждые 60 секунд (увеличено для лучшей производительности)
    const interval = setInterval(() => {
      loadRecentTransactions()
    }, 60000)

    // Слушаем события от Telegram WebApp
    const tg = getTelegramWebApp()
    if (tg) {
      // Слушаем события от бота
      tg.onEvent('notification', () => handleNotification({}))
    }

    return () => {
      clearInterval(interval)
      if (tg) {
        tg.offEvent('notification', () => handleNotification({}))
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

    // Убрано показ всплывающих уведомлений через Telegram WebApp
    // Уведомления теперь только сохраняются в список и отображаются в иконке уведомлений
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
    <>
      {/* Контейнер для языкового селектора и уведомлений */}
      <div 
        className="fixed-header-controls"
        style={{ 
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          pointerEvents: 'none'
        }}
      >
        {/* Языковой селектор */}
        <div style={{ pointerEvents: 'auto' }}>
          <LanguageSelector 
            onOpenChange={(isOpen) => {
              setLanguageSelectorOpen(isOpen)
              if (isOpen) {
                // Закрываем уведомления при открытии языкового селектора
                setIsVisible(false)
              }
            }}
          />
        </div>

        {/* Кнопка уведомлений */}
        <button
          onClick={() => {
            const newVisibility = !isVisible
            setIsVisible(newVisibility)
            if (newVisibility) {
              // Закрываем языковой селектор через небольшой таймаут, чтобы дать ему время закрыться
              setTimeout(() => {
                setLanguageSelectorOpen(false)
              }, 100)
            }
          }}
          className="bg-black/20 backdrop-blur border border-white/20 rounded-full hover:bg-black/30 transition-all relative flex-shrink-0 pointer-events-auto"
          style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Список уведомлений */}
      {isVisible && (
        <>
          {/* Overlay для закрытия при клике вне */}
          <div 
            style={{ 
              position: 'fixed',
              inset: 0,
              zIndex: 99998,
              backgroundColor: 'transparent'
            }}
            onClick={() => setIsVisible(false)}
          />
          <div 
            className="bg-black/20 backdrop-blur border border-white/20 rounded-xl p-2.5 max-h-72 overflow-y-auto shadow-2xl"
            style={{ 
              position: 'fixed',
              top: '3.5rem',
              right: '1rem',
              width: '280px',
              maxWidth: 'calc(100vw - 2rem)',
              zIndex: 99999,
              willChange: 'transform'
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-white font-semibold text-sm">Уведомления</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-green-400 text-xs hover:text-green-300"
              >
                Прочитать все
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-white/70 text-center py-3 text-sm">
              Нет уведомлений
            </div>
          ) : (
            <div className="space-y-1.5">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-2 rounded-lg border transition-all ${
                    notification.read 
                      ? 'bg-white/5 border-white/10' 
                      : 'bg-green-500/10 border-green-500/30'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          notification.type === 'success' ? 'bg-green-500' :
                          notification.type === 'error' ? 'bg-red-500' :
                          notification.type === 'warning' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`} />
                        <span className="text-white font-medium text-xs truncate">
                          {notification.title}
                        </span>
                      </div>
                      <p className="text-white/80 text-xs line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.transaction && (
                        <div className="mt-1.5 pt-1.5 border-t border-white/10">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-white/60">
                              {notification.transaction.type === 'deposit' ? 'Пополнение' : 'Вывод'}
                            </span>
                            <span className={`font-semibold ${
                              notification.transaction.type === 'deposit' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {notification.transaction.type === 'deposit' ? '+' : '-'}{notification.transaction.amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} сом
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-1 flex-shrink-0">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-green-400 hover:text-green-300 text-xs w-4 h-4 flex items-center justify-center"
                          title="Прочитано"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={() => removeNotification(notification.id)}
                        className="text-red-400 hover:text-red-300 text-xs w-4 h-4 flex items-center justify-center"
                        title="Удалить"
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
        </>
      )}
    </>
  )
}





