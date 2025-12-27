'use client'

import { useState, useEffect, useMemo } from 'react'
import { useHomePageData } from '../hooks/useHomePageData'

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
  progress: number
  target: number
  unlockedAt?: string
  instruction?: string // Инструкция как получить достижение
}

export default function Achievements() {
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)
  const { transactions, loading } = useHomePageData()

  // Вычисляем достижения на основе загруженных транзакций
  const achievements = useMemo<Achievement[]>(() => {
    if (loading || !transactions.length) {
      return []
    }
      
      const successful = transactions.filter((t: any) => 
        t.status === 'completed' || t.status === 'approved'
      )
      
      const deposits = successful.filter((t: any) => t.type === 'deposit')
      const withdrawals = successful.filter((t: any) => t.type === 'withdraw')
      
      const totalDeposits = Math.round(deposits.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) * 100) / 100
      const totalWithdrawals = Math.round(withdrawals.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) * 100) / 100
      const depositCount = deposits.length
      const withdrawalCount = withdrawals.length
      
      // Определяем достижения с инструкциями
      const allAchievements: Achievement[] = [
        {
          id: 'first_deposit',
          title: 'Первое пополнение',
          description: 'Совершите первое пополнение',
          icon: '🎯',
          unlocked: depositCount >= 1,
          progress: Math.min(depositCount, 1),
          target: 1,
          instruction: 'Перейдите в раздел "Пополнение", выберите способ оплаты и пополните баланс на любую сумму. Достижение откроется автоматически после успешного пополнения.',
        },
        {
          id: 'deposit_10',
          title: 'Активный игрок',
          description: '10 успешных пополнений',
          icon: '🔥',
          unlocked: depositCount >= 10,
          progress: Math.min(depositCount, 10),
          target: 10,
          instruction: 'Совершите 10 успешных пополнений баланса. Каждое пополнение должно быть завершено со статусом "Успешно" или "Одобрено".',
        },
        {
          id: 'deposit_50',
          title: 'Ветеран',
          description: '50 успешных пополнений',
          icon: '⭐',
          unlocked: depositCount >= 50,
          progress: Math.min(depositCount, 50),
          target: 50,
          instruction: 'Совершите 50 успешных пополнений баланса. Это достижение показывает ваш опыт и активность в системе.',
        },
        {
          id: 'deposit_100',
          title: 'Легенда',
          description: '100 успешных пополнений',
          icon: '👑',
          unlocked: depositCount >= 100,
          progress: Math.min(depositCount, 100),
          target: 100,
          instruction: 'Совершите 100 успешных пополнений баланса. Это высшее достижение для самых активных игроков!',
        },
        {
          id: 'total_10k',
          title: '10K клуб',
          description: 'Пополнить на 10,000 сом',
          icon: '💎',
          unlocked: totalDeposits >= 10000,
          progress: Math.min(totalDeposits, 10000),
          target: 10000,
          instruction: 'Накопите общую сумму пополнений в размере 10,000 сом. Сумма считается по всем успешным пополнениям. Можно пополнять баланс несколько раз.',
        },
        {
          id: 'total_50k',
          title: '50K клуб',
          description: 'Пополнить на 50,000 сом',
          icon: '🏆',
          unlocked: totalDeposits >= 50000,
          progress: Math.min(totalDeposits, 50000),
          target: 50000,
          instruction: 'Накопите общую сумму пополнений в размере 50,000 сом. Это элитный клуб для самых щедрых игроков!',
        },
        {
          id: 'first_withdraw',
          title: 'Первый вывод',
          description: 'Совершите первый вывод',
          icon: '💰',
          unlocked: withdrawalCount >= 1,
          progress: Math.min(withdrawalCount, 1),
          target: 1,
          instruction: 'Перейдите в раздел "Вывод", укажите сумму и реквизиты для вывода. Достижение откроется после успешного вывода средств.',
        },
        {
          id: 'withdraw_10',
          title: 'Выводной мастер',
          description: '10 успешных выводов',
          icon: '🎪',
          unlocked: withdrawalCount >= 10,
          progress: Math.min(withdrawalCount, 10),
          target: 10,
          instruction: 'Совершите 10 успешных выводов средств. Каждый вывод должен быть завершен со статусом "Успешно" или "Одобрено".',
        },
        {
          id: 'total_withdraw_50k',
          title: 'Большой вывод',
          description: 'Вывести 50,000 сом',
          icon: '🚀',
          unlocked: totalWithdrawals >= 50000,
          progress: Math.min(totalWithdrawals, 50000),
          target: 50000,
          instruction: 'Выведите общую сумму в размере 50,000 сом. Сумма считается по всем успешным выводам. Можно выводить средства несколько раз.',
        },
      ]
      
      return allAchievements
  }, [transactions, loading])

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

  const unlockedCount = achievements?.filter(a => a.unlocked).length || 0
  const totalCount = achievements?.length || 0

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
            onClick={() => setSelectedAchievement(achievement)}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              achievement.unlocked
                ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                : 'bg-white/5 border-white/10 opacity-60 hover:opacity-80'
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

      {/* Модальное окно с инструкцией */}
      {selectedAchievement && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedAchievement(null)}
        >
          <div 
            className="card p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{selectedAchievement.icon}</span>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedAchievement.title}</h3>
                  <p className="text-sm text-white/70">{selectedAchievement.description}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAchievement(null)}
                className="text-white/50 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              {selectedAchievement.unlocked ? (
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <span className="text-xl">✓</span>
                    <span className="font-semibold">Достижение получено!</span>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3">
                  <div className="text-blue-400 font-semibold mb-2">Прогресс</div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${(selectedAchievement.progress / selectedAchievement.target) * 100}%` }}
                    />
                  </div>
                  <div className="text-sm text-white/70">
                    {selectedAchievement.progress} / {selectedAchievement.target}
                    {selectedAchievement.id.includes('total_') || selectedAchievement.id.includes('withdraw_50k') ? ' сом' : ''}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2">📖 Как получить:</h4>
              <p className="text-white/80 text-sm leading-relaxed">
                {selectedAchievement.instruction || selectedAchievement.description}
              </p>
            </div>

            <button
              onClick={() => setSelectedAchievement(null)}
              className="w-full mt-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

