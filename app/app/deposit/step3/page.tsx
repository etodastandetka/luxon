"use client"
import { useState, useEffect, Suspense } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'
import BankButtons from '../../../components/BankButtons'
import { getApiBase, safeFetch } from '../../../utils/fetch'
import { getTelegramUserId, getTelegramUser } from '../../../utils/telegram'
import { DEPOSIT_CONFIG } from '../../../config/app'

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

function DepositStep3Content() {
  useBankUiTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const [selectedBank, setSelectedBank] = useState('')
  const [loading, setLoading] = useState(false)
  const [paymentUrls, setPaymentUrls] = useState<Record<string, string>>({})
  const [enabledBanks, setEnabledBanks] = useState<string[]>([])
  const [timeLeft, setTimeLeft] = useState(DEPOSIT_CONFIG.TIMEOUT_SECONDS)
  const [timerStarted, setTimerStarted] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [receiptUploaded, setReceiptUploaded] = useState(false)
  const [requestId, setRequestId] = useState<number | null>(null)
  const bookmaker = searchParams.get('bookmaker') || (typeof window !== 'undefined' ? localStorage.getItem('deposit_bookmaker') : '') || ''
  const accountId = searchParams.get('accountId') || ''
  const amount = searchParams.get('amount') || ''

  // Инициализация и восстановление таймера из localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const TIMER_DURATION = DEPOSIT_CONFIG.TIMEOUT_SECONDS
    const TIMER_KEY = `deposit_timer_${bookmaker}_${accountId}_${amount}`
    
    // Проверяем, есть ли сохраненный таймер
    const savedTimerStart = localStorage.getItem(TIMER_KEY)
    const now = Date.now()
    
    if (savedTimerStart) {
      const elapsed = Math.floor((now - parseInt(savedTimerStart)) / 1000)
      const remaining = Math.max(0, TIMER_DURATION - elapsed)
      
      if (remaining > 0) {
        setTimeLeft(remaining)
        setTimerStarted(true)
      } else {
        // Таймер истек, удаляем из localStorage
        localStorage.removeItem(TIMER_KEY)
        setTimeLeft(0)
      }
    } else {
      // Создаем новый таймер
      localStorage.setItem(TIMER_KEY, now.toString())
      setTimeLeft(TIMER_DURATION)
      setTimerStarted(true)
    }
    
    // Очистка при размонтировании (если пользователь уходит со страницы)
    return () => {
      // Не удаляем таймер при размонтировании, чтобы он сохранялся при обновлении
    }
  }, [bookmaker, accountId, amount])

  // Таймер обратного отсчета
  useEffect(() => {
    if (!timerStarted || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          const TIMER_KEY = `deposit_timer_${bookmaker}_${accountId}_${amount}`
          if (typeof window !== 'undefined') {
            localStorage.removeItem(TIMER_KEY)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, timerStarted, bookmaker, accountId, amount])

  useEffect(() => {
    if (!bookmaker || !accountId || !amount) {
      router.push('/deposit/step1')
      return
    }

    // Загружаем фото чека, если заявка уже создана
    const requestIdFromUrl = searchParams.get('requestId')
    if (requestIdFromUrl && !requestId) {
      // Загружаем фото только если requestId есть в URL, но еще не загружен в state
      fetch(`${getApiBase()}/api/requests/${requestIdFromUrl}/photo`)
        .then(response => {
          if (response.ok) {
            return response.json()
          }
          return null
        })
        .then(data => {
          if (data && data.success && data.data && data.data.photoFileUrl) {
            setReceiptPreview(data.data.photoFileUrl)
            setReceiptUploaded(true)
            setRequestId(parseInt(requestIdFromUrl))
            console.log('✅ Фото чека загружено из API')
          }
        })
        .catch(error => {
          console.error('Ошибка загрузки фото чека:', error)
        })
    }

    // Загружаем настройки банков и QR ссылки
    async function loadBankSettingsAndQR() {
      try {
        const base = getApiBase()
        const telegramUserId = getTelegramUserId()
        const amountNum = parseFloat(amount)
        
        // 1. Пробуем загрузить предзагруженные QR ссылки из sessionStorage
        const storageKey = `deposit_qr_${bookmaker}_${accountId}_${amountNum}`
        const cachedQr = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null
        
        if (cachedQr) {
          try {
            const cachedUrls = JSON.parse(cachedQr)
            setPaymentUrls(cachedUrls)
            console.log('✅ QR ссылки загружены из кэша:', Object.keys(cachedUrls))
            // Удаляем из кэша после использования
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem(storageKey)
            }
          } catch (e) {
            console.error('Error parsing cached QR:', e)
          }
        }

        // 2. Загружаем настройки банков (параллельно)
        const settingsUrl = telegramUserId 
          ? `${base}/api/public/payment-settings?user_id=${telegramUserId}`
          : `${base}/api/public/payment-settings`
        
        const [settingsRes, qrResponse] = await Promise.all([
          fetch(settingsUrl, { cache: 'no-store' }),
          // Если QR ссылки не были в кэше, загружаем их
          cachedQr ? Promise.resolve(null) : safeFetch(`${base}/api/public/generate-qr`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: amountNum,
              playerId: accountId,
              bank: 'demirbank'
            }),
            timeout: 30000,
            retries: 2,
            retryDelay: 1000
          })
        ])
        
        // Обрабатываем настройки банков
        const settingsData = await settingsRes.json()
        if (settingsData && settingsData.deposits && settingsData.deposits.banks && Array.isArray(settingsData.deposits.banks)) {
          const bankCodeMapping: Record<string, string> = {
            'DemirBank': 'demirbank',
            'demirbank': 'demirbank',
            'O! bank': 'omoney',
            'O!bank': 'omoney',
            'omoney': 'omoney',
            'odengi': 'omoney',
            'Balance.kg': 'balance',
            'balance': 'balance',
            'Bakai': 'bakai',
            'bakai': 'bakai',
            'MegaPay': 'megapay',
            'megapay': 'megapay',
            'MBank': 'mbank',
            'mbank': 'mbank'
          }
          const mappedBanks: string[] = []
          for (const b of settingsData.deposits.banks) {
            const code = b.code || b
            const mapped = bankCodeMapping[code] || code.toLowerCase()
            if (mapped) mappedBanks.push(mapped)
          }
          setEnabledBanks(mappedBanks)
        }

        // Обрабатываем QR ссылки (если не были в кэше)
        if (qrResponse && qrResponse.ok) {
          const qrData = await qrResponse.json()
          if (qrData.success && qrData.all_bank_urls) {
            setPaymentUrls(qrData.all_bank_urls)
            console.log('✅ QR ссылки получены из API:', Object.keys(qrData.all_bank_urls))
          }
        }
      } catch (error) {
        console.error('Error loading bank settings or QR:', error)
      }
    }
    loadBankSettingsAndQR()
  }, [bookmaker, accountId, amount, router])

  const handleBankSelect = async (bankCode: string) => {
    setSelectedBank(bankCode)
    setLoading(true)

    try {
      // Ищем ссылку для выбранного банка
      const bankUrlMap: Record<string, string[]> = {
        'demirbank': ['DemirBank', 'demirbank', 'Demir'],
        'omoney': ['O!Money', 'omoney', 'O!Money', 'Odengi'],
        'balance': ['Balance.kg', 'balance', 'Balance'],
        'bakai': ['Bakai', 'bakai'],
        'megapay': ['MegaPay', 'megapay'],
        'mbank': ['MBank', 'mbank', 'MBank']
      }

      let bankUrl: string | undefined = undefined
      const variants = bankUrlMap[bankCode] || [bankCode]
      
      // Пробуем найти ссылку по вариантам названий
      for (const variant of variants) {
        if (paymentUrls[variant]) {
          bankUrl = paymentUrls[variant]
          break
        }
      }

      // Если не нашли, пробуем напрямую по коду
      if (!bankUrl && paymentUrls[bankCode]) {
        bankUrl = paymentUrls[bankCode]
      }

      if (!bankUrl) {
        alert('Ссылка для оплаты не найдена. Попробуйте обновить страницу.')
        setLoading(false)
        return
      }

      // Открываем ссылку на оплату
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        (window as any).Telegram.WebApp.openLink(bankUrl)
      } else {
        window.open(bankUrl, '_blank')
      }

      // Пытаемся создать заявку (необязательно, если нет userId)
      const userId = getTelegramUserId()
      if (userId) {
        try {
          const base = getApiBase()
          const amountNum = parseFloat(amount)
          
          // Получаем данные пользователя из Telegram
          const telegramUser = getTelegramUser()

          const response = await safeFetch(`${base}/api/payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'deposit',
              bookmaker: bookmaker,
              userId: userId,
              account_id: accountId,
              amount: amountNum,
              payment_method: bankCode,
              telegram_username: telegramUser?.username || null,
              telegram_first_name: telegramUser?.first_name || null,
              telegram_last_name: telegramUser?.last_name || null,
            }),
            timeout: 30000,
            retries: 2,
            retryDelay: 1000
          })

          if (!response.ok) {
            const errorText = await response.text()
            let errorData: any = null
            try {
              errorData = JSON.parse(errorText)
            } catch (e) {}

            const errorMessage = errorData?.error || errorData?.message || `Ошибка сервера: ${response.status}`
            console.error('Ошибка создания заявки:', errorMessage)
          } else {
            const data = await response.json()
            if (!data.success) {
              console.error('Ошибка создания заявки:', data.error)
            } else {
              console.log('✅ Заявка создана успешно')
              // Сохраняем ID заявки для загрузки чека
              if (data.data && data.data.id) {
                setRequestId(data.data.id)
              }
              
              // Если сумма была скорректирована, перегенерируем QR-код с новой суммой
              if (data.data && data.data.amount && data.data.originalAmount) {
                const adjustedAmount = data.data.amount
                const originalAmount = data.data.originalAmount
                
                if (Math.abs(adjustedAmount - originalAmount) > 0.001) {
                  console.log(`💰 Сумма была скорректирована: ${originalAmount} → ${adjustedAmount}, перегенерируем QR-код`)
                  
                  try {
                    const base = getApiBase()
                    const qrResponse = await safeFetch(`${base}/api/public/generate-qr`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        amount: adjustedAmount,
                        playerId: accountId,
                        bank: selectedBank || 'demirbank'
                      }),
                      timeout: 30000,
                      retries: 2,
                      retryDelay: 1000
                    })
                    
                    if (qrResponse.ok) {
                      const qrData = await qrResponse.json()
                      if (qrData.success && qrData.all_bank_urls) {
                        setPaymentUrls(qrData.all_bank_urls)
                        console.log('✅ QR-код обновлен с скорректированной суммой')
                      }
                    }
                  } catch (qrError) {
                    console.error('Ошибка при перегенерации QR-кода:', qrError)
                    // Не критично, продолжаем с исходным QR
                  }
                }
              }
            }
          }
        } catch (error: any) {
          console.error('Error creating deposit:', error)
        }
      } else {
        console.log('⚠️ Telegram user ID не найден, заявка не создана (ссылка открыта)')
      }
    } catch (error: any) {
      console.error('Error opening bank link:', error)
      alert('Ошибка при открытии ссылки на оплату')
    } finally {
      setLoading(false)
    }
  }

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Проверка размера файла (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Размер файла не должен превышать 10MB')
      return
    }

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение (PNG, JPG)')
      return
    }

    setReceiptFile(file)

    // Создаем превью
    if (typeof window !== 'undefined' && typeof (window as any).FileReader !== 'undefined') {
      const reader = new (window as any).FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const base64 = e.target?.result as string
        setReceiptPreview(base64)
      }
      reader.onerror = () => {
        alert('Ошибка при загрузке фото. Попробуйте еще раз.')
      }
      reader.readAsDataURL(file)
    }

    // Если есть requestId, сразу загружаем
    if (requestId) {
      await uploadReceipt(file)
    }
  }

  const uploadReceipt = async (file: File) => {
    if (!requestId) return

    setUploadingReceipt(true)
    try {
      const base = getApiBase()
      const formData = new FormData()
      formData.append('receipt', file)
      formData.append('requestId', requestId.toString())

      const response = await fetch(`${base}/api/requests/${requestId}/receipt`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Чек загружен успешно')
        // Показываем успешное сообщение (используем message из ответа или дефолтное)
        const successMessage = data.message || 'Чек успешно загружен'
        alert(successMessage)
        // Обновляем состояние, чтобы показать, что чек загружен
        setReceiptUploaded(true)
      } else {
        // Ошибка: используем только error, не message (message может быть успешным сообщением)
        const errorMessage = data.error || `Ошибка сервера: ${response.status}`
        alert(`Ошибка загрузки чека: ${errorMessage}`)
      }
    } catch (error: any) {
      console.error('Error uploading receipt:', error)
      alert('Ошибка при загрузке чека. Попробуйте еще раз.')
    } finally {
      setUploadingReceipt(false)
    }
  }

  const handlePaymentConfirmed = async () => {
    if (!selectedBank) {
      alert('Пожалуйста, сначала выберите банк для оплаты')
      return
    }

    setLoading(true)
    try {
      const userId = getTelegramUserId()
      if (!userId) {
        alert('Ошибка: не удалось получить ID пользователя')
        setLoading(false)
        return
      }

      const base = getApiBase()
      const amountNum = parseFloat(amount)

      // Получаем данные пользователя из Telegram
      const telegramUser = getTelegramUser()

      // Если заявка еще не создана, создаем ее
      if (!requestId) {
        const response = await safeFetch(`${base}/api/payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'deposit',
            bookmaker: bookmaker,
            userId: userId,
            account_id: accountId,
            amount: amountNum,
            payment_method: selectedBank,
            telegram_username: telegramUser?.username || null,
            telegram_first_name: telegramUser?.first_name || null,
            telegram_last_name: telegramUser?.last_name || null,
          }),
          timeout: 30000,
          retries: 2,
          retryDelay: 1000
        })

        if (!response.ok) {
          const errorText = await response.text()
          let errorData: any = null
          try {
            errorData = JSON.parse(errorText)
          } catch (e) {}

          const errorMessage = errorData?.error || errorData?.message || `Ошибка сервера: ${response.status}`
          alert(`${t.paymentConfirmError}: ${errorMessage}`)
          setLoading(false)
          return
        }

        const data = await response.json()
        if (!data.success) {
          alert(`${t.paymentConfirmError}: ${data.error}`)
          setLoading(false)
          return
        }

        if (data.data && data.data.id) {
          setRequestId(data.data.id)
          
          // Если сумма была скорректирована, перегенерируем QR-код с новой суммой
          if (data.data.amount && data.data.originalAmount) {
            const adjustedAmount = parseFloat(data.data.amount)
            const originalAmount = parseFloat(data.data.originalAmount)
            
            if (Math.abs(adjustedAmount - originalAmount) > 0.001) {
              console.log(`💰 Сумма была скорректирована: ${originalAmount} → ${adjustedAmount}, перегенерируем QR-код`)
              
              // Обновляем amount в URL (state обновится автоматически через searchParams)
              const newAmount = adjustedAmount.toFixed(2)
              router.replace(`/deposit/step3?bookmaker=${bookmaker}&accountId=${encodeURIComponent(accountId.trim())}&amount=${newAmount}&requestId=${data.data.id}`)
              
              try {
                const qrResponse = await safeFetch(`${base}/api/public/generate-qr`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    amount: adjustedAmount,
                    playerId: accountId,
                    bank: selectedBank || 'demirbank'
                  }),
                  timeout: 30000,
                  retries: 2,
                  retryDelay: 1000
                })
                
                if (qrResponse.ok) {
                  const qrData = await qrResponse.json()
                  if (qrData.success && qrData.all_bank_urls) {
                    setPaymentUrls(qrData.all_bank_urls)
                    console.log('✅ QR-код обновлен с скорректированной суммой')
                  }
                }
              } catch (qrError) {
                console.error('Ошибка при перегенерации QR-кода:', qrError)
                // Не критично, продолжаем с исходным QR
              }
            }
          }
          
          // Если есть загруженный чек, загружаем его
          if (receiptFile) {
            await uploadReceipt(receiptFile)
          }
        }
      } else {
        // Если заявка уже создана, просто подтверждаем оплату
        // Заявка уже в статусе pending, админ увидит ее в админке
      }

      alert(t.paymentConfirmed)
      
      // Переходим на главную страницу
      router.push('/')
    } catch (error: any) {
      console.error('Error confirming payment:', error)
      alert(`${t.paymentConfirmError}: ${error.message || 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
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
      title: 'Оплата',
      subtitle: 'Оплатите заявку',
      timeToPay: 'Время на оплату',
      requestDetails: 'Детали заявки',
      bookmaker: 'Букмекер:',
      playerId: 'ID игрока:',
      amountToPay: 'Сумма к оплате:',
      selectBank: 'Выберите банк для оплаты',
      back: 'Назад',
      loading: 'Создание заявки...',
      uploadReceipt: 'Загрузить чек об оплате',
      receiptUploaded: 'Чек загружен',
      uploadReceiptDesc: 'Загрузите скриншот или фото чека об оплате',
      receiptFileTypes: 'PNG, JPG до 10MB',
      uploading: 'Загрузка...',
      paidButton: 'Я оплатил',
      paymentConfirmed: 'Заявка отправлена в обработку',
      paymentConfirmError: 'Ошибка при отправке заявки',
      timeExpired: 'Ваше время истекло',
      timeExpiredDesc: 'Время на оплату заявки истекло. Пожалуйста, создайте новую заявку.',
      goToMainMenu: 'В главное меню'
    },
    en: {
      title: 'Payment',
      subtitle: 'Pay the application',
      timeToPay: 'Time to pay',
      requestDetails: 'Application details',
      bookmaker: 'Bookmaker:',
      playerId: 'Player ID:',
      amountToPay: 'Amount to pay:',
      selectBank: 'Select bank for payment',
      back: 'Back',
      loading: 'Creating request...',
      uploadReceipt: 'Upload payment receipt',
      receiptUploaded: 'Receipt uploaded',
      uploadReceiptDesc: 'Upload a screenshot or photo of the payment receipt',
      receiptFileTypes: 'PNG, JPG up to 10MB',
      uploading: 'Uploading...',
      paidButton: 'I paid',
      paymentConfirmed: 'Request submitted for processing',
      paymentConfirmError: 'Error submitting request',
      timeExpired: 'Your time has expired',
      timeExpiredDesc: 'The time to pay the request has expired. Please create a new request.',
      goToMainMenu: 'Go to main menu'
    },
    ky: {
      title: 'Төлөм',
      subtitle: 'Өтүнүчтү төлөңүз',
      timeToPay: 'Төлөм убактысы',
      requestDetails: 'Өтүнүч деталдары',
      bookmaker: 'Букмекер:',
      playerId: 'Оюнчу ID:',
      amountToPay: 'Төлөм суммасы:',
      selectBank: 'Төлөм үчүн банкты тандаңыз',
      back: 'Артка',
      loading: 'Өтүнүч түзүлүүдө...',
      uploadReceipt: 'Төлөм чегин жүктөө',
      receiptUploaded: 'Чек жүктөлдү',
      uploadReceiptDesc: 'Төлөм чегинин скриншотун же сүрөтүн жүктөңүз',
      receiptFileTypes: 'PNG, JPG 10MB чейин',
      uploading: 'Жүктөлүүдө...',
      paidButton: 'Мен төлөдүм',
      paymentConfirmed: 'Өтүнүч иштетүүгө жөнөтүлдү',
      paymentConfirmError: 'Өтүнүчтү жөнөтүүдө ката',
      timeExpired: 'Сиздин убактыңыз бүттү',
      timeExpiredDesc: 'Төлөм убактысы бүттү. Сураныч, жаңы өтүнүч түзүңүз.',
      goToMainMenu: 'Башкы менюга'
    },
    uz: {
      title: 'To\'lov',
      subtitle: 'Ariza to\'lovini to\'lang',
      timeToPay: 'To\'lov vaqti',
      requestDetails: 'Ariza tafsilotlari',
      bookmaker: 'Bukmeker:',
      playerId: 'O\'yinchi ID:',
      amountToPay: 'To\'lov summasi:',
      selectBank: 'To\'lov uchun bankni tanlang',
      back: 'Orqaga',
      loading: 'So\'rov yaratilmoqda...',
      uploadReceipt: 'To\'lov kvitansiyasini yuklash',
      receiptUploaded: 'Kvitansiya yuklandi',
      uploadReceiptDesc: 'To\'lov kvitansiyasining skrinshotini yoki rasmini yuklang',
      receiptFileTypes: 'PNG, JPG 10MB gacha',
      uploading: 'Yuklanmoqda...',
      paidButton: 'To\'lov qildim',
      paymentConfirmed: 'So\'rov qayta ishlash uchun yuborildi',
      paymentConfirmError: 'So\'rovni yuborishda xatolik',
      timeExpired: 'Vaqtingiz tugadi',
      timeExpiredDesc: 'To\'lov vaqti tugadi. Iltimos, yangi so\'rov yarating.',
      goToMainMenu: 'Bosh menyuga'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  // Форматирование времени MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Вычисление прогресса таймера (0-100%)
  const timerProgress = (DEPOSIT_CONFIG.TIMEOUT_SECONDS - timeLeft) / DEPOSIT_CONFIG.TIMEOUT_SECONDS * 100

  // Если время истекло, показываем страницу истечения времени
  if (timeLeft <= 0) {
    return (
      <main className="space-y-4">
        <FixedHeaderControls />
        
        {/* Страница истечения времени */}
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <div className="card space-y-4 p-8 text-center max-w-md">
            {/* Иконка истечения времени */}
            <div className="w-24 h-24 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            {/* Заголовок */}
            <h2 className="text-2xl font-bold text-white">{t.timeExpired}</h2>
            
            {/* Описание */}
            <p className="text-white/70 text-sm leading-relaxed">
              {t.timeExpiredDesc}
            </p>
            
            {/* Кнопка в главное меню */}
            <button 
              className="btn btn-primary w-full mt-6" 
              onClick={() => router.push('/')}
            >
              {t.goToMainMenu}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-4">
      <FixedHeaderControls />
      
      {/* Заголовок и подзаголовок */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-white">{t.title}</h1>
        <p className="text-white/80 text-sm">{t.subtitle}</p>
      </div>

      {/* Таймер */}
      <section className="card space-y-3 p-6">
        <div className="text-center">
          <div className="relative inline-block">
            {/* Круглый прогресс-бар */}
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="transform -rotate-90 w-32 h-32" viewBox="0 0 120 120">
                {/* Фоновый круг */}
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="8"
                  fill="none"
                />
                {/* Прогресс круг */}
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  stroke="url(#timerGradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - timerProgress / 100)}`}
                  className="transition-all duration-1000 ease-linear"
                />
                <defs>
                  <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#52d16a" />
                    <stop offset="100%" stopColor="#4eab3f" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Текст таймера в центре */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-3xl font-bold text-white transition-all duration-300 ${
                    timeLeft <= 60 ? 'text-red-400 animate-pulse' : ''
                  }`}>
                    {formatTime(timeLeft)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-white/70 text-sm font-medium">{t.timeToPay}</div>
        </div>
      </section>

      {/* Детали заявки */}
      <section className="card space-y-3">
        <div className="label font-semibold">{t.requestDetails}</div>
        {bookmaker && (
          <div className="flex justify-between items-center">
            <span className="text-white/80">{t.bookmaker}</span>
            <span className="text-white font-semibold">{getBookmakerName(bookmaker)}</span>
          </div>
        )}
        {accountId && (
          <div className="flex justify-between items-center">
            <span className="text-white/80">{t.playerId}</span>
            <span className="text-white font-semibold">{accountId}</span>
          </div>
        )}
        {amount && (
          <div className="flex justify-between items-center">
            <span className="text-white/80">{t.amountToPay}</span>
            <span className="text-white font-semibold text-lg">
              {parseFloat(amount || '0').toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} сом
            </span>
          </div>
        )}
      </section>

      {/* Выбор банка */}
      <section className="card space-y-3">
        <div className="label">{t.selectBank}</div>
        {Object.keys(paymentUrls).length > 0 ? (
          <BankButtons
            onPick={handleBankSelect}
            selected={selectedBank}
            disabled={loading}
            allBankUrls={paymentUrls}
            enabledBanks={enabledBanks}
          />
        ) : (
          <div className="text-center text-white/70 text-sm py-4">
            Загрузка ссылок для оплаты...
          </div>
        )}
        {loading && (
          <div className="text-center text-white/70 text-sm py-2">
            {t.loading}
          </div>
        )}
      </section>

      {/* Загрузка чека */}
      <section className="card space-y-3">
          <div className="label">{t.uploadReceipt}</div>
          <div className="text-white/70 text-xs mb-2">{t.uploadReceiptDesc}</div>
          
          <div className="relative">
            <input 
              type="file"
              accept="image/*"
              onChange={handleReceiptChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              id="receipt-upload"
              disabled={uploadingReceipt}
            />
            <label 
              htmlFor="receipt-upload"
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl bg-gradient-to-br transition-all duration-300 cursor-pointer group relative ${
                receiptPreview 
                  ? 'border-green-400/50 bg-green-800/40' 
                  : 'border-green-400/30 bg-green-900/20 hover:border-green-400/50 hover:bg-green-800/30'
              } ${uploadingReceipt ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex flex-col items-center space-y-2">
                {receiptPreview ? (
                  <>
                    <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-green-400/50">
                      <img 
                        src={receiptPreview} 
                        alt="Receipt preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-green-300">
                        {t.receiptUploaded}
                      </p>
                      {receiptFile && (
                        <p className="text-xs text-white/60 mt-1">
                          {receiptFile.name}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white group-hover:text-green-300 transition-colors">
                        {uploadingReceipt ? t.uploading : t.uploadReceipt}
                      </p>
                      <p className="text-xs text-white/60 mt-1">
                        {t.receiptFileTypes}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </label>
          </div>
        </section>

      <div className="flex gap-3">
        <button 
          className="btn btn-ghost flex-1" 
          onClick={() => router.back()}
          disabled={loading || uploadingReceipt}
        >
          {t.back}
        </button>
        <button 
          className="btn btn-primary flex-1" 
          onClick={handlePaymentConfirmed}
          disabled={loading || uploadingReceipt || !selectedBank}
        >
          {t.paidButton}
        </button>
      </div>
    </main>
  )
}

export default function DepositStep3() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <FixedHeaderControls />
        <div className="text-white">Загрузка...</div>
      </div>
    }>
      <DepositStep3Content />
    </Suspense>
  )
}

