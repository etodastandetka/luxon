"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
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

export default function DepositStep2() {
  
  useBankUiTheme()
const [userId, setUserId] = useState('')
  const { language } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    
    const bookmaker = localStorage.getItem('deposit_bookmaker')
    const paymentType = localStorage.getItem('deposit_payment_type')
    if (!bookmaker || !paymentType) {
      router.push('/deposit/step0')
      return
    }
    
    
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }
    
    
    const cookieName = `user_id_${bookmaker}`
    const savedUserId = getCookie(cookieName)
    
    
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
    
    if (!userId.trim() || !userId.match(/^\d+$/)) {
      alert('Введите корректный ID (только цифры)')
      return
    }
    
    
    const bookmaker = localStorage.getItem('deposit_bookmaker')
    if (!bookmaker) {
      alert('Ошибка: не выбрано казино')
      router.push('/deposit/step0')
      return
    }
    
    
    const localStorageKey = `deposit_user_id_${bookmaker}`
    localStorage.setItem(localStorageKey, userId)
    
    
    localStorage.setItem('deposit_user_id', userId)
    
    
    const expires = new Date()
    expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000))
    const cookieName = `user_id_${bookmaker}`
    document.cookie = `${cookieName}=${userId}; expires=${expires.toUTCString()}; path=/`
    
    
    router.push('/deposit/step3')
  }

  const handleBack = () => {
    router.push('/deposit/step1')
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
    <main className="space-y-4">
      <FixedHeaderControls />
      <div className="pr-20">
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>
      
      <div className="card space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">{t.subtitle}</h2>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{width: '50%'}}></div>
          </div>
          <p className="text-sm text-white/70 mt-1">Шаг 2 из 3</p>
        </div>
        
        <p className="text-white/80 text-center">{t.instruction}</p>
        
        <div className="space-y-3">
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
            disabled={!userId.trim()}
          >
            {t.next}
          </button>
        </div>
      </div>
    </main>
  )
}