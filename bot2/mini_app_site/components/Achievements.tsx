'use client'

import { useState, useEffect } from 'react'
import { getTelegramUserId } from '../utils/telegram'
import { getApiBase } from '../utils/fetch'

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
  progress: number
  target: number
  unlockedAt?: string
}

export default function Achievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAchievements()
  }, [])

  const loadAchievements = async () => {
    try {
      const userId = getTelegramUserId()
      if (!userId) {
        setLoading(false)
        return
      }

      const apiUrl = getApiBase()
      
      // Загружаем статистику пользователя
      const statsResponse = await fetch(`${apiUrl}/api/transaction-history?user_id=${userId}`)
      const statsData = await statsResponse.json()
      const transactions = statsData.data?.transactions || statsData.transactions || []
      
      const successful = transactions.filter((t: any) => 
        t.status === 'completed' || t.status === 'approved'
      )
      
      const deposits = successful.filter((t: any) => t.type === 'deposit')
      const withdrawals = successful.filter((t: any) => t.type === 'withdraw')
      
      const totalDeposits = deposits.reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
      const totalWithdrawals = withdrawals.reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
      const depositCount = deposits.length
      const withdrawalCount = withdrawals.length
      
      // Определяем достижения
      const allAchievements: Achievement[] = [
        {
          id: 'first_deposit',
          title: 'Первое пополнение',
          description: 'Совершите первое пополнение',
          icon: '🎯',
          unlocked: depositCount >= 1,
          progress: Math.min(depositCount, 1),
          target: 1,
        },
        {
          id: 'deposit_10',
          title: 'Активный игрок',
          description: '10 успешных пополнений',
          icon: '🔥',
          unlocked: depositCount >= 10,
          progress: Math.min(depositCount, 10),
          target: 10,
        },
        {
          id: 'deposit_50',
          title: 'Ветеран',
          description: '50 успешных пополнений',
          icon: '⭐',
          unlocked: depositCount >= 50,
          progress: Math.min(depositCount, 50),
          target: 50,
        },
        {
          id: 'deposit_100',
          title: 'Легенда',
          description: '100 успешных пополнений',
          icon: '👑',
          unlocked: depositCount >= 100,
          progress: Math.min(depositCount, 100),
          target: 100,
        },
        {
          id: 'total_10k',
          title: '10K клуб',
          description: 'Пополнить на 10,000 сом',
          icon: '💎',
          unlocked: totalDeposits >= 10000,
          progress: Math.min(totalDeposits, 10000),
          target: 10000,
        },
        {
          id: 'total_50k',
          title: '50K клуб',
          description: 'Пополнить на 50,000 сом',
          icon: '🏆',
          unlocked: totalDeposits >= 50000,
          progress: Math.min(totalDeposits, 50000),
          target: 50000,
        },
        {
          id: 'total_100k',
          title: '100K клуб',
          description: 'Пополнить на 100,000 сом',
          icon: '💍',
          unlocked: totalDeposits >= 100000,
          progress: Math.min(totalDeposits, 100000),
          target: 100000,
        },
        {
          id: 'first_withdraw',
          title: 'Первый вывод',
          description: 'Совершите первый вывод',
          icon: '💰',
          unlocked: withdrawalCount >= 1,
          progress: Math.min(withdrawalCount, 1),
          target: 1,
        },
        {
          id: 'withdraw_10',
          title: 'Выводной мастер',
          description: '10 успешных выводов',
          icon: '🎪',
          unlocked: withdrawalCount >= 10,
          progress: Math.min(withdrawalCount, 10),
          target: 10,
        },
        {
          id: 'total_withdraw_50k',
          title: 'Большой вывод',
          description: 'Вывести 50,000 сом',
          icon: '🚀',
          unlocked: totalWithdrawals >= 50000,
          progress: Math.min(totalWithdrawals, 50000),
          target: 50000,
        },
      ]
      
      setAchievements(allAchievements)
    } catch (error) {
      console.error('Error loading achievements:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-white/10 rounded w-1/2"></div>
          <div className="h-3 bg-white/5 rounded"></div>
        </div>
      </div>
    )
  }

  const unlockedCount = achievements.filter(a => a.unlocked).length
  const totalCount = achievements.length

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">🏅 Достижения</h3>
        <span className="text-sm text-white/50">
          {unlockedCount}/{totalCount}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`p-3 rounded-lg border ${
              achievement.unlocked
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-white/5 border-white/10 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{achievement.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold ${
                  achievement.unlocked ? 'text-white' : 'text-white/50'
                }`}>
                  {achievement.title}
                </div>
              </div>
            </div>
            {!achievement.unlocked && (
              <div className="mt-2">
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {achievement.progress} / {achievement.target}
                </div>
              </div>
            )}
            {achievement.unlocked && (
              <div className="text-xs text-green-400 mt-1">✓ Получено</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

