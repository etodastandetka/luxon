"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import QuickAmounts from '../../../components/QuickAmounts'
import { useLanguage } from '../../../components/LanguageContext'
import { validateCryptoAmount, formatUsd, formatKgs, usdToKgs, clearExchangeRateCache } from '../../../utils/crypto-pay'


declare global {
  interface Window {
    __wbBankUiRefCount?: number
  }
}

const __WB_BANK_UI_CSS = `:root{
  --wb-bg0:#07150d;
  --wb-bg1:#0b2014;
  --wb-line:rgba(255,255,255,.14);
  --wb-glass:rgba(255,255,255,.08);
  --wb-glass2:rgba(255,255,255,.12);
  --wb-shadow:0 16px 42px rgba(0,0,0,.38);
  --wb-shadow2:0 10px 24px rgba(0,0,0,.24);
  --wb-r:20px;
  --wb-a1:#52d16a;
  --wb-a2:#9ed1a8;
}
body{
  background:
    radial-gradient(900px 700px at 20% -10%, rgba(82,209,106,.20), transparent 60%),
    radial-gradient(900px 700px at 90% 0%, rgba(78,171,63,.16), transparent 62%),
    radial-gradient(900px 700px at 50% 110%, rgba(18,89,50,.34), transparent 58%),
    linear-gradient(180deg,var(--wb-bg0),var(--wb-bg1));
}
main{
  max-width:520px;
  margin:0 auto;
  padding:10px 14px 120px;
}
h1,h2{
  letter-spacing:.2px;
}
.card{
  border-radius:var(--wb-r);
  border:1px solid var(--wb-line);
  background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.06));
  box-shadow:var(--wb-shadow2);
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
}
.card:not([class*="p-"]){
  padding:14px;
}
.label{
  color:rgba(255,255,255,.74);
  font-size:12px;
}
.input{
  border-radius:16px;
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.16);
  color:rgba(255,255,255,.92);
}
.input:focus{
  outline:none;
  box-shadow:0 0 0 4px rgba(82,209,106,.14);
  border-color:rgba(82,209,106,.42);
}
.btn{
  border-radius:16px;
  min-height:48px;
  transition:transform 140ms ease, filter 140ms ease, background 140ms ease;
  will-change:transform;
}
.btn:active{
  transform:scale(.986);
}
.btn.btn-primary{
  background:linear-gradient(135deg, rgba(78,171,63,.92), rgba(18,89,50,.92));
  border:1px solid rgba(255,255,255,.18);
  box-shadow:var(--wb-shadow);
}
.btn.btn-primary:disabled{
  filter:saturate(.6) brightness(.9);
}
.btn.btn-ghost{
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.12);
}
.wb-top{
  padding:0 6px;
}
.wb-title{
  color:rgba(255,255,255,.96);
}
.wb-sub{
  color:rgba(255,255,255,.66);
  font-size:13px;
}
.wb-progress{
  width:100%;
  height:8px;
  background:rgba(255,255,255,.12);
  border-radius:999px;
  overflow:hidden;
}
.wb-progress > div{
  height:100%;
  background:linear-gradient(90deg,var(--wb-a1),var(--wb-a2));
  border-radius:999px;
  box-shadow:0 10px 24px rgba(82,209,106,.18);
}
.wb-sticky{
  position:sticky;
  bottom:10px;
  z-index:5;
}
.wb-bar{
  display:flex;
  gap:10px;
  padding:10px;
  border-radius:18px;
  border:1px solid var(--wb-line);
  background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.06));
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
  box-shadow:var(--wb-shadow2);
}
@media (prefers-reduced-motion: reduce){
  .btn{transition:none}
}`

function useBankUiTheme() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.__wbBankUiRefCount = (window.__wbBankUiRefCount || 0) + 1
    const id = 'wb-bank-ui-v1'
    let el = document.getElementById(id) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = id
      el.textContent = __WB_BANK_UI_CSS
      document.head.appendChild(el)
    }
    return () => {
      window.__wbBankUiRefCount = Math.max(0, (window.__wbBankUiRefCount || 1) - 1)
      if ((window.__wbBankUiRefCount || 0) === 0) {
        const cur = document.getElementById(id)
        if (cur) cur.remove()
      }
    }
  }, [])
}

export default function DepositStep3() {
  
  useBankUiTheme()
const [amount, setAmount] = useState('')
  const [paymentType, setPaymentType] = useState<'bank' | 'crypto'>('bank')
  const [convertedAmount, setConvertedAmount] = useState<string>('')
  const [bookmaker, setBookmaker] = useState<string>('')
  const { language } = useLanguage()
  const router = useRouter()

  
  const getMinDeposit = () => {
    const normalizedBookmaker = bookmaker.toLowerCase()
    if (normalizedBookmaker.includes('1win') || normalizedBookmaker === '1win') {
      return 100 
    }
    return 35 
  }

  useEffect(() => {
    
    const savedBookmaker = localStorage.getItem('deposit_bookmaker')
    const userId = localStorage.getItem('deposit_user_id')
    const savedPaymentType = localStorage.getItem('deposit_payment_type') as 'bank' | 'crypto' || 'bank'
    
    if (!savedBookmaker || !userId || !savedPaymentType) {
      router.push('/deposit/step0')
      return
    }
    
    setBookmaker(savedBookmaker)
    setPaymentType(savedPaymentType)
    
    
    if (savedPaymentType === 'crypto') {
      clearExchangeRateCache()
    }
  }, [router])

  
  useEffect(() => {
    const updateConvertedAmount = async () => {
      if (paymentType === 'crypto' && amount) {
        const numAmount = parseFloat(amount)
        if (!isNaN(numAmount) && numAmount > 0) {
          try {
            const amountInKgs = await usdToKgs(numAmount)
            setConvertedAmount(amountInKgs.toFixed(2))
          } catch (error: any) {
            setConvertedAmount('Ошибка загрузки курса')
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

  const handleNext = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    const numAmount = parseFloat(amount)
    if (!amount.trim() || isNaN(numAmount) || numAmount <= 0) {
      alert(paymentType === 'crypto' ? 'Введите корректную сумму в долларах' : 'Введите корректную сумму')
      return
    }
    
    try {
      if (paymentType === 'crypto') {
        
        
        const validation = validateCryptoAmount(numAmount)
        if (!validation.valid) {
          alert(validation.error || 'Неверная сумма')
          return
        }
        
        try {
          
          const amountInKgs = await usdToKgs(numAmount)
          
          
          localStorage.setItem('deposit_amount_usd', numAmount.toString())
          
          localStorage.setItem('deposit_amount', amountInKgs.toString())
        } catch (error: any) {
          
          alert(error.message || 'Ошибка получения курса валют. Пожалуйста, попробуйте позже.')
          return
        }
      } else {
        
        const minDeposit = getMinDeposit()
        if (numAmount < minDeposit || numAmount > 100000) {
          alert(`Сумма должна быть от ${minDeposit} до 100000 сом`)
          return
        }
        
        
        const randomKopecks = Math.floor(Math.random() * 99) + 1
        const amountWithKopecks = numAmount + (randomKopecks / 100)
        
        
        localStorage.setItem('deposit_amount', amountWithKopecks.toString())
      }
      
      
      router.push('/deposit/step4')
    } catch (error) {
      
    }
  }

  const handleBack = () => {
    router.push('/deposit/step2')
  }

  const getTranslations = () => {
    const minDeposit = getMinDeposit()
    const base = {
      ru: {
        title: 'Пополнение - Шаг 3',
        subtitle: 'Введите сумму',
        instruction: paymentType === 'crypto' ? 'Введите сумму в долларах (USD)' : 'Введите сумму пополнения',
        placeholder: paymentType === 'crypto' ? 'Введите сумму в долларах' : 'Введите сумму',
        limits: paymentType === 'crypto' ? 'От $1 до $1000 USD' : `От ${minDeposit} до 100000 сом`,
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
        limits: paymentType === 'crypto' ? 'From $1 to $1000 USD' : `From ${minDeposit} to 100000 som`,
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
        limits: paymentType === 'crypto' ? '$1дөн $1000 USD чейин' : `${minDeposit}дөн 100000 сом чейин`,
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
        limits: paymentType === 'crypto' ? '$1 dan $1000 USD gacha' : `${minDeposit} dan 100000 som gacha`,
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
    <main className="space-y-4">
      <FixedHeaderControls />
      <div className="pr-24">
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>
      
      <div className="card space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">{t.subtitle}</h2>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{width: '75%'}}></div>
          </div>
          <p className="text-sm text-white/70 mt-1">Шаг 3 из 3</p>
        </div>
        
        <p className="text-white/80 text-center">{t.instruction}</p>
        
        <div className="space-y-3">
          <div>
            <label className="label">{t.subtitle}</label>
            <input 
              className="input w-full"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t.placeholder}
              min={paymentType === 'crypto' ? '1' : getMinDeposit().toString()}
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
            
            
            {paymentType === 'crypto' && amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && convertedAmount && (
              <div className="mt-2 p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                <p className="text-sm text-white">
                  {t.convertedLabel}: <span className="font-semibold">{formatKgs(convertedAmount)}</span>
                </p>
              </div>
            )}
          </div>
          
          <QuickAmounts 
            onPick={(value) => setAmount(value.toString())} 
            selected={amount} 
            currency={paymentType === 'crypto' ? 'usd' : 'kgs'}
          />
        </div>
        
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
            disabled={!amount.trim()}
          >
            {t.next}
          </button>
        </div>
      </div>
    </main>
  )
}
