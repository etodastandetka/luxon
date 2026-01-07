'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getTelegramUserId } from '../../utils/telegram'
import { getApiBase } from '../../utils/fetch'
import { useLanguage } from '../../components/LanguageContext'
import FixedHeaderControls from '../../components/FixedHeaderControls'
import { DiamondIcon, GoldIcon, SilverIcon, BronzeIcon, IronIcon } from '../../components/Icons'

interface LeaderboardUser {
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  displayName: string
  transactionCount: number
  totalAmount: number
  rank: number
  rankType: 'diamond' | 'gold' | 'silver' | 'bronze' | 'iron'
}

interface ProgressInfo {
  currentRank: string
  nextRank: string
  currentAmount: number
  nextRankAmount: number
  progress: number
  remaining: number
}

interface FriendComparison {
  userId: string
  displayName: string
  totalAmount: number
  isAhead: boolean
  difference: number
}

export default function RatingPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [userRank, setUserRank] = useState<number | null>(null)
  const [userTotal, setUserTotal] = useState<number>(0)
  const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null)
  const [friends, setFriends] = useState<FriendComparison[]>([])
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'total'>('deposits')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { language } = useLanguage()

  // Определяем ранг на основе суммы (перемещено выше для использования)
  const getRankByAmount = (amount: number): { rank: string; nextRank: string; nextAmount: number } => {
    // Пороги для рангов (можно настроить)
    // Округляем amount до 2 знаков после запятой
    const roundedAmount = Math.round(amount * 100) / 100
    if (roundedAmount >= 50000) return { rank: 'diamond', nextRank: 'diamond', nextAmount: roundedAmount }
    if (roundedAmount >= 25000) return { rank: 'gold', nextRank: 'diamond', nextAmount: 50000 }
    if (roundedAmount >= 10000) return { rank: 'silver', nextRank: 'gold', nextAmount: 25000 }
    if (roundedAmount >= 5000) return { rank: 'bronze', nextRank: 'silver', nextAmount: 10000 }
    return { rank: 'iron', nextRank: 'bronze', nextAmount: 5000 }
  }

  // Загружаем сравнение с друзьями (перемещено выше для использования)
  const loadFriendsComparison = async (userId: string) => {
    try {
      const apiUrl = getApiBase()
      
      // Получаем данные рефералов
      const referralResponse = await fetch(`${apiUrl}/api/public/referral-data?user_id=${userId}`)
      const referralData = await referralResponse.json()
      
      if (referralData.success && referralData.referrals && Array.isArray(referralData.referrals)) {
        const referrals = referralData.referrals.slice(0, 5) // Топ 5 рефералов
        const friendsList: FriendComparison[] = []
        
        // Параллельно загружаем статистику всех рефералов для ускорения
        const refStatsPromises = referrals.map(async (ref: any) => {
          try {
            const refStatsResponse = await fetch(`${apiUrl}/api/transaction-history?user_id=${ref.referred_id}`)
            const refStatsData = await refStatsResponse.json()
            const transactions = refStatsData.data?.transactions || refStatsData.transactions || []
            
            const filtered = transactions.filter((t: any) => {
              const isSuccess = t.status === 'completed' || t.status === 'approved'
              if (activeTab === 'deposits') return isSuccess && t.type === 'deposit'
              if (activeTab === 'withdrawals') return isSuccess && t.type === 'withdraw'
              return isSuccess
            })
            
            const refTotal = Math.round(filtered.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) * 100) / 100
            const difference = Math.round(Math.abs(userTotal - refTotal) * 100) / 100
            const isAhead = userTotal > refTotal
            
            return {
              userId: ref.referred_id.toString(),
              displayName: ref.displayName || (ref.referred_username ? `@${ref.referred_username}` : `Игрок #${ref.referred_id}`),
              totalAmount: refTotal,
              isAhead,
              difference,
            }
          } catch (e) {
            return null
          }
        })
        
        const friendsResults = await Promise.all(refStatsPromises)
        friendsList.push(...friendsResults.filter((f): f is FriendComparison => f !== null))
        
        // Сортируем по разнице
        friendsList.sort((a, b) => b.difference - a.difference)
        setFriends(friendsList)
      }
    } catch (error) {
      console.error('Error loading friends comparison:', error)
    }
  }

  useEffect(() => {
    loadLeaderboard()
  }, [activeTab])

  const loadLeaderboard = async () => {
    setLoading(true)
    try {
      const apiUrl = getApiBase()
      const userId = getTelegramUserId()
      
      // Загружаем рейтинг
      const response = await fetch(`${apiUrl}/api/public/leaderboard?type=${activeTab}&limit=20`)
      const data = await response.json()
      
      if (data.success && data.data?.leaderboard) {
        setLeaderboard(data.data.leaderboard)
        
        // Находим позицию текущего пользователя
        if (userId) {
          const userIndex = data.data.leaderboard.findIndex((u: LeaderboardUser) => u.userId === userId)
          if (userIndex !== -1) {
            // Пользователь в топе
            setUserRank(userIndex + 1)
            const userAmount = Math.round(data.data.leaderboard[userIndex].totalAmount * 100) / 100
            setUserTotal(userAmount)
            
            // Вычисляем прогресс до следующего ранга
            const rankInfo = getRankByAmount(userAmount)
            const remaining = Math.round(Math.max(0, rankInfo.nextAmount - userAmount) * 100) / 100
            const progress = rankInfo.nextAmount > userAmount 
              ? (userAmount / rankInfo.nextAmount) * 100 
              : 100
            
            setProgressInfo({
              currentRank: rankInfo.rank,
              nextRank: rankInfo.nextRank,
              currentAmount: data.data.leaderboard[userIndex].totalAmount,
              nextRankAmount: rankInfo.nextAmount,
              progress: Math.min(100, progress),
              remaining,
            })
            
            // Загружаем сравнение с друзьями
            loadFriendsComparison(userId)
          } else {
            // Если пользователь не в топе, загружаем его статистику отдельно
            const userStatsResponse = await fetch(`${apiUrl}/api/transaction-history?user_id=${userId}`)
            const userStatsData = await userStatsResponse.json()
            const transactions = userStatsData.data?.transactions || userStatsData.transactions || []
            
            const filtered = transactions.filter((t: any) => {
              const isSuccess = t.status === 'completed' || t.status === 'approved'
              if (activeTab === 'deposits') return isSuccess && t.type === 'deposit'
              if (activeTab === 'withdrawals') return isSuccess && t.type === 'withdraw'
              return isSuccess
            })
            
            const total = Math.round(filtered.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) * 100) / 100
            setUserTotal(total)
            setUserRank(null) // Не в топе
            
            // Вычисляем прогресс до следующего ранга
            const rankInfo = getRankByAmount(total)
            const remaining = Math.round(Math.max(0, rankInfo.nextAmount - total) * 100) / 100
            const progress = rankInfo.nextAmount > total 
              ? (total / rankInfo.nextAmount) * 100 
              : 100
            
            setProgressInfo({
              currentRank: rankInfo.rank,
              nextRank: rankInfo.nextRank,
              currentAmount: total,
              nextRankAmount: rankInfo.nextAmount,
              progress: Math.min(100, progress),
              remaining,
            })
            
            // Загружаем сравнение с друзьями
            loadFriendsComparison(userId)
          }
        }
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rankType: string) => {
    const iconClass = "w-5 h-5"
    switch (rankType) {
      case 'diamond':
        return <DiamondIcon className={iconClass} />
      case 'gold':
        return <GoldIcon className={iconClass} />
      case 'silver':
        return <SilverIcon className={iconClass} />
      case 'bronze':
        return <BronzeIcon className={iconClass} />
      default:
        return <IronIcon className={iconClass} />
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


  const translations = {
    ru: {
      title: 'Рейтинг игроков',
      deposits: 'Пополнения',
      withdrawals: 'Выводы',
      total: 'Общий',
      rank: 'Место',
      player: 'Игрок',
      amount: 'Сумма',
      transactions: 'Операций',
      yourRank: 'Ваше место',
      notInTop: 'Не в топе',
      loading: 'Загрузка...',
      back: 'Назад',
      progressToNext: 'До следующего ранга',
      remaining: 'Осталось',
      friendsComparison: 'Сравнение с друзьями',
      youAhead: 'Ты впереди',
      aheadOfYou: 'Впереди тебя',
      by: 'на'
    },
    en: {
      title: 'Player Rating',
      deposits: 'Deposits',
      withdrawals: 'Withdrawals',
      total: 'Total',
      rank: 'Rank',
      player: 'Player',
      amount: 'Amount',
      transactions: 'Transactions',
      yourRank: 'Your Rank',
      notInTop: 'Not in top',
      loading: 'Loading...',
      back: 'Back',
      progressToNext: 'Progress to next rank',
      remaining: 'Remaining',
      friendsComparison: 'Friends Comparison',
      youAhead: 'You are ahead',
      aheadOfYou: 'Ahead of you',
      by: 'by'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <main className="space-y-6" style={{ paddingBottom: '20px' }}>
      <FixedHeaderControls />
      
      {/* Заголовок */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white pr-20">{t.title}</h1>
      </div>

      {/* Табы */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('deposits')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'deposits'
              ? 'bg-green-500 text-white'
              : 'bg-white/10 text-white/70'
          }`}
        >
          {t.deposits}
        </button>
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'withdrawals'
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-white/70'
          }`}
        >
          {t.withdrawals}
        </button>
        <button
          onClick={() => setActiveTab('total')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'total'
              ? 'bg-purple-500 text-white'
              : 'bg-white/10 text-white/70'
          }`}
        >
          {t.total}
        </button>
      </div>

      {/* Прогресс до следующего ранга */}
      {progressInfo && progressInfo.nextRank !== progressInfo.currentRank && (
        <div className="card p-4 bg-gradient-to-r from-green-500/20 to-blue-500/20 border-green-500/50">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/70">{t.progressToNext}</span>
              <span className={`text-sm font-bold flex items-center gap-1 ${getRankColor(progressInfo.nextRank)}`}>
                {getRankIcon(progressInfo.nextRank)}
                <span>{progressInfo.nextRank === 'diamond' ? 'Алмаз' :
                 progressInfo.nextRank === 'gold' ? 'Золото' :
                 progressInfo.nextRank === 'silver' ? 'Серебро' :
                 progressInfo.nextRank === 'bronze' ? 'Бронза' : 'Железо'}</span>
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
                style={{ width: `${progressInfo.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-white/50">
                {(Math.round(progressInfo.currentAmount * 100) / 100).toLocaleString('ru-RU')} / {(Math.round(progressInfo.nextRankAmount * 100) / 100).toLocaleString('ru-RU')} сом
              </span>
              <span className="text-xs font-semibold text-green-400">
                {t.remaining}: {(Math.round(progressInfo.remaining * 100) / 100).toLocaleString('ru-RU')} сом
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Статистика пользователя */}
      {userRank !== null && (
        <div className="card p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500/50">
          <div className="text-center">
            <div className="text-lg font-semibold text-white mb-1">{t.yourRank}</div>
            <div className="text-3xl font-bold text-purple-400">#{userRank}</div>
            <div className="text-sm text-white/70 mt-2">
              {(Math.round(userTotal * 100) / 100).toLocaleString('ru-RU')} сом
            </div>
          </div>
        </div>
      )}

      {/* Сравнение с друзьями */}
      {friends.length > 0 && (
        <div className="card p-4">
          <h3 className="text-lg font-semibold text-white mb-3">{t.friendsComparison}</h3>
          <div className="space-y-2">
            {friends.map((friend) => (
              <div
                key={friend.userId}
                className={`p-3 rounded-lg ${
                  friend.isAhead ? 'bg-green-500/10 border border-green-500/30' : 'bg-blue-500/10 border border-blue-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={friend.isAhead ? 'text-green-400' : 'text-blue-400'}>
                      {friend.isAhead ? '⬆️' : '⬇️'}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-white">{friend.displayName}</div>
                      <div className="text-xs text-white/50">
                        {friend.totalAmount.toLocaleString('ru-RU')} сом
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${friend.isAhead ? 'text-green-400' : 'text-blue-400'}`}>
                      {friend.isAhead ? t.youAhead : t.aheadOfYou}
                    </div>
                    <div className="text-xs text-white/50">
                      {t.by} {(Math.round(friend.difference * 100) / 100).toLocaleString('ru-RU')} сом
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Рейтинг */}
      {loading ? (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{
            animation: 'spin 1s linear infinite',
            borderRadius: '50%',
            height: '48px',
            width: '48px',
            border: '2px solid #22c55e',
            borderTopColor: 'transparent',
            margin: '0 auto 16px'
          }}></div>
          <div style={{
            color: 'rgba(255, 255, 255, 0.7)'
          }}>{t.loading}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((user, index) => (
            <div
              key={user.userId}
              className={`card p-4 ${
                index < 3 ? 'border-2' : 'border'
              } ${
                index === 0 ? 'border-cyan-400/50 bg-cyan-500/10' :
                index === 1 ? 'border-yellow-400/50 bg-yellow-500/10' :
                index === 2 ? 'border-gray-300/50 bg-gray-500/10' :
                'border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={getRankColor(user.rankType)}>
                    {getRankIcon(user.rankType)}
                  </div>
                  <div>
                    <div className="font-bold text-white">#{user.rank}</div>
                    <div className="text-sm text-white/70">{user.displayName}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${getRankColor(user.rankType)}`}>
                    {(Math.round(user.totalAmount * 100) / 100).toLocaleString('ru-RU')} сом
                  </div>
                  <div className="text-xs text-white/50">
                    {user.transactionCount} {t.transactions}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Кнопка назад */}
      <div className="text-center">
        <button
          onClick={() => router.push('/')}
          className="btn btn-ghost"
        >
          {t.back}
        </button>
      </div>
    </main>
  )
}

