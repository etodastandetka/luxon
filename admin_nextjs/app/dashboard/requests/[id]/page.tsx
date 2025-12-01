'use client'

import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface RequestDetail {
  id: number
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  bookmaker: string | null
  accountId: string | null
  amount: string | null
  requestType: string
  status: string
  statusDetail: string | null
  status_detail: string | null
  processedBy: string | null
  bank: string | null
  phone: string | null
  photoFileUrl: string | null
  userNote: string | null
  paymentMethod: string | null
  cryptoPayment: any | null
  createdAt: string
  updatedAt: string
  processedAt: string | null
  incomingPayments: any[]
  matchingPayments?: any[]
  casinoTransactions?: any[]
}

interface MatchingPayment {
  id: number
  amount: string
  bank: string | null
  paymentDate: string
  requestId: number | null
  isProcessed: boolean
}

interface Payment {
  id: number
  amount: string
  createdAt: string
  description?: string
}

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(false) // Начинаем с false - показываем скелетон сразу
  const [searchAmount, setSearchAmount] = useState('')
  const [exactAmount, setExactAmount] = useState(false)
  const [processedOnly, setProcessedOnly] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchId, setSearchId] = useState('')
  const [deferring, setDeferring] = useState(false)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [photoZoom, setPhotoZoom] = useState(1)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<'completed' | 'approved' | 'rejected' | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
    }
  }, [])

    useEffect(() => {
      const requestId = Array.isArray(params.id) ? params.id[0] : params.id
      if (!requestId) {
        setLoading(false)
        return
      }

      const abortController = new AbortController()
      let intervalId: NodeJS.Timeout | null = null

      // Загружаем данные сразу, без показа индикатора загрузки
      const fetchRequest = async (showLoading = true) => {
        
        try {
          // Используем кэширование для более быстрой загрузки
          const response = await fetch(`/api/requests/${requestId}`, {
            signal: abortController.signal,
            cache: showLoading ? 'no-store' : 'default', // При первой загрузке не кэшируем, при автообновлении используем кэш
          })
          
          if (abortController.signal.aborted || !isMountedRef.current) return
          
          // Проверяем, что ответ является JSON
          const contentType = response.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text()
            console.error('❌ API returned non-JSON response:', response.status, text.substring(0, 200))
            throw new Error(`API returned ${response.status} error. Expected JSON but got ${contentType}`)
          }
          
          const data = await response.json()

          // console.log('📋 Request detail data:', data)

          if (!isMountedRef.current) return

          if (data.success && isMountedRef.current) {
            const requestData = data.data
            
            // Устанавливаем данные сразу - все данные уже загружены в одном запросе
            setRequest(requestData)
            
            // Убираем loading после установки данных
            if (showLoading) {
              setLoading(false)
            }
            
            // Обновляем интервал автообновления в зависимости от статуса
            if (requestData.status === 'pending') {
              // Для pending заявок обновляем чаще
              if (intervalId) {
                clearInterval(intervalId)
                intervalId = setInterval(() => {
                  if (!document.hidden) {
                    fetchRequest(false)
                  }
                }, 5000)
              }
            } else {
              // Для остальных - реже
              if (intervalId) {
                clearInterval(intervalId)
                intervalId = setInterval(() => {
                  if (!document.hidden) {
                    fetchRequest(false)
                  }
                }, 15000)
              }
            }
            
            // Загружаем фото профиля асинхронно в фоне (не блокируем отображение страницы)
            if (requestData.userId) {
              // Загружаем фото профиля с задержкой, чтобы не замедлять основную загрузку
              setTimeout(() => {
                fetchProfilePhoto(requestData.userId).catch(err => {
                  console.error('Failed to fetch profile photo:', err)
                })
              }, 200) // Задержка 200ms для приоритета основной загрузки
            }
            
            // Проверяем автопополнение (привязанный платеж с совпадающей суммой)
            // Делаем это в фоне после отображения страницы, чтобы не замедлять загрузку
            if (requestData.requestType === 'deposit' && 
                requestData.status !== 'completed' && 
                requestData.status !== 'approved' &&
                requestData.status !== 'rejected' &&
                requestData.matchingPayments) {
              // Выполняем проверку асинхронно после отображения страницы
              setTimeout(() => {
                const linkedPayment = requestData.matchingPayments.find((p: MatchingPayment) => 
                  p.requestId === requestData.id && p.isProcessed
                )
                
                if (linkedPayment && requestData.amount) {
                  const paymentAmount = parseFloat(linkedPayment.amount)
                  const requestAmount = parseFloat(requestData.amount)
                  
                  // Если сумма совпадает (с точностью до 1 копейки), обновляем статус
                  if (Math.abs(paymentAmount - requestAmount) < 0.01) {
                    // Обновляем статус в фоне, не блокируя UI
                    fetch(`/api/requests/${requestData.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        status: 'completed',
                        statusDetail: null
                      }),
                    })
                    .then(updateResponse => {
                      if (updateResponse.ok && isMountedRef.current) {
                        // Обновляем данные без полной перезагрузки
                        fetchRequest(false)
                      }
                    })
                    .catch(error => {
                      console.error('Failed to auto-update request status:', error)
                    })
                  }
                }
              }, showLoading ? 500 : 0) // При первой загрузке ждем 500ms чтобы страница успела отобразиться
            }
          } else {
            console.error('❌ Failed to fetch request:', data.error)
            // Если заявка не найдена, сбрасываем loading
            if (showLoading) {
              setLoading(false)
            }
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            return // Запрос был отменен, игнорируем ошибку
          }
          console.error('❌ Failed to fetch request:', error)
          // При ошибке тоже сбрасываем loading
          if (isMountedRef.current && !abortController.signal.aborted && showLoading) {
            setLoading(false)
          }
        }
      }
      
      const fetchProfilePhoto = async (userId: string) => {
        try {
          const photoResponse = await fetch(`/api/users/${userId}/profile-photo`)
          
          // Проверяем Content-Type перед парсингом JSON
          const photoContentType = photoResponse.headers.get('content-type')
          if (!photoContentType || !photoContentType.includes('application/json')) {
            // Если не JSON, просто игнорируем (возможно, это ошибка 500)
            if (!photoResponse.ok) {
              const text = await photoResponse.text()
              console.error('❌ Profile photo API error:', photoResponse.status, text.substring(0, 200))
            }
            return
          }
          
          const photoData = await photoResponse.json()
          
          if (photoData.success && photoData.data?.photoUrl && isMountedRef.current) {
            setProfilePhotoUrl(photoData.data.photoUrl)
          }
        } catch (error) {
          console.error('Failed to fetch profile photo:', error)
        }
      }
      
      // Загружаем фото чека отдельно (может быть большим)
      const fetchPhotoFileUrl = async (requestId: number) => {
        try {
          const photoRes = await fetch(`/api/requests/${requestId}/photo`, {
            cache: 'default',
          }).catch(() => null)
          
          if (!isMountedRef.current || !photoRes || !photoRes.ok) return
          
          const data = await photoRes.json()
          
          // Убираем проверку на request - обновляем состояние напрямую
          if (data.success && data.data && isMountedRef.current) {
            setRequest(prev => {
              if (!prev) return null
              return {
                ...prev,
                photoFileUrl: data.data.photoFileUrl || null,
                cryptoPayment: data.data.cryptoPayment || null,
              }
            })
          }
        } catch (error) {
          console.error('Failed to fetch photo file URL:', error)
        }
      }
      
      // Загружаем дополнительные данные (matchingPayments, casinoTransactions, userNote) в фоне
      const fetchAdditionalData = async (requestId: number, userId: string, amount: string | null, accountId: string | null, bookmaker: string | null) => {
        try {
          const requestAmountInt = amount ? Math.floor(parseFloat(amount)) : null
          
          // Загружаем все дополнительные данные параллельно через отдельный API endpoint
          const additionalDataRes = await fetch(`/api/requests/${requestId}/additional`, {
            cache: 'default',
          }).catch(() => null)
          
          if (!isMountedRef.current || !additionalDataRes || !additionalDataRes.ok) return
          
          const data = await additionalDataRes.json()
          
          // Убираем проверку на request - обновляем состояние напрямую
          if (data.success && data.data && isMountedRef.current) {
            setRequest(prev => {
              if (!prev) return null
              return {
                ...prev,
                matchingPayments: data.data.matchingPayments || [],
                casinoTransactions: data.data.casinoTransactions || [],
                userNote: data.data.userNote || null,
              }
            })
          }
        } catch (error) {
          console.error('Failed to fetch additional data:', error)
        }
      }
    
    // Загружаем данные сразу
    fetchRequest(true)
    
    // Автоматическое обновление: чаще для pending заявок (5 сек), реже для остальных (15 сек)
    // Начинаем с 5 секунд (предполагаем что заявка pending), интервал обновится после первой загрузки
    let currentInterval = 5000
    
    const createInterval = () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      intervalId = setInterval(() => {
        if (!document.hidden) {
          fetchRequest(false)
        }
      }, currentInterval)
    }
    
    // Создаем интервал
    createInterval()
    
    // Обновляем интервал после загрузки данных
    const updateInterval = () => {
      if (request?.status === 'pending') {
        currentInterval = 5000
      } else {
        currentInterval = 15000
      }
      createInterval()
    }
    
    // Вызываем обновление интервала после первой загрузки
    setTimeout(() => {
      updateInterval()
    }, 100)
    
    // Обновление при фокусе страницы
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchRequest(false)
      }
    }
    
    const handleFocus = () => {
      fetchRequest(false)
    }
    
    // Синхронизация между вкладками через storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'request_updated' && e.newValue) {
        const updatedRequestId = parseInt(e.newValue)
        if (updatedRequestId === parseInt(requestId as string)) {
          console.log('🔄 Request updated in another tab:', updatedRequestId)
          fetchRequest(false)
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorageChange)
    
      return () => {
      abortController.abort()
      if (intervalId) {
        clearInterval(intervalId)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorageChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]) // request?.status обновляется внутри fetchRequest, не нужно в зависимостях

  // Закрываем меню при клике вне его
  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!isMountedRef.current) return
      
      const target = event.target as HTMLElement
      if (!target.closest('.relative')) {
        if (isMountedRef.current) {
          setShowMenu(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  // Получаем все транзакции по accountId (ID казино) - используем useMemo для безопасного вычисления
  // ВАЖНО: должен вызываться до любых условных возвратов!
  const transactions = useMemo(() => {
    if (!request || !request.casinoTransactions) return []
    
    return request.casinoTransactions.map(t => {
      const amount = parseFloat(t.amount || '0')
      const isDeposit = t.requestType === 'deposit'
      const userName = t.username 
        ? `@${t.username}` 
        : t.firstName 
          ? `${t.firstName}${t.lastName ? ' ' + t.lastName : ''}` 
          : `ID: ${t.userId}`
      
      return {
        id: t.id,
        amount: Math.abs(amount).toFixed(2).replace('.', ','),
        isDeposit,
        createdAt: t.createdAt,
        status: t.status,
        userName,
        userId: t.userId,
        bookmaker: t.bookmaker,
        description: `${isDeposit ? 'Пополнение' : 'Вывод'} от ${userName}`,
      }
    })
  }, [request])

  // Вычисляем отображаемую сумму: если выбран платеж, используем его сумму, иначе сумму заявки
  // ВАЖНО: должен вызываться до любых условных возвратов!
  const displayAmount = useMemo(() => {
    if (selectedPaymentId && request?.matchingPayments) {
      const selectedPayment = request.matchingPayments.find((p: MatchingPayment) => p.id === selectedPaymentId)
      if (selectedPayment) {
        return parseFloat(selectedPayment.amount).toFixed(2).replace('.', ',')
      }
    }
    return request?.amount ? parseFloat(request.amount).toFixed(2).replace('.', ',') : '0,00'
  }, [selectedPaymentId, request?.amount, request?.matchingPayments])

  // Отфильтрованные платежи для блока "Переводы по QR"
  const filteredPayments = useMemo(() => {
    if (!request?.matchingPayments) return []

    return request.matchingPayments.filter((payment: MatchingPayment) => {
      if (searchAmount) {
        const searchValue = parseFloat(searchAmount.replace(',', '.'))
        const paymentAmount = parseFloat(payment.amount)
        if (!isNaN(searchValue)) {
          if (exactAmount) {
            if (Math.abs(paymentAmount - searchValue) > 0.01) return false
          } else {
            if (paymentAmount < searchValue * 0.9 || paymentAmount > searchValue * 1.1) return false
          }
        }
      }
      if (processedOnly && !payment.isProcessed) return false
      return true
    })
  }, [request?.matchingPayments, searchAmount, exactAmount, processedOnly])

  // Показываем не больше 3 платежей
  const limitedPayments = useMemo(() => filteredPayments.slice(0, 3), [filteredPayments])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    // Скопировано в буфер обмена
  }, [])

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${day}.${month}.${year} • ${hours}:${minutes}`
  }, [])

  // Функция для определения кто обработал заявку (логин админа или "автопополнение")
  const getProcessedBy = useCallback((processedBy: string | null | undefined) => {
    if (!processedBy) {
      return null
    }
    return processedBy === 'автопополнение' ? 'автопополнение' : processedBy
  }, [])

  // Функция для определения состояния (Успешно/Отклонено/Ожидает)
  const getStatusState = useCallback((status: string) => {
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
    if (status === 'api_error' || status === 'deposit_failed') {
      return 'Ошибка API'
    }
    return status
  }, [])

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending':
      case 'Ожидает':
        return 'bg-yellow-500 text-black'
      case 'completed':
      case 'approved':
      case 'Успешно':
        return 'bg-green-500 text-black'
      case 'rejected':
        return 'bg-red-500 text-white'
      case 'api_error':
      case 'deposit_failed':
        return 'bg-orange-500 text-white'
      case 'deferred':
        return 'bg-orange-500 text-white'
      default:
        return 'bg-gray-700 text-gray-300'
    }
  }, [])

  const getStatusLabel = useCallback((status: string) => {
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
      default:
        return status
    }
  }, [])

  const deferRequest = async () => {
    if (!request) return
    
    setDeferring(true)
    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deferred' }),
      })

      // Проверяем Content-Type перед парсингом JSON
      const deferContentType = response.headers.get('content-type')
      if (!deferContentType || !deferContentType.includes('application/json')) {
        const text = await response.text()
        console.error('❌ Defer API returned non-JSON:', response.status, text.substring(0, 200))
        console.error(`Ошибка отложения заявки: Сервер вернул ошибку ${response.status}`)
        setDeferring(false)
        return
      }

      const data = await response.json()

      if (data.success) {
        // Проверяем, что компонент все еще смонтирован перед обновлением
        setRequest(prevRequest => prevRequest ? { ...prevRequest, ...data.data } : data.data)
        setShowMenu(false)
        
        // Уведомляем другие вкладки об обновлении
        localStorage.setItem('request_updated', request.id.toString())
        localStorage.removeItem('request_updated') // Триггерим storage event
        
        // Заявка отложена успешно
      } else {
        console.error('Ошибка при откладывании заявки:', data.error)
      }
    } catch (error) {
      console.error('Failed to defer request:', error)
    } finally {
      setDeferring(false)
    }
  }

    // Функция для обновления статуса заявки (подтвердить/отклонить)
    const updateRequestStatus = async (newStatus: 'completed' | 'approved' | 'rejected') => {
      if (!request) return
      
      try {
        // Если подтверждаем депозит и выбран платеж, сначала привязываем его
        if ((newStatus === 'completed' || newStatus === 'approved') && request.requestType === 'deposit' && selectedPaymentId) {
          try {
            const linkResponse = await fetch(`/api/incoming-payment/${selectedPaymentId}/link`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requestId: request.id }),
            })
            
            if (linkResponse.ok) {
              const linkData = await linkResponse.json()
              if (linkData.success) {
                // Обновляем заявку после привязки
                const fetchResponse = await fetch(`/api/requests/${request.id}`)
                if (fetchResponse.ok) {
                  const fetchData = await fetchResponse.json()
                  if (fetchData.success) {
                    setRequest(fetchData.data)
                    // Если заявка уже подтверждена автоматически (сумма совпала), перенаправляем на дашборд
                    if (fetchData.data.status === 'completed' || fetchData.data.status === 'approved') {
                      setSelectedPaymentId(null)
                      setTimeout(() => {
                        router.push('/dashboard')
                      }, 500)
                      return
                    }
                  }
                }
              }
            }
          } catch (linkError) {
            console.error('Failed to link payment:', linkError)
            // Продолжаем выполнение, даже если привязка не удалась
          }
        }
        
        // Если подтверждаем депозит, пополняем баланс через API казино
        if ((newStatus === 'completed' || newStatus === 'approved') && request.requestType === 'deposit' && request.bookmaker && request.accountId && request.amount) {
          try {
            // Если выбран платеж, используем его сумму, иначе сумму заявки
            let depositAmount = request.amount
            if (selectedPaymentId && request.matchingPayments) {
              const selectedPayment = request.matchingPayments.find((p: MatchingPayment) => p.id === selectedPaymentId)
              if (selectedPayment) {
                depositAmount = selectedPayment.amount
              }
            }
            
            const depositResponse = await fetch('/api/deposit-balance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requestId: request.id,
                bookmaker: request.bookmaker,
                accountId: request.accountId,
                amount: depositAmount,
              }),
            })

            // Проверяем, что ответ является JSON
            const contentType = depositResponse.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
              const text = await depositResponse.text()
              console.error('❌ Deposit API returned non-JSON response:', depositResponse.status, text.substring(0, 200))
              return
            }

            const depositData = await depositResponse.json()

            if (!depositData.success) {
              console.error('❌ Deposit failed:', depositData.error || depositData.message)
              return
            }

            // Если пополнение успешно, API уже обновил статус заявки на completed
            // Обновляем заявку из ответа API
            if (depositData.data?.request) {
              console.log('✅ Deposit successful, updating request from API response:', depositData.data.request)
              
              // Обновляем заявку с данными из ответа API (уже содержит обновленный статус)
              setRequest(depositData.data.request)
              
              // Перезагружаем данные для получения актуального состояния (включая связанные платежи)
              setTimeout(async () => {
                const refreshResponse = await fetch(`/api/requests/${request.id}`)
                
                // Проверяем Content-Type перед парсингом JSON
                const refreshContentType = refreshResponse.headers.get('content-type')
                if (!refreshContentType || !refreshContentType.includes('application/json')) {
                  console.error('❌ Refresh API returned non-JSON:', refreshResponse.status)
                  return
                }
                
                const refreshData = await refreshResponse.json()
                if (refreshData.success && isMountedRef.current) {
                  console.log('✅ Request refreshed after deposit:', refreshData.data)
                  setRequest(refreshData.data)
                }
              }, 500)
              
              // Уведомляем другие вкладки об обновлении
              localStorage.setItem('request_updated', request.id.toString())
              localStorage.removeItem('request_updated')
              
              setSelectedPaymentId(null)
              
              // Перенаправляем на дашборд после успешного депозита
              setTimeout(() => {
                router.push('/dashboard')
              }, 500)
              return
            } else {
              // Если в ответе нет данных заявки, перезагружаем вручную
              console.log('⚠️ No request data in deposit response, refreshing manually')
              setTimeout(async () => {
                const refreshResponse = await fetch(`/api/requests/${request.id}`)
                
                const refreshContentType = refreshResponse.headers.get('content-type')
                if (!refreshContentType || !refreshContentType.includes('application/json')) {
                  console.error('❌ Refresh API returned non-JSON:', refreshResponse.status)
                  return
                }
                
                const refreshData = await refreshResponse.json()
                if (refreshData.success && isMountedRef.current) {
                  setRequest(refreshData.data)
                }
              }, 500)
              
              setSelectedPaymentId(null)
              
              // Перенаправляем на дашборд после успешного депозита
              setTimeout(() => {
                router.push('/dashboard')
              }, 500)
              return
            }
          } catch (depositError) {
            console.error('Failed to deposit balance:', depositError)
            return
          }
        }

        // Обновляем статус заявки
        // processedBy будет установлен автоматически на сервере из токена админа
        const response = await fetch(`/api/requests/${request.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            status: newStatus
          }),
        })

        // Проверяем Content-Type перед парсингом JSON
        const responseContentType = response.headers.get('content-type')
        if (!responseContentType || !responseContentType.includes('application/json')) {
          const text = await response.text()
          console.error('❌ Update status API returned non-JSON:', response.status, text.substring(0, 200))
          return
        }

        const data = await response.json()

        if (data.success) {
          // Обновляем заявку с новым статусом
          const updatedRequest = { ...request, ...data.data, status: newStatus }
          setRequest(updatedRequest)
          
          // Перезагружаем данные для получения актуального состояния
          setTimeout(async () => {
            const refreshResponse = await fetch(`/api/requests/${request.id}`)
            
            // Проверяем Content-Type перед парсингом JSON
            const refreshContentType2 = refreshResponse.headers.get('content-type')
            if (!refreshContentType2 || !refreshContentType2.includes('application/json')) {
              console.error('❌ Refresh API returned non-JSON:', refreshResponse.status)
              return
            }
            
            const refreshData = await refreshResponse.json()
            if (refreshData.success && isMountedRef.current) {
              setRequest(refreshData.data)
            }
          }, 500)
          
          // Уведомляем другие вкладки об обновлении
          localStorage.setItem('request_updated', request.id.toString())
          localStorage.removeItem('request_updated') // Триггерим storage event
          
          setSelectedPaymentId(null)
          
          // Перенаправляем на дашборд после успешного обновления статуса
          setTimeout(() => {
            router.push('/dashboard')
          }, 500)
        } else {
          console.error('Failed to update request:', data.error)
        }
      } catch (error) {
        console.error('Failed to update request status:', error)
      }
    }

  const handleSearchById = () => {
    if (!searchId.trim()) {
      console.error('Введите ID заявки')
      return
    }

    const id = parseInt(searchId.trim())
    if (isNaN(id)) {
      console.error('ID должен быть числом')
      return
    }

    router.push(`/dashboard/requests/${id}`)
    setShowSearchModal(false)
    setSearchId('')
  }

  // Мемоизированный компонент для транзакции
  const TransactionListItem = memo(({ transaction, formatDate, getStatusState }: { 
    transaction: typeof transactions[0], 
    formatDate: (date: string) => string,
    getStatusState: (status: string) => string 
  }) => {
    const statusClass = transaction.status === 'completed' || transaction.status === 'approved'
      ? 'bg-green-500 text-black'
      : transaction.status === 'pending'
      ? 'bg-yellow-500 text-black'
      : transaction.status === 'rejected'
      ? 'bg-red-500 text-white'
      : 'bg-gray-700 text-gray-300'
    
    const statusLabel = getStatusState(transaction.status)
    const formattedDate = formatDate(transaction.createdAt)

    return (
      <Link
        href={`/dashboard/requests/${transaction.id}`}
        className="block bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-green-500 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className={`w-1 h-12 rounded-full ${transaction.isDeposit ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <p className="text-sm font-medium text-white">
                {transaction.description}
              </p>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
                {statusLabel}
              </span>
            </div>
            <p className="text-xs text-gray-400">{formattedDate}</p>
            {transaction.bookmaker && (
              <p className="text-xs text-gray-500 mt-1">{transaction.bookmaker}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <p className={`text-lg font-bold ${transaction.isDeposit ? 'text-green-500' : 'text-red-500'}`}>
              {transaction.isDeposit ? '+' : '-'}{transaction.amount}
            </p>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
    )
  })
  TransactionListItem.displayName = 'TransactionListItem'

  // Показываем лоадер во время загрузки
  if (loading && !request) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-white text-sm">Загрузка...</p>
      </div>
    )
  }

  // Показываем "Заявка не найдена" только если загрузка завершена и заявки нет
  if (!request && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-24 h-24 bg-red-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
          <svg className="w-16 h-16 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-white text-lg font-medium">Заявка не найдена</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
        >
          Назад
        </button>
      </div>
    )
  }

  // Мемоизируем вычисления для оптимизации рендеринга
  const requestComputed = useMemo(() => {
    if (!request) return null

    const isDeposit = request.requestType === 'deposit'
    const isDeferred = request.status === 'deferred'
    const processedBy = getProcessedBy(request.processedBy)
    const showMinus = isDeferred && processedBy === 'автопополнение'
    const isProcessed = request.status === 'completed' || 
                        request.status === 'approved' || 
                        request.status === 'rejected' || 
                        request.status === 'declined' ||
                        request.status === 'auto_completed' || 
                        request.status === 'autodeposit_success'
    const showActionButtons = !isProcessed || request.status === 'api_error' || request.status === 'deposit_failed'
    const userName = request.username 
      ? `@${request.username}` 
      : request.firstName 
        ? `${request.firstName}${request.lastName ? ' ' + request.lastName : ''}` 
        : `ID: ${request.userId}`
    const displayName = request.firstName || request.username || `ID: ${request.userId}`
    const statusColor = getStatusColor(request.status)
    const statusState = getStatusState(request.status)
    const formattedCreatedAt = formatDate(request.createdAt)

    return {
      isDeposit,
      isDeferred,
      processedBy,
      showMinus,
      isProcessed,
      showActionButtons,
      userName,
      displayName,
      statusColor,
      statusState,
      formattedCreatedAt,
    }
  }, [request, getProcessedBy, getStatusColor, getStatusState, formatDate])

    const isDeposit = requestComputed?.isDeposit ?? false
    const isDeferred = requestComputed?.isDeferred ?? false
    const processedBy = requestComputed?.processedBy ?? null
    const showMinus = requestComputed?.showMinus ?? false
    const isProcessed = requestComputed?.isProcessed ?? false
    const showActionButtons = requestComputed?.showActionButtons ?? false
    const userName = requestComputed?.userName ?? ''
    const displayName = requestComputed?.displayName ?? ''

  return (
    <div className="py-4">
      {/* Показываем "Заявка не найдена" только если загрузка завершена */}
      {!request && !loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-red-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <svg className="w-16 h-16 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-white text-lg font-medium">Заявка не найдена</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Назад
          </button>
        </div>
      ) : request ? (
        <>
      {/* Хедер с навигацией */}
      <div className="flex items-center mb-4 px-4">
        <div className="flex items-center space-x-2 flex-1 bg-gray-800 rounded-xl px-3 py-2 border border-gray-700">
          <button
            onClick={() => router.back()}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <Link
            href={`/dashboard/users/${request?.userId || ''}`}
            className="flex items-center space-x-2 flex-1"
          >
            {profilePhotoUrl ? (
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-gray-600 relative">
                <Image
                  src={profilePhotoUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  loading="lazy"
                  sizes="40px"
                  onError={() => {
                    // Если фото не загрузилось, показываем букву
                    setProfilePhotoUrl(null)
                  }}
                />
              </div>
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">{displayName.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="text-left flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              {request.username && (
                <p className="text-xs text-gray-400 truncate">@{request.username}</p>
              )}
            </div>
          </Link>
          <div className="flex items-center space-x-1">
            <Link
              href={`/dashboard/users/${request.userId}/chat`}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </Link>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-lg z-50">
                  <button
                    onClick={deferRequest}
                    disabled={deferring}
                    className="w-full text-left px-4 py-3 text-sm text-white hover:bg-gray-700 rounded-t-xl transition-colors disabled:opacity-50"
                  >
                    {deferring ? 'Откладывание...' : 'Отложить'}
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowSearchModal(true)
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-white hover:bg-gray-700 rounded-b-xl transition-colors"
                  >
                    Поиск по ID
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно поиска по ID */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 mx-4 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Поиск по ID</h3>
            <input
              type="text"
              placeholder="Введите ID заявки"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchById()}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 mb-4"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={handleSearchById}
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-black rounded-lg font-medium transition-colors"
              >
                Найти
              </button>
              <button
                onClick={() => {
                  setShowSearchModal(false)
                  setSearchId('')
                }}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Мини описание */}
      <div className="mx-4 mb-4 bg-gray-800 rounded-xl p-3 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-lg font-bold text-white">{request.accountId || 'N/A'}</span>
            {request.accountId && (
              <button
                onClick={() => copyToClipboard(request.accountId || '')}
                className="p-0.5 hover:bg-gray-700 rounded transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
          </div>
          <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full ${requestComputed?.statusColor || 'bg-gray-700 text-gray-300'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
            <span className="text-xs font-medium">{requestComputed?.statusState || request.status}</span>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-1.5">{requestComputed?.formattedCreatedAt || ''}</p>

        {/* Отображение ошибки депозита */}
        {(request.status === 'api_error' || request.status === 'deposit_failed') && request.statusDetail && (
          <div className="mb-2 p-2 bg-orange-900/30 border border-orange-500 rounded-lg">
            <p className="text-xs text-orange-300 font-semibold">⚠️ Ошибка депозита:</p>
            <p className="text-xs text-orange-200 mt-1">{request.statusDetail}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {isDeposit ? 'Пополнение' : 'Вывод'}
          </p>
          <p className={`text-xl font-bold ${showMinus ? 'text-red-500' : (isDeposit ? 'text-green-500' : 'text-red-500')}`}>
            {showMinus ? '-' : (isDeposit ? '+' : '-')}{displayAmount}
          </p>
        </div>
      </div>

      {/* Фото чека или QR-кода (если есть) */}
      {request.photoFileUrl && (
        <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <h3 className="text-base font-semibold text-white mb-3">
            {request.requestType === 'withdraw' ? 'Фото QR-кода' : 'Фото чека'}
          </h3>
          <div 
            className="relative w-full flex justify-center cursor-pointer hover:opacity-90 transition-opacity" 
            style={{ minHeight: '200px', maxHeight: '500px' }}
            onClick={() => {
              setShowPhotoModal(true)
              setPhotoZoom(1)
            }}
          >
            <Image
              src={request.photoFileUrl}
              alt="Фото чека об оплате"
              width={800}
              height={500}
              className="max-w-full max-h-[500px] rounded-lg border border-gray-600 object-contain"
              style={{ width: 'auto', height: 'auto' }}
              loading="lazy"
              onError={(e) => {
                // Если фото не загрузилось, скрываем блок
                const target = e.target as HTMLElement
                target.style.display = 'none'
                const parent = target.closest('.bg-gray-800')
                if (parent) {
                  (parent as HTMLElement).style.display = 'none'
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Модальное окно для увеличения фото */}
      {showPhotoModal && request.photoFileUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute top-4 right-4 z-10 bg-gray-800 hover:bg-gray-700 text-white rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-4 absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-gray-800/80 rounded-lg p-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPhotoZoom(Math.max(0.5, photoZoom - 0.25))
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white rounded px-3 py-1 text-sm font-medium"
              >
                −
              </button>
              <span className="text-white text-sm font-medium min-w-[60px] text-center">
                {Math.round(photoZoom * 100)}%
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPhotoZoom(Math.min(5, photoZoom + 0.25))
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white rounded px-3 py-1 text-sm font-medium"
              >
                +
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPhotoZoom(1)
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white rounded px-3 py-1 text-sm font-medium ml-2"
              >
                Сброс
              </button>
            </div>

            <div 
              className="max-w-full max-h-full overflow-auto"
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => {
                e.preventDefault()
                const delta = e.deltaY > 0 ? -0.1 : 0.1
                setPhotoZoom(Math.max(0.5, Math.min(5, photoZoom + delta)))
              }}
            >
              <Image
                src={request.photoFileUrl}
                alt="Фото чека об оплате (увеличенное)"
                width={1200}
                height={800}
                className="rounded-lg shadow-2xl"
                priority
                style={{ 
                  transform: `scale(${photoZoom})`,
                  transformOrigin: 'center',
                  transition: 'transform 0.1s ease-out',
                  maxWidth: '90vw',
                  maxHeight: '90vh',
                  objectFit: 'contain'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Входящие платежи с поиском - показываем для всех pending заявок */}
      {request.requestType === 'deposit' && request.status === 'pending' && (
        <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">Переводы по QR</h3>
          
          {/* Проверяем есть ли платежи */}
          {request.matchingPayments && request.matchingPayments.length > 0 ? (
            <>
              {/* Поиск и фильтры */}
              <div className="mb-3">
                <div className="flex space-x-2 mb-2">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Поиск по сумме..."
                      value={searchAmount}
                      onChange={(e) => setSearchAmount(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>
                <div className="flex space-x-3">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exactAmount}
                      onChange={(e) => setExactAmount(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-300">Точная сумма</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={processedOnly}
                      onChange={(e) => setProcessedOnly(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-300">Обработанные</span>
                  </label>
                </div>
              </div>
              
              {filteredPayments.length === 0 ? (
                <p className="text-sm text-gray-400">Совпадений не найдено</p>
              ) : (
                <>
                  <div className="space-y-1.5 pr-1">
                    {limitedPayments.map((payment: MatchingPayment) => {
                      const isAttached = payment.requestId === request.id && payment.isProcessed
                      const isAutoCompleted = request.status === 'autodeposit_success' || request.status === 'auto_completed'
                      const isDisabled = isAutoCompleted || isAttached || (payment.isProcessed && payment.requestId !== null && payment.requestId !== request.id)
                      const isSelected = selectedPaymentId === payment.id
                      
                      return (
                        <div
                          key={payment.id}
                          className={`bg-gray-900 rounded-lg p-2.5 border transition-colors ${
                            isDisabled 
                              ? 'border-gray-700 opacity-50 cursor-not-allowed' 
                              : isSelected
                                ? 'border-green-500 bg-green-900/20'
                                : 'border-gray-700 hover:border-gray-600 cursor-pointer'
                          }`}
                          onClick={() => !isDisabled && setSelectedPaymentId(isSelected ? null : payment.id)}
                        >
                          <div className="flex items-center space-x-2">
                            <div className={`w-1 h-10 rounded-full ${isDisabled ? 'bg-gray-600' : 'bg-green-500'}`}></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-white truncate">Перевод по QR</p>
                                {(isAttached || (payment.isProcessed && payment.requestId === request.id)) && (
                                  <span className="px-2 py-0.5 bg-gray-600 text-gray-300 rounded text-xs font-medium flex-shrink-0">
                                    Обработан
                                  </span>
                                )}
                                {payment.isProcessed && payment.requestId !== request.id && payment.requestId !== null && (
                                  <span className="px-2 py-0.5 bg-gray-600 text-gray-300 rounded text-xs font-medium flex-shrink-0">
                                    Обработан
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 mt-0.5">
                                <p className="text-xs text-gray-400">{formatDate(payment.paymentDate)}</p>
                                {payment.bank && (
                                  <span className="text-xs text-gray-500">• {payment.bank}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <p className={`text-base font-bold ${isDisabled ? 'text-gray-500' : 'text-green-500'}`}>
                                +{parseFloat(payment.amount).toFixed(2).replace('.', ',')}
                              </p>
                              {isSelected && !isDisabled && (
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {filteredPayments.length > 3 && (
                    <p className="text-[11px] text-gray-500 mt-2">
                      Показаны первые 3 из {filteredPayments.length} совпадений
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">Платежи не найдены</p>
              <p className="text-gray-500 text-xs mt-1">Ожидание платежа на сумму {request.amount ? parseFloat(request.amount.toString()).toFixed(2).replace('.', ',') : '0,00'} сом</p>
            </div>
          )}
        </div>
      )}

      {/* Кнопки действий для отложенных и ожидающих заявок */}
      {/* Скрываем кнопки если заявка уже обработана */}
      {(() => {
        const isPendingOrDeferred = request.status === 'deferred' || request.status === 'pending'
        const isProcessed = request.status === 'completed' || 
                          request.status === 'approved' || 
                          request.status === 'rejected' || 
                          request.status === 'auto_completed' || 
                          request.status === 'autodeposit_success'
        
        // Показываем кнопки для:
        // 1. Необработанных заявок со статусом pending или deferred
        // 2. Заявок с ошибкой API (api_error, deposit_failed) - чтобы можно было пополнить баланс и подтвердить вручную
        const isApiError = request.status === 'api_error' || request.status === 'deposit_failed'
        return (isPendingOrDeferred && !isProcessed) || isApiError
      })() && (
        <div className="mx-4 mb-4 flex space-x-3">
          <button
            onClick={() => {
              setPendingStatus('approved')
              setShowConfirmModal(true)
            }}
            className="flex-1 bg-green-500 hover:bg-green-600 text-black font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Подтвердить</span>
          </button>
          <button
            onClick={() => {
              // Для выводов показываем дополнительное предупреждение
              if (request.requestType === 'withdraw') {
                if (!confirm(`⚠️ ВНИМАНИЕ!\n\nВы уверены, что хотите ОТКЛОНИТЬ вывод на ${request.amount ? parseFloat(request.amount.toString()).toFixed(2).replace('.', ',') : '0,00'} сом?\n\nЭто действие может быть выполнено только администратором и не может быть отменено автоматически.`)) {
                  return
                }
              }
              setPendingStatus('rejected')
              setShowConfirmModal(true)
            }}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Отклонить</span>
          </button>
        </div>
      )}

      {/* Модальное окно подтверждения */}
      {showConfirmModal && request && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowConfirmModal(false)}>
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">
              {pendingStatus === 'rejected' ? '⚠️ Отклонить заявку' : 'Подтвердить операцию'}
            </h3>
            <p className="text-gray-300 mb-6">
              {pendingStatus === 'rejected' && request.requestType === 'withdraw' ? (
                <>
                  <span className="text-red-400 font-semibold block mb-2">⚠️ ВНИМАНИЕ: Отклонение вывода</span>
                  Вы уверены, что хотите <span className="text-red-400 font-semibold">отклонить</span> заявку на{' '}
                  <span className="font-semibold text-white">вывод</span>{' '}
                  <span className="font-semibold text-white">
                    {request.amount ? parseFloat(request.amount.toString()).toFixed(2).replace('.', ',') : '0,00'} сом
                  </span>{' '}
                  для {userName}?
                  <br /><br />
                  <span className="text-yellow-400 text-sm">
                    ⚠️ Это действие может быть выполнено только администратором и не может быть отменено автоматически.
                  </span>
                </>
              ) : pendingStatus === 'rejected' ? (
                <>
                  Вы уверены, что хотите <span className="text-red-400 font-semibold">отклонить</span> заявку на{' '}
                  {request.requestType === 'deposit' ? 'пополнение' : 'вывод'}{' '}
                  <span className="font-semibold text-white">
                    {request.amount ? parseFloat(request.amount.toString()).toFixed(2).replace('.', ',') : '0,00'} сом
                  </span>{' '}
                  для {userName}?
                </>
              ) : (
                <>
                  Вы уверены, что хотите{' '}
                  <span className="text-green-400 font-semibold">
                    {request.requestType === 'deposit' ? 'принять' : 'принять'}
                  </span>{' '}
                  заявку на {request.requestType === 'deposit' ? 'пополнение' : 'вывод'}{' '}
                  <span className="font-semibold text-white">
                    {request.amount ? parseFloat(request.amount.toString()).toFixed(2).replace('.', ',') : '0,00'} сом
                  </span>{' '}
                  для {userName}?
                </>
              )}
            </p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={async () => {
                  setShowConfirmModal(false)
                  if (pendingStatus) {
                    await updateRequestStatus(pendingStatus)
                    setPendingStatus(null)
                  }
                }}
                className={`w-full font-semibold py-3 px-4 rounded-xl transition-colors ${
                  pendingStatus === 'rejected' 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {pendingStatus === 'rejected' ? 'Да, отклонить' : 'Да, принять'}
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setPendingStatus(null)
                }}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Информация о сайте и пользователе */}
      <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-4 border border-gray-700">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Сайт:</span>
            <span className="text-sm font-medium text-white">{request.bookmaker || 'N/A'}</span>
          </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">ID заявки:</span>
              <span className="text-sm font-medium text-white">{request.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">ID счета:</span>
              <span className="text-sm font-medium text-white">{request.accountId || 'N/A'}</span>
            </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Дата создания:</span>
            <span className="text-sm font-medium text-white">{requestComputed?.formattedCreatedAt || ''}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Пользователь:</span>
            <span className="text-sm font-medium text-white">{userName}</span>
          </div>
          {request.userNote && (
            <div className="pt-2 border-t border-gray-700">
              <span className="text-sm text-gray-400 block mb-1">Заметка:</span>
              <span className="text-sm font-medium text-red-400 whitespace-pre-wrap">{request.userNote}</span>
            </div>
          )}
          {request.bank && request.paymentMethod !== 'crypto' && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Банк:</span>
              <span className="text-sm font-medium text-white">{request.bank}</span>
            </div>
          )}
          {request.paymentMethod && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Способ оплаты:</span>
              <span className={`text-sm font-medium ${
                request.paymentMethod === 'crypto' ? 'text-purple-400' : 'text-white'
              }`}>
                {request.paymentMethod === 'crypto' ? '₿ Криптовалюта' : '💳 Банковский перевод'}
              </span>
            </div>
          )}
          {request.paymentMethod === 'crypto' && request.cryptoPayment && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Крипто-платеж:</span>
              <span className="text-sm font-medium text-purple-400">
                {request.cryptoPayment.amount} {request.cryptoPayment.asset}
              </span>
            </div>
          )}
          {request.status && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Статус:</span>
              <span className={`text-sm font-medium ${requestComputed?.statusColor?.includes('text-') ? requestComputed.statusColor : 'text-white'}`}>
                {requestComputed?.statusState || request.status}
              </span>
            </div>
          )}
          
          {/* Отображение деталей ошибки */}
          {(request.status === 'api_error' || request.status === 'deposit_failed') && request.statusDetail && (
            <div className="mt-3 p-3 bg-orange-900/30 border border-orange-500 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-orange-300 font-semibold mb-1">Ошибка при пополнении баланса:</p>
                  <p className="text-sm text-orange-200">{request.statusDetail}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Список транзакций по ID казино */}
      <div className="mx-4">
        <h3 className="text-lg font-semibold text-white mb-3">
          Транзакции {request.accountId && `(ID: ${request.accountId})`}
        </h3>
        {transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <TransactionListItem
                key={transaction.id}
                transaction={transaction}
                formatDate={formatDate}
                getStatusState={getStatusState}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
            <p className="text-gray-400">
              {request.accountId 
                ? `Нет транзакций по ID: ${request.accountId}`
                : 'ID казино не указан'}
            </p>
          </div>
        )}
      </div>
        </>
      ) : null}
    </div>
  )
}
