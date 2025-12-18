"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import BookmakerGrid from '../../../components/BookmakerGrid'
// PageTransition убран для ускорения загрузки
import { useLanguage } from '../../../components/LanguageContext'
import { getApiBase } from '../../../utils/fetch'

export default function DepositStep1() {
  const [bookmaker, setBookmaker] = useState('')
  const [depositsEnabled, setDepositsEnabled] = useState(true)
  const [disabledCasinos, setDisabledCasinos] = useState<string[]>([])
  const { language } = useLanguage()
  const router = useRouter()

  // Параметр bot обрабатывается в BookmakerGrid компоненте
  // Здесь не сохраняем, чтобы избежать конфликтов

  // Проверка настроек депозитов и казино - загружаем в фоне, не блокируя UI
  useEffect(() => {
    // Проверяем, что пользователь выбрал тип оплаты
    const paymentType = localStorage.getItem('deposit_payment_type')
    if (!paymentType) {
      router.push('/deposit/step0')
      return
    }
    
    async function checkSettings() {
      try {
        const base = getApiBase()
        const res = await fetch(`${base}/api/public/payment-settings`, { 
          cache: 'no-store'
        })
        
        const data = await res.json()
        if (data && data.deposits) {
          setDepositsEnabled(data.deposits.enabled !== false)
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
        // Если ошибка - продолжаем работу с дефолтными настройками
        console.error('Ошибка загрузки настроек:', error)
        // По умолчанию депозиты включены, все казино доступны
        setDepositsEnabled(true)
        setDisabledCasinos([])
      }
    }
    // Загружаем настройки асинхронно, не блокируя UI
    checkSettings()
  }, [router])

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (!bookmaker) {
      alert('Выберите букмекера')
      return
    }
    
    // Сохраняем выбор
    localStorage.setItem('deposit_bookmaker', bookmaker)
    
    // Переходим к вводу ID
    router.push('/deposit/step2')
  }

  const handleBack = () => {
    // Убрали анимацию для мгновенного перехода
    router.push('/deposit/step0')
  }

  const translations = {
    ru: {
      title: 'Пополнение - Шаг 1',
      subtitle: 'Выберите букмекера',
      next: 'Далее',
      back: 'Назад'
    },
    en: {
      title: 'Deposit - Step 1',
      subtitle: 'Select bookmaker',
      next: 'Next',
      back: 'Back'
    },
    ky: {
      title: 'Толтуруу - 1-чи кадам',
      subtitle: 'Букмекерди тандаңыз',
      next: 'Кийинки',
      back: 'Артка'
    },
    uz: {
      title: 'To\'ldirish - 1-qadam',
      subtitle: 'Bukmekerni tanlang',
      next: 'Keyingi',
      back: 'Orqaga'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  // Если депозиты отключены, показываем технические работы
  // (проверяем только после загрузки настроек, но не блокируем UI)
  if (!depositsEnabled) {
    return (
      <div>
        <main className="space-y-4">
          <FixedHeaderControls />
          <div className="fade-in pr-20">
            <h1 className="text-xl font-bold">{t.title}</h1>
          </div>
          <div className="card text-center bg-orange-900/20 border-orange-500">
            <div className="text-orange-300 text-lg font-semibold mb-2">
              🔧 Технические работы
            </div>
            <div className="text-white/70 mb-4">
              Пополнения временно недоступны. Попробуйте позже.
            </div>
            <button
              onClick={() => router.push('/')}
              className="btn btn-ghost"
            >
              ← Назад
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div>
      <main className="space-y-4">
        <FixedHeaderControls />
        <div className="fade-in pr-24">
          <h1 className="text-xl font-bold">{t.title}</h1>
        </div>
        
        <div className="card space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold">{t.subtitle}</h2>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{width: '25%'}}></div>
            </div>
            <p className="text-sm text-white/70 mt-1">Шаг 1 из 4</p>
          </div>
          
          <BookmakerGrid 
            value={bookmaker} 
            onChange={setBookmaker}
            disabledCasinos={disabledCasinos}
          />
          
          <div className="flex gap-2">
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
        </div>
      </main>
    </div>
  )
}
