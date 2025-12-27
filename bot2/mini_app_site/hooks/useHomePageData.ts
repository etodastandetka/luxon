'use client'

import { useState, useEffect, useRef } from 'react'
import { getTelegramUserId } from '../utils/telegram'
import { API_URLS } from '../config/api'

interface HomePageData {
  transactions: any[]
  topPlayers: any[]
  loading: boolean
}

// Кеш для данных главной страницы
const dataCache = new Map<string, { data: HomePageData; timestamp: number }>()
const CACHE_TTL = 30_000 // 30 секунд

export function useHomePageData() {
  const [data, setData] = useState<HomePageData>({
    transactions: [],
    topPlayers: [],
    loading: true,
  })
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const loadAllData = async () => {
      const userId = getTelegramUserId()
      if (!userId) {
        setData({ transactions: [], topPlayers: [], loading: false })
        return
      }

      // Проверяем кеш
      const cacheKey = `homepage_${userId}`
      const cached = dataCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setData(cached.data)
        return
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

        const result = {
          transactions,
          topPlayers,
          loading: false,
        }

        // Сохраняем в кеш
        dataCache.set(cacheKey, { data: result, timestamp: Date.now() })
        setData(result)
      } catch (error) {
        console.error('Error loading homepage data:', error)
        setData({ transactions: [], topPlayers: [], loading: false })
      }
    }

    loadAllData()
  }, [])

  return data
}

