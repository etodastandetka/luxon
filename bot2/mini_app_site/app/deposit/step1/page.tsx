"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import BookmakerGrid from '../../../components/BookmakerGrid'

import { useLanguage } from '../../../components/LanguageContext'
import { getApiBase } from '../../../utils/fetch'


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

export default function DepositStep1() {
  
  useBankUiTheme()
const [bookmaker, setBookmaker] = useState('')
  const [depositsEnabled, setDepositsEnabled] = useState(true)
  const [disabledCasinos, setDisabledCasinos] = useState<string[]>([])
  const { language } = useLanguage()
  const router = useRouter()

  
  

  
  useEffect(() => {
    
    const paymentType = localStorage.getItem('deposit_payment_type')
    if (!paymentType) {
      router.push('/deposit/step0')
      return
    }
    
    async function checkSettings() {
      try {
        const base = getApiBase()
        
        const { getTelegramUserId } = await import('../../../utils/telegram')
        const telegramUserId = getTelegramUserId()
        const url = telegramUserId 
          ? `${base}/api/public/payment-settings?user_id=${telegramUserId}`
          : `${base}/api/public/payment-settings`
        const res = await fetch(url, { 
          cache: 'no-store'
        })
        
        const data = await res.json()
        if (data && data.deposits) {
          setDepositsEnabled(data.deposits.enabled !== false)
        }
        if (data && data.casinos) {
          
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
        
        
        
        setDepositsEnabled(true)
        setDisabledCasinos([])
      }
    }
    
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
    
    
    localStorage.setItem('deposit_bookmaker', bookmaker)
    
    
    router.push('/deposit/step2')
  }

  const handleBack = () => {
    
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