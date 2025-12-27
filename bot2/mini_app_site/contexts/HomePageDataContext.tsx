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

// Глобальный флаг загрузки для предотвращения дублирования
let isLoading = false
let loadingPromise: Promise<HomePageData> | null = null

const loadAllData = async (): Promise<HomePageData> => {
  const userId = getTelegramUserId()
  if (!userId) {
    return { transactions: [], topPlayers: [], loading: false }
  }

  // Проверяем кеш
  const cacheKey = `homepage_${userId}`
  const cached = dataCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

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

    // Сохраняем в кеш
    dataCache.set(cacheKey, { data: result, timestamp: Date.now() })
    return result
  } catch (error) {
    console.error('Error loading homepage data:', error)
    return { transactions: [], topPlayers: [], loading: false }
  }
}

export function HomePageDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HomePageData>({
    transactions: [],
    topPlayers: [],
    loading: true,
  })
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    // Если уже идет загрузка, ждем ее
    if (isLoading && loadingPromise) {
      loadingPromise.then(result => {
        setData(result)
      })
      return
    }

    // Начинаем загрузку
    isLoading = true
    loadingPromise = loadAllData()
    
    loadingPromise.then(result => {
      setData(result)
      isLoading = false
      loadingPromise = null
    }).catch(() => {
      isLoading = false
      loadingPromise = null
    })
  }, [])

  const refresh = () => {
    const userId = getTelegramUserId()
    if (userId) {
      const cacheKey = `homepage_${userId}`
      dataCache.delete(cacheKey)
    }
    loadedRef.current = false
    isLoading = false
    loadingPromise = null
    setData({ transactions: [], topPlayers: [], loading: true })
    
    // Перезагружаем данные
    const promise = loadAllData()
    promise.then(result => {
      setData(result)
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

