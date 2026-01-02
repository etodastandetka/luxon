"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FixedHeaderControls from '../../../components/FixedHeaderControls'

import { useLanguage } from '../../../components/LanguageContext'


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

export default function DepositStep0() {
  
  useBankUiTheme()
const [paymentType, setPaymentType] = useState<'bank' | 'crypto' | ''>('bank')
  
  const router = useRouter()
  const { language } = useLanguage()

  
  

  const translations = {
    ru: {
      title: 'Пополнение счета',
      subtitle: 'Выберите способ оплаты',
      bank: 'Банковский перевод',
      bankDesc: 'Оплата через QR код',
      crypto: 'Криптовалюта',
      cryptoDesc: 'Оплата через Crypto Bot',
      next: 'Далее',
      back: 'Назад',
      howToDeposit: 'Как пополнить',
      watchVideo: '📹 Посмотреть видео-инструкцию'
    },
    en: {
      title: 'Deposit',
      subtitle: 'Select payment method',
      bank: 'Bank Transfer',
      bankDesc: 'Pay via QR code',
      crypto: 'Cryptocurrency',
      cryptoDesc: 'Pay via Crypto Bot',
      next: 'Next',
      back: 'Back',
      howToDeposit: 'How to deposit',
      watchVideo: '📹 Watch video tutorial'
    },
    ky: {
      title: 'Капкалды кошуу',
      subtitle: 'Төлөм ыкмасын тандаңыз',
      bank: 'Банктык которуу',
      bankDesc: 'QR код аркылуу төлөө',
      crypto: 'Криптовалюта',
      cryptoDesc: 'Crypto Bot аркылуу төлөө',
      next: 'Кийинки',
      back: 'Артка',
      howToDeposit: 'Капкалды кантип кошуу керек',
      watchVideo: '📹 Видео көрсөтмөнү көрүү'
    },
    uz: {
      title: 'Hisobni to\'ldirish',
      subtitle: 'To\'lov usulini tanlang',
      bank: 'Bank o\'tkazmasi',
      bankDesc: 'QR kod orqali to\'lash',
      crypto: 'Kriptovalyuta',
      cryptoDesc: 'Crypto Bot orqali to\'lash',
      next: 'Keyingi',
      back: 'Orqaga',
      howToDeposit: 'Qanday to\'ldirish kerak',
      watchVideo: '📹 Video ko\'rsatmani ko\'rish'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // Всегда используем банковский перевод
    localStorage.setItem('deposit_payment_type', 'bank')
    
    router.push('/deposit/step1')
  }

  const handleBack = () => {
    router.push('/')
  }

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
              <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{width: '0%'}}></div>
            </div>
            <p className="text-sm text-white/70 mt-1">Шаг 0 из 4</p>
          </div>
          
          
          <div className="grid grid-cols-1 gap-3">
            
            <button
              onClick={() => setPaymentType('bank')}
              className={`p-4 rounded-lg border-2 transition-all ${
                paymentType === 'bank'
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white">{t.bank}</div>
                  <div className="text-sm text-white/70">{t.bankDesc}</div>
                </div>
                {paymentType === 'bank' && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>

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
          >
            {t.next}
          </button>
        </div>
      </div>

    </main>
  )
}
