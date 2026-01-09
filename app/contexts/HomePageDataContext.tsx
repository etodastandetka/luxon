'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { getTelegramUserId } from '../utils/telegram'
import { API_URLS } from '../config/api'

interface HomePageData {
  transactions: any[]
  topPlayers: any[]
  loading: boolean
}

interface HomePageDataContextType {
  data: HomePageData
  refresh: () => void
}

const HomePageDataContext = createContext<HomePageDataContextType | undefined>(undefined)

// Кеш для данных главной страницы
const dataCache = new Map<string, { data: HomePageData; timestamp: number }>()
const CACHE_TTL = 120_000 // 120 секунд - увеличили для более быстрой загрузки

// Кеш в sessionStorage для еще более быстрого доступа
const getSessionCache = (userId: string): HomePageData | null => {
  if (typeof window === 'undefined') return null
  try {
    const cacheKey = `homepage_cache_${userId}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached) as { data: HomePageData; timestamp: number }
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed.data
      }
    }
  } catch {
    // Игнорируем ошибки
  }
  return null
}

const setSessionCache = (userId: string, data: HomePageData) => {
  if (typeof window === 'undefined') return
  try {
    const cacheKey = `homepage_cache_${userId}`
    sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // Игнорируем ошибки quota
  }
}

// Глобальное состояние для предотвращения множественных загрузок
let globalData: HomePageData | null = null
let isLoading = false
let loadingPromise: Promise<HomePageData> | null = null
let subscribers: Set<(data: HomePageData) => void> = new Set()

const loadAllData = async (): Promise<HomePageData> => {
  // Если уже идет загрузка, возвращаем существующий промис
  if (isLoading && loadingPromise) {
    return loadingPromise
  }

  // Если данные уже загружены глобально, возвращаем их
  if (globalData && !globalData.loading) {
    return globalData
  }

  const userId = getTelegramUserId()
  if (!userId) {
    const emptyData = { transactions: [], topPlayers: [], loading: false }
    globalData = emptyData
    return emptyData
  }

  // Проверяем кеш (сначала sessionStorage, потом память)
  const cacheKey = `homepage_${userId}`
  
  // Проверяем sessionStorage для быстрого доступа
  const sessionCached = getSessionCache(userId)
  if (sessionCached && !sessionCached.loading) {
    globalData = sessionCached
    dataCache.set(cacheKey, { data: sessionCached, timestamp: Date.now() })
    return sessionCached
  }
  
  // Проверяем кеш в памяти
  const cached = dataCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    globalData = cached.data
    setSessionCache(userId, cached.data) // Сохраняем в sessionStorage
    return cached.data
  }

  // Устанавливаем флаг загрузки и создаем промис
  isLoading = true
  loadingPromise = (async () => {
    try {
      // Загружаем все данные параллельно одним запросом
      // Загружаем все транзакции пачками, как в профиле, чтобы получить точную статистику
      let allTransactions: any[] = []
      try {
        let offset = 0
        const limit = 1000
        let hasMore = true
        
        // Загружаем все транзакции пачками (максимум 10000 для статистики)
        while (hasMore && offset < 10000) {
          const transactionsResponse = await fetch(
            `${API_URLS.BASE}/api/transaction-history?user_id=${userId}&limit=${limit}&offset=${offset}`,
            {
              cache: 'no-store', // Не кэшируем для актуальных данных
            }
          )
          
          if (!transactionsResponse.ok) {
            console.warn('⚠️ Transaction history API returned error:', transactionsResponse.status)
            break
          }
          
          const transactionsData = await transactionsResponse.json()
          
          const transactions = transactionsData.data?.transactions || transactionsData.transactions || []
          allTransactions = allTransactions.concat(transactions)
          
          // Проверяем, есть ли еще транзакции
          hasMore = transactionsData.data?.pagination?.hasMore || transactions.length === limit
          offset += limit
          
          // Если получили меньше транзакций чем лимит, значит это последняя страница
          if (transactions.length < limit) {
            hasMore = false
          }
        }
        
        console.log('✅ Transactions loaded:', allTransactions.length, 'transactions')
      } catch (error) {
        console.error('❌ Error loading transactions:', error)
        // Продолжаем с пустым массивом - не критично для отображения
        allTransactions = []
      }
      
      // Загружаем leaderboard параллельно
      let topPlayers: any[] = []
      try {
        const leaderboardResponse = await fetch(`${API_URLS.LEADERBOARD}?type=deposits&limit=5`, {
          cache: 'no-store', // Не кэшируем для актуальных данных
        })
        
        if (leaderboardResponse.ok) {
          const leaderboardData = await leaderboardResponse.json()
          
          // Обрабатываем разные форматы ответа
          let rawLeaderboard: any[] = []
          
          if (leaderboardData.success && leaderboardData.data?.leaderboard) {
            rawLeaderboard = Array.isArray(leaderboardData.data.leaderboard) 
              ? leaderboardData.data.leaderboard
              : []
          } else if (Array.isArray(leaderboardData.leaderboard)) {
            // Fallback для другого формата ответа
            rawLeaderboard = leaderboardData.leaderboard
          } else if (Array.isArray(leaderboardData)) {
            // Еще один fallback
            rawLeaderboard = leaderboardData
          }
          
          // Преобразуем данные в нужный формат для компонента
          topPlayers = rawLeaderboard.slice(0, 5).map((player: any) => ({
            userId: player.userId || player.user_id || String(player.id || ''),
            displayName: player.displayName || player.display_name || player.username || `Игрок #${player.userId || player.user_id || ''}`,
            totalAmount: typeof player.totalAmount === 'number' ? player.totalAmount : (typeof player.total_amount === 'number' ? player.total_amount : 0),
            rank: typeof player.rank === 'number' ? player.rank : (player.rank || 0),
            rankType: player.rankType || player.rank_type || 'iron',
          }))
          
          console.log('✅ Leaderboard loaded:', topPlayers.length, 'players')
        } else {
          console.warn('⚠️ Leaderboard API returned error:', leaderboardResponse.status, leaderboardResponse.statusText)
        }
      } catch (error) {
        console.error('❌ Error loading leaderboard:', error)
        // Продолжаем с пустым массивом - не критично
        topPlayers = []
      }

      const transactions = allTransactions

      const result: HomePageData = {
        transactions,
        topPlayers,
        loading: false,
      }

      // Сохраняем в кеш (память + sessionStorage) и глобально
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() })
      setSessionCache(userId, result)
      globalData = result
      
      // Уведомляем всех подписчиков
      subscribers.forEach(callback => callback(result))
      
      return result
    } catch (error) {
      console.error('Error loading homepage data:', error)
      const errorData = { transactions: [], topPlayers: [], loading: false }
      globalData = errorData
      subscribers.forEach(callback => callback(errorData))
      return errorData
    } finally {
      isLoading = false
      loadingPromise = null
    }
  })()

  return loadingPromise
}

// Функция для получения начального состояния из кеша
const getInitialData = (): HomePageData => {
  // Сначала проверяем глобальные данные
  if (globalData && !globalData.loading) {
    return globalData
  }

  const userId = getTelegramUserId()
  if (userId) {
    const cacheKey = `homepage_${userId}`
    
    // Проверяем sessionStorage для быстрого доступа
    const sessionCached = getSessionCache(userId)
    if (sessionCached && !sessionCached.loading) {
      globalData = sessionCached
      return sessionCached
    }
    
    // Проверяем кеш в памяти
    const cached = dataCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      globalData = cached.data
      return cached.data
    }
  }
  
  // Возвращаем пустые данные без флага загрузки, чтобы контент показывался сразу
  // Данные загрузятся в фоне через useEffect
  return {
    transactions: [],
    topPlayers: [],
    loading: false,
  }
}

export function HomePageDataProvider({ children }: { children: ReactNode }) {
  // Инициализируем состояние из кеша синхронно
  const [data, setData] = useState<HomePageData>(getInitialData)
  const mountedRef = useRef(true)
  const subscribedRef = useRef(false)
  const userIdRef = useRef<string | null>(null)

  // Проверяем userId при монтировании и при изменениях
  useEffect(() => {
    mountedRef.current = true
    const currentUserId = getTelegramUserId()
    
    // Если пользователь изменился или появился (был null, стал не null), перезагружаем данные
    if (userIdRef.current !== currentUserId) {
      const previousUserId = userIdRef.current
      userIdRef.current = currentUserId
      
      // Если пользователь появился (раньше был null, теперь есть) или изменился, очищаем кеш
      if (currentUserId && (previousUserId !== currentUserId)) {
        const cacheKey = `homepage_${currentUserId}`
        dataCache.delete(cacheKey)
        globalData = null
        isLoading = false
        loadingPromise = null
        
        // Сразу загружаем данные для нового пользователя
        loadAllData().then(result => {
          if (mountedRef.current) {
            console.log('📊 Data loaded for user:', currentUserId, 'transactions:', result.transactions.length)
            setData(result)
          }
        }).catch(error => {
          console.error('❌ Error loading data for user:', error)
          if (mountedRef.current) {
            setData({ transactions: [], topPlayers: [], loading: false })
          }
        })
      }
    }
  }, []) // Запускаем только при монтировании
  
  // Отдельный эффект для периодической проверки userId (если он появится позже)
  useEffect(() => {
    const checkUserId = () => {
      const currentUserId = getTelegramUserId()
      if (!currentUserId) {
        // Если userId еще нет, проверяем снова через небольшую задержку
        return
      }
      
      if (userIdRef.current !== currentUserId) {
        userIdRef.current = currentUserId
        // Перезагружаем данные
        const cacheKey = `homepage_${currentUserId}`
        dataCache.delete(cacheKey)
        globalData = null
        isLoading = false
        loadingPromise = null
        
        loadAllData().then(result => {
          if (mountedRef.current) {
            console.log('📊 Data loaded after userId appeared:', currentUserId, 'transactions:', result.transactions.length)
            setData(result)
          }
        }).catch(error => {
          console.error('❌ Error loading data after userId appeared:', error)
        })
      }
    }
    
    // Проверяем сразу
    checkUserId()
    
    // Проверяем с интервалом на случай, если userId появится позже
    const interval = setInterval(checkUserId, 500)
    
    return () => clearInterval(interval)
  }, [])
  
  // Подписываемся на обновления (только один раз)
  useEffect(() => {
    if (!subscribedRef.current) {
      subscribedRef.current = true
      const callback = (newData: HomePageData) => {
        if (mountedRef.current) {
          console.log('📊 HomePageData updated via callback:', {
            transactions: newData.transactions.length,
            topPlayers: newData.topPlayers.length,
            loading: newData.loading
          })
          setData(newData)
        }
      }
      subscribers.add(callback)

      // Если уже идет загрузка, ждем результат
      if (isLoading && loadingPromise) {
        loadingPromise.then(result => {
          if (mountedRef.current) {
            setData(result)
          }
        }).catch(error => {
          console.error('❌ Error in loading promise:', error)
          if (mountedRef.current) {
            setData({ transactions: [], topPlayers: [], loading: false })
          }
        })
      } else {
        // Загружаем данные сразу при первой подписке
        const currentUserId = getTelegramUserId()
        if (currentUserId) {
          loadAllData().then(result => {
            if (mountedRef.current) {
              console.log('📊 Initial data loaded:', currentUserId, 'transactions:', result.transactions.length)
              setData(result)
            }
          }).catch(error => {
            console.error('❌ Error loading initial data:', error)
            if (mountedRef.current) {
              setData({ transactions: [], topPlayers: [], loading: false })
            }
          })
        }
      }

      return () => {
        subscribers.delete(callback)
        mountedRef.current = false
      }
    }
  }, [])
  
  // Периодическое обновление данных для актуальной статистики
  useEffect(() => {
    const currentUserId = getTelegramUserId()
    if (!currentUserId) {
      return
    }
    
    // Обновляем данные периодически (каждые 30 секунд) чтобы статистика была актуальной
    const refreshInterval = setInterval(() => {
      if (mountedRef.current && userIdRef.current === currentUserId) {
        // Очищаем кеш перед обновлением для получения актуальных данных
        const cacheKey = `homepage_${currentUserId}`
        dataCache.delete(cacheKey)
        globalData = null
        isLoading = false
        loadingPromise = null
        
        loadAllData().then(result => {
          if (mountedRef.current) {
            console.log('🔄 Periodic data refresh:', currentUserId, 'transactions:', result.transactions.length)
            setData(result)
          }
        }).catch(error => {
          console.error('❌ Error in periodic refresh:', error)
        })
      }
    }, 30000) // Обновляем каждые 30 секунд
    
    // Обновляем при фокусе окна (когда пользователь возвращается на вкладку)
    const handleFocus = () => {
      if (mountedRef.current && userIdRef.current === currentUserId) {
        const cacheKey = `homepage_${currentUserId}`
        dataCache.delete(cacheKey)
        globalData = null
        isLoading = false
        loadingPromise = null
        
        loadAllData().then(result => {
          if (mountedRef.current) {
            console.log('🔄 Focus refresh:', currentUserId, 'transactions:', result.transactions.length)
            setData(result)
          }
        }).catch(error => {
          console.error('❌ Error in focus refresh:', error)
        })
      }
    }
    
    window.addEventListener('focus', handleFocus)
    
    // Обновляем при видимости страницы
    const handleVisibilityChange = () => {
      if (!document.hidden && mountedRef.current && userIdRef.current === currentUserId) {
        const cacheKey = `homepage_${currentUserId}`
        dataCache.delete(cacheKey)
        globalData = null
        isLoading = false
        loadingPromise = null
        
        loadAllData().then(result => {
          if (mountedRef.current) {
            console.log('🔄 Visibility refresh:', currentUserId, 'transactions:', result.transactions.length)
            setData(result)
          }
        }).catch(error => {
          console.error('❌ Error in visibility refresh:', error)
        })
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Если данные пустые, загружаем сразу
    if (!data.transactions.length && !data.topPlayers.length) {
      const cacheKey = `homepage_${currentUserId}`
      const cached = dataCache.get(cacheKey)
      
      // Если в кеше нет данных или они устарели, загружаем
      if (!cached || Date.now() - cached.timestamp >= CACHE_TTL) {
        loadAllData().then(result => {
          if (mountedRef.current) {
            console.log('📊 Reloading empty data:', currentUserId, 'transactions:', result.transactions.length)
            setData(result)
          }
        }).catch(error => {
          console.error('❌ Error reloading empty data:', error)
        })
      }
    }
    
    return () => {
      clearInterval(refreshInterval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [data.transactions.length, data.topPlayers.length]) // Перезагружаем при изменении данных

  // Отслеживаем изменение пользователя и перезагружаем данные
  useEffect(() => {
    const currentUserId = getTelegramUserId()
    if (userIdRef.current !== currentUserId && currentUserId) {
      console.log('🔄 User changed, reloading data:', currentUserId)
      userIdRef.current = currentUserId
      // Перезагружаем данные для нового пользователя
      const cacheKey = `homepage_${currentUserId}`
      dataCache.delete(cacheKey)
      globalData = null
      isLoading = false
      loadingPromise = null
      // Не устанавливаем loading: true, чтобы контент показывался сразу
      setData({ transactions: [], topPlayers: [], loading: false })
      loadAllData().then(result => {
        if (mountedRef.current) {
          setData(result)
        }
      }).catch(error => {
        console.error('❌ Error reloading data for new user:', error)
        if (mountedRef.current) {
          setData({ transactions: [], topPlayers: [], loading: false })
        }
      })
    }
  })

  const refresh = () => {
    const userId = getTelegramUserId()
    if (userId) {
      const cacheKey = `homepage_${userId}`
      dataCache.delete(cacheKey)
    }
    globalData = null
    isLoading = false
    loadingPromise = null
    setData({ transactions: [], topPlayers: [], loading: true })
    
    // Перезагружаем данные
    loadAllData().then(result => {
      if (mountedRef.current) {
        setData(result)
      }
    })
  }

  return (
    <HomePageDataContext.Provider value={{ data, refresh }}>
      {children}
    </HomePageDataContext.Provider>
  )
}

export function useHomePageData() {
  const context = useContext(HomePageDataContext)
  if (!context) {
    // Fallback для случаев, когда провайдер не используется
    return {
      transactions: [],
      topPlayers: [],
      loading: false,
    }
  }
  return context.data
}
