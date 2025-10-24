"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BankButtons from '../../../components/BankButtons'
import LanguageSelector from '../../../components/LanguageSelector'
import { useLanguage } from '../../../components/LanguageContext'

export default function WithdrawStep1() {
  const [bank, setBank] = useState('')
  const { language } = useLanguage()
    const router = useRouter()

  useEffect(() => {
    // Проверяем, что пользователь выбрал букмекера
    const bookmaker = localStorage.getItem('withdraw_bookmaker')
    if (!bookmaker) {
      router.push('/withdraw/step0')
    }
  }, [router])

  const handleNext = () => {
    if (!bank) {
      alert('Выберите банк')
      return
    }
    
    // Сохраняем выбор
    localStorage.setItem('withdraw_bank', bank)
    
    // Переходим к следующему шагу
    router.push('/withdraw/step2')
  }

  const translations = {
    ru: {
      title: 'Вывод - Шаг 1',
      subtitle: 'Выберите банк для вывода',
      instruction: 'Выберите банк, на который хотите вывести средства',
      next: 'Далее',
      back: 'Назад'
    },
    en: {
      title: 'Withdraw - Step 1',
      subtitle: 'Select withdrawal bank',
      instruction: 'Choose the bank to withdraw funds to',
      next: 'Next',
      back: 'Back'
    },
    ky: {
      title: 'Чыгаруу - 1-чи кадам',
      subtitle: 'Чыгаруу банкын тандаңыз',
      instruction: 'Акча чыгарууну каалаган банкты тандаңыз',
      next: 'Кийинки',
      back: 'Артка'
    },
    uz: {
      title: 'Yechib olish - 1-qadam',
      subtitle: 'Yechib olish bankini tanlang',
      instruction: 'Pul yechib olishni xohlagan bankni tanlang',
      next: 'Keyingi',
      back: 'Orqaga'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <main className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">{t.title}</h1>
        <LanguageSelector />
      </div>
      
      <div className="card space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">{t.subtitle}</h2>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-accent h-2 rounded-full" style={{width: '33%'}}></div>
          </div>
          <p className="text-sm text-white/70 mt-1">Шаг 2 из 6</p>
        </div>
        
        <p className="text-white/80 text-center">{t.instruction}</p>
        
        <BankButtons onPick={setBank} selected={bank} />
        
        <div className="flex gap-2">
          <button 
            className="btn btn-ghost flex-1"
            onClick={() => router.push('/withdraw/step0')}
          >
            {t.back}
          </button>
          <button 
            className="btn btn-primary flex-1"
            onClick={handleNext}
            disabled={!bank}
          >
            {t.next}
          </button>
        </div>
      </div>
    </main>
  )
}