'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TelegramUser, getTelegramUser } from '../utils/telegram'
import { getApiBase } from '../utils/fetch'
import { useLanguage } from './LanguageContext'
import { PremiumIcon } from './Icons'

interface UserStats {
  totalDeposits: number
  totalWithdraws: number
  totalDepositAmount: number
  totalWithdrawAmount: number
}

// Кеш статистики в памяти (на время сессии)
const statsCache = new Map<number, { stats: UserStats; timestamp: number }>()
const CACHE_TTL = 60_000 // 60 секунд

export default function UserProfile() {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const router = useRouter()
  const { language } = useLanguage()
  const statsLoadedRef = useRef(false)

  // Загружаем пользователя сразу (синхронно)
  useEffect(() => {
    const telegramUser = getTelegramUser()
    if (telegramUser) {
      setUser(telegramUser)
      // Загружаем статистику в фоне, не блокируя рендер
      loadStats(telegramUser.id)
    }
  }, [])

  const loadStats = async (userId: number) => {
    // Проверяем кеш
    const cached = statsCache.get(userId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setStats(cached.stats)
      return
    }

    // Если уже загружается, не делаем повторный запрос
    if (statsLoadedRef.current) return
    statsLoadedRef.current = true

    try {
      const apiUrl = getApiBase()
      // Используем лимит для быстрой загрузки - нам нужны только счетчики
      // Для точных сумм можно сделать отдельный запрос, но для счетчиков достаточно
      const response = await fetch(`${apiUrl}/api/transaction-history?user_id=${userId}&limit=1000`, {
        cache: 'default'
      })
      const data = await response.json()
      
      const transactions = data.data?.transactions || data.transactions || []
      
      // Считаем только успешные транзакции (completed или approved)
      const deposits = transactions.filter((t: any) => 
        t.type === 'deposit' && (t.status === 'completed' || t.status === 'approved')
      )
      const withdraws = transactions.filter((t: any) => 
        t.type === 'withdraw' && (t.status === 'completed' || t.status === 'approved')
      )
      
      const userStats: UserStats = {
        totalDeposits: deposits.length,
        totalWithdraws: withdraws.length,
        totalDepositAmount: deposits
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
        totalWithdrawAmount: withdraws
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
      }
      
      // Сохраняем в кеш
      statsCache.set(userId, { stats: userStats, timestamp: Date.now() })
      setStats(userStats)
    } catch (error) {
      console.error('Error loading stats:', error)
      setStats({
        totalDeposits: 0,
        totalWithdraws: 0,
        totalDepositAmount: 0,
        totalWithdrawAmount: 0
      })
    } finally {
      statsLoadedRef.current = false
    }
  }

  const translations = {
    ru: {
      profile: 'Профиль',
      deposits: 'Пополнений',
      withdraws: 'Выводов',
      totalDeposited: 'Всего пополнено',
      totalWithdrawn: 'Всего выведено',
      viewHistory: 'История операций',
      viewProfile: 'Посмотреть профиль'
    },
    en: {
      profile: 'Profile',
      deposits: 'Deposits',
      withdraws: 'Withdrawals',
      totalDeposited: 'Total Deposited',
      totalWithdrawn: 'Total Withdrawn',
      viewHistory: 'Transaction History',
      viewProfile: 'View Profile'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  // Показываем профиль сразу, даже если статистика еще загружается
  if (!user) {
    return null
  }

  // Получаем аватарку пользователя (если есть)
  const avatarUrl = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name + (user.last_name || ''))}&background=22c55e&color=fff&size=128`

  return (
    <div 
      className="card p-4 cursor-pointer hover:scale-105 transition-transform duration-200 profile-card-3d"
      onClick={() => router.push('/profile')}
    >
      <div className="flex items-center space-x-4">
        {/* Аватарка */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center overflow-hidden profile-avatar-3d">
            {user.photo_url ? (
              <img 
                src={avatarUrl} 
                alt={user.first_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-white">
                {user.first_name?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-gray-900"></div>
        </div>

        {/* Информация о пользователе */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-bold text-white truncate">
              {user.first_name} {user.last_name || ''}
            </h3>
            {user.is_premium && (
              <PremiumIcon className="w-5 h-5 text-yellow-400" />
            )}
          </div>
          {user.username && (
            <p className="text-sm text-white/60 truncate">@{user.username}</p>
          )}
          
          {/* Статистика */}
          {stats && (
            <div className="flex items-center space-x-4 mt-2">
              <div className="text-xs">
                <span className="text-white/50">{t.deposits}: </span>
                <span className="text-green-400 font-semibold">{stats.totalDeposits}</span>
              </div>
              <div className="text-xs">
                <span className="text-white/50">{t.withdraws}: </span>
                <span className="text-blue-400 font-semibold">{stats.totalWithdraws}</span>
              </div>
            </div>
          )}
        </div>

        {/* Иконка стрелки */}
        <div className="text-white/40">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  )
}

