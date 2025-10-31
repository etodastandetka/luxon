"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BookmakerGrid from '../../../components/BookmakerGrid'
import PageTransition from '../../../components/PageTransition'

export default function WithdrawStep0() {
  const router = useRouter()
  const [bookmaker, setBookmaker] = useState<string>('')
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [disabledCasinos, setDisabledCasinos] = useState<string[]>([])

  // Проверка настроек выводов и казино
  useEffect(() => {
    async function checkSettings() {
      try {
        const base = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3001' 
          : 'https://xendro.pro'
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

  const handleNext = () => {
    console.log('Current bookmaker:', bookmaker)
    if (!bookmaker) {
      alert('Выберите букмекера')
      return
    }
    
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
          <h1 className="text-xl font-bold fade-in">Вывод средств</h1>
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
          <h1 className="text-xl font-bold fade-in">Вывод средств</h1>
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
        <h1 className="text-xl font-bold fade-in">Вывод средств</h1>
        
        <section className="card space-y-3 slide-in-left delay-100">
          <div className="label">Выберите букмекера</div>
          <BookmakerGrid 
            value={bookmaker} 
            onChange={handleBookmakerChange}
            disabledCasinos={disabledCasinos}
          />
        </section>

        <div className="flex gap-3">
          <button 
            className="btn btn-ghost flex-1 slide-in-left delay-200" 
            onClick={handleBack}
          >
            Назад
          </button>
          <button 
            className="btn btn-primary flex-1 slide-in-right delay-200" 
            onClick={handleNext}
            disabled={!bookmaker}
          >
            Далее
          </button>
        </div>
      </main>
    </PageTransition>
  )
}