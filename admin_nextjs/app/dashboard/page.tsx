'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  playDepositSound, 
  playWithdrawSound, 
  isSoundsEnabled, 
  setSoundsEnabled,
  initAudioContext,
  activateAudioContext
} from '@/lib/sounds'
import { initNotifications, showDepositNotification, showWithdrawNotification } from '@/lib/notifications'

interface Request {
  id: number
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  bookmaker: string | null
  accountId: string | null
  bank: string | null
  amount: string | null
  requestType: string
  status: string
  status_detail: string | null
  createdAt: string
}

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(false) // Начинаем с false - показываем скелетон сразу
  const [activeTab, setActiveTab] = useState<'pending' | 'deferred'>('pending')
  const [soundsEnabled, setSoundsEnabledState] = useState(true)
  
  // Сохраняем предыдущий список заявок для определения новых
  const previousRequestsRef = useRef<Request[]>([])
  const isFirstLoadRef = useRef(true)
  // Отслеживаем уже воспроизведенные звуки для конкретных заявок
  // Используем строковый ключ: "type-status-id" для уникальности
  const playedSoundsRef = useRef<Set<string>>(new Set())
  const isFetchingRef = useRef(false) // Флаг для предотвращения параллельных запросов

  const fetchRequests = useCallback(async (showLoading = true) => {
    // Предотвращаем параллельные запросы
    if (isFetchingRef.current) {
      console.log('⏸️ Request already in progress, skipping...')
      return
    }
    
    isFetchingRef.current = true
    
    if (showLoading) {
      setLoading(true)
    }
    try {
      const params = new URLSearchParams()
      if (activeTab === 'pending') {
        // Показываем только ожидающие заявки
        params.append('status', 'pending')
      } else if (activeTab === 'deferred') {
        // Показываем только отложенные заявки
        params.append('status', 'deferred')
      }
      
      // Добавляем лимит для ускорения загрузки
      params.append('limit', '20')
      
      // Используем кэширование, но не агрессивное - данные должны обновляться сразу
      const response = await fetch(`/api/requests?${params.toString()}`, {
        cache: 'no-store', // Не кэшируем - данные должны быть актуальными
      })
      
      if (!response.ok) {
        console.error(`❌ HTTP error! status: ${response.status}`)
        if (showLoading) {
          setLoading(false)
        }
        return
      }
      
      const data = await response.json()
      
      // Убираем отдельный запрос для autodeposit - это вызывает rate limiting
      // Автопополнения будут отслеживаться через изменения статуса в основном запросе
      let autodepositRequests: Request[] = []

      console.log('📋 Fetched requests data:', data)

      if (data.success) {
        const requestsList = data.data.requests || []
        
        console.log(`✅ Loaded ${requestsList.length} requests for tab: ${activeTab}`)
        
        // Определяем новые заявки и изменения статуса
        // ВАЖНО: Только для вкладки "Ожидает", не при первой загрузке и не при showLoading
        // Дополнительная проверка: previousRequestsRef должен быть не пустым
        if (activeTab === 'pending' && !isFirstLoadRef.current && !showLoading && previousRequestsRef.current.length > 0) {
          const previousMap = new Map(previousRequestsRef.current.map((r: Request) => [r.id, r]))
          const newRequests = requestsList.filter((r: Request) => !previousMap.has(r.id))
          
          // Проверяем изменения статуса существующих заявок (для автопополнений)
          // ТОЛЬКО если статус действительно изменился с pending на autodeposit_success/completed
          const statusChangedRequests = requestsList.filter((r: Request) => {
            const prev = previousMap.get(r.id)
            if (!prev) return false
            // Только если было pending и стало autodeposit_success или completed
            return prev.status === 'pending' && 
                   prev.status !== r.status && 
                   (r.status === 'autodeposit_success' || r.status === 'completed')
          })
          
          // Также проверяем автопополнения из отдельного запроса
          // ТОЛЬКО если это действительно новые автопополнения
          const previousAutodepositIds = new Set(
            previousRequestsRef.current
              .filter(r => r.status === 'autodeposit_success')
              .map(r => r.id)
          )
          const newAutodepositRequests = autodepositRequests.filter(
            (r: Request) => !previousAutodepositIds.has(r.id) && 
                           r.status === 'autodeposit_success'
          )
          
          // Фильтруем только те заявки которые действительно должны воспроизвести звук
          
          // Новые заявки на вывод (pending)
          const newWithdrawRequests = newRequests.filter((r: Request) => 
            r.requestType === 'withdraw' && r.status === 'pending'
          )
          
          // Новые заявки на пополнение (pending) - только звук без уведомления
          const newDepositPendingRequests = newRequests.filter((r: Request) => 
            r.requestType === 'deposit' && r.status === 'pending'
          )
          
          // Автопополнения - статус изменился на autodeposit_success
          const completedDeposits = [...statusChangedRequests, ...newAutodepositRequests].filter((r: Request) =>
            r.requestType === 'deposit' && 
            (r.status === 'autodeposit_success' || r.status === 'completed')
          )
          
          // Убираем дубликаты по ID
          const uniqueRequests = new Map<number, Request>()
          newWithdrawRequests.forEach((r: Request) => uniqueRequests.set(r.id, r))
          newDepositPendingRequests.forEach((r: Request) => uniqueRequests.set(r.id, r))
          completedDeposits.forEach((r: Request) => uniqueRequests.set(r.id, r))
          
          const allRequestsToNotify = Array.from(uniqueRequests.values())
          
          console.log(`🔍 [Dashboard] New withdraw: ${newWithdrawRequests.length}, New deposit pending: ${newDepositPendingRequests.length}, Completed: ${completedDeposits.length}`)
          
          // Воспроизводим звуки ТОЛЬКО если есть реальные заявки для уведомления
          if (allRequestsToNotify.length > 0) {
            console.log(`🔔 [Dashboard] Found ${allRequestsToNotify.length} request(s) to notify:`, 
              allRequestsToNotify.map((r: Request) => ({ id: r.id, type: r.requestType, status: r.status })))
            
            // Проверяем что звуки включены
            if (!isSoundsEnabled()) {
              console.log(`🔇 [Dashboard] Sounds disabled, skipping sound playback`)
            } else {
              // ВАЖНО: Воспроизводим звук ТОЛЬКО ОДИН РАЗ для всех заявок одного типа
              // Определяем какие звуки нужно воспроизвести (приоритет: withdraw > deposit completed > deposit pending)
              
              const withdrawRequests = allRequestsToNotify.filter(r => r.requestType === 'withdraw' && r.status === 'pending')
              const depositCompletedRequests = allRequestsToNotify.filter(r => 
                r.requestType === 'deposit' && (r.status === 'autodeposit_success' || r.status === 'completed')
              )
              const depositPendingRequests = allRequestsToNotify.filter(r => 
                r.requestType === 'deposit' && r.status === 'pending'
              )
              
              // Воспроизводим звуки ОДИН РАЗ СРАЗУ, без активации AudioContext (она уже должна быть активирована)
              // Используем уникальный ключ на основе ID всех заявок этого типа
              let soundToPlay: 'withdraw' | 'deposit' | null = null
              let soundKey = ''
              
              if (withdrawRequests.length > 0) {
                const ids = withdrawRequests.map(r => r.id).sort().join(',')
                soundKey = `withdraw-${ids}`
                soundToPlay = 'withdraw'
              } else if (depositCompletedRequests.length > 0) {
                const ids = depositCompletedRequests.map(r => r.id).sort().join(',')
                soundKey = `deposit-completed-${ids}`
                soundToPlay = 'deposit'
              } else if (depositPendingRequests.length > 0) {
                const ids = depositPendingRequests.map(r => r.id).sort().join(',')
                soundKey = `deposit-pending-${ids}`
                soundToPlay = 'deposit'
              }
              
              // Воспроизводим звук ТОЛЬКО если он еще не воспроизводился
              if (soundToPlay && soundKey && !playedSoundsRef.current.has(soundKey)) {
                // Активируем AudioContext и воспроизводим звук ОДИН РАЗ
                activateAudioContext().then(() => {
                  if (soundToPlay === 'withdraw') {
                    playWithdrawSound()
                    console.log(`🔊 [Dashboard] Withdraw sound played ONCE for ${withdrawRequests.length} new withdraw(s)`)
                  } else if (soundToPlay === 'deposit') {
                    playDepositSound()
                    const count = depositCompletedRequests.length || depositPendingRequests.length
                    console.log(`🔊 [Dashboard] Deposit sound played ONCE for ${count} new deposit(s)`)
                  }
                  playedSoundsRef.current.add(soundKey)
                }).catch(err => {
                  console.error('🔊 [Dashboard] Failed to activate AudioContext:', err)
                })
              } else if (soundKey && playedSoundsRef.current.has(soundKey)) {
                console.log(`🔇 [Dashboard] Sound already played for key: ${soundKey}, skipping`)
              }
                
              // Теперь показываем уведомления для каждой заявки (без звуков)
              allRequestsToNotify.forEach((request: Request, index: number) => {
                // Минимальная задержка только для уведомлений
                setTimeout(() => {
                  const amount = request.amount ? parseFloat(request.amount) : 0
                  const bookmaker = request.bookmaker || 'не указано'
                  const accountId = request.accountId || 'не указан'
                  
                  if (request.requestType === 'deposit' && 
                      (request.status === 'autodeposit_success' || request.status === 'completed')) {
                    // Автопополнение или ручное пополнение
                    showDepositNotification(amount, bookmaker, accountId, request.id).catch(err => {
                      console.error('Error showing deposit notification:', err)
                    })
                    
                    // Отправляем в Service Worker для работы даже когда сайт закрыт
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                      navigator.serviceWorker.controller.postMessage({
                        type: 'SHOW_DEPOSIT_NOTIFICATION',
                        data: { requestId: request.id, amount, bookmaker, accountId }
                      })
                    }
                  } else if (request.requestType === 'withdraw' && request.status === 'pending') {
                    // Новая заявка на вывод
                    showWithdrawNotification(amount, bookmaker, accountId, request.id).catch(err => {
                      console.error('Error showing withdraw notification:', err)
                    })
                    
                    // Отправляем в Service Worker
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                      navigator.serviceWorker.controller.postMessage({
                        type: 'SHOW_WITHDRAW_NOTIFICATION',
                        data: { requestId: request.id, amount, bookmaker, accountId }
                      })
                    }
                  }
                }, index * 50) // Минимальная задержка 50ms только для уведомлений
              })
              
              // Очищаем старые записи из playedSoundsRef чтобы не накапливать память
              // Оставляем только последние 200 заявок
              if (playedSoundsRef.current.size > 200) {
                const ids = Array.from(playedSoundsRef.current)
                playedSoundsRef.current = new Set(ids.slice(-200))
              }
            }
          }
        }
        
        // ВАЖНО: Обновляем предыдущий список ДО обработки новых заявок при первой загрузке
        // чтобы при следующем обновлении все заявки не считались новыми
        if (isFirstLoadRef.current) {
          // При первой загрузке просто сохраняем список без воспроизведения звуков
          previousRequestsRef.current = requestsList
          isFirstLoadRef.current = false
          console.log(`🔇 [Dashboard] First load: ${requestsList.length} requests loaded, sounds skipped`)
        } else {
          // Обновляем предыдущий список только после обработки новых заявок
          previousRequestsRef.current = requestsList
        }
        
        setRequests(requestsList)
      } else {
        console.error('❌ Failed to fetch requests:', data.error || data)
        // Не сбрасываем список заявок при ошибке API, чтобы пользователь видел старые данные
        // setRequests([])
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch requests:', error)
      // Не сбрасываем список заявок при ошибке, чтобы пользователь видел старые данные
    } finally {
      if (showLoading) {
        setLoading(false)
      }
      isFetchingRef.current = false
    }
  }, [activeTab])

  // Инициализация звуков и загрузка настройки
  useEffect(() => {
    initAudioContext()
    setSoundsEnabledState(isSoundsEnabled())
  }, [])
  
  // Перезагружаем данные при изменении вкладки
  useEffect(() => {
    // Сбрасываем состояние при переключении вкладки
    previousRequestsRef.current = []
    isFirstLoadRef.current = true
    // Загружаем данные для новой вкладки
    fetchRequests(true)
  }, [activeTab, fetchRequests])
  
  useEffect(() => {
    // Проверяем параметр refresh в URL - если есть, обновляем данные
    const refreshParam = searchParams.get('refresh')
    if (refreshParam) {
      // Убираем параметр из URL
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
      // Принудительно обновляем данные
      fetchRequests(true)
    }
    
    // Инициализируем уведомления при загрузке
    initNotifications().then(success => {
      if (success) {
        console.log('✅ Уведомления инициализированы')
      }
    })
    
    // Слушаем сообщения от Service Worker для уведомлений
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Message from Service Worker:', event.data)
      })
    }
    
    fetchRequests()
    
    // Автоматическое обновление: для вкладки "pending" - очень быстрое обновление каждую секунду
    // для мгновенного появления новых заявок, для других вкладок - реже (5 сек)
    const updateInterval = activeTab === 'pending' ? 1000 : 5000
    
    const interval = setInterval(() => {
      if (!document.hidden && !isFetchingRef.current) {
        fetchRequests(false) // Не показываем loading при автообновлении
      }
    }, updateInterval)
    
    // Обновление при фокусе страницы
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchRequests(false)
      }
    }
    
    // Обновление при возврате фокуса
    const handleFocus = () => {
      fetchRequests(false)
    }
    
    // Синхронизация между вкладками через storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'request_updated' && e.newValue) {
        const updatedRequestId = parseInt(e.newValue)
        console.log('🔄 Request updated in another tab:', updatedRequestId)
        fetchRequests(false)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [fetchRequests, activeTab]) // Добавляем activeTab в зависимости для пересоздания интервала

  const getTypeLabel = (type: string) => {
    return type === 'deposit' ? 'Пополнение' : 'Вывод'
  }

  // Функция для определения кто обработал транзакцию (логин админа или "автопополнение")
  const getProcessedBy = (processedBy: string | null | undefined) => {
    if (!processedBy) {
      return null
    }
    return processedBy === 'автопополнение' ? 'автопополнение' : processedBy
  }

  // Функция для определения состояния (Успешно/Отклонено/Ожидает)
  const getStatusState = (status: string) => {
    if (status === 'completed' || status === 'approved' || status === 'auto_completed' || status === 'autodeposit_success') {
      return 'Успешно'
    }
    if (status === 'rejected' || status === 'declined') {
      return 'Отклонено'
    }
    if (status === 'pending') {
      return 'Ожидает'
    }
    if (status === 'deferred') {
      return 'Отложено'
    }
    if (status === 'manual' || status === 'awaiting_manual') {
      return 'Ручная'
    }
    return status
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Ожидает'
      case 'completed':
      case 'approved':
      case 'auto_completed':
      case 'autodeposit_success':
        return 'Успешно'
      case 'rejected':
      case 'declined':
        return 'Отклонено'
      case 'deferred':
        return 'Отложено'
      case 'manual':
      case 'awaiting_manual':
        return 'Ручная'
      case 'api_error':
      case 'deposit_failed':
        return 'Ошибка API'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'auto_completed':
      case 'autodeposit_success':
        return 'bg-green-500 text-black border border-green-400'
      case 'pending':
        return 'bg-yellow-500 text-black border border-yellow-400'
      case 'rejected':
      case 'declined':
        return 'bg-red-500 text-white border border-red-400'
      case 'api_error':
      case 'deposit_failed':
        return 'bg-orange-500 text-white border border-orange-400'
      case 'deferred':
        return 'bg-orange-500 text-white border border-orange-400'
      case 'manual':
      case 'awaiting_manual':
        return 'bg-red-500 text-white border border-red-400'
      default:
        return 'bg-gray-700 text-gray-300 border border-gray-600'
    }
  }

  // Функция для получения цвета текста статуса (без фона)
  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'auto_completed':
      case 'autodeposit_success':
        return 'text-green-500'
      case 'pending':
        return 'text-yellow-500'
      case 'rejected':
      case 'declined':
        return 'text-red-500'
      case 'deferred':
        return 'text-orange-500'
      case 'manual':
      case 'awaiting_manual':
        return 'text-red-500'
      default:
        return 'text-gray-300'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}.${month}.${year} • ${hours}:${minutes}`
  }

  const getBankImage = (bank: string | null) => {
    if (!bank) return null
    const normalized = bank.toLowerCase()
    
    // Маппинг банков на изображения
    if (normalized.includes('demirbank') || normalized.includes('demir')) {
      return '/images/demirbank.jpg'
    }
    if (normalized.includes('omoney') || normalized.includes('o!money')) {
      return '/images/omoney.jpg'
    }
    if (normalized.includes('balance')) {
      return '/images/balance.jpg'
    }
    if (normalized.includes('bakai')) {
      return '/images/bakai.jpg'
    }
    if (normalized.includes('megapay')) {
      return '/images/megapay.jpg'
    }
    if (normalized.includes('mbank')) {
      return '/images/mbank.png'
    }
    if (normalized.includes('optima')) {
      return '/images/optima.jpg'
    }
    if (normalized.includes('companion')) {
      return '/images/companion.png'
    }
    
    return null
  }

    // Эта функция больше не используется, используем getTransactionType с параметрами

  return (
    <div className="py-4">
      {/* Хедер с заголовком */}
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={async () => {
            const newState = !soundsEnabled
            setSoundsEnabledState(newState)
            setSoundsEnabled(newState)
            // Воспроизводим тестовый звук при включении
            if (newState) {
              // Принудительно активируем AudioContext при включении звуков
              await activateAudioContext()
              // Небольшая задержка чтобы AudioContext успел активироваться
              setTimeout(() => {
                playDepositSound()
              }, 100)
            }
          }}
          className={`p-2 rounded-lg transition-colors ${
            soundsEnabled 
              ? 'bg-green-500 hover:bg-green-600' 
              : 'bg-gray-800 hover:bg-gray-700'
          }`}
          title={soundsEnabled ? 'Звуки включены' : 'Звуки выключены'}
        >
          {soundsEnabled ? (
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-white">Заявки</h1>
          <p className="text-xs text-gray-300 mt-1">Актуальные транзакции</p>
        </div>
        <button 
          onClick={() => fetchRequests()}
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          title="Обновить"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Табы */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => {
            if (activeTab !== 'pending') {
              setActiveTab('pending')
              // Сбрасываем данные при переключении вкладки
              setRequests([])
              previousRequestsRef.current = []
              isFirstLoadRef.current = true
            }
          }}
          className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'pending'
              ? 'bg-green-500 text-black shadow-lg'
              : 'bg-gray-800 text-gray-300'
          }`}
        >
          Ожидающие
        </button>
        <button
          onClick={() => {
            if (activeTab !== 'deferred') {
              setActiveTab('deferred')
              // Сбрасываем данные при переключении вкладки
              setRequests([])
              previousRequestsRef.current = []
              isFirstLoadRef.current = true
            }
          }}
          className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'deferred'
              ? 'bg-green-500 text-black shadow-lg'
              : 'bg-gray-800 text-gray-300'
          }`}
        >
          Отложенные
        </button>
      </div>

      {/* Контент заявок */}
      {loading || requests.length === 0 ? (
        loading ? (
          // Скелетон для быстрой загрузки
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-800 bg-opacity-50 rounded-xl p-4 border border-gray-700 animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-700 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded w-24 mb-2"></div>
                      <div className="h-5 bg-gray-700 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <div className="h-3 bg-gray-700 rounded w-20"></div>
                    <div className="h-5 bg-gray-700 rounded w-16"></div>
                    <div className="h-5 bg-gray-700 rounded w-24"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-green-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <svg className="w-16 h-16 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-white text-lg font-medium">Нет заявок</p>
        </div>
        )
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const isDeposit = request.requestType === 'deposit'
            const userName = request.firstName 
              ? `${request.firstName}${request.lastName ? ' ' + request.lastName : ''}` 
              : `ID: ${request.userId}`
            const processedBy = getProcessedBy((request as any).processedBy)
            const transactionType = processedBy ? (processedBy === 'автопополнение' ? 'автопополнение' : processedBy) : '-'
            const isDeferred = request.status === 'deferred'
            // Если отложено и "Авто пополнение", показываем минус
            const showMinus = isDeferred && transactionType === 'Авто пополнение'

            const isPending = request.status === 'pending'
            
            return (
              <Link
                key={request.id}
                href={`/dashboard/requests/${request.id}`}
                prefetch={false}
                className="block bg-gray-800 bg-opacity-50 rounded-xl p-4 border border-gray-700 hover:border-green-500 transition-colors backdrop-blur-sm"
              >
                  <div className="flex items-start justify-between">
                    {/* Левая часть: Иконка банка и информация о пользователе */}
                    <div className="flex items-start space-x-3 flex-1">
                      {/* Иконка банка */}
                      {getBankImage(request.bank) ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-600 bg-gray-900 relative">
                          <Image
                            src={getBankImage(request.bank) || ''}
                            alt={request.bank || 'Bank'}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* Информация о пользователе и транзакции */}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-white mb-0.5">
                          {userName}
                        </p>
                        <p className="text-xs text-gray-400 mb-2">
                          {request.accountId ? `ID: ${request.accountId}` : request.bookmaker || '-'}
                        </p>
                        
                        {/* Кто обработал */}
                        {processedBy && (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-500 bg-opacity-20 text-blue-300 rounded-md mb-1 border border-blue-500 border-opacity-30">
                            {processedBy === 'автопополнение' ? 'автопополнение' : processedBy}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Правая часть: Дата, сумма и статус */}
                    <div className="flex flex-col items-end space-y-2 ml-4">
                      {/* Дата и время */}
                      <p className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(request.createdAt)}
                      </p>
                      
                      {/* Сумма */}
                      <p
                        className={`text-base font-bold ${
                          showMinus ? 'text-red-500' : (isDeposit ? 'text-green-500' : 'text-red-500')
                        }`}
                      >
                        {showMinus ? '-' : (isDeposit ? '+' : '-')}
                        {request.amount ? parseFloat(request.amount).toLocaleString('ru-RU', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).replace('.', ',') : '0,00'}
                      </p>
                      
                      {/* Статус */}
                      <span className={`text-xs font-medium whitespace-nowrap ${getStatusTextColor(request.status)}`}>
                        {getStatusState(request.status)}
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
