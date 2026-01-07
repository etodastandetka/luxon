"use client"
import { useState, useEffect, useCallback, Suspense } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'
import QuickAmounts from '../../../components/QuickAmounts'
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

function DepositStep2Content() {
  useBankUiTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [minAmount, setMinAmount] = useState(35)
  const [maxAmount, setMaxAmount] = useState(100000)
  const [checkingId, setCheckingId] = useState(false)
  const [idValid, setIdValid] = useState<boolean | null>(null)
  const [bookmaker, setBookmaker] = useState('')

  // Инициализируем bookmaker из searchParams или localStorage
  useEffect(() => {
    const bookmakerFromParams = searchParams.get('bookmaker')
    if (bookmakerFromParams) {
      setBookmaker(bookmakerFromParams)
    } else if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deposit_bookmaker')
      if (saved) {
        setBookmaker(saved)
      }
    }
  }, [searchParams])

  // Проверяем, нужно ли проверять ID для этого казино
  const needsIdCheck = useCallback(() => {
    if (!bookmaker) return false
    const normalized = bookmaker.toLowerCase()
    // Проверка доступна только для казино с Cashdesk API (не mostbet и не 1win)
    return normalized.includes('1xbet') || 
           normalized.includes('melbet') || 
           normalized.includes('winwin') || 
           normalized.includes('888starz')
  }, [bookmaker])

  // Проверка ID игрока - возвращает результат проверки
  const checkPlayerId = useCallback(async (playerId: string): Promise<boolean | null> => {
    if (!needsIdCheck() || !playerId.trim()) {
      setIdValid(null)
      return null
    }

    setCheckingId(true)
    setIdValid(null)

    try {
      const base = getApiBase()
      const { safeFetch } = await import('../../../utils/fetch')
      
      const response = await safeFetch(`${base}/api/public/casino/check-player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookmaker: bookmaker,
          userId: playerId.trim(),
        }),
        timeout: 10000,
        retries: 1,
        retryDelay: 500
      })

      if (!response.ok) {
        console.error('Error checking player ID:', response.status)
        // При ошибке API блокируем - считаем ID неверным
        setIdValid(false)
        return false
      }

      const data = await response.json()
      
      if (data.success && data.data) {
        if (data.data.skip) {
          // Для казино без проверки (mostbet, 1win) считаем валидным
          setIdValid(true)
          return true
        } else {
          const isValid = data.data.exists === true
          setIdValid(isValid)
          return isValid
        }
      } else {
        // Если API вернул неожиданный формат - блокируем
        console.error('Unexpected API response format:', data)
        setIdValid(false)
        return false
      }
    } catch (error) {
      console.error('Error checking player ID:', error)
      // При ошибке блокируем - считаем ID неверным
      setIdValid(false)
      return false
    } finally {
      setCheckingId(false)
    }
  }, [bookmaker, needsIdCheck])

  useEffect(() => {
    // Не делаем редирект, если bookmaker еще загружается
    if (!bookmaker) {
      // Проверяем, есть ли bookmaker в localStorage или searchParams
      const bookmakerFromParams = searchParams.get('bookmaker')
      const saved = typeof window !== 'undefined' ? localStorage.getItem('deposit_bookmaker') : null
      
      // Если нигде нет bookmaker, тогда редиректим
      if (!bookmakerFromParams && !saved) {
        router.push('/deposit/step1')
      }
      return
    }
    
    // Загружаем сохраненный ID если есть
    const cookieName = `user_id_${bookmaker}`
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }
    
    const savedUserId = getCookie(cookieName)
    if (savedUserId) {
      setAccountId(savedUserId)
      // Проверяем сохраненный ID
      checkPlayerId(savedUserId)
    }

    // Загружаем настройки депозитов
    async function loadDepositSettings() {
      try {
        const base = getApiBase()
        const { getTelegramUserId } = await import('../../../utils/telegram')
        const telegramUserId = getTelegramUserId()
        const url = telegramUserId 
          ? `${base}/api/public/payment-settings?user_id=${telegramUserId}`
          : `${base}/api/public/payment-settings`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        
        if (data && data.deposits) {
          if (data.deposits.min_amount !== undefined) {
            setMinAmount(data.deposits.min_amount)
          }
          if (data.deposits.max_amount !== undefined) {
            setMaxAmount(data.deposits.max_amount)
          }
        }
      } catch (error) {
        console.error('Error loading deposit settings:', error)
      }
    }
    loadDepositSettings()
  }, [bookmaker, router, checkPlayerId])

  // Проверяем ID при изменении (с задержкой)
  useEffect(() => {
    if (!accountId.trim() || !needsIdCheck()) {
      setIdValid(null)
      return
    }

    const timer = setTimeout(() => {
      checkPlayerId(accountId)
    }, 1000) // Задержка 1 секунда после последнего ввода

    return () => clearTimeout(timer)
  }, [accountId, needsIdCheck, checkPlayerId])

  const handleContinue = async () => {
    if (!accountId.trim()) {
      alert('Введите ID аккаунта в казино')
      return
    }

    // Для казино с проверкой ID - проверяем перед продолжением
    if (needsIdCheck()) {
      if (checkingId) {
        alert('Пожалуйста, подождите завершения проверки ID')
        return
      }

      // Если еще не проверяли или результат отрицательный - проверяем
      if (idValid === null || idValid === false) {
        const checkResult = await checkPlayerId(accountId)
        
        // Проверяем результат функции (не состояние, которое обновляется асинхронно)
        if (checkResult === false) {
          alert('Игрок с таким ID не найден в казино. Проверьте правильность введенного ID.')
          return
        }
        
        // Если результат null (пропущено) или true (валидно) - продолжаем
        if (checkResult === null) {
          // Для казино без проверки (mostbet, 1win) продолжаем
          // но в этом случае checkResult должен быть true, не null
        }
      }
      
      // Дополнительная проверка состояния после await (на случай если оно обновилось)
      if (idValid === false) {
        alert('Игрок с таким ID не найден в казино. Проверьте правильность введенного ID.')
        return
      }
    }

    const amountNum = parseFloat(amount)
    
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      alert('Введите сумму')
      return
    }

    if (amountNum < minAmount) {
      alert(`Минимальная сумма: ${minAmount} сом`)
      return
    }

    if (amountNum > maxAmount) {
      alert(`Максимальная сумма: ${maxAmount} сом`)
      return
    }

    if (!bookmaker) {
      alert('Ошибка: не выбран казино')
      return
    }

    // Сохраняем ID в cookie
    const cookieName = `user_id_${bookmaker}`
    const setCookie = (name: string, value: string, maxAgeSec = 31536000) => {
      if (typeof document === 'undefined') return
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax`
    }
    setCookie(cookieName, accountId.trim())

    // Предзагружаем QR ссылки перед переходом на step3 для ускорения загрузки
    try {
      const base = getApiBase()
      const { safeFetch } = await import('../../../utils/fetch')
      
      const qrResponse = await safeFetch(`${base}/api/public/generate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountNum,
          playerId: accountId.trim(),
          bank: 'demirbank'
        }),
        timeout: 30000,
        retries: 2,
        retryDelay: 1000
      })

      if (qrResponse.ok) {
        const qrData = await qrResponse.json()
        if (qrData.success && qrData.all_bank_urls) {
          // Сохраняем QR ссылки в sessionStorage для быстрого доступа на step3
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(`deposit_qr_${bookmaker}_${accountId}_${amountNum}`, JSON.stringify(qrData.all_bank_urls))
          }
        }
      }
    } catch (error) {
      console.error('Error preloading QR links:', error)
      // Не блокируем переход, даже если не удалось предзагрузить
    }

    router.push(`/deposit/step3?bookmaker=${bookmaker}&accountId=${encodeURIComponent(accountId.trim())}&amount=${amountNum}`)
  }

  const getBookmakerName = (bm: string) => {
    const names: Record<string, string> = {
      '1xbet': '1xBet',
      '1win': '1WIN',
      'melbet': 'Melbet',
      'mostbet': 'Mostbet',
      'winwin': 'Winwin',
      '888starz': '888starz',
    }
    return names[bm.toLowerCase()] || bm
  }

  const translations = {
    ru: {
      title: 'Пополнение счета',
      accountId: 'ID аккаунта в казино',
      accountIdPlaceholder: 'Введите ID аккаунта',
      amount: 'Сумма (сом)',
      amountPlaceholder: 'Введите сумму',
      next: 'Далее',
      back: 'Назад',
      minAmount: 'Мин.',
      maxAmount: 'Макс.'
    },
    en: {
      title: 'Deposit',
      accountId: 'Casino account ID',
      accountIdPlaceholder: 'Enter account ID',
      amount: 'Amount (KGS)',
      amountPlaceholder: 'Enter amount',
      next: 'Next',
      back: 'Back',
      minAmount: 'Min.',
      maxAmount: 'Max.'
    },
    ky: {
      title: 'Эсепти толтуруу',
      accountId: 'Казинодогу аккаунт ID',
      accountIdPlaceholder: 'ID киргизиңиз',
      amount: 'Сумма (сом)',
      amountPlaceholder: 'Сумманы киргизиңиз',
      next: 'Кийинки',
      back: 'Артка',
      minAmount: 'Минималдык',
      maxAmount: 'Максималдык'
    },
    uz: {
      title: 'Hisobni to\'ldirish',
      accountId: 'Kazino hisob ID',
      accountIdPlaceholder: 'ID kiriting',
      amount: 'Summa (som)',
      amountPlaceholder: 'Summani kiriting',
      next: 'Keyingi',
      back: 'Orqaga',
      minAmount: 'Min.',
      maxAmount: 'Maks.'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <main className="space-y-4">
      <FixedHeaderControls />
      <h1 className="text-xl font-bold">{t.title}</h1>
      
      {/* Информация о казино */}
      {bookmaker && (
        <section className="card space-y-2">
          <div className="label">Казино</div>
          <div className="text-white font-semibold text-lg">{getBookmakerName(bookmaker)}</div>
        </section>
      )}

      {/* ID аккаунта */}
      <section className="card space-y-3">
        <div className="label">{t.accountId}</div>
        <div className="relative">
          <input
            type="text"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value)
              setIdValid(null) // Сбрасываем статус при изменении
            }}
            placeholder={t.accountIdPlaceholder}
            className="input w-full"
            disabled={checkingId}
          />
          {checkingId && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">
              Проверка...
            </div>
          )}
          {!checkingId && idValid === true && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400">
              ✓
            </div>
          )}
          {!checkingId && idValid === false && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
              ✗
            </div>
          )}
        </div>
        {idValid === false && (
          <div className="text-red-400 text-xs">
            Игрок с таким ID не найден в казино
          </div>
        )}
        {idValid === true && needsIdCheck() && (
          <div className="text-green-400 text-xs">
            ID подтвержден
          </div>
        )}
      </section>

      {/* Ввод суммы */}
      <section className="card space-y-4">
        <div>
          <div className="label">{t.amount}</div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t.amountPlaceholder}
            min={minAmount}
            max={maxAmount}
            className="input w-full"
          />
          <div className="flex justify-between text-xs text-white/60 mt-2">
            <span>{t.minAmount}: {minAmount} сом</span>
            <span>{t.maxAmount}: {maxAmount.toLocaleString()} сом</span>
          </div>
        </div>

        {/* Быстрый выбор суммы */}
        <QuickAmounts 
          onPick={setAmount}
          selected={amount}
          currency="kgs"
        />
      </section>

      <div className="flex gap-3">
        <button 
          className="btn btn-ghost flex-1" 
          onClick={() => router.back()}
        >
          {t.back}
        </button>
        <button 
          className="btn btn-primary flex-1" 
          onClick={handleContinue}
          disabled={
            !accountId.trim() || 
            !amount || 
            parseFloat(amount) < minAmount || 
            parseFloat(amount) > maxAmount ||
            checkingId ||
            (needsIdCheck() && idValid === false)
          }
        >
          {checkingId ? 'Проверка...' : t.next}
        </button>
      </div>
    </main>
  )
}

export default function DepositStep2() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <FixedHeaderControls />
        <div className="text-white">Загрузка...</div>
      </div>
    }>
      <DepositStep2Content />
    </Suspense>
  )
}
