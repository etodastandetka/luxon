"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BookmakerGrid from '../../../components/BookmakerGrid'
import LanguageSelector from '../../../components/LanguageSelector'
import PageTransition from '../../../components/PageTransition'
import { useLanguage } from '../../../components/LanguageContext'

export default function DepositStep1() {
  const [bookmaker, setBookmaker] = useState('')
  const { language } = useLanguage()
  const router = useRouter()

  const handleNext = () => {
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
    // Анимация выхода - направление назад
    if (typeof window !== 'undefined' && (window as any).pageTransitionExit) {
      (window as any).pageTransitionExit()
      setTimeout(() => {
        router.push('/')
      }, 250)
    } else {
      router.push('/')
    }
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

  return (
    <PageTransition direction="backward">
      <main className="space-y-4">
        <div className="flex justify-between items-center fade-in">
          <h1 className="text-xl font-bold">{t.title}</h1>
          <LanguageSelector />
        </div>
        
        <div className="card space-y-4 slide-in-left delay-100">
          <div className="text-center">
            <h2 className="text-lg font-semibold">{t.subtitle}</h2>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{width: '25%'}}></div>
            </div>
            <p className="text-sm text-white/70 mt-1">Шаг 1 из 4</p>
          </div>
          
          <BookmakerGrid value={bookmaker} onChange={setBookmaker} />
          
          <div className="flex gap-2 slide-in-right delay-200">
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
    </PageTransition>
  )
}