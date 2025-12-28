"use client"
import { useEffect, useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import ServiceStatus from '../components/ServiceStatus'
import FixedHeaderControls from '../components/FixedHeaderControls'
import { useLanguage } from '../components/LanguageContext'
import { useBotSettings } from '../components/SettingsLoader'
import { initTelegramWebApp, syncWithBot, TelegramUser } from '../utils/telegram'
import { useHomePageData } from '../hooks/useHomePageData'
import { ReferralIcon, HistoryIcon, InstructionIcon, SupportIcon } from '../components/Icons'

// Видео компоненты удалены - не используются

// Загружаем UserProfile без динамической загрузки для мгновенного отображения
import UserProfile from '../components/UserProfile'

// Загружаем компоненты без динамической загрузки для мгновенного отображения
import RatingBlock from '../components/RatingBlock'
import Achievements from '../components/Achievements'
// Загружаем 3D логотип с динамической загрузкой (тяжелый компонент)
const Logo3D = dynamic(() => import('../components/Logo3D'), { ssr: false })

export default function HomePage() {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [userStats, setUserStats] = useState<{deposits: number, withdraws: number} | null>(null)
  const { language } = useLanguage()
  const { loading: settingsLoading } = useBotSettings()
  
  // Инициализируем пользователя сразу при монтировании (без задержек)
  // Используем useRef для предотвращения повторных вызовов
  const userInitialized = useRef(false)
  useEffect(() => {
    if (userInitialized.current) return
    userInitialized.current = true
    
    const telegramUser = initTelegramWebApp()
    if (telegramUser) {
      setUser(telegramUser)
      // Синхронизируем с ботом в фоне (не блокируем рендер)
      syncWithBot(telegramUser, 'app_opened', {
        page: 'home',
        language
      }).catch(err => console.error('Sync error:', err))
    }
  }, []) // Убираем language из зависимостей, чтобы не вызывать повторно

  // Приветствие по времени суток
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) {
      return language === 'en' ? 'Good morning' : 'Доброе утро'
    } else if (hour >= 12 && hour < 18) {
      return language === 'en' ? 'Good afternoon' : 'Добрый день'
    } else if (hour >= 18 && hour < 22) {
      return language === 'en' ? 'Good evening' : 'Добрый вечер'
    } else {
      return language === 'en' ? 'Good night' : 'Доброй ночи'
    }
  }, [language])

  // Используем единый хук для загрузки всех данных главной страницы
  const { transactions } = useHomePageData()
  
  // Вычисляем статистику сразу через useMemo (без задержек)
  const computedStats = useMemo(() => {
    const deposits = transactions.filter((t: any) => t.type === 'deposit' && (t.status === 'completed' || t.status === 'approved')).length
    const withdraws = transactions.filter((t: any) => t.type === 'withdraw' && (t.status === 'completed' || t.status === 'approved')).length
    return { deposits, withdraws }
  }, [transactions])
  
  // Обновляем состояние только если изменилось
  useEffect(() => {
    if (userStats?.deposits !== computedStats.deposits || userStats?.withdraws !== computedStats.withdraws) {
      setUserStats(computedStats)
    }
  }, [computedStats])

  // Видео инструкции удалены - не используются


  const translations = {
    ru: {
      welcome: 'Добро пожаловать!',
      subtitle: 'Платформа для пополнения и вывода средств в казино',
      deposit: 'Пополнить',
      withdraw: 'Вывести',
      referral: 'Рефералы',
      support: 'Поддержка',
      history: 'История',
      instruction: 'Инструкция',
      howToDeposit: 'Как пополнить',
      howToWithdraw: 'Как вывести',
      quickDeposit: 'Быстрое пополнение',
      quickWithdraw: 'Быстрый вывод',
      referralProgram: 'Реферальная программа',
      supportHelp: 'Помощь и поддержка',
      transactionHistory: 'История операций',
      stepByStepGuide: 'Пошаговая инструкция',
      yourBalance: 'Ваш баланс',
      quickActions: 'Быстрые действия',
      services: 'Сервисы',
      profile: 'Профиль'
    },
    en: {
      welcome: 'Welcome!',
      subtitle: 'Platform for deposits and withdrawals in casinos',
      deposit: 'Deposit',
      withdraw: 'Withdraw',
      referral: 'Referrals',
      support: 'Support',
      history: 'History',
      instruction: 'Instruction',
      howToDeposit: 'How to deposit',
      howToWithdraw: 'How to withdraw',
      quickDeposit: 'Quick deposit',
      quickWithdraw: 'Quick withdraw',
      referralProgram: 'Referral program',
      supportHelp: 'Help and support',
      transactionHistory: 'Transaction history',
      stepByStepGuide: 'Step-by-step guide',
      yourBalance: 'Your Balance',
      quickActions: 'Quick Actions',
      services: 'Services',
      profile: 'Profile'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <main className="space-y-6" style={{ paddingTop: '0.5rem', paddingBottom: '100px' }}>
      <FixedHeaderControls />
      
      {/* Профиль пользователя */}
      <UserProfile />

      {/* Приветствие по времени суток */}
      <div className="card p-6 greeting-card-3d">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">
            {greeting}{user ? `, ${user.first_name}!` : '!'}
          </h1>
          <p className="text-sm text-white/70">{t.subtitle}</p>
        </div>
      </div>

      {/* Быстрые действия - банковский стиль */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white px-1">{t.quickActions}</h2>
        <div className="grid grid-cols-2 gap-3">
          <ServiceStatus service="deposits">
            <a href="/deposit" className="card btn btn-primary text-center p-6 action-card-3d">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="font-semibold text-lg">{t.deposit}</div>
              </div>
            </a>
          </ServiceStatus>
          <ServiceStatus service="withdrawals">
            <a href="/withdraw" className="card btn btn-primary text-center p-6 action-card-3d">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </div>
                <div className="font-semibold text-lg">{t.withdraw}</div>
              </div>
            </a>
          </ServiceStatus>
        </div>
      </div>

      {/* 3D Логотип */}
      <Logo3D className="rounded-lg" />
      
      {/* Сервисы - банковский стиль */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white px-1">{t.services}</h2>
        <div className="grid grid-cols-2 gap-3">
          <a href="/referral" className="card p-4 service-card-3d">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <ReferralIcon className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">{t.referral}</div>
                <div className="text-xs text-white/50">Реферальная программа</div>
              </div>
            </div>
          </a>
          <a href="/history" className="card p-4 service-card-3d">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <HistoryIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">{t.history}</div>
                <div className="text-xs text-white/50">История операций</div>
              </div>
            </div>
          </a>
          <a href="/instruction" className="card p-4 service-card-3d">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <InstructionIcon className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">{t.instruction}</div>
                <div className="text-xs text-white/50">Инструкция</div>
              </div>
            </div>
          </a>
          <a href="/support" className="card p-4 service-card-3d">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <SupportIcon className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">{t.support}</div>
                <div className="text-xs text-white/50">Поддержка</div>
              </div>
            </div>
          </a>
        </div>
      </div>

      {/* Блок рейтинга */}
      <RatingBlock />

      {/* Достижения */}
      <Achievements />

    </main>
  )
}