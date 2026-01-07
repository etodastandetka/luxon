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
      let offset = 0
      const limit = 1000
      let hasMore = true
      
      // Загружаем все транзакции пачками (максимум 10000 для статистики)
      while (hasMore && offset < 10000) {
        const transactionsResponse = await fetch(
          `${API_URLS.BASE}/api/transaction-history?user_id=${userId}&limit=${limit}&offset=${offset}`
        )
        const transactionsData = await transactionsResponse.json()
        
        const transactions = transactionsData.data?.transactions || transactionsData.transactions || []
        allTransactions = allTransactions.concat(transactions)
        
        // Проверяем, есть ли еще транзакции
        hasMore = transactionsData.data?.pagination?.hasMore || transactions.length === limit
        offset += limit
      }
      
      // Загружаем leaderboard параллельно
      const leaderboardResponse = await fetch(`${API_URLS.LEADERBOARD}?type=deposits&limit=5`)
      const leaderboardData = await leaderboardResponse.json()

      const transactions = allTransactions
      const topPlayers = leaderboardData.success && leaderboardData.data?.leaderboard
        ? leaderboardData.data.leaderboard.slice(0, 5)
        : []

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
  
  return {
    transactions: [],
    topPlayers: [],
    loading: true,
  }
}

export function HomePageDataProvider({ children }: { children: ReactNode }) {
  // Инициализируем состояние из кеша синхронно
  const [data, setData] = useState<HomePageData>(getInitialData)
  const mountedRef = useRef(true)
  const subscribedRef = useRef(false)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    const currentUserId = getTelegramUserId()
    
    // Если пользователь изменился, очищаем кеш и перезагружаем данные
    if (userIdRef.current !== currentUserId) {
      userIdRef.current = currentUserId
      if (currentUserId) {
        const cacheKey = `homepage_${currentUserId}`
        dataCache.delete(cacheKey)
        globalData = null
        isLoading = false
        loadingPromise = null
      }
    }
    
    // Если данные уже загружены из кеша, сразу показываем их и обновляем в фоне
    if (!data.loading) {
      // Загружаем свежие данные в фоне без блокировки UI (даже если данных нет)
      loadAllData().then(result => {
        if (mountedRef.current) {
          setData(result)
        }
      }).catch(() => {
        // Игнорируем ошибки фоновой загрузки
      })
      // Не возвращаемся - продолжаем подписку
    }

    // Подписываемся на обновления (только один раз)
    if (!subscribedRef.current) {
      subscribedRef.current = true
      const callback = (newData: HomePageData) => {
        if (mountedRef.current) {
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
        })
      } else {
        // Загружаем данные сразу, не ждем
        loadAllData()
      }

      return () => {
        subscribers.delete(callback)
        mountedRef.current = false
      }
    }
  }, []) // Пустой массив - выполняется только один раз

  // Отслеживаем изменение пользователя и перезагружаем данные
  useEffect(() => {
    const currentUserId = getTelegramUserId()
    if (userIdRef.current !== currentUserId && currentUserId) {
      userIdRef.current = currentUserId
      // Перезагружаем данные для нового пользователя
      const cacheKey = `homepage_${currentUserId}`
      dataCache.delete(cacheKey)
      globalData = null
      isLoading = false
      loadingPromise = null
      setData({ transactions: [], topPlayers: [], loading: true })
      loadAllData().then(result => {
        if (mountedRef.current) {
          setData(result)
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
