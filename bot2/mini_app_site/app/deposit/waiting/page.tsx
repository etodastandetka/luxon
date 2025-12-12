"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'
import { getApiBase } from '../../../utils/fetch'

export default function DepositWaitingPage() {
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
    // Получаем ID заявки из localStorage
    const transactionId = localStorage.getItem('deposit_transaction_id') || localStorage.getItem('deposit_request_id')
    if (!transactionId) {
      // Если нет ID заявки, перенаправляем на главную
      router.push('/')
      return
    }

    setRequestId(transactionId)
  }, [router])

  useEffect(() => {
    if (!requestId) return

    // Начинаем проверку статуса сразу при загрузке
    checkPaymentStatus()

    // Проверяем статус каждые 3 секунды для более быстрого обновления
    // Продолжаем проверять даже если статус изменился, чтобы обновить UI
    const interval = setInterval(() => {
      checkPaymentStatus()
    }, 3000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      console.log('Payment status check:', { requestId, data })
      
      if (data.success && data.data) {
        const requestStatus = data.data.status
        const processedBy = data.data.processedBy
        const statusDetail = data.data.statusDetail || data.data.status_detail
        const amount = data.data.amount

        if (amount) {
          setRequestAmount(amount)
        }

        console.log('Request status:', { requestStatus, processedBy, statusDetail })

        // Проверяем успешные статусы (включая автопополнение)
        // Автопополнение: статус completed с processedBy = 'автопополнение'
        // Ручное подтверждение: статус completed, approved, auto_completed, autodeposit_success
        const isAutoDeposit = requestStatus === 'completed' && processedBy === 'автопополнение'
        const isManualCompleted = requestStatus === 'completed' || 
                                   requestStatus === 'approved' || 
                                   requestStatus === 'auto_completed' || 
                                   requestStatus === 'autodeposit_success'
        
        if (isAutoDeposit || isManualCompleted) {
          console.log('Payment successful! Setting status to success')
          setStatus('success')
          
          // Очищаем localStorage
          localStorage.removeItem('deposit_transaction_id')
          localStorage.removeItem('deposit_request_id')
          localStorage.removeItem('deposit_timer_start')
          localStorage.removeItem('deposit_bookmaker')
          localStorage.removeItem('deposit_user_id')
          localStorage.removeItem('deposit_amount')
          localStorage.removeItem('deposit_amount_usd')
          localStorage.removeItem('deposit_payment_type')
        } else if (['rejected', 'declined', 'failed'].includes(requestStatus)) {
          console.log('Payment rejected! Setting status to error')
          setStatus('error')
          
          // Парсим причину отклонения из statusDetail
          if (statusDetail) {
            try {
              // Если statusDetail это JSON, парсим его
              const parsed = JSON.parse(statusDetail)
              if (parsed.reason || parsed.message) {
                setRejectionReason(parsed.reason || parsed.message)
              } else {
                setRejectionReason(statusDetail)
              }
            } catch {
              // Если не JSON, используем как есть
              setRejectionReason(statusDetail)
            }
          }
        } else {
          console.log('Payment still pending:', requestStatus)
        }
      } else {
        console.error('Invalid response data:', data)
      }
    } catch (error) {
      console.error('Error checking payment status:', error)
      // В случае ошибки продолжаем ждать
    }
  }

  const handleCheckPayment = () => {
    // Перенаправляем на страницу с инструкциями по проверке оплаты
    // Или показываем модальное окно с информацией
    alert(t.checkAmount)
  }

  const handleConfirm = () => {
    // Перенаправляем в поддержку для подтверждения заявки
    const supportLink = 'https://t.me/operator_luxon_bot'
    window.open(supportLink, '_blank')
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col p-2">
      <FixedHeaderControls />

      {status === 'waiting' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-md">
            {/* Простая иконка загрузки */}
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
            {/* Простая иконка успеха */}
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
            {/* Простая иконка отклонения */}
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

              {/* Компактный FAQ */}
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
