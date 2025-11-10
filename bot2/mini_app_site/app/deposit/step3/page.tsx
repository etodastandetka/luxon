"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import QuickAmounts from '../../../components/QuickAmounts'
import PageTransition from '../../../components/PageTransition'
import { useLanguage } from '../../../components/LanguageContext'
import { kgsToUsdt, usdtToKgs, validateCryptoAmount } from '../../../utils/crypto-pay'

// Примерный курс USD/KGS (можно обновить или получать через API)
const USD_TO_KGS_RATE = 95

export default function DepositStep3() {
  const [amount, setAmount] = useState('')
  const [paymentType, setPaymentType] = useState<'bank' | 'crypto'>('bank')
  const { language } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    // Проверяем, что пользователь прошел предыдущие шаги
    const bookmaker = localStorage.getItem('deposit_bookmaker')
    const userId = localStorage.getItem('deposit_user_id')
    const savedPaymentType = localStorage.getItem('deposit_payment_type') as 'bank' | 'crypto' || 'bank'
    
    if (!bookmaker || !userId) {
      router.push('/deposit/step1')
      return
    }
    
    setPaymentType(savedPaymentType)
  }, [router])

  // Конвертация USD в KGS
  const usdToKgs = (usd: number) => usd * USD_TO_KGS_RATE
  
  // Конвертация KGS в USD
  const kgsToUsd = (kgs: number) => kgs / USD_TO_KGS_RATE

  const handleNext = () => {
    const numAmount = parseFloat(amount)
    if (!amount.trim() || isNaN(numAmount) || numAmount <= 0) {
      alert(paymentType === 'crypto' ? 'Введите корректную сумму в сомах' : 'Введите корректную сумму')
      return
    }
    
    if (paymentType === 'crypto') {
      // Для крипты: пользователь вводит сумму в сомах
      // Валидируем сумму в сомах
      const validation = validateCryptoAmount(numAmount)
      if (!validation.valid) {
        alert(validation.error || 'Неверная сумма')
        return
      }
      
      // Конвертируем в USDT для сохранения
      const amountUsdt = kgsToUsdt(numAmount)
      
      // Сохраняем сумму в сомах (основная валюта)
      localStorage.setItem('deposit_amount', numAmount.toString())
      // Также сохраняем в USDT для совместимости
      localStorage.setItem('deposit_amount_usd', amountUsdt.toString())
    } else {
      // Для банковских переводов: валидация в сомах
      if (numAmount < 35 || numAmount > 100000) {
        alert('Сумма должна быть от 35 до 100000 сом')
        return
      }
      
      // Добавляем случайные копейки к сумме (1-99 копеек)
      const randomKopecks = Math.floor(Math.random() * 99) + 1
      const amountWithKopecks = numAmount + (randomKopecks / 100)
      
      // Сохраняем сумму с копейками
      localStorage.setItem('deposit_amount', amountWithKopecks.toString())
    }
    
    // Переходим к оплате (step4 теперь страница оплаты)
    router.push('/deposit/step4')
  }

  const handleBack = () => {
    // Анимация выхода
    if (typeof window !== 'undefined' && (window as any).pageTransitionExit) {
      (window as any).pageTransitionExit()
      setTimeout(() => {
        router.push('/deposit/step2')
      }, 250)
    } else {
      router.push('/deposit/step2')
    }
  }

  const getTranslations = () => {
    const base = {
      ru: {
        title: 'Пополнение - Шаг 3',
        subtitle: 'Введите сумму',
        instruction: 'Введите сумму пополнения',
        placeholder: paymentType === 'crypto' ? 'Введите сумму в сомах' : 'Введите сумму',
        limits: paymentType === 'crypto' ? `От ${usdtToKgs(1)} до ${usdtToKgs(1000)} сом` : 'От 35 до 100000 сом',
        currency: 'сом',
        next: 'Далее',
        back: 'Назад'
      },
      en: {
        title: 'Deposit - Step 3',
        subtitle: 'Enter amount',
        instruction: 'Enter deposit amount',
        placeholder: paymentType === 'crypto' ? 'Enter amount in som' : 'Enter amount',
        limits: paymentType === 'crypto' ? `From ${usdtToKgs(1)} to ${usdtToKgs(1000)} som` : 'From 35 to 100000 som',
        currency: 'som',
        next: 'Next',
        back: 'Back'
      },
      ky: {
        title: 'Толтуруу - 3-чү кадам',
        subtitle: 'Сумманы киргизиңиз',
        instruction: 'Толтуруу суммасын киргизиңиз',
        placeholder: paymentType === 'crypto' ? 'Сом суммасын киргизиңиз' : 'Сумма киргизиңиз',
        limits: paymentType === 'crypto' ? `${usdtToKgs(1)} сомдон ${usdtToKgs(1000)} сомго чейин` : '35дөн 100000 сом чейин',
        currency: 'сом',
        next: 'Кийинки',
        back: 'Артка'
      },
      uz: {
        title: 'To\'ldirish - 3-qadam',
        subtitle: 'Summani kiriting',
        instruction: 'To\'ldirish summasini kiriting',
        placeholder: paymentType === 'crypto' ? 'Som summasini kiriting' : 'Summa kiriting',
        limits: paymentType === 'crypto' ? `${usdtToKgs(1)} somdan ${usdtToKgs(1000)} somgacha` : '35 dan 100000 som gacha',
        currency: 'som',
        next: 'Keyingi',
        back: 'Orqaga'
      }
    }
    return base[language as keyof typeof base] || base.ru
  }

  const t = getTranslations()

  return (
    <PageTransition direction="backward">
      <main className="space-y-4">
        <FixedHeaderControls />
        <div className="fade-in pr-24">
          <h1 className="text-xl font-bold">{t.title}</h1>
        </div>
        
        <div className="card space-y-4 slide-in-left delay-100">
          <div className="text-center">
            <h2 className="text-lg font-semibold">{t.subtitle}</h2>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{width: '75%'}}></div>
            </div>
            <p className="text-sm text-white/70 mt-1">Шаг 3 из 3</p>
          </div>
          
          <p className="text-white/80 text-center slide-in-right delay-200">{t.instruction}</p>
          
          <div className="space-y-3 scale-in delay-300">
            <div>
              <label className="label">{t.subtitle}</label>
              <input 
                className="input w-full"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t.placeholder}
                min={paymentType === 'crypto' ? usdtToKgs(1).toString() : '35'}
                max={paymentType === 'crypto' ? usdtToKgs(1000).toString() : '100000'}
                step="0.01"
                style={{'MozAppearance': 'textfield'}}
              />
              <style jsx>{`
                input[type="number"]::-webkit-outer-spin-button,
                input[type="number"]::-webkit-inner-spin-button {
                  -webkit-appearance: none;
                  margin: 0;
                }
                input[type="number"] {
                  -moz-appearance: textfield;
                }
              `}</style>
              <p className="text-sm text-white/70 mt-1">{t.limits}</p>
            </div>
            
            <QuickAmounts 
              onPick={(value) => setAmount(value.toString())} 
              selected={amount} 
              currency="kgs"
            />
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
              disabled={!amount.trim()}
            >
              {t.next}
            </button>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}

