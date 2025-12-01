"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import VideoModal from '../../../components/VideoModal'
import { useRouter } from 'next/navigation'
import BookmakerGrid from '../../../components/BookmakerGrid'
import PageTransition from '../../../components/PageTransition'
import { useLanguage } from '../../../components/LanguageContext'
import { getApiBase } from '../../../utils/fetch'

export default function WithdrawStep0() {
  const router = useRouter()
  const { language } = useLanguage()
  const [bookmaker, setBookmaker] = useState<string>('')
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [disabledCasinos, setDisabledCasinos] = useState<string[]>([])
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [withdrawVideoUrl, setWithdrawVideoUrl] = useState<string>('')
  const [isNavigating, setIsNavigating] = useState(false)

  const translations = {
    ru: {
      title: 'Вывод средств',
      howToWithdraw: 'Как вывести',
      watchVideo: '📹 Посмотреть видео-инструкцию',
      back: 'Назад',
      next: 'Далее',
      selectBookmaker: 'Выберите букмекера'
    },
    en: {
      title: 'Withdraw',
      howToWithdraw: 'How to withdraw',
      watchVideo: '📹 Watch video tutorial',
      back: 'Back',
      next: 'Next',
      selectBookmaker: 'Select bookmaker'
    },
    ky: {
      title: 'Акчаны чыгаруу',
      howToWithdraw: 'Кантип чыгаруу керек',
      watchVideo: '📹 Видео көрсөтмөнү көрүү',
      back: 'Артка',
      next: 'Кийинки',
      selectBookmaker: 'Букмекерди тандаңыз'
    },
    uz: {
      title: 'Pulni yechib olish',
      howToWithdraw: 'Qanday yechib olish kerak',
      watchVideo: '📹 Video ko\'rsatmani ko\'rish',
      back: 'Orqaga',
      next: 'Keyingi',
      selectBookmaker: 'Bukmekerni tanlang'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  // Проверка настроек выводов и казино
  useEffect(() => {
    async function checkSettings() {
      try {
        const base = getApiBase()
        const res = await fetch(`${base}/api/public/payment-settings`, { cache: 'no-store' })
        const data = await res.json()
        if (data && data.withdrawals) {
          setWithdrawalsEnabled(data.withdrawals.enabled !== false)
        }
        if (data && data.casinos) {
          // Формируем список отключенных казино
          const disabled: string[] = []
          if (data.casinos['1xbet'] === false) disabled.push('1xbet')
          if (data.casinos['1win'] === false) disabled.push('1win')
          if (data.casinos['melbet'] === false) disabled.push('melbet')
          if (data.casinos['mostbet'] === false) disabled.push('mostbet')
          if (data.casinos['winwin'] === false) disabled.push('winwin')
          if (data.casinos['888starz'] === false) disabled.push('888starz')
          setDisabledCasinos(disabled)
        }
      } catch (error) {
        console.error('Ошибка загрузки настроек:', error)
      } finally {
        setLoadingSettings(false)
      }
    }
    checkSettings()
  }, [])

  // Загружаем видео URL из API
  useEffect(() => {
    const fetchVideoUrl = async () => {
      try {
        const base = getApiBase()
        const response = await fetch(`${base}/api/public/video-instructions`, { cache: 'no-store' })
        const data = await response.json()
        
        if (data.success && data.data?.withdraw_video_url) {
          setWithdrawVideoUrl(data.data.withdraw_video_url)
        } else {
          setWithdrawVideoUrl('https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view')
        }
      } catch (error) {
        console.error('Failed to fetch video URL:', error)
        setWithdrawVideoUrl('https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view')
      }
    }
    
    fetchVideoUrl()
  }, [])

  useEffect(() => {
    // Загружаем сохраненный букмекер, если есть
    const savedBookmaker = localStorage.getItem('withdraw_bookmaker')
    if (savedBookmaker) {
      setBookmaker(savedBookmaker)
    }
  }, [])

  const handleBookmakerChange = (key: string) => {
    console.log('Bookmaker selected:', key)
    setBookmaker(key)
  }

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (isNavigating) return
    
    console.log('Current bookmaker:', bookmaker)
    if (!bookmaker) {
      alert('Выберите букмекера')
      return
    }
    
    setIsNavigating(true)
    
    // Сохраняем выбор букмекера
    localStorage.setItem('withdraw_bookmaker', bookmaker)
    
    console.log('Navigating to /withdraw/step1')
    router.push('/withdraw/step1')
  }

  const handleBack = () => {
    // Анимация выхода
    if (typeof window !== 'undefined' && (window as any).pageTransitionExit) {
      (window as any).pageTransitionExit()
      setTimeout(() => {
        router.push('/')
      }, 250)
    } else {
      router.push('/')
    }
  }

  // Если выводы отключены, показываем технические работы
  if (loadingSettings) {
    return (
      <PageTransition direction="backward">
        <main className="space-y-4">
          <FixedHeaderControls />
          <h1 className="text-xl font-bold fade-in pr-20">Вывод средств</h1>
          <div className="card text-center">
            <div className="text-white/70">Загрузка...</div>
          </div>
        </main>
      </PageTransition>
    )
  }

  if (!withdrawalsEnabled) {
    return (
      <PageTransition direction="backward">
        <main className="space-y-4">
          <FixedHeaderControls />
          <h1 className="text-xl font-bold fade-in pr-20">Вывод средств</h1>
          <div className="card text-center bg-orange-900/20 border-orange-500">
            <div className="text-orange-300 text-lg font-semibold mb-2">
              🔧 Технические работы
            </div>
            <div className="text-white/70 mb-4">
              Вывод средств временно недоступен. Попробуйте позже.
            </div>
            <button
              onClick={() => router.push('/')}
              className="btn btn-ghost"
            >
              ← Назад
            </button>
          </div>
        </main>
      </PageTransition>
    )
  }

  return (
    <PageTransition direction="backward">
      <main className="space-y-4">
        <FixedHeaderControls />
        <h1 className="text-xl font-bold fade-in">Вывод средств</h1>
        
        <section className="card space-y-3 slide-in-left delay-100">
          <div className="label">{t.selectBookmaker}</div>
          <BookmakerGrid 
            value={bookmaker} 
            onChange={handleBookmakerChange}
            disabledCasinos={disabledCasinos}
          />
        </section>

        {/* Кнопка "Как вывести" */}
        <button
          onClick={() => setIsVideoModalOpen(true)}
          className="w-full card btn btn-ghost p-4 border-2 border-dashed border-gray-600 hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold">{t.watchVideo}</span>
          </div>
        </button>

        <div className="flex gap-3">
          <button 
            className="btn btn-ghost flex-1 slide-in-left delay-200" 
            onClick={handleBack}
          >
            {t.back}
          </button>
          <button 
            className="btn btn-primary flex-1 slide-in-right delay-200" 
            onClick={handleNext}
            disabled={!bookmaker || isNavigating}
          >
            {isNavigating ? (language === 'ru' ? 'Загрузка...' : 'Loading...') : t.next}
          </button>
        </div>

        {/* Модальное окно с видео */}
        <VideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          videoSrc={withdrawVideoUrl || 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view'}
          title={t.howToWithdraw}
        />
      </main>
    </PageTransition>
  )
}
