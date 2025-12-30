"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import BankButtons from '../../../components/BankButtons'
import PageTransition from '../../../components/PageTransition'
import { useLanguage } from '../../../components/LanguageContext'
import { getTelegramUser, getTelegramUserId, syncWithBot, notifyUser, checkUserBlocked } from '../../../utils/telegram'
import { useAlert } from '../../../components/useAlert'
import { formatKgs, formatUsdt, formatUsd } from '../../../utils/crypto-pay'
import { safeFetch, getApiBase } from '../../../utils/fetch'
import { compressImageIfNeeded } from '../../../utils/image-compress'


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

export default function DepositStep4() {
  
  useBankUiTheme()
const [bank, setBank] = useState('omoney') 
  const [paymentUrl, setPaymentUrl] = useState('')
  const [qrData, setQrData] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(300) 
  const [isPaid, setIsPaid] = useState(false)
  const [isCreatingRequest, setIsCreatingRequest] = useState(false)
  const [paymentType, setPaymentType] = useState<'bank' | 'crypto'>('bank')
  const [paymentByNumber, setPaymentByNumber] = useState<{ phoneNumber: string; recipientName: string; bankName: string } | null>(null)
  const [cryptoInvoice, setCryptoInvoice] = useState<any>(null)
  const [cryptoLoading, setCryptoLoading] = useState(false)
  const router = useRouter()
  const { showAlert, AlertComponent } = useAlert()

  
  const [bookmaker, setBookmaker] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [amount, setAmount] = useState(0)
  const [depositsEnabled, setDepositsEnabled] = useState(true)
  const [requireReceiptPhoto, setRequireReceiptPhoto] = useState(true) 
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null)
  const [receiptPhotoPreview, setReceiptPhotoPreview] = useState<string | null>(null)
  const [receiptPhotoBase64, setReceiptPhotoBase64] = useState<string | null>(null)
  const { language } = useLanguage()

  useEffect(() => {
    const savedBookmaker = localStorage.getItem('deposit_bookmaker') || ''
    const savedPlayerId = localStorage.getItem('deposit_user_id') || ''
    const savedAmount = parseFloat(localStorage.getItem('deposit_amount') || '0')
    const savedPaymentType = localStorage.getItem('deposit_payment_type') as 'bank' | 'crypto' || 'bank'
    
    setBookmaker(savedBookmaker)
    setPlayerId(savedPlayerId)
    setAmount(savedAmount)
    setPaymentType(savedPaymentType)
    
    
    const telegramUserId = getTelegramUserId()
    
    
    const previousBookmaker = localStorage.getItem('previous_deposit_bookmaker') || ''
    const previousTelegramUserId = localStorage.getItem('previous_deposit_telegram_user_id') || ''
    const previousAmount = parseFloat(localStorage.getItem('previous_deposit_amount') || '0')
    const transactionId = localStorage.getItem('deposit_transaction_id')
    
    
    
    const isNewRequest = !previousBookmaker || 
                         !previousTelegramUserId || 
                         !telegramUserId ||
                         previousBookmaker !== savedBookmaker ||
                         previousTelegramUserId !== telegramUserId ||
                         previousAmount !== savedAmount
    
    if (isNewRequest && telegramUserId) {
      
      setIsPaid(false)
      setTimeLeft(300) 
      localStorage.removeItem('deposit_transaction_id')
      localStorage.removeItem('deposit_request_id')
      localStorage.removeItem('deposit_timer_start')
      
      localStorage.setItem('previous_deposit_bookmaker', savedBookmaker)
      localStorage.setItem('previous_deposit_telegram_user_id', telegramUserId)
      localStorage.setItem('previous_deposit_amount', savedAmount.toString())
      
      localStorage.setItem('deposit_timer_start', Date.now().toString())
      return
    }
    
    
    if (transactionId) {
      
      setIsPaid(true)
      setTimeLeft(0)
      localStorage.removeItem('deposit_timer_start') 
      return
    }
    
    
    const timerStartTime = localStorage.getItem('deposit_timer_start')
    if (timerStartTime) {
      const startTime = parseInt(timerStartTime, 10)
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000) 
      const remaining = Math.max(0, 300 - elapsed) 
      setTimeLeft(remaining)
      
      
      if (remaining === 0) {
        
        setTimeout(() => {
          handleTimeExpired()
        }, 100)
      }
    } else {
      
      localStorage.setItem('deposit_timer_start', Date.now().toString())
    }
  }, [])

  
  const createCryptoInvoice = async () => {
    if (cryptoLoading || cryptoInvoice) return
    
    setCryptoLoading(true)
    try {
      const apiUrl = getApiBase()
      
      
      const savedAmountUsd = localStorage.getItem('deposit_amount_usd')
      if (!savedAmountUsd) {
        throw new Error('Сумма в долларах не найдена')
      }
      
      const amountInUsd = parseFloat(savedAmountUsd)
      
      
      const telegramUserId = getTelegramUserId()
      
      const payload = JSON.stringify({
        bookmaker,
        playerId,
        amount: amount, 
        amount_usd: amountInUsd, 
        telegram_user_id: telegramUserId
      })
      
      const response = await safeFetch(`${apiUrl}/api/crypto-pay/create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountUsd: amountInUsd, 
          asset: 'USDT',
          description: `Пополнение баланса ${bookmaker} - ID: ${playerId}`,
          payload: payload,
        }),
        timeout: 30000,
        retries: 1,
        retryDelay: 2000
      })
      
      if (response.ok) {
        let data
        try {
          const text = await response.text()
          data = text ? JSON.parse(text) : {}
        } catch (parseError) {
          console.error('❌ Ошибка парсинга JSON ответа crypto invoice:', parseError)
          throw new Error(language === 'ru' 
            ? 'Ошибка при обработке ответа сервера. Попробуйте еще раз.'
            : 'Error processing server response. Please try again.')
        }
        
        if (data.success && data.data) {
          const invoiceData = data.data
          setCryptoInvoice(invoiceData)
          
        } else {
          console.error('❌ Invoice creation failed:', data)
          const errorMsg = data.error || data.message || (language === 'ru' 
            ? 'Не удалось создать счет на оплату'
            : 'Failed to create payment invoice')
          throw new Error(errorMsg)
        }
      } else {
        let errorData: any = {}
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : { error: `HTTP ${response.status}` }
        } catch (e) {
          errorData = { error: `HTTP ${response.status} ${response.statusText}` }
        }
        
        console.error('❌ Failed to create crypto invoice:', errorData)
        throw new Error(errorData.error || errorData.message || (language === 'ru'
          ? 'Не удалось создать счет на оплату'
          : 'Failed to create payment invoice'))
      }
    } catch (error: any) {
      console.error('❌ Error creating crypto invoice:', error)
      const errorMessage = error?.message || String(error)
      const userMessage = errorMessage.includes('интернет') || errorMessage.includes('connection') || errorMessage.includes('Таймаут')
        ? (language === 'ru' 
            ? 'Нет подключения к интернету. Проверьте соединение и попробуйте снова.'
            : 'No internet connection. Check your connection and try again.')
        : (errorMessage || (language === 'ru' 
            ? 'Ошибка при создании счета на оплату. Попробуйте еще раз.'
            : 'Error creating payment invoice. Please try again.'))
      
      
      const isCryptoError = errorMessage.includes('wallet') || errorMessage.includes('кошелек') || errorMessage.includes('invoice')
      const finalMessage = isCryptoError && paymentType === 'crypto'
        ? (language === 'ru' 
            ? 'Ошибка при создании крипто-счета. Проверьте настройки Crypto Bot или попробуйте позже.'
            : 'Error creating crypto invoice. Check Crypto Bot settings or try later.')
        : userMessage
      
      showAlert({
        type: 'error',
        title: language === 'ru' ? 'Ошибка' : 'Error',
        message: finalMessage
      })
    } finally {
      setCryptoLoading(false)
    }
  }

  
  useEffect(() => {
    const loadPaymentByNumber = async () => {
      try {
        const apiUrl = getApiBase()
        const response = await fetch(`${apiUrl}/api/public/payment-by-number`, { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.phoneNumber && data.recipientName) {
            setPaymentByNumber({
              phoneNumber: data.phoneNumber,
              recipientName: data.recipientName,
              bankName: data.bankName || ''
            })
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки настроек пополнения по номеру:', error)
      }
    }
    loadPaymentByNumber()
  }, [])

  
  useEffect(() => {
    if (bookmaker && playerId && amount > 0) {
      
      if (!localStorage.getItem('deposit_timer_start')) {
        localStorage.setItem('deposit_timer_start', Date.now().toString())
      }
      
      if (paymentType === 'crypto') {
        
        createCryptoInvoice().catch((error) => {
          console.error('❌ Ошибка создания crypto invoice:', error)
        })
      } else {
        
        generateBankLinksForNumber()
      }
    }
    
  }, [bookmaker, playerId, amount, paymentType])

  
  useEffect(() => {
    
    if (paymentType === 'crypto') {
      return
    }
    
    if (timeLeft > 0 && !isPaid) {
      const timer = setTimeout(() => {
        
        const timerStartTime = localStorage.getItem('deposit_timer_start')
        if (timerStartTime) {
          const startTime = parseInt(timerStartTime, 10)
          const now = Date.now()
          const elapsed = Math.floor((now - startTime) / 1000)
          const remaining = Math.max(0, 300 - elapsed)
          setTimeLeft(remaining)
          
          
          if (remaining === 0) {
            handleTimeExpired()
            return
          }
        } else {
          
          setTimeLeft(timeLeft - 1)
        }
      }, 1000)
      
      
      if (timeLeft % 10 === 0) {
        checkPaymentStatus()
      }
      
        return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !isPaid) {
      
      handleTimeExpired()
    }
  }, [timeLeft, isPaid, paymentType])

  

  
  const handleTimeExpired = async () => {
    
    if (isPaid) {
      return
    }
    
    try {
      
      const transactionId = localStorage.getItem('deposit_transaction_id')
      if (transactionId) {
        const response = await safeFetch('/api/payment', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: transactionId,
            status: 'rejected',
            reason: 'Время на оплату истекло'
          }),
          timeout: 10000,
          retries: 0
        })
        
        if (response.ok) {
        }
      }
      
      
      localStorage.removeItem('deposit_bookmaker')
      localStorage.removeItem('deposit_user_id')
      localStorage.removeItem('deposit_amount')
      localStorage.removeItem('deposit_transaction_id')
      localStorage.removeItem('deposit_timer_start') 
      localStorage.removeItem('previous_deposit_bookmaker')
      localStorage.removeItem('previous_deposit_telegram_user_id')
      localStorage.removeItem('previous_deposit_amount')
      
      showAlert({
        type: 'warning',
        title: language === 'ru' ? 'Время истекло' : 'Time expired',
        message: language === 'ru' 
          ? 'Время на оплату истекло. Заявка отклонена.' 
          : 'Payment time has expired. Request rejected.',
        autoClose: 3000
      })
      
      setTimeout(() => {
        router.push('/')
      }, 3000)
    } catch (error) {
      console.error('Ошибка при отклонении заявки:', error)
      router.push('/')
    }
  }

  
  const checkPaymentStatus = async () => {
    try {
      
      const transactionId = localStorage.getItem('deposit_transaction_id')
      if (transactionId) {
        const base = getApiBase()
        
        const response = await fetch(`${base}/api/requests/${transactionId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            const requestStatus = data.data.status
            const processedBy = data.data.processedBy
            
            
            const isAutoDeposit = requestStatus === 'completed' && processedBy === 'автопополнение'
            const isManualCompleted = ['completed', 'approved', 'auto_completed', 'autodeposit_success'].includes(requestStatus)
            
            if ((isAutoDeposit || isManualCompleted) && !isPaid) {
              setIsPaid(true)
              
              localStorage.removeItem('deposit_timer_start')
              
              await sendPaymentConfirmation()
              
              router.push('/deposit/waiting')
            }
          }
        }
      }
    } catch (error) {
      console.error('Ошибка проверки оплаты:', error)
    }
  }

  
  const createDepositRequest = async () => {
    try {
      
      const tg = (window as any).Telegram?.WebApp
      let telegramUser = null
      
      
      
      if (tg?.initDataUnsafe?.user) {
        telegramUser = tg.initDataUnsafe.user
      } else if (tg?.initData) {
        
        try {
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          if (userParam) {
            telegramUser = JSON.parse(decodeURIComponent(userParam))
          }
        } catch (e) {
        }
      }
      

      
      
      const currentReceiptPhotoBase64 = receiptPhotoBase64
      
      let finalReceiptPhotoBase64: string | null = currentReceiptPhotoBase64
      if (!finalReceiptPhotoBase64 && receiptPhoto) {
        
        if (typeof window === 'undefined' || typeof (window as any).FileReader === 'undefined') {
          console.error('❌ FileReader недоступен в этом окружении')
          throw new Error('FileReader недоступен. Пожалуйста, используйте другой браузер или обновите страницу.')
        }
        
        console.warn('⚠️ Base64 не сохранен, читаем файл заново (fallback)')
        finalReceiptPhotoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new (window as any).FileReader()
          reader.onloadend = async () => {
            const base64String = reader.result as string
            const originalSizeKB = (base64String.length * 3) / 4 / 1024
            
            
            try {
              const compressed = await compressImageIfNeeded(base64String, 300)
              const compressedSizeKB = (compressed.length * 3) / 4 / 1024
              resolve(compressed)
            } catch (compressError) {
              console.error('❌ Ошибка при сжатии фото при чтении:', compressError)
              resolve(base64String) 
            }
          }
          reader.onerror = (error: ProgressEvent<FileReader>) => {
            console.error('❌ Ошибка при чтении фото:', error)
            reject(error)
          }
          reader.readAsDataURL(receiptPhoto)
        })
      }
      
      
      if (finalReceiptPhotoBase64) {
        const originalSizeKB = (finalReceiptPhotoBase64.length * 3) / 4 / 1024
        
        try {
          
          
          finalReceiptPhotoBase64 = await compressImageIfNeeded(finalReceiptPhotoBase64, 300)
          const compressedSizeKB = (finalReceiptPhotoBase64.length * 3) / 4 / 1024
          
          if (compressedSizeKB < originalSizeKB) {
          } else {
          }
        } catch (compressError) {
          console.error('❌ Ошибка при сжатии фото:', compressError)
          
        }
      }

      
      const savedAmountUsd = paymentType === 'crypto' ? localStorage.getItem('deposit_amount_usd') : null
      const amountUsd = savedAmountUsd ? parseFloat(savedAmountUsd) : null

      
          let invoiceId = null
          if (paymentType === 'crypto' && cryptoInvoice) {
            invoiceId = cryptoInvoice.invoice_id || cryptoInvoice.invoiceId || cryptoInvoice.id || null
      }

      if (!playerId || !bookmaker || !amount || amount <= 0) {
        const errorMsg = `Недостаточно данных для создания заявки: playerId=${playerId}, bookmaker=${bookmaker}, amount=${amount}`
        console.error('❌', errorMsg)
        throw new Error(errorMsg)
      }

      
      let telegramUserId = getTelegramUserId()
      
      
      if (!telegramUserId) {
        telegramUserId = playerId || 'unknown'
      }

      
      const isBlocked = await checkUserBlocked(telegramUserId)
      if (isBlocked) {
        console.error('❌ Пользователь заблокирован! Нельзя создавать заявки.')
        alert('Ваш аккаунт заблокирован. Вы не можете создавать заявки на пополнение.')
        window.location.href = '/blocked'
        return
      }

      const requestData = {
        type: 'deposit',
        amount: amount, 
        amount_usd: amountUsd, 
        
        userId: telegramUserId, 
        bookmaker: bookmaker,
        bank: bank,
        account_id: playerId, 
        playerId: playerId, 
        payment_method: paymentType, 
        crypto_invoice_id: invoiceId,
        
        telegram_user_id: telegramUserId,
        telegram_username: telegramUser?.username,
        telegram_first_name: telegramUser?.first_name,
        telegram_last_name: telegramUser?.last_name,
        telegram_language_code: telegramUser?.language_code,
        
        receipt_photo: finalReceiptPhotoBase64,
      }

      
      const apiUrl = '/api/payment'
      
      
      const bodyString = JSON.stringify(requestData)
      const bodySize = bodyString.length
      const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
      
      const maxBodySize = 1024 * 1024 
      if (bodySize > maxBodySize) {
        const errorMsg = language === 'ru'
          ? `Размер данных слишком большой (${(bodySize / 1024).toFixed(2)} KB). Пожалуйста, загрузите фото меньшего размера или попробуйте без фото.`
          : `Data size too large (${(bodySize / 1024).toFixed(2)} KB). Please upload a smaller photo or try without photo.`
        console.error('❌ Body слишком большой:', bodySize, 'bytes')
        throw new Error(errorMsg)
      }
      
      if (bodySize > 500 * 1024) {
        console.warn('⚠️ Body большой:', `${(bodySize / 1024).toFixed(2)} KB. Может быть проблема с nginx лимитом.`)
      }
      
      const startTime = Date.now()
      let response: Response
      
      try {
        
        response = await safeFetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: bodyString,
          timeout: 30000,
          retries: isIOS ? 0 : 1, 
          retryDelay: 2000
        })
      } catch (fetchError: any) {
        console.error('❌ Ошибка при вызове safeFetch:', {
          error: fetchError,
          message: fetchError?.message,
          name: fetchError?.name,
          stack: fetchError?.stack,
          isIOS
        })
        
        
        if (isIOS && (fetchError.name === 'AbortError' || fetchError.message?.includes('AbortController'))) {
          try {
            response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: bodyString
            })
          } catch (fallbackError: any) {
            console.error('❌ Fallback fetch тоже failed:', fallbackError)
            throw new Error(language === 'ru' 
              ? 'Ошибка подключения к серверу. Проверьте интернет и попробуйте снова.'
              : 'Connection error. Check your internet and try again.')
          }
        } else {
          throw fetchError
        }
      }
      
      const responseTime = Date.now() - startTime
      
      if (!response.ok) {
        let errorText = ''
        try {
          errorText = await response.text()
        } catch (e) {
          errorText = `HTTP ${response.status} ${response.statusText}`
        }
        
        console.error('❌ Ошибка HTTP ответа:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500),
          errorTextLength: errorText.length,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          bodySize: `${(bodySize / 1024).toFixed(2)} KB`,
          bodySizeBytes: bodySize
        })
        
        let errorData: any
        try {
          errorData = JSON.parse(errorText)
        } catch (parseError) {
          errorData = { error: errorText || 'Unknown error' }
        }
        
        
        let userFriendlyMessage = language === 'ru' 
          ? 'Ошибка при отправке заявки. Попробуйте еще раз.'
          : 'Error sending request. Please try again.'
        
        if (response.status === 413) {
          
          userFriendlyMessage = language === 'ru'
            ? 'Фото чека слишком большое. Пожалуйста, загрузите фото меньшего размера или попробуйте без фото.'
            : 'Receipt photo is too large. Please upload a smaller photo or try without photo.'
          console.error('❌ Ошибка 413: Request Entity Too Large. Body size:', bodySize, 'bytes')
        } else if (response.status === 409) {
          userFriendlyMessage = errorData.error || (language === 'ru' 
            ? 'Заявка уже существует. Пожалуйста, подождите обработки.'
            : 'Request already exists. Please wait for processing.')
        } else if (response.status === 400) {
          userFriendlyMessage = errorData.error || (language === 'ru'
            ? 'Проверьте правильность введенных данных.'
            : 'Please check the entered data.')
        } else if (response.status >= 500) {
          userFriendlyMessage = language === 'ru'
            ? 'Ошибка сервера. Попробуйте позже или обратитесь в поддержку.'
            : 'Server error. Please try later or contact support.'
        } else if (errorData.error) {
          userFriendlyMessage = errorData.error
        } else if (errorData.message) {
          userFriendlyMessage = errorData.message
        }
        
        throw new Error(userFriendlyMessage)
      }

      let data
      try {
        const text = await response.text()
        data = text ? JSON.parse(text) : {}
      } catch (parseError) {
        console.error('❌ Ошибка парсинга JSON ответа:', parseError)
        throw new Error(language === 'ru' 
          ? 'Ошибка при обработке ответа сервера. Попробуйте еще раз.'
          : 'Error processing server response. Please try again.')
      }
      
      if (!data.success && !data.id && !data.transactionId) {
        console.error('❌ Заявка не создана:', data)
        throw new Error(data.error || data.message || 'Failed to create request')
      }
      
      
      const requestId = data.id || data.transactionId || (data.data && data.data.id)
      if (!requestId) {
        throw new Error('Request ID not received from server')
      }
      
      localStorage.setItem('deposit_transaction_id', String(requestId))
      localStorage.setItem('deposit_request_id', String(requestId)) 
      
      
      if (!localStorage.getItem('deposit_timer_start')) {
        localStorage.setItem('deposit_timer_start', Date.now().toString())
      }
      
      
      const telegramUserForSync = getTelegramUser()
      if (telegramUserForSync) {
        await syncWithBot(telegramUserForSync, 'deposit_request_created', {
          requestId: requestId,
          bookmaker,
          playerId,
          amount,
          bank
        })
      }
      
      return requestId
    } catch (error: any) {
      const errorMessage = error?.message || String(error)
      
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА создания заявки:', {
        error: error,
        errorMessage: errorMessage,
        errorStack: error?.stack,
        errorName: error?.name,
        errorString: String(error),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        currentState: {
          bookmaker,
          playerId,
          amount,
          paymentType,
          isPaid,
          isCreatingRequest
        },
        localStorage: {
          deposit_bookmaker: localStorage.getItem('deposit_bookmaker'),
          deposit_user_id: localStorage.getItem('deposit_user_id'),
          deposit_amount: localStorage.getItem('deposit_amount')
        }
      })
      
      
      
      const isNonCriticalError = 
        errorMessage.includes('Load failed') ||
        errorMessage.includes('Failed to load') ||
        errorMessage.includes('NetworkError') ||
        (error?.name === 'TypeError' && errorMessage.includes('Load'))
      
      if (!isNonCriticalError) {
        try {
          const tg = (window as any).Telegram?.WebApp
          const telegramUserId = getTelegramUserId() || 'unknown'
          
          
          safeFetch('/api/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'error_log',
              error: {
                message: errorMessage,
                stack: error?.stack,
                name: error?.name,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
              },
              telegram_user_id: telegramUserId
            }),
            timeout: 5000,
            retries: 0 
          }).catch(logError => {
            console.error('❌ Не удалось отправить лог ошибки:', logError)
          })
        } catch (logError) {
          console.error('❌ Ошибка при попытке логирования:', logError)
        }
      } else {
        console.warn('⚠️ Игнорируем несущественную ошибку загрузки ресурса:', errorMessage)
      }
      
      throw error 
    }
  }

  
  const sendPaymentConfirmation = async () => {
    try {
      const requestId = localStorage.getItem('deposit_request_id')
      
      const response = await safeFetch('/api/payment', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: requestId,
          status: 'completed',
          type: 'deposit'
        }),
        timeout: 10000,
        retries: 1
      })
      
      if (response.ok) {
      }
    } catch (error) {
      console.error('Ошибка обновления заявки:', error)
    }
  }

  
  const handleCryptoIPaid = async () => {
    if (!cryptoInvoice) {
      showAlert({
        type: 'error',
        title: language === 'ru' ? 'Ошибка' : 'Error',
        message: language === 'ru' 
          ? 'Invoice не загружен. Попробуйте обновить страницу.'
          : 'Invoice not loaded. Please refresh the page.'
      })
      return
    }

    
    if (isCreatingRequest || isPaid) {
      showAlert({
        type: 'info',
        title: language === 'ru' ? 'Информация' : 'Info',
        message: language === 'ru'
          ? 'Заявка уже отправлена или обрабатывается. Пожалуйста, подождите.'
          : 'Request already submitted or being processed. Please wait.'
      })
      return
    }

    setIsCreatingRequest(true)

    try {
      
      
      const requestId = await createDepositRequest()
      
      
      
      if (requestId) {
        localStorage.setItem('deposit_request_id', String(requestId))
      }
      
      
      setIsPaid(true)
      
      
      router.push('/deposit/waiting')
    } catch (error: any) {
      console.error('❌ Error creating deposit request (crypto):', error)
      
      setIsCreatingRequest(false)
      
      const errorMessage = error?.message || String(error) || 'Неизвестная ошибка'
      showAlert({
        type: 'error',
        title: language === 'ru' ? 'Ошибка' : 'Error',
        message: errorMessage || (language === 'ru' 
          ? 'Ошибка при создании заявки. Попробуйте ещё раз.'
          : 'Error creating request. Please try again.')
      })
    } finally {
      
      if (!isPaid) {
        setIsCreatingRequest(false)
      }
    }
  }

  
  const handleReceiptPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptPhoto(null)
      setReceiptPhotoPreview(null)
      setReceiptPhotoBase64(null)
      
      
      setReceiptPhoto(file)
      
      
      
      if (typeof window === 'undefined' || typeof (window as any).FileReader === 'undefined') {
        console.error('❌ FileReader недоступен в этом окружении')
        alert('Ошибка: FileReader недоступен. Пожалуйста, используйте другой браузер или обновите страницу.')
        return
      }
      
      const reader = new (window as any).FileReader() 
      reader.onloadend = async () => {
        const base64String = reader.result as string
        const originalSizeKB = (base64String.length * 3) / 4 / 1024
        
        
        
        try {
          const compressedBase64 = await compressImageIfNeeded(base64String, 300)
          const compressedSizeKB = (compressedBase64.length * 3) / 4 / 1024
          
          if (compressedSizeKB < originalSizeKB) {
          } else {
          }
          
          
          setReceiptPhotoPreview(compressedBase64)
          setReceiptPhotoBase64(compressedBase64)
        } catch (compressError) {
          console.error('❌ Ошибка при сжатии фото при загрузке:', compressError)
          
          setReceiptPhotoPreview(base64String)
          setReceiptPhotoBase64(base64String)
        }
      }
      reader.onerror = (error: ProgressEvent<FileReader>) => {
        console.error('❌ Ошибка при чтении фото:', error)
        setReceiptPhoto(null)
        setReceiptPhotoPreview(null)
        setReceiptPhotoBase64(null)
      }
      reader.readAsDataURL(file)
    }
  }

  
  const handleIPaid = async () => {
    if (paymentType === 'crypto') {
      return
    }

    if (requireReceiptPhoto && !receiptPhoto && !receiptPhotoBase64) {
      showAlert({
        type: 'error',
        title: language === 'ru' ? 'Ошибка' : 'Error',
        message: language === 'ru'
          ? 'Пожалуйста, загрузите фото чека об оплате'
          : 'Please upload receipt photo'
      })
      return
    }

    
    if (isPaid || isCreatingRequest) {
      showAlert({
        type: 'info',
        title: language === 'ru' ? 'Информация' : 'Info',
        message: language === 'ru'
          ? 'Заявка уже отправлена или обрабатывается. Пожалуйста, подождите.'
          : 'Request already submitted or being processed. Please wait.'
      })
      return
    }

    
    setIsCreatingRequest(true)
    
    try {
      const requestId = await createDepositRequest()
      
      
      
      if (requestId) {
        localStorage.setItem('deposit_request_id', String(requestId))
      }
      
      
      setIsPaid(true)
      setTimeLeft(0) 
      
      
      localStorage.removeItem('deposit_timer_start')
      
      
      const telegramUserId = getTelegramUserId()
      
      
      if (telegramUserId) {
        localStorage.setItem('previous_deposit_bookmaker', bookmaker)
        localStorage.setItem('previous_deposit_telegram_user_id', telegramUserId)
        localStorage.setItem('previous_deposit_amount', amount.toString())
      }
      
      
      
      router.push('/deposit/waiting')
    } catch (e: any) {
      console.error('❌ Ошибка в handleIPaid:', {
        error: e,
        message: e?.message,
        name: e?.name,
        stack: e?.stack,
        currentState: { isPaid, isCreatingRequest, bookmaker, playerId, amount }
      })
      
      
      setIsCreatingRequest(false)
      
      
      const errorMessage = e?.message || String(e) || 'Неизвестная ошибка'
      
      
      let userFriendlyMessage = errorMessage
      if (errorMessage.includes('интернет') || errorMessage.includes('connection') || errorMessage.includes('Таймаут') || errorMessage.includes('Failed to fetch')) {
        userFriendlyMessage = language === 'ru'
          ? 'Нет подключения к интернету. Проверьте соединение и попробуйте снова.'
          : 'No internet connection. Check your connection and try again.'
      } else if (errorMessage.includes('Недостаточно данных')) {
        userFriendlyMessage = language === 'ru'
          ? 'Не все данные заполнены. Пожалуйста, вернитесь и проверьте введенные данные.'
          : 'Not all data is filled. Please go back and check the entered data.'
      }
      
      showAlert({
        type: 'error',
        title: language === 'ru' ? 'Ошибка' : 'Error',
        message: language === 'ru'
          ? `Ошибка при отправке заявки.\n\n${userFriendlyMessage}\n\nПожалуйста, попробуйте ещё раз или обратитесь в поддержку.`
          : `Error submitting request.\n\n${userFriendlyMessage}\n\nPlease try again or contact support.`
      })
    } finally {
      
      
      if (!isPaid) {
        setIsCreatingRequest(false)
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleBankSelect = (bankKey: string) => {
    setBank(bankKey)
    
    generateBankLinksForNumber()
  }


  
  const getActiveRequisite = async (): Promise<{ value: string; bank: string | null; name: string | null } | null> => {
    try {
      const response = await fetch('/api/requisites-proxy', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        return null
      }
      
      const data = await response.json()
      
      if (!data.success || !data.requisites || !Array.isArray(data.requisites)) {
        return null
      }
      
      
      if (data.active_id) {
        const activeRequisite = data.requisites.find((req: any) => req.id === data.active_id)
        if (activeRequisite) {
          return { 
            value: activeRequisite.value, 
            bank: activeRequisite.bank || null,
            name: activeRequisite.name || null
          }
        }
      }
      
      
      const activeRequisite = data.requisites.find((req: any) => req.is_active === true || req.isActive === true)
      if (activeRequisite) {
        return { 
          value: activeRequisite.value, 
          bank: activeRequisite.bank || null,
          name: activeRequisite.name || null
        }
      }
      
      
      if (data.requisites.length > 0) {
        const firstRequisite = data.requisites[0]
        return { 
          value: firstRequisite.value, 
          bank: firstRequisite.bank || null,
          name: firstRequisite.name || null
        }
      }
    } catch (error) {
      console.error('Error fetching active requisite:', error)
    }
    return null
  }


  
  const getBaseBankLinks = (): Record<string, string> => ({
    'DemirBank': 'https://retail.demirbank.kg/',
    'O!Money': 'https://api.dengi.o.kg/',
    'Balance.kg': 'https://balance.kg/',
    'Bakai': 'https://bakai24.app/',
    'MegaPay': 'https://megapay.kg/',
    'MBank': 'https://app.mbank.kg/',
    'demirbank': 'https://retail.demirbank.kg/',
    'omoney': 'https://api.dengi.o.kg/',
    'balance': 'https://balance.kg/',
    'bakai': 'https://bakai24.app/',
    'megapay': 'https://megapay.kg/',
    'mbank': 'https://app.mbank.kg/'
  })

  
  const generateBankLinksForNumber = () => {
    
    const bankLinks: Record<string, string> = {
      'DemirBank': 'https://retail.demirbank.kg/',
      'O!Money': 'https://api.dengi.o.kg/',
      'Balance.kg': 'https://balance.kg/',
      'Bakai': 'https://bakai24.app/',
      'MegaPay': 'https://megapay.kg/',
      'MBank': 'https://app.mbank.kg/',
      'demirbank': 'https://retail.demirbank.kg/',
      'omoney': 'https://api.dengi.o.kg/',
      'balance': 'https://balance.kg/',
      'bakai': 'https://bakai24.app/',
      'megapay': 'https://megapay.kg/',
      'mbank': 'https://app.mbank.kg/'
    }
    
    setQrData({
      all_bank_urls: bankLinks,
      settings: {
        enabled_banks: ['demirbank', 'omoney', 'balance', 'bakai', 'megapay', 'mbank'], 
        deposits_enabled: true
      }
    })
    setPaymentUrl(bankLinks['DemirBank'] || '')
  }


  const handleBack = () => {
    
    if (typeof window !== 'undefined' && (window as any).pageTransitionExit) {
      (window as any).pageTransitionExit()
      setTimeout(() => {
        router.push('/deposit/step3')
      }, 250)
    } else {
      router.push('/deposit/step3')
    }
  }

  const translations = {
    ru: {
      title: 'Оплата',
      subtitle: 'Оплатите заявку',
      timer: 'Время на оплату',
      amount: 'Сумма к оплате',
      bookmaker: 'Букмекер',
      playerId: 'ID игрока',
      bank: 'Банк',
      selectBank: 'Выберите банк для оплаты',
      paymentComplete: 'Оплата завершена',
      back: 'Назад',
      iPaid: 'Я оплатил',
      instructions: 'Как оплатить:',
      instructionSteps: [
        'Выберите ваш банк из списка ниже',
        'Нажмите на кнопку выбранного банка',
        'Вы будете перенаправлены в приложение банка',
        'Подтвердите оплату указанной суммы в приложении',
        'Вернитесь сюда и нажмите "Я оплатил"',
        'Мы проверим оплату и зачислим средства автоматически'
      ]
    },
    en: {
      title: 'Payment',
      subtitle: 'Pay the request',
      timer: 'Time to pay',
      amount: 'Amount to pay',
      bookmaker: 'Bookmaker',
      playerId: 'Player ID',
      bank: 'Bank',
      selectBank: 'Select your bank for payment',
      paymentComplete: 'Payment completed',
      back: 'Back',
      iPaid: 'I paid',
      instructions: 'How to pay:',
      instructionSteps: [
        'Select your bank from the list below',
        'Click on the selected bank button',
        'You will be redirected to the bank app',
        'Confirm payment of the specified amount in the app',
        'Return here and click "I paid"',
        'We will verify payment and credit funds automatically'
      ]
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  
  if (!depositsEnabled) {
    return (
      <PageTransition direction="backward">
        <main className="space-y-4 min-h-screen flex flex-col">
          <FixedHeaderControls />
          <div className="text-center space-y-2 fade-in">
            <div className="pr-20">
              <h1 className="text-xl font-bold text-white">{t.title}</h1>
            </div>
            <p className="text-sm text-white/70">{t.subtitle}</p>
          </div>

          <div className="card text-center">
            <div className="text-orange-300 text-lg font-semibold mb-2">🔧 Технические работы</div>
            <div className="text-slate-400">Пополнения временно недоступны. Попробуйте позже.</div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="btn btn-ghost w-full"
            >
              ← {t.back}
            </button>
          </div>
        </main>
      </PageTransition>
    )
  }

  return (
    <PageTransition direction="backward">
      <main className="space-y-4 min-h-screen flex flex-col">
      <FixedHeaderControls />
      
      <div className="text-center space-y-2 fade-in">
        <div className="pr-20">
          <h1 className="text-xl font-bold text-white">{t.title}</h1>
        </div>
        <p className="text-sm text-white/70">{t.subtitle}</p>
      </div>

      
      {paymentType === 'bank' && (
        <div className="card text-center pulse">
          <div className="text-3xl font-bold text-red-500 mb-2">
            {formatTime(timeLeft)}
          </div>
          <p className="text-sm text-white/70">{t.timer}</p>
        </div>
      )}

      
      {paymentType === 'crypto' && cryptoLoading && (
        <div className="card text-center">
          <div className="text-white/70">
            {language === 'ru' ? 'Создание счета на оплату...' : 'Creating payment invoice...'}
          </div>
        </div>
      )}

      
      {paymentType === 'crypto' && !cryptoLoading && !cryptoInvoice && (
        <div className="card text-center bg-red-900/20 border-red-500">
          <div className="text-red-500 text-lg font-semibold mb-2">
            {language === 'ru' ? 'Ошибка создания счета' : 'Invoice creation error'}
          </div>
          <p className="text-sm text-white/70 mb-4">
            {language === 'ru' 
              ? 'Не удалось создать счет на оплату. Попробуйте обновить страницу.'
              : 'Failed to create payment invoice. Please refresh the page.'}
          </p>
          <button
            onClick={() => {
              setCryptoLoading(true)
              createCryptoInvoice().finally(() => setCryptoLoading(false))
            }}
            className="btn btn-primary"
          >
            {language === 'ru' ? 'Попробовать снова' : 'Try again'}
          </button>
        </div>
      )}

      
      {process.env.NODE_ENV === 'development' && (
        <div className="card text-xs text-white/50">
          <div>paymentType: {paymentType}</div>
          <div>cryptoInvoice: {cryptoInvoice ? '✅' : '❌'}</div>
          <div>cryptoLoading: {cryptoLoading ? '✅' : '❌'}</div>
          <div>isPaid: {isPaid ? '✅' : '❌'}</div>
        </div>
      )}

      
      {paymentType === 'crypto' && cryptoInvoice && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-white text-center">
            {language === 'ru' ? 'Оплата через Crypto Bot' : 'Pay via Crypto Bot'}
          </h2>
          <p className="text-sm text-white/70 text-center">
            {language === 'ru' 
              ? 'Нажмите на кнопку ниже для оплаты'
              : 'Click the button below to pay'}
          </p>
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              
              
              try {
                const tg = (window as any).Telegram?.WebApp
                
                if (!cryptoInvoice) {
                  console.error('❌ cryptoInvoice is null or undefined')
                  showAlert({
                    type: 'error',
                    title: language === 'ru' ? 'Ошибка' : 'Error',
                    message: language === 'ru' 
                      ? 'Invoice не загружен. Попробуйте обновить страницу.'
                      : 'Invoice not loaded. Please refresh the page.'
                  })
                  return
                }
                
                
                const invoiceUrl = cryptoInvoice.bot_invoice_url || 
                                  cryptoInvoice.mini_app_invoice_url || 
                                  cryptoInvoice.web_app_invoice_url
                
                if (!invoiceUrl) {
                  console.error('❌ No invoice URL available')
                  showAlert({
                    type: 'error',
                    title: language === 'ru' ? 'Ошибка' : 'Error',
                    message: language === 'ru' 
                      ? 'Не удалось получить ссылку на счет. Попробуйте создать заявку заново.'
                      : 'Failed to get invoice URL. Please try creating a new request.'
                  })
                  return
                }

                
                const miniAppUrl = cryptoInvoice.mini_app_invoice_url
                
                if (tg && tg.openLink && miniAppUrl) {
                  try {
                    
                    
                    tg.openLink(miniAppUrl)
                  } catch (error: any) {
                    console.error('❌ Error calling openLink with mini_app_invoice_url:', error)
                    showAlert({
                      type: 'error',
                      title: language === 'ru' ? 'Ошибка' : 'Error',
                      message: language === 'ru' 
                        ? `Ошибка при открытии invoice: ${error.message || 'Неизвестная ошибка'}`
                        : `Error opening invoice: ${error.message || 'Unknown error'}`
                    })
                  }
                } 
                
                else if (tg && tg.openInvoice && cryptoInvoice.bot_invoice_url) {
                  try {
                    tg.openInvoice(cryptoInvoice.bot_invoice_url, (status: string) => {
                      if (status === 'paid' || status === 'completed') {
                        setIsPaid(true)
                        setTimeout(() => {
                          router.push('/deposit/waiting')
                        }, 1000)
                      } else if (status === 'cancelled' || status === 'failed') {
                        showAlert({
                          type: 'info',
                          title: language === 'ru' ? 'Информация' : 'Info',
                          message: language === 'ru' 
                            ? 'Оплата была отменена'
                            : 'Payment was cancelled'
                        })
                      }
                    })
                  } catch (error: any) {
                    console.error('❌ Error calling openInvoice:', error)
                    showAlert({
                      type: 'error',
                      title: language === 'ru' ? 'Ошибка' : 'Error',
                      message: language === 'ru' 
                        ? `Ошибка при открытии invoice: ${error.message || 'Неизвестная ошибка'}`
                        : `Error opening invoice: ${error.message || 'Unknown error'}`
                    })
                  }
                } 
                
                else if (tg && tg.openLink && cryptoInvoice.web_app_invoice_url) {
                  try {
                    tg.openLink(cryptoInvoice.web_app_invoice_url)
                  } catch (error: any) {
                    console.error('❌ Error calling openLink with web_app_invoice_url:', error)
                    showAlert({
                      type: 'error',
                      title: language === 'ru' ? 'Ошибка' : 'Error',
                      message: language === 'ru' 
                        ? `Ошибка при открытии invoice: ${error.message || 'Неизвестная ошибка'}`
                        : `Error opening invoice: ${error.message || 'Unknown error'}`
                    })
                  }
                }
                
                else {
                  console.warn('⚠️ Telegram WebApp not available, using window.open fallback')
                  const fallbackUrl = miniAppUrl || cryptoInvoice.bot_invoice_url || cryptoInvoice.web_app_invoice_url
                  if (fallbackUrl) {
                    try {
                      window.open(fallbackUrl, '_blank')
                      showAlert({
                        type: 'info',
                        title: language === 'ru' ? 'Информация' : 'Info',
                        message: language === 'ru' 
                          ? 'Invoice открыт в новой вкладке'
                          : 'Invoice opened in new tab'
                      })
                    } catch (error: any) {
                      console.error('❌ Error opening in new tab:', error)
                      showAlert({
                        type: 'error',
                        title: language === 'ru' ? 'Ошибка' : 'Error',
                        message: language === 'ru' 
                          ? 'Не удалось открыть invoice. Попробуйте скопировать ссылку вручную.'
                          : 'Failed to open invoice. Please copy the link manually.'
                      })
                    }
                  } else {
                    showAlert({
                      type: 'error',
                      title: language === 'ru' ? 'Ошибка' : 'Error',
                      message: language === 'ru' 
                        ? 'Не удалось получить ссылку на invoice. Попробуйте создать заявку заново.'
                        : 'Failed to get invoice URL. Please try creating a new request.'
                    })
                  }
                }
              } catch (error) {
                console.error('❌ Unexpected error in button click handler:', error)
                showAlert({
                  type: 'error',
                  title: language === 'ru' ? 'Ошибка' : 'Error',
                  message: language === 'ru' 
                    ? 'Произошла неожиданная ошибка. Попробуйте обновить страницу.'
                    : 'An unexpected error occurred. Please refresh the page.'
                })
              }
            }}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!cryptoInvoice || !cryptoInvoice.bot_invoice_url}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {language === 'ru' ? 'Оплатить через Crypto Bot' : 'Pay via Crypto Bot'}
          </button>
          
          <div className="text-xs text-white/50 text-center">
            {(() => {
              const invoiceAmount = cryptoInvoice?.amount;
              const amountUsd = localStorage.getItem('deposit_amount_usd');
              return language === 'ru' 
                ? `Сумма: ${formatUsd(amountUsd || '0')} (≈ ${formatUsdt(String(invoiceAmount || '0'))} для оплаты)`
                : `Amount: ${formatUsd(amountUsd || '0')} (≈ ${formatUsdt(String(invoiceAmount || '0'))} to pay)`;
            })()}
          </div>
          <div className="text-xs text-white/40 text-center">
            {language === 'ru' 
              ? 'Invoice откроется внутри Telegram'
              : 'Invoice will open inside Telegram'}
          </div>
          
          
          {process.env.NODE_ENV === 'development' && cryptoInvoice && (
            <div className="text-xs text-white/30 text-center mt-2 p-2 bg-black/20 rounded">
              <div>Invoice ID: {cryptoInvoice.invoice_id || cryptoInvoice.invoiceId || cryptoInvoice.id || 'undefined'}</div>
              <div>Has bot_invoice_url: {cryptoInvoice.bot_invoice_url ? '✅' : '❌'}</div>
              <div>Has mini_app_invoice_url: {cryptoInvoice.mini_app_invoice_url ? '✅' : '❌'}</div>
              <div>Full invoice object: {JSON.stringify(cryptoInvoice, null, 2)}</div>
            </div>
          )}
        </div>
      )}

      
      <div className="card space-y-3 slide-in-left delay-100">
        <h2 className="text-lg font-semibold text-white">Детали заявки</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/70">{t.bookmaker}:</span>
            <span className="text-white">{bookmaker}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">{t.playerId}:</span>
            <span className="text-white">{playerId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">{t.amount}:</span>
            <div className="text-right">
              {paymentType === 'crypto' ? (
                <>
                  <span className="text-white font-bold text-lg">
                    {formatUsd(localStorage.getItem('deposit_amount_usd') || '0')}
                  </span>
                  <div className="text-sm text-white/60">
                    ≈ {formatKgs(amount)} (будет пополнено в казино)
                  </div>
                  {cryptoInvoice && (
                    <div className="text-xs text-white/50 mt-1">
                      ≈ {formatUsdt(String(cryptoInvoice.amount))} для оплаты
                    </div>
                  )}
                </>
              ) : (
                <span className="text-white font-bold text-lg">{formatKgs(amount)}</span>
              )}
            </div>
          </div>
        </div>
      </div>


      
      {paymentType === 'bank' && paymentByNumber && (
        <div className="card space-y-4 slide-in-right delay-300">
          <h2 className="text-lg font-semibold text-white">
            {language === 'ru' ? 'Реквизиты для перевода' : 'Transfer details'}
          </h2>
          <div className="space-y-3 bg-gray-900/80 rounded-lg p-4 border border-gray-700">
            {paymentByNumber.bankName && (
              <div>
                <p className="text-sm text-gray-400 mb-1">
                  {language === 'ru' ? 'Банк' : 'Bank'}
                </p>
                <p className="text-lg font-semibold text-white">{paymentByNumber.bankName}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-400 mb-1">
                {language === 'ru' ? 'Номер телефона' : 'Phone number'}
              </p>
              <p className="text-lg font-semibold text-white">{paymentByNumber.phoneNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">
                {language === 'ru' ? 'Получатель' : 'Recipient'}
              </p>
              <p className="text-lg font-semibold text-white">{paymentByNumber.recipientName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">
                {language === 'ru' ? 'Сумма' : 'Amount'}
              </p>
              <p className="text-lg font-semibold text-green-500">{formatKgs(amount)}</p>
            </div>
          </div>
        </div>
      )}

      
      {paymentType === 'bank' && (
        <div className="card space-y-4 slide-in-right delay-300">
          <h2 className="text-lg font-semibold text-white">{t.selectBank}</h2>
          <BankButtons 
            onPick={handleBankSelect} 
            selected={bank} 
            paymentUrl={paymentUrl || ''}
            allBankUrls={qrData?.all_bank_urls || {}}
            enabledBanks={qrData?.settings?.enabled_banks}
          />
        </div>
      )}

      
      {isPaid && paymentType === 'bank' && (
        <div className="card text-center bg-green-900/20 border-green-500">
          <div className="text-green-500 text-lg font-semibold mb-2">
            ✅ {t.paymentComplete}
          </div>
          <p className="text-sm text-white/70">
            Ваша заявка обрабатывается. Пополнение поступит в течение 5-10 минут.
          </p>
        </div>
      )}

      
      {!isPaid && requireReceiptPhoto && paymentType === 'bank' && (
        <div className="card space-y-3">
          <div>
            <h3 className="text-base font-semibold text-white mb-1">
              {language === 'ru' ? 'Отправьте фото чека об оплате' : 'Send payment receipt photo'}
            </h3>
            <p className="text-sm text-white/70">
              {language === 'ru' ? 'Загрузить фото чека' : 'Upload receipt photo'}
            </p>
          </div>
          
          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleReceiptPhotoChange}
              className="hidden"
            />
            <div className="relative w-full min-h-[200px] bg-[#1A472A] border-2 border-dashed border-green-500 rounded-xl cursor-pointer hover:border-green-400 transition-colors flex flex-col items-center justify-center p-6">
              {receiptPhotoPreview ? (
                <>
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-3">
                    <div className="relative w-full max-h-[300px] flex items-center justify-center">
                      <img
                        src={receiptPhotoPreview}
                        alt="Receipt preview"
                        className="max-w-full max-h-[300px] object-contain rounded-lg"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setReceiptPhoto(null)
                          setReceiptPhotoPreview(null)
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-medium mb-1">
                        {language === 'ru' ? 'Файл выбран' : 'File selected'}
                      </p>
                      <p className="text-white/60 text-sm">
                        {receiptPhoto?.name || 'receipt.jpg'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-white text-sm text-center">
                    {language === 'ru' 
                      ? 'Нажмите, чтобы выбрать фото'
                      : 'Click to select photo'
                    }
                  </p>
                </>
              )}
            </div>
          </label>
          
          <p className="text-xs text-gray-400 text-center">
            {language === 'ru' 
              ? 'Загрузите четкое фото чека об оплате для быстрой обработки заявки'
              : 'Upload a clear photo of the payment receipt for quick processing'
            }
          </p>
        </div>
      )}

      
      {!isPaid && paymentType === 'bank' && (
        <button
          onClick={async (e) => {
              event: e,
              currentTarget: e.currentTarget,
              timestamp: new Date().toISOString(),
              isPaid,
              isCreatingRequest,
              requireReceiptPhoto,
              hasReceiptPhoto: !!receiptPhoto,
              hasReceiptPhotoBase64: !!receiptPhotoBase64
            })
            e.preventDefault()
            e.stopPropagation()
            
            
            if (isPaid || isCreatingRequest) {
              console.warn('⚠️ Кнопка заблокирована:', { isPaid, isCreatingRequest })
              return
            }
            
            try {
              await handleIPaid()
            } catch (error) {
              console.error('❌ Необработанная ошибка в handleIPaid:', error)
            }
          }}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isPaid || isCreatingRequest}
        >
          {isCreatingRequest ? (
            <>
              <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {language === 'ru' ? 'Отправка...' : 'Sending...'}
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t.iPaid}
            </>
          )}
        </button>
      )}

      
      {paymentType === 'crypto' && cryptoInvoice && !isPaid && (
        <button
          type="button"
          onClick={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            
            if (isPaid || isCreatingRequest) {
              console.warn('⚠️ Кнопка заблокирована:', { isPaid, isCreatingRequest })
              return
            }
            
            try {
              await handleCryptoIPaid()
            } catch (error) {
              console.error('❌ Необработанная ошибка в handleCryptoIPaid:', error)
            }
          }}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isPaid || isCreatingRequest}
        >
          {isCreatingRequest ? (
            <>
              <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {language === 'ru' ? 'Отправка...' : 'Sending...'}
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t.iPaid}
            </>
          )}
        </button>
      )}

      
      {!isPaid && (
        <button
          onClick={handleBack}
          className="btn btn-ghost w-full"
        >
          ← {t.back}
        </button>
      )}

      
      {paymentType === 'bank' && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-white">{t.instructions}</h2>
          <div className="space-y-2">
            {t.instructionSteps.map((step, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </div>
                <p className="text-sm text-white/80 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      
      {paymentType === 'crypto' && cryptoInvoice && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {language === 'ru' ? 'Как оплатить:' : 'How to pay:'}
          </h2>
          <div className="space-y-2">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <p className="text-sm text-white/80 leading-relaxed">
                {language === 'ru' 
                  ? 'Нажмите на кнопку "Оплатить через Crypto Bot" выше'
                  : 'Click the "Pay via Crypto Bot" button above'}
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <p className="text-sm text-white/80 leading-relaxed">
                {language === 'ru' 
                  ? 'В открывшемся Crypto Bot подтвердите оплату'
                  : 'In the opened Crypto Bot, confirm the payment'}
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <p className="text-sm text-white/80 leading-relaxed">
                {language === 'ru' 
                  ? 'После оплаты средства будут автоматически зачислены на ваш счет'
                  : 'After payment, funds will be automatically credited to your account'}
              </p>
            </div>
          </div>
        </div>
      )}

      
      {AlertComponent}
    </main>
    </PageTransition>
  )
}