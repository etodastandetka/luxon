"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
// Видео компоненты удалены
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
  const [disabledCasinos, setDisabledCasinos] = useState<string[]>([])
  // Видео инструкции удалены

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
        // Игнорируем ошибки
      }
    }
    checkSettings()
  }, [])

  // Видео инструкции удалены

  useEffect(() => {
    // Загружаем сохраненный букмекер, если есть
    const savedBookmaker = localStorage.getItem('withdraw_bookmaker')
    if (savedBookmaker) {
      setBookmaker(savedBookmaker)
    }
  }, [])

  const handleBookmakerChange = (key: string) => {
    setBookmaker(key)
  }

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (!bookmaker) {
      alert('Выберите букмекера')
      return
    }
    
    localStorage.setItem('withdraw_bookmaker', bookmaker)
    router.push('/withdraw/step1')
  }

  const handleBack = () => {
    router.push('/')
  }

  if (!withdrawalsEnabled) {
    return (
      <main className="space-y-4">
        <FixedHeaderControls />
        <h1 className="text-xl font-bold pr-20">Вывод средств</h1>
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
    )
  }

  return (
    <main className="space-y-4">
      <FixedHeaderControls />
      <h1 className="text-xl font-bold">Вывод средств</h1>
      
      <section className="card space-y-3">
        <div className="label">{t.selectBookmaker}</div>
        <BookmakerGrid 
          value={bookmaker} 
          onChange={handleBookmakerChange}
          disabledCasinos={disabledCasinos}
        />
      </section>


      <div className="flex gap-3">
        <button 
          className="btn btn-ghost flex-1" 
          onClick={handleBack}
        >
          {t.back}
        </button>
        <button 
          className="btn btn-primary flex-1" 
          onClick={handleNext}
          disabled={!bookmaker}
        >
          {t.next}
        </button>
      </div>

    </main>
  )
}
