"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import PageTransition from '../../../components/PageTransition'
import { useLanguage } from '../../../components/LanguageContext'

export default function DepositStep2() {
  const [userId, setUserId] = useState('')
  const [isNavigating, setIsNavigating] = useState(false)
  const { language } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    // Проверяем, что пользователь прошел предыдущие шаги
    const bookmaker = localStorage.getItem('deposit_bookmaker')
    const paymentType = localStorage.getItem('deposit_payment_type')
    if (!bookmaker || !paymentType) {
      router.push('/deposit/step0')
      return
    }
    
    // Автоматически заполняем ID из cookies для конкретного казино
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }
    
    // Загружаем ID для конкретного казино
    const cookieName = `user_id_${bookmaker}`
    const savedUserId = getCookie(cookieName)
    
    // Также проверяем localStorage для обратной совместимости
    const localStorageKey = `deposit_user_id_${bookmaker}`
    const savedUserIdFromStorage = localStorage.getItem(localStorageKey)
    
    if (savedUserId) {
      setUserId(savedUserId)
    } else if (savedUserIdFromStorage) {
      setUserId(savedUserIdFromStorage)
    }
  }, [router])

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (isNavigating) return
    
    if (!userId.trim() || !userId.match(/^\d+$/)) {
      alert('Введите корректный ID (только цифры)')
      return
    }
    
    setIsNavigating(true)
    
    // Получаем выбранное казино
    const bookmaker = localStorage.getItem('deposit_bookmaker')
    if (!bookmaker) {
      setIsNavigating(false)
      alert('Ошибка: не выбрано казино')
      router.push('/deposit/step0')
      return
    }
    
    // Сохраняем данные в localStorage с привязкой к казино
    const localStorageKey = `deposit_user_id_${bookmaker}`
    localStorage.setItem(localStorageKey, userId)
    
    // Также сохраняем для обратной совместимости (старый формат)
    localStorage.setItem('deposit_user_id', userId)
    
    // Сохраняем в cookies с привязкой к казино на 30 дней
    const expires = new Date()
    expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000))
    const cookieName = `user_id_${bookmaker}`
    document.cookie = `${cookieName}=${userId}; expires=${expires.toUTCString()}; path=/`
    
    // Переходим к следующему шагу
    router.push('/deposit/step3')
  }

  const handleBack = () => {
    // Анимация выхода
    if (typeof window !== 'undefined' && (window as any).pageTransitionExit) {
      (window as any).pageTransitionExit()
      setTimeout(() => {
        router.push('/deposit/step1')
      }, 250)
    } else {
      router.push('/deposit/step1')
    }
  }

  const translations = {
    ru: {
      title: 'Пополнение - Шаг 2',
      subtitle: 'ID аккаунта',
      instruction: 'Введите ваш ID в букмекере',
      placeholder: 'Введите ID',
      next: 'Далее',
      back: 'Назад'
    },
    en: {
      title: 'Deposit - Step 2',
      subtitle: 'Account ID',
      instruction: 'Enter your bookmaker ID',
      placeholder: 'Enter ID',
      next: 'Next',
      back: 'Back'
    },
    ky: {
      title: 'Толтуруу - 2-чи кадам',
      subtitle: 'Аккаунт ID',
      instruction: 'Букмекердеги ID киргизиңиз',
      placeholder: 'ID киргизиңиз',
      next: 'Кийинки',
      back: 'Артка'
    },
    uz: {
      title: 'To\'ldirish - 2-qadam',
      subtitle: 'Hisob ID',
      instruction: 'Bukmekerdagi ID ni kiriting',
      placeholder: 'ID kiriting',
      next: 'Keyingi',
      back: 'Orqaga'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <PageTransition direction="backward">
      <main className="space-y-4">
        <FixedHeaderControls />
        <div className="fade-in pr-20">
          <h1 className="text-xl font-bold">{t.title}</h1>
        </div>
        
        <div className="card space-y-4 slide-in-left delay-100">
          <div className="text-center">
            <h2 className="text-lg font-semibold">{t.subtitle}</h2>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{width: '50%'}}></div>
            </div>
            <p className="text-sm text-white/70 mt-1">Шаг 2 из 3</p>
          </div>
          
          <p className="text-white/80 text-center slide-in-right delay-200">{t.instruction}</p>
          
          <div className="space-y-3 scale-in delay-300">
            <div>
              <label className="label">{t.subtitle}</label>
              <input 
                className="input w-full"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={t.placeholder}
              />
            </div>
          </div>
          
          <div className="flex gap-2 slide-in-right delay-400">
            <button 
              className="btn btn-ghost flex-1"
              onClick={handleBack}
            >
              {t.back}
            </button>
            <button 
              className="btn btn-primary flex-1"
              onClick={handleNext}
              disabled={!userId.trim() || isNavigating}
            >
              {isNavigating ? (language === 'ru' ? 'Загрузка...' : 'Loading...') : t.next}
            </button>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
