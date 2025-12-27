'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { TelegramUser, getTelegramUser } from '../utils/telegram'
import { useLanguage } from './LanguageContext'
import { PremiumIcon } from './Icons'
import { useHomePageData } from '../hooks/useHomePageData'

interface UserStats {
  totalDeposits: number
  totalWithdraws: number
  totalDepositAmount: number
  totalWithdrawAmount: number
}


export default function UserProfile() {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const router = useRouter()
  const { language } = useLanguage()
  const { transactions } = useHomePageData()

  // Загружаем пользователя синхронно при первом рендере для мгновенного отображения
  // Используем useRef для предотвращения повторных вызовов
  const userLoadedRef = useRef(false)
  useEffect(() => {
    if (userLoadedRef.current) return
    userLoadedRef.current = true
    
    const telegramUser = getTelegramUser()
    if (telegramUser && !user) {
      setUser(telegramUser)
    }
  }, [])

  // Вычисляем статистику из общих данных (без отдельного запроса)
  // Не показываем компонент, пока данные не загружены
  const stats = useMemo<UserStats | null>(() => {
    if (!transactions.length) {
      // Если данные еще загружаются, возвращаем null чтобы не показывать пустой компонент
      return null
    }
    
    const deposits = transactions.filter((t: any) => 
      t.type === 'deposit' && (t.status === 'completed' || t.status === 'approved')
    )
    const withdraws = transactions.filter((t: any) => 
      t.type === 'withdraw' && (t.status === 'completed' || t.status === 'approved')
    )
    
    return {
      totalDeposits: deposits.length,
      totalWithdraws: withdraws.length,
      totalDepositAmount: deposits.reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
      totalWithdrawAmount: withdraws.reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    }
  }, [transactions])

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

  // Получаем пользователя синхронно для мгновенного отображения
  const telegramUser = getTelegramUser()
  const displayUser = user || telegramUser
  
  // Показываем профиль сразу, даже если статистика еще загружается
  if (!displayUser) {
    return null
  }

  // Получаем аватарку пользователя (если есть)
  const avatarUrl = displayUser.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayUser.first_name + (displayUser.last_name || ''))}&background=22c55e&color=fff&size=128`

  return (
    <div 
      className="card p-4 cursor-pointer profile-card-3d"
      onClick={() => router.push('/profile')}
    >
      <div className="flex items-center space-x-4">
        {/* Аватарка */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center overflow-hidden profile-avatar-3d">
            {displayUser.photo_url ? (
              <img 
                src={avatarUrl} 
                alt={displayUser.first_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-white">
                {displayUser.first_name?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-gray-900"></div>
        </div>

        {/* Информация о пользователе */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-bold text-white truncate">
              {displayUser.first_name} {displayUser.last_name || ''}
            </h3>
            {displayUser.is_premium && (
              <PremiumIcon className="w-5 h-5 text-yellow-400" />
            )}
          </div>
          {displayUser.username && (
            <p className="text-sm text-white/60 truncate">@{displayUser.username}</p>
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

