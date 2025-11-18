"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'
import PageTransition from '../../../components/PageTransition'

export default function DepositWaitingPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const [status, setStatus] = useState<'waiting' | 'success' | 'error'>('waiting')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
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
      questions: 'Вопросы:'
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
      questions: 'Questions:'
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
      questions: 'Суроолор:'
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
      questions: 'Savollar:'
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
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'
      
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
          setShowConfetti(true)
          
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

  const handleConfirm = async () => {
    if (!requestId) return

    try {
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'
      
      // Отправляем запрос на подтверждение заявки
      const response = await fetch(`${apiUrl}/api/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'approved',
        }),
      })

      if (response.ok) {
        // Обновляем статус на успех
        setStatus('success')
        setShowConfetti(true)
      } else {
        alert('Ошибка при подтверждении заявки')
      }
    } catch (error) {
      console.error('Error confirming request:', error)
      alert('Ошибка при подтверждении заявки')
    }
  }

  // Конфетти анимация
  useEffect(() => {
    if (showConfetti) {
      createConfetti()
    }
  }, [showConfetti])

  const createConfetti = () => {
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    const confettiCount = 100

    for (let i = 0; i < confettiCount; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div')
        confetti.style.position = 'fixed'
        confetti.style.left = Math.random() * 100 + '%'
        confetti.style.top = '-10px'
        confetti.style.width = Math.random() * 10 + 5 + 'px'
        confetti.style.height = confetti.style.width
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0'
        confetti.style.opacity = '1'
        confetti.style.zIndex = '9999'
        confetti.style.pointerEvents = 'none'
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`
        
        document.body.appendChild(confetti)

        const animation = confetti.animate([
          { 
            transform: `translateY(0) rotate(${Math.random() * 360}deg)`,
            opacity: 1
          },
          { 
            transform: `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 720}deg)`,
            opacity: 0
          }
        ], {
          duration: Math.random() * 2000 + 2000,
          easing: 'cubic-bezier(0.5, 0, 0.5, 1)'
        })

        animation.onfinish = () => {
          confetti.remove()
        }
      }, i * 20)
    }
  }

  return (
    <PageTransition direction="forward">
      <div className="min-h-screen bg-gradient-to-b from-green-950 to-green-900 flex flex-col items-center justify-center p-4">
        <FixedHeaderControls />

        {status === 'waiting' && (
          <div className="text-center space-y-6 max-w-md">
            {/* Анимация загрузки */}
            <div className="relative">
              <div className="w-32 h-32 mx-auto border-8 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-16 h-16 text-green-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-white">{t.waiting}</h1>
              <p className="text-white/70 text-lg">{t.checking}</p>
            </div>

            {/* Пульсирующие точки */}
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center space-y-6 max-w-md animate-fade-in">
            {/* Иконка успеха */}
            <div className="relative">
              <div className="w-32 h-32 mx-auto bg-green-500 rounded-full flex items-center justify-center animate-scale-in">
                <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              {/* Взрыв хлопушек */}
              {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ width: '200px', height: '200px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                  {[...Array(30)].map((_, i) => {
                    const angle = (i * 360) / 30
                    const distance = 60 + Math.random() * 40
                    const color = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#fbbf24'][Math.floor(Math.random() * 7)]
                    const radian = (angle * Math.PI) / 180
                    const x = Math.cos(radian) * distance
                    const y = Math.sin(radian) * distance
                    return (
                      <div
                        key={i}
                        className="absolute"
                        style={{
                          left: '50%',
                          top: '50%',
                          width: '8px',
                          height: '8px',
                          backgroundColor: color,
                          borderRadius: Math.random() > 0.5 ? '50%' : '0',
                          transform: `translate(-50%, -50%)`,
                          animation: `explode-${i} 1.5s ease-out forwards`,
                          animationDelay: `${i * 0.03}s`
                        }}
                      />
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-green-400 animate-bounce">{t.success}</h1>
              <p className="text-white text-xl">{t.successMessage}</p>
            </div>

            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
              {t.backHome}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center space-y-6 max-w-md animate-fade-in">
            {/* Иконка отклонения */}
            <div className="relative">
              <div className="w-32 h-32 mx-auto bg-red-500 rounded-full flex items-center justify-center animate-scale-in">
                <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h1 className="text-4xl font-bold text-red-400">{t.error}</h1>
                <p className="text-white text-xl mt-2">{t.errorMessage}</p>
              </div>

              {rejectionReason && (
                <div className="bg-red-900/50 rounded-lg p-4 border border-red-700">
                  <p className="text-red-300 font-semibold mb-2">{t.rejectionReason}</p>
                  <p className="text-white">{rejectionReason}</p>
                </div>
              )}

              {requestAmount && (
                <div className="bg-yellow-900/50 rounded-lg p-4 border border-yellow-700">
                  <p className="text-yellow-300 font-semibold mb-2">{t.checkAmount}</p>
                  <p className="text-white text-lg">Сумма заявки: <span className="font-bold">{requestAmount} сом</span></p>
                </div>
              )}

              <div className="space-y-3 pt-4">
                <button
                  onClick={handleCheckPayment}
                  className="w-full px-6 py-3 bg-yellow-500 text-black rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
                >
                  {t.checkPayment}
                </button>
                <button
                  onClick={handleConfirm}
                  className="w-full px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
                >
                  {t.confirm}
                </button>
              </div>
            </div>

            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              {t.backHome}
            </button>
          </div>
        )}

        {/* CSS для анимаций */}
        <style jsx global>{`
          @keyframes fade-in {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes scale-in {
            from {
              transform: scale(0);
            }
            to {
              transform: scale(1);
            }
          }

          ${[...Array(30)].map((_, i) => {
            const angle = (i * 360) / 30
            const distance = 60 + (i % 3) * 20
            const radian = (angle * Math.PI) / 180
            const x = Math.cos(radian) * distance
            const y = Math.sin(radian) * distance
            return `
            @keyframes explode-${i} {
              0% {
                opacity: 1;
                transform: translate(-50%, -50%) translateX(0) translateY(0) scale(1) rotate(0deg);
              }
              100% {
                opacity: 0;
                transform: translate(-50%, -50%) translateX(${x}px) translateY(${y}px) scale(0) rotate(360deg);
              }
            }`
          }).join('')}

          .animate-fade-in {
            animation: fade-in 0.5s ease-out;
          }

          .animate-scale-in {
            animation: scale-in 0.5s ease-out;
          }
        `}</style>
      </div>
    </PageTransition>
  )
}
