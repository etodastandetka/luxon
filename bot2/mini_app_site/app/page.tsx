"use client"
import { useEffect, useState, useMemo } from 'react'
import AnimatedHeader from '../components/AnimatedHeader'
import LoadingScreen from '../components/LoadingScreen'
import ServiceStatus from '../components/ServiceStatus'
import FixedHeaderControls from '../components/FixedHeaderControls'
import VideoModal from '../components/VideoModal'
import UserProfile from '../components/UserProfile'
import { useLanguage } from '../components/LanguageContext'
import { useBotSettings } from '../components/SettingsLoader'
import { initTelegramWebApp, getTelegramUser, syncWithBot, TelegramUser, getTelegramUserId } from '../utils/telegram'
import { getApiBase } from '../utils/fetch'
import { ReferralIcon, HistoryIcon, InstructionIcon, SupportIcon } from '../components/Icons'
import BannerCarousel from '../components/BannerCarousel'

export default function HomePage() {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<string>('')
  const [videoTitle, setVideoTitle] = useState<string>('')
  const [depositVideoUrl, setDepositVideoUrl] = useState<string>('')
  const [withdrawVideoUrl, setWithdrawVideoUrl] = useState<string>('')
  const [userStats, setUserStats] = useState<{deposits: number, withdraws: number} | null>(null)
  const { language } = useLanguage()
  const { settings, loading: settingsLoading, error: settingsError } = useBotSettings()

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

  // Загружаем статистику пользователя
  useEffect(() => {
    const loadUserStats = async () => {
      try {
        const userId = getTelegramUserId()
        if (!userId) return

        const apiUrl = getApiBase()
        const response = await fetch(`${apiUrl}/api/transaction-history?user_id=${userId}`)
        const data = await response.json()
        
        const transactions = data.data?.transactions || data.transactions || []
        setUserStats({
          deposits: transactions.filter((t: any) => t.type === 'deposit').length,
          withdraws: transactions.filter((t: any) => t.type === 'withdraw').length
        })
      } catch (error) {
        console.error('Error loading user stats:', error)
      }
    }

    if (user) {
      loadUserStats()
    }
  }, [user])

  // Загружаем видео URL из API
  useEffect(() => {
    const fetchVideoUrls = async () => {
      try {
        const response = await fetch('/api/video-instructions', { cache: 'no-store' })
        const data = await response.json()
        
        if (data.success && data.data) {
          setDepositVideoUrl(data.data.deposit_video_url || 'https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view')
          setWithdrawVideoUrl(data.data.withdraw_video_url || 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view')
        }
      } catch (error) {
        console.error('Failed to fetch video instructions:', error)
        // Используем значения по умолчанию при ошибке
        setDepositVideoUrl('https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view')
        setWithdrawVideoUrl('https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view')
      }
    }
    
    fetchVideoUrls()
  }, [])

  useEffect(() => {
    let progressInterval: NodeJS.Timeout | null = null
    let checkInterval: NodeJS.Timeout | null = null
    let timeoutId: NodeJS.Timeout | null = null
    
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

    // Функция проверки готовности
    const checkReady = () => {
      const isDocumentReady = document.readyState === 'complete' || document.readyState === 'interactive'
      // Не ждем settings, если они долго загружаются - показываем страницу
      const isSettingsLoaded = !settingsLoading || true // Всегда true для быстрого показа
      
      // Проверяем все условия
      return isDocumentReady && isSettingsLoaded
    }

    // Функция завершения загрузки
    const finishLoading = () => {
      console.log('✅ Завершение загрузки')
      setLoadingProgress(100)
      setTimeout(() => {
        setIsLoading(false)
        console.log('✅ Загрузка завершена, показываем главную страницу')
      }, 300)
    }

    // Анимация прогресса загрузки
    let currentProgress = 0
    progressInterval = setInterval(() => {
      currentProgress = Math.min(currentProgress + 2, 98)
      setLoadingProgress(currentProgress)
      
      // Если достигли 98%, останавливаем анимацию
      if (currentProgress >= 98) {
        if (progressInterval) clearInterval(progressInterval)
      }
    }, 40)

    // Быстрая проверка готовности каждые 50мс
    checkInterval = setInterval(() => {
      if (checkReady()) {
        console.log('✅ Все готово, завершаем загрузку')
        if (checkInterval) clearInterval(checkInterval)
        if (progressInterval) clearInterval(progressInterval)
        if (timeoutId) clearTimeout(timeoutId)
        finishLoading()
      }
    }, 50)

    // Максимальное время загрузки - 1.5 секунды (уменьшено для быстрого отклика)
    timeoutId = setTimeout(() => {
      console.log('⏰ Таймаут загрузки, принудительно завершаем')
      if (checkInterval) clearInterval(checkInterval)
      if (progressInterval) clearInterval(progressInterval)
      finishLoading()
    }, 1500)

    // Проверяем сразу при монтировании
    if (checkReady()) {
      console.log('✅ Готово сразу при монтировании')
      if (checkInterval) clearInterval(checkInterval)
      if (progressInterval) clearInterval(progressInterval)
      if (timeoutId) clearTimeout(timeoutId)
      finishLoading()
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval)
      if (checkInterval) clearInterval(checkInterval)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [language, settingsLoading])

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

  if (isLoading) {
    return (
      <LoadingScreen 
        message="LUX ON"
        showProgress={true}
        progress={loadingProgress}
      />
    )
  }

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
            <a href="/deposit" className="card btn btn-primary text-center p-6 action-card-3d hover:scale-105 transition-transform">
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
            <a href="/withdraw" className="card btn btn-primary text-center p-6 action-card-3d hover:scale-105 transition-transform">
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

      {/* Баннеры розыгрышей */}
      <BannerCarousel />
      
      {/* Сервисы - банковский стиль */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white px-1">{t.services}</h2>
        <div className="grid grid-cols-2 gap-3">
          <a href="/referral" className="card p-4 service-card-3d hover:scale-105 transition-transform">
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
          <a href="/history" className="card p-4 service-card-3d hover:scale-105 transition-transform">
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
          <a href="/instruction" className="card p-4 service-card-3d hover:scale-105 transition-transform">
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
          <a href="/support" className="card p-4 service-card-3d hover:scale-105 transition-transform">
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

      {/* Видео инструкции */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            setSelectedVideo(depositVideoUrl || 'https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view')
            setVideoTitle(t.howToDeposit)
            setIsVideoModalOpen(true)
          }}
          className="card btn btn-ghost text-center p-4 service-card-3d hover:scale-105 transition-transform"
        >
          <div className="font-semibold text-sm flex flex-col items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t.howToDeposit}</span>
          </div>
        </button>
        <button
          onClick={() => {
            setSelectedVideo(withdrawVideoUrl || 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view')
            setVideoTitle(t.howToWithdraw)
            setIsVideoModalOpen(true)
          }}
          className="card btn btn-ghost text-center p-4 service-card-3d hover:scale-105 transition-transform"
        >
          <div className="font-semibold text-sm flex flex-col items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t.howToWithdraw}</span>
          </div>
        </button>
      </div>

      {/* Модальное окно с видео */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoSrc={selectedVideo}
        title={videoTitle || t.howToDeposit}
      />
    </main>
  )
}