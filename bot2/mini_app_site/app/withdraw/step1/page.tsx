"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import BankButtons from '../../../components/BankButtons'
import { useLanguage } from '../../../components/LanguageContext'
import { getApiBase } from '../../../utils/fetch'

export default function WithdrawStep1() {
  const [bank, setBank] = useState('')
  const [enabledBanks, setEnabledBanks] = useState<string[]>([])
  const { language } = useLanguage()
  const router = useRouter()

  // Загрузка настроек выводов
  useEffect(() => {
    async function loadWithdrawalSettings() {
      try {
        const base = getApiBase()
        const res = await fetch(`${base}/api/public/payment-settings`, { cache: 'no-store' })
        const data = await res.json()
        if (data && data.withdrawals && data.withdrawals.banks && Array.isArray(data.withdrawals.banks)) {
          const bankCodeMapping: Record<string, string> = {
            'kompanion': 'kompanion',
            'odengi': 'omoney',
            'bakai': 'bakai',
            'balance': 'balance',
            'megapay': 'megapay',
            'mbank': 'mbank',
            'demir': 'demirbank',
            'demirbank': 'demirbank'
          }
          const mappedBanks: string[] = []
          for (const b of data.withdrawals.banks) {
            const code = b.code || b
            const mapped = bankCodeMapping[code] || code
            if (mapped) mappedBanks.push(mapped)
          }
          setEnabledBanks(mappedBanks)
        } else {
          setEnabledBanks([])
        }
      } catch (error) {
        // Игнорируем ошибки
      }
    }
    loadWithdrawalSettings()
  }, [])

  useEffect(() => {
    // Проверяем, что пользователь выбрал букмекера
    const bookmaker = localStorage.getItem('withdraw_bookmaker')
    if (!bookmaker) {
      router.push('/withdraw/step0')
    }
  }, [router])

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
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
      <FixedHeaderControls />
      <div className="pr-20">
        <h1 className="text-xl font-bold">{t.title}</h1>
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
        
        <BankButtons 
          onPick={setBank} 
          selected={bank} 
          enabledBanks={enabledBanks.length > 0 ? enabledBanks : []}
        />
        
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
