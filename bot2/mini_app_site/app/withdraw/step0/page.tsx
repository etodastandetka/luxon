"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BookmakerGrid from '../../../components/BookmakerGrid'
import PageTransition from '../../../components/PageTransition'

export default function WithdrawStep0() {
  const router = useRouter()
  const [bookmaker, setBookmaker] = useState<string>('')

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

  return (
    <PageTransition direction="backward">
      <main className="space-y-4">
        <h1 className="text-xl font-bold fade-in">Вывод средств</h1>
        
        <section className="card space-y-3 slide-in-left delay-100">
          <div className="label">Выберите букмекера</div>
          <BookmakerGrid value={bookmaker} onChange={handleBookmakerChange} />
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