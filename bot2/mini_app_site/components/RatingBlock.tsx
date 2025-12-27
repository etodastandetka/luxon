'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { API_URLS } from '../config/api'
import { logger } from '../lib/logger'

interface LeaderboardUser {
  userId: string
  displayName: string
  totalAmount: number
  rank: number
  rankType: 'diamond' | 'gold' | 'silver' | 'bronze' | 'iron'
}

export default function RatingBlock() {
  const [topPlayers, setTopPlayers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadTopPlayers()
  }, [])

  const loadTopPlayers = async () => {
    try {
      const response = await fetch(`${API_URLS.LEADERBOARD}?type=deposits&limit=5`)
      const data = await response.json()
      
      if (data.success && data.data?.leaderboard) {
        setTopPlayers(data.data.leaderboard.slice(0, 5))
      }
    } catch (error) {
      logger.error('Error loading top players:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rankType: string) => {
    switch (rankType) {
      case 'diamond':
        return '💎'
      case 'gold':
        return '🥇'
      case 'silver':
        return '🥈'
      case 'bronze':
        return '🥉'
      default:
        return '⭐'
    }
  }

  const getRankColor = (rankType: string) => {
    switch (rankType) {
      case 'diamond':
        return 'text-cyan-400'
      case 'gold':
        return 'text-yellow-400'
      case 'silver':
        return 'text-gray-300'
      case 'bronze':
        return 'text-orange-400'
      default:
        return 'text-white/60'
    }
  }

  if (loading) {
    return (
      <div className="card p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-white/10 rounded w-1/2"></div>
          <div className="h-3 bg-white/5 rounded"></div>
          <div className="h-3 bg-white/5 rounded"></div>
        </div>
      </div>
    )
  }

  if (topPlayers.length === 0) {
    return null
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">🏆 Топ игроков</h3>
        <button
          onClick={() => router.push('/rating')}
          className="text-sm text-green-400 hover:text-green-300"
        >
          Все →
        </button>
      </div>
      <div className="space-y-2">
        {topPlayers.map((player, index) => (
          <div
            key={player.userId}
            className={`flex items-center justify-between p-2 rounded-lg ${
              index < 3 ? 'bg-white/5' : 'bg-white/2'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-lg ${getRankColor(player.rankType)}`}>
                {getRankIcon(player.rankType)}
              </span>
              <div>
                <div className="text-sm font-medium text-white">
                  #{player.rank} {player.displayName}
                </div>
              </div>
            </div>
            <div className={`text-sm font-bold ${getRankColor(player.rankType)}`}>
              {player.totalAmount.toLocaleString('ru-RU')} сом
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

