"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import BookmakerGrid from '../../../components/BookmakerGrid'
import { useLanguage } from '../../../components/LanguageContext'
import { getApiBase } from '../../../utils/fetch'

export default function WithdrawStep1() {
  const router = useRouter()
  const { language } = useLanguage()
  const [bookmaker, setBookmaker] = useState<string>('')
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true)
  const [disabledCasinos, setDisabledCasinos] = useState<string[]>([])

  const translations = {
    ru: {
      title: 'Вывод средств',
      selectBookmaker: 'Выберите казино',
      next: 'Далее',
      back: 'Назад'
    },
    en: {
      title: 'Withdraw',
      selectBookmaker: 'Select casino',
      next: 'Next',
      back: 'Back'
    },
    ky: {
      title: 'Акчаны чыгаруу',
      selectBookmaker: 'Казинодо тандаңыз',
      next: 'Кийинки',
      back: 'Артка'
    },
    uz: {
      title: 'Pulni yechib olish',
      selectBookmaker: 'Kazinoni tanlang',
      next: 'Keyingi',
      back: 'Orqaga'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  // Проверка настроек выводов и казино
  useEffect(() => {
    async function checkSettings() {
      try {
        const base = getApiBase()
        const { getTelegramUserId } = await import('../../../utils/telegram')
        const telegramUserId = getTelegramUserId()
        const url = telegramUserId 
          ? `${base}/api/public/payment-settings?user_id=${telegramUserId}`
          : `${base}/api/public/payment-settings`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        
        if (data && data.withdrawals) {
          setWithdrawalsEnabled(data.withdrawals.enabled === true)
        } else {
          setWithdrawalsEnabled(false)
        }
        
        if (data && data.casinos) {
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
        console.error('Error loading settings:', error)
      }
    }
    checkSettings()
  }, [])

  // Загружаем сохраненный букмекер, если есть
  useEffect(() => {
    const savedBookmaker = localStorage.getItem('withdraw_bookmaker')
    if (savedBookmaker) {
      setBookmaker(savedBookmaker)
    }
  }, [])

  const handleNext = () => {
    if (!bookmaker) {
      alert('Выберите казино')
      return
    }
    
    localStorage.setItem('withdraw_bookmaker', bookmaker)
    router.push('/withdraw/step2')
  }

  const handleBack = () => {
    router.push('/')
  }

  if (!withdrawalsEnabled) {
    return (
      <main className="space-y-4">
        <FixedHeaderControls />
        <h1 className="text-xl font-bold pr-20">{t.title}</h1>
        <div className="card text-center bg-orange-900/20 border-orange-500">
          <div className="text-orange-300 text-lg font-semibold mb-2">
            🔧 Технические работы
          </div>
          <div className="text-white/70 mb-4">
            Вывод средств временно недоступен. Попробуйте позже.
          </div>
          <button
            onClick={handleBack}
            className="btn btn-ghost"
          >
            ← {t.back}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-4">
      <FixedHeaderControls />
      <h1 className="text-xl font-bold">{t.title}</h1>
      
      <section className="card space-y-3">
        <div className="label">{t.selectBookmaker}</div>
        <BookmakerGrid 
          value={bookmaker} 
          onChange={setBookmaker}
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

