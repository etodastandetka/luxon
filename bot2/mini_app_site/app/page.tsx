"use client"
import { useEffect, useState } from 'react'
import LanguageSelector from '../components/LanguageSelector'
import AnimatedHeader from '../components/AnimatedHeader'
import LoadingScreen from '../components/LoadingScreen'
import ServiceStatus from '../components/ServiceStatus'
import { useLanguage } from '../components/LanguageContext'
import { useBotSettings } from '../components/SettingsLoader'
import { initTelegramWebApp, getTelegramUser, syncWithBot, TelegramUser } from '../utils/telegram'

export default function HomePage() {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const { language } = useLanguage()
  const { settings, loading: settingsLoading, error: settingsError } = useBotSettings()

  useEffect(() => {
    // Инициализируем Telegram WebApp
    const telegramUser = initTelegramWebApp()
    if (telegramUser) {
      setUser(telegramUser)
      
      // Синхронизируем с ботом при первом входе
      syncWithBot(telegramUser, 'app_opened', {
        page: 'home',
        language
      })
    }

    // Анимация прогресса загрузки от 0 до 100
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          setIsLoading(false)
          return 100
        }
        return prev + 2 // Увеличиваем на 2% каждые 50мс
      })
    }, 50)

    return () => clearInterval(progressInterval)
  }, [language])

  const handleLoaderComplete = () => {
    setIsLoading(false)
  }

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
      quickDeposit: 'Быстрое пополнение',
      quickWithdraw: 'Быстрый вывод',
      referralProgram: 'Реферальная программа',
      supportHelp: 'Помощь и поддержка',
      transactionHistory: 'История операций',
      stepByStepGuide: 'Пошаговая инструкция'
    },
    en: {
      welcome: 'Welcome!',
      subtitle: 'Platform for deposits and withdrawals in casinos',
      deposit: '💳 Deposit',
      withdraw: '💰 Withdraw',
      referral: '👥 Referrals',
      support: '🎧 Support',
      history: '📜 History',
      instruction: '🧾 Instruction',
      quickDeposit: 'Quick deposit',
      quickWithdraw: 'Quick withdraw',
      referralProgram: 'Referral program',
      supportHelp: 'Help and support',
      transactionHistory: 'Transaction history',
      stepByStepGuide: 'Step-by-step guide'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  if (isLoading) {
    return (
      <LoadingScreen 
        message="Загрузка LUX ON"
        variant="object"
        showProgress={true}
        progress={loadingProgress}
      />
    )
  }

  return (
    <main className="space-y-6">
      {/* Анимированный заголовок */}
      <AnimatedHeader />
      
      {/* Красивый заголовок с анимацией */}
      <div className="text-center space-y-4 fade-in">
        <div className="relative">
          <h1 className="text-3xl font-bold text-white gentle-float">{t.welcome}</h1>
          <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-400 rounded-full pulse"></div>
        </div>
        <p className="text-sm text-white/70 slide-in-left delay-200">{t.subtitle}</p>
        {user && (
          <p className="text-sm text-white/60 slide-in-right delay-300">
            👋 {user.first_name} {user.last_name}
          </p>
        )}
        <div className="flex justify-center scale-in delay-400">
          <LanguageSelector />
        </div>
      </div>
      
      {/* Основные действия */}
      <div className="grid grid-cols-2 gap-3">
        <ServiceStatus service="deposits">
          <a href="/deposit" className="card btn btn-primary text-center p-4 fade-in delay-500">
            <div className="font-semibold text-lg">{t.deposit}</div>
          </a>
        </ServiceStatus>
        <ServiceStatus service="withdrawals">
          <a href="/withdraw" className="card btn btn-primary text-center p-4 fade-in delay-600">
            <div className="font-semibold text-lg">{t.withdraw}</div>
          </a>
        </ServiceStatus>
      </div>
      
      {/* Дополнительные разделы */}
      <div className="grid grid-cols-2 gap-3">
        <a href="/referral" className="card btn btn-ghost text-center p-4 fade-in delay-700">
          <div className="font-semibold text-lg">{t.referral}</div>
        </a>
        <a href="/history" className="card btn btn-ghost text-center p-4 fade-in delay-800">
          <div className="font-semibold text-lg">{t.history}</div>
        </a>
      </div>
      
      {/* Помощь и инструкции */}
      <div className="grid grid-cols-2 gap-3">
        <a href="/instruction" className="card btn btn-ghost text-center p-4 fade-in delay-800">
          <div className="font-semibold text-lg">{t.instruction}</div>
        </a>
        <a href="/support" className="card btn btn-ghost text-center p-4 fade-in delay-800">
          <div className="font-semibold text-lg">{t.support}</div>
        </a>
      </div>
    </main>
  )
}