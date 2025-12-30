"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
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

export default function DepositWaitingPage() {
  
  useBankUiTheme()
const router = useRouter()
  const { language } = useLanguage()
  const [status, setStatus] = useState<'waiting' | 'success' | 'error'>('waiting')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [requestAmount, setRequestAmount] = useState<string | null>(null)

  const translations = {
    ru: {
      waiting: 'Ожидайте',
      checking: 'Проверяем вашу оплату...',
      success: 'Успешная оплата!',
      successMessage: 'Ваш баланс пополнен!',
      error: 'Заявка отклонена',
      errorMessage: 'Ваша заявка отклонена.',
      rejectionReason: 'Причина отклонения:',
      checkPayment: 'Проверьте оплату',
      confirm: 'Подтвердить',
      checkAmount: 'Посмотрите что вы до копейки скинули',
      back: 'На главную',
      backHome: 'На главную',
      questions: 'Что может помочь:',
      faq1: 'Проверьте сумму перевода',
      faq1Desc: 'Убедитесь, что вы отправили точную сумму до копейки',
      faq2: 'Проверьте реквизиты',
      faq2Desc: 'Убедитесь, что вы перевели на правильные реквизиты',
      faq3: 'Проверьте время перевода',
      faq3Desc: 'Перевод должен быть выполнен в течение времени действия заявки',
      faq4: 'Обратитесь в поддержку',
      faq4Desc: 'Если все верно, напишите в поддержку @operator_luxon_bot'
    },
    en: {
      waiting: 'Please wait',
      checking: 'Checking your payment...',
      success: 'Payment successful!',
      successMessage: 'Your balance has been topped up!',
      error: 'Request rejected',
      errorMessage: 'Your request has been rejected.',
      rejectionReason: 'Rejection reason:',
      checkPayment: 'Check payment',
      confirm: 'Confirm',
      checkAmount: 'Please check that you sent the exact amount to the penny',
      back: 'Back',
      backHome: 'Back to home',
      questions: 'What can help:',
      faq1: 'Check the transfer amount',
      faq1Desc: 'Make sure you sent the exact amount to the penny',
      faq2: 'Check the details',
      faq2Desc: 'Make sure you transferred to the correct details',
      faq3: 'Check the transfer time',
      faq3Desc: 'The transfer must be completed within the request validity period',
      faq4: 'Contact support',
      faq4Desc: 'If everything is correct, write to support @operator_luxon_bot'
    },
    ky: {
      waiting: 'Күтүңүз',
      checking: 'Төлөмүңүздү текшерип жатабыз...',
      success: 'Төлөм ийгиликтүү!',
      successMessage: 'Балансыңыз толукталды!',
      error: 'Өтүнүч четке кагылды',
      errorMessage: 'Кечиресиз, сиздин өтүнүчүңүз четке кагылды.',
      rejectionReason: 'Четке кагуу себеби:',
      checkPayment: 'Төлөмдү текшериңиз',
      confirm: 'Ырастоо',
      checkAmount: 'Сиз тийиштүү сумманы тийиштүү копейкага чейин жөнөткөнүңүздү текшериңиз',
      back: 'Артка',
      backHome: 'Башкы бетке',
      questions: 'Эмне жардам берет:',
      faq1: 'Которуу суммасын текшериңиз',
      faq1Desc: 'Сиз так сумманы копейкага чейин жөнөткөнүңүздү текшериңиз',
      faq2: 'Реквизиттерди текшериңиз',
      faq2Desc: 'Сиз туура реквизиттерге которгонуңузду текшериңиз',
      faq3: 'Которуу убактысын текшериңиз',
      faq3Desc: 'Которуу өтүнүчтүн жарактуулук мөөнөтүндө аткарылышы керек',
      faq4: 'Колдоого кайрылыңыз',
      faq4Desc: 'Эгерде баары туура болсо, колдоого @operator_luxon_bot жазыңыз'
    },
    uz: {
      waiting: 'Kuting',
      checking: 'To\'lovingizni tekshiryapmiz...',
      success: 'To\'lov muvaffaqiyatli!',
      successMessage: 'Balansingiz to\'ldirildi!',
      error: 'So\'rov rad etildi',
      errorMessage: 'Afsuski, so\'rovingiz rad etildi.',
      rejectionReason: 'Rad etish sababi:',
      checkPayment: 'To\'lovni tekshiring',
      confirm: 'Tasdiqlash',
      checkAmount: 'Iltimos, siz to\'liq summani to\'liq tiyincha yuborganingizni tekshiring',
      back: 'Orqaga',
      backHome: 'Bosh sahifaga',
      questions: 'Nima yordam beradi:',
      faq1: 'O\'tkazma summasini tekshiring',
      faq1Desc: 'Siz aniq summani tiyincha yuborganingizni tekshiring',
      faq2: 'Rekvizitlarni tekshiring',
      faq2Desc: 'Siz to\'g\'ri rekvizitlarga o\'tkazganingizni tekshiring',
      faq3: 'O\'tkazma vaqtini tekshiring',
      faq3Desc: 'O\'tkazma so\'rovning amal qilish muddati ichida bajarilishi kerak',
      faq4: 'Qo\'llab-quvvatlashga murojaat qiling',
      faq4Desc: 'Agar hammasi to\'g\'ri bo\'lsa, qo\'llab-quvvatlashga @operator_luxon_bot yozing'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  useEffect(() => {
    
    const transactionId = localStorage.getItem('deposit_transaction_id') || localStorage.getItem('deposit_request_id')
    if (!transactionId) {
      
      router.push('/')
      return
    }

    setRequestId(transactionId)
  }, [router])

  useEffect(() => {
    if (!requestId) return

    
    checkPaymentStatus()

    
    
    const interval = setInterval(() => {
      checkPaymentStatus()
    }, 3000)

    return () => clearInterval(interval)
    
  }, [requestId])

  const checkPaymentStatus = async () => {
    if (!requestId) return

    try {
      const apiUrl = getApiBase()
      
      const response = await fetch(`${apiUrl}/api/requests/${requestId}`)
      
      if (!response.ok) {
        console.error('Failed to fetch request status:', response.status)
        return
      }

      const data = await response.json()
      
      
      if (data.success && data.data) {
        const requestStatus = data.data.status
        const processedBy = data.data.processedBy
        const statusDetail = data.data.statusDetail || data.data.status_detail
        const amount = data.data.amount

        if (amount) {
          setRequestAmount(amount)
        }


        
        
        
        const isAutoDeposit = requestStatus === 'completed' && processedBy === 'автопополнение'
        const isManualCompleted = requestStatus === 'completed' || 
                                   requestStatus === 'approved' || 
                                   requestStatus === 'auto_completed' || 
                                   requestStatus === 'autodeposit_success'
        
        if (isAutoDeposit || isManualCompleted) {
          setStatus('success')
          
          
          localStorage.removeItem('deposit_transaction_id')
          localStorage.removeItem('deposit_request_id')
          localStorage.removeItem('deposit_timer_start')
          localStorage.removeItem('deposit_bookmaker')
          localStorage.removeItem('deposit_user_id')
          localStorage.removeItem('deposit_amount')
          localStorage.removeItem('deposit_amount_usd')
          localStorage.removeItem('deposit_payment_type')
        } else if (['rejected', 'declined', 'failed'].includes(requestStatus)) {
          setStatus('error')
          
          
          if (statusDetail) {
            try {
              
              const parsed = JSON.parse(statusDetail)
              if (parsed.reason || parsed.message) {
                setRejectionReason(parsed.reason || parsed.message)
              } else {
                setRejectionReason(statusDetail)
              }
            } catch {
              
              setRejectionReason(statusDetail)
            }
          }
        } else {
        }
      } else {
        console.error('Invalid response data:', data)
      }
    } catch (error) {
      console.error('Error checking payment status:', error)
      
    }
  }

  const handleCheckPayment = () => {
    
    
    alert(t.checkAmount)
  }

  const handleConfirm = () => {
    
    const supportLink = 'https://t.me/operator_luxon_bot'
    window.open(supportLink, '_blank')
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col p-2">
      <FixedHeaderControls />

      {status === 'waiting' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-md">
            
            <div className="w-16 h-16 mx-auto border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white">{t.waiting}</h1>
              <p className="text-white/70 text-sm">{t.checking}</p>
            </div>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-md">
            
            <div className="w-16 h-16 mx-auto bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-bold text-green-400">{t.success}</h1>
              <p className="text-white text-sm">{t.successMessage}</p>
            </div>

            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors text-sm"
            >
              {t.backHome}
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 overflow-y-auto">
          <div className="text-center space-y-2 max-w-md mx-auto px-2 py-2">
            
            <div className="w-14 h-14 mx-auto bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500/50">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <div className="space-y-2">
              <div>
                <h1 className="text-lg font-bold text-red-400">{t.error}</h1>
                <p className="text-white/80 text-xs mt-1">{t.errorMessage}</p>
              </div>

              {requestAmount && (
                <div className="bg-black/40 backdrop-blur rounded-lg p-2 border border-white/20">
                  <p className="text-white/70 text-xs mb-1">{t.checkAmount}</p>
                  <p className="text-white text-sm">Сумма: <span className="font-bold text-green-400">{requestAmount} сом</span></p>
                </div>
              )}

              
              <div className="bg-black/40 backdrop-blur rounded-lg p-2 border border-white/20 text-left">
                <h3 className="text-white font-semibold mb-1.5 text-xs">{t.questions}</h3>
                <div className="space-y-1.5">
                  <div className="text-xs">
                    <p className="text-green-400 font-medium">• {t.faq1}</p>
                    <p className="text-white/50 text-[10px] leading-tight">{t.faq1Desc}</p>
                  </div>
                  <div className="text-xs">
                    <p className="text-green-400 font-medium">• {t.faq2}</p>
                    <p className="text-white/50 text-[10px] leading-tight">{t.faq2Desc}</p>
                  </div>
                  <div className="text-xs">
                    <p className="text-green-400 font-medium">• {t.faq3}</p>
                    <p className="text-white/50 text-[10px] leading-tight">{t.faq3Desc}</p>
                  </div>
                  <div className="text-xs">
                    <p className="text-green-400 font-medium">• {t.faq4}</p>
                    <p className="text-white/50 text-[10px] leading-tight">{t.faq4Desc}</p>
                  </div>
                </div>
              </div>

              {rejectionReason && (
                <div className="bg-red-900/30 rounded-lg p-2 border border-red-500/30">
                  <p className="text-red-300 font-semibold mb-1 text-xs">{t.rejectionReason}</p>
                  <p className="text-white/80 text-[10px] leading-tight">{rejectionReason}</p>
                </div>
              )}

              <div className="pt-1">
                <button
                  onClick={handleCheckPayment}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors text-sm"
                >
                  {t.checkPayment}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}