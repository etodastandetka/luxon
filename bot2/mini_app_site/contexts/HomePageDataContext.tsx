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
const CACHE_TTL = 30_000 // 30 секунд

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

  // Проверяем кеш
  const cacheKey = `homepage_${userId}`
  const cached = dataCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    globalData = cached.data
    return cached.data
  }

  // Устанавливаем флаг загрузки и создаем промис
  isLoading = true
  loadingPromise = (async () => {
    try {
      // Загружаем все данные параллельно одним запросом
      const [transactionsResponse, leaderboardResponse] = await Promise.all([
        fetch(`${API_URLS.BASE}/api/transaction-history?user_id=${userId}&limit=1000`),
        fetch(`${API_URLS.LEADERBOARD}?type=deposits&limit=5`),
      ])

      const [transactionsData, leaderboardData] = await Promise.all([
        transactionsResponse.json(),
        leaderboardResponse.json(),
      ])

      const transactions = transactionsData.data?.transactions || transactionsData.transactions || []
      const topPlayers = leaderboardData.success && leaderboardData.data?.leaderboard
        ? leaderboardData.data.leaderboard.slice(0, 5)
        : []

      const result: HomePageData = {
        transactions,
        topPlayers,
        loading: false,
      }

      // Сохраняем в кеш и глобально
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() })
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

  useEffect(() => {
    mountedRef.current = true
    
    // Если данные уже загружены, не делаем ничего
    if (!data.loading && data.transactions.length > 0) {
      return
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
      } else if (!globalData || globalData.loading) {
        // Загружаем данные только если их еще нет
        loadAllData()
      }

      return () => {
        subscribers.delete(callback)
        mountedRef.current = false
      }
    }
  }, []) // Пустой массив - выполняется только один раз

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
