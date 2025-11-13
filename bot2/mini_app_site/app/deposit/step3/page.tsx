"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import QuickAmounts from '../../../components/QuickAmounts'
import PageTransition from '../../../components/PageTransition'
import { useLanguage } from '../../../components/LanguageContext'
import { validateCryptoAmount, formatUsd, formatKgs, usdToKgs, clearExchangeRateCache } from '../../../utils/crypto-pay'

export default function DepositStep3() {
  const [amount, setAmount] = useState('')
  const [paymentType, setPaymentType] = useState<'bank' | 'crypto'>('bank')
  const [convertedAmount, setConvertedAmount] = useState<string>('')
  const [loadingRate, setLoadingRate] = useState(false)
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
    
    // Если выбрана крипта, сбрасываем кэш курса для получения актуального курса
    if (savedPaymentType === 'crypto') {
      console.log('🔄 Clearing exchange rate cache for fresh rates...')
      clearExchangeRateCache()
    }
  }, [router])

  // Обновление конвертированной суммы при изменении введенной суммы
  useEffect(() => {
    const updateConvertedAmount = async () => {
      if (paymentType === 'crypto' && amount) {
        const numAmount = parseFloat(amount)
        if (!isNaN(numAmount) && numAmount > 0) {
          setLoadingRate(true)
          try {
            console.log('🔄 Fetching exchange rate for USD -> KGS conversion...')
            const amountInKgs = await usdToKgs(numAmount)
            console.log('✅ Conversion successful:', numAmount, 'USD =', amountInKgs, 'KGS')
            setConvertedAmount(amountInKgs.toFixed(2))
          } catch (error: any) {
            console.error('❌ Error converting USD to KGS:', error)
            // Показываем ошибку пользователю
            setConvertedAmount('Ошибка загрузки курса')
            // Можно показать alert, но лучше просто показать в UI
            if (error.message) {
              console.warn('Exchange rate error:', error.message)
            }
          } finally {
            setLoadingRate(false)
          }
        } else {
          setConvertedAmount('')
        }
      } else {
        setConvertedAmount('')
      }
    }

    updateConvertedAmount()
  }, [amount, paymentType])

  const handleNext = async () => {
    const numAmount = parseFloat(amount)
    if (!amount.trim() || isNaN(numAmount) || numAmount <= 0) {
      alert(paymentType === 'crypto' ? 'Введите корректную сумму в долларах' : 'Введите корректную сумму')
      return
    }
    
    if (paymentType === 'crypto') {
      // Для крипты: пользователь вводит сумму в долларах (USD)
      // Валидируем сумму в долларах
      const validation = validateCryptoAmount(numAmount)
      if (!validation.valid) {
        alert(validation.error || 'Неверная сумма')
        return
      }
      
      try {
        // Конвертируем доллары в сомы для пополнения в казино (используя реальный курс из API)
        const amountInKgs = await usdToKgs(numAmount)
        
        // Сохраняем сумму в долларах (что ввел пользователь)
        localStorage.setItem('deposit_amount_usd', numAmount.toString())
        // Сохраняем сумму в сомах (для пополнения в казино)
        localStorage.setItem('deposit_amount', amountInKgs.toString())
      } catch (error: any) {
        console.error('❌ Error converting USD to KGS:', error)
        alert(error.message || 'Ошибка получения курса валют. Пожалуйста, попробуйте позже.')
        return
      }
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
        instruction: paymentType === 'crypto' ? 'Введите сумму в долларах (USD)' : 'Введите сумму пополнения',
        placeholder: paymentType === 'crypto' ? 'Введите сумму в долларах' : 'Введите сумму',
        limits: paymentType === 'crypto' ? 'От $1 до $1000 USD' : 'От 35 до 100000 сом',
        currency: paymentType === 'crypto' ? 'USD' : 'сом',
        convertedLabel: '≈ в сомах',
        next: 'Далее',
        back: 'Назад'
      },
      en: {
        title: 'Deposit - Step 3',
        subtitle: 'Enter amount',
        instruction: paymentType === 'crypto' ? 'Enter amount in US dollars (USD)' : 'Enter deposit amount',
        placeholder: paymentType === 'crypto' ? 'Enter amount in dollars' : 'Enter amount',
        limits: paymentType === 'crypto' ? 'From $1 to $1000 USD' : 'From 35 to 100000 som',
        currency: paymentType === 'crypto' ? 'USD' : 'som',
        convertedLabel: '≈ in som',
        next: 'Next',
        back: 'Back'
      },
      ky: {
        title: 'Толтуруу - 3-чү кадам',
        subtitle: 'Сумманы киргизиңиз',
        instruction: paymentType === 'crypto' ? 'Доллар суммасын киргизиңиз (USD)' : 'Толтуруу суммасын киргизиңиз',
        placeholder: paymentType === 'crypto' ? 'Доллар суммасын киргизиңиз' : 'Сумма киргизиңиз',
        limits: paymentType === 'crypto' ? '$1дөн $1000 USD чейин' : '35дөн 100000 сом чейин',
        currency: paymentType === 'crypto' ? 'USD' : 'сом',
        convertedLabel: '≈ сомдо',
        next: 'Кийинки',
        back: 'Артка'
      },
      uz: {
        title: 'To\'ldirish - 3-qadam',
        subtitle: 'Summani kiriting',
        instruction: paymentType === 'crypto' ? 'AQSh dollarida summani kiriting (USD)' : 'To\'ldirish summasini kiriting',
        placeholder: paymentType === 'crypto' ? 'Dollar summasini kiriting' : 'Summa kiriting',
        limits: paymentType === 'crypto' ? '$1 dan $1000 USD gacha' : '35 dan 100000 som gacha',
        currency: paymentType === 'crypto' ? 'USD' : 'som',
        convertedLabel: '≈ somda',
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
                min={paymentType === 'crypto' ? '1' : '35'}
                max={paymentType === 'crypto' ? '1000' : '100000'}
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
              
              {/* Показываем конвертированную сумму для крипты */}
              {paymentType === 'crypto' && amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
                <div className="mt-2 p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                  {loadingRate ? (
                    <p className="text-sm text-white/70">Загрузка курса...</p>
                  ) : convertedAmount ? (
                    <p className="text-sm text-white">
                      {t.convertedLabel}: <span className="font-semibold">{formatKgs(convertedAmount)}</span>
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            
            <QuickAmounts 
              onPick={(value) => setAmount(value.toString())} 
              selected={amount} 
              currency={paymentType === 'crypto' ? 'usd' : 'kgs'}
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

