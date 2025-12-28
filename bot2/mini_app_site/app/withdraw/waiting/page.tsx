"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'
import { getApiBase } from '../../../utils/fetch'

export default function WithdrawWaitingPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const [status, setStatus] = useState<'waiting' | 'success' | 'error'>('waiting')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [requestAmount, setRequestAmount] = useState<string | null>(null)

  const translations = {
    ru: {
      waiting: 'Заявка отправлена',
      checking: 'Ваша заявка на вывод отправлена. Ожидайте обработки от 1 до 5 минут.',
      success: 'Вывод выполнен!',
      successMessage: 'Ваша заявка на вывод обработана!',
      error: 'Заявка отклонена',
      errorMessage: 'Ваша заявка отклонена.',
      rejectionReason: 'Причина отклонения:',
      back: 'На главную',
      backHome: 'На главную',
      questions: 'Что может помочь:',
      faq1: 'Проверьте данные',
      faq1Desc: 'Убедитесь, что все данные указаны правильно',
      faq2: 'Проверьте реквизиты',
      faq2Desc: 'Убедитесь, что реквизиты для получения средств указаны верно',
      faq3: 'Обратитесь в поддержку',
      faq3Desc: 'Если все верно, напишите в поддержку @operator_luxon_bot'
    },
    en: {
      waiting: 'Request sent',
      checking: 'Your withdrawal request has been sent. Please wait for processing from 1 to 5 minutes.',
      success: 'Withdrawal completed!',
      successMessage: 'Your withdrawal request has been processed!',
      error: 'Request rejected',
      errorMessage: 'Your request has been rejected.',
      rejectionReason: 'Rejection reason:',
      back: 'Back',
      backHome: 'Back to home',
      questions: 'What can help:',
      faq1: 'Check the data',
      faq1Desc: 'Make sure all data is correct',
      faq2: 'Check the details',
      faq2Desc: 'Make sure the withdrawal details are correct',
      faq3: 'Contact support',
      faq3Desc: 'If everything is correct, write to support @operator_luxon_bot'
    },
    ky: {
      waiting: 'Өтүнүч жөнөтүлдү',
      checking: 'Сиздин чыгаруу өтүнүчүңүз жөнөтүлдү. Өнүктүрүү үчүн 1-5 мүнөт күтүңүз.',
      success: 'Чыгаруу ийгиликтүү!',
      successMessage: 'Сиздин чыгаруу өтүнүчүңүз иштетилди!',
      error: 'Өтүнүч четке кагылды',
      errorMessage: 'Кечиресиз, сиздин өтүнүчүңүз четке кагылды.',
      rejectionReason: 'Четке кагуу себеби:',
      back: 'Артка',
      backHome: 'Башкы бетке',
      questions: 'Эмне жардам берет:',
      faq1: 'Маалыматтарды текшериңиз',
      faq1Desc: 'Бардык маалыматтардын туура экенин текшериңиз',
      faq2: 'Реквизиттерди текшериңиз',
      faq2Desc: 'Чыгаруу реквизиттеринин туура экенин текшериңиз',
      faq3: 'Колдоого кайрылыңыз',
      faq3Desc: 'Эгерде баары туура болсо, колдоого @operator_luxon_bot жазыңыз'
    },
    uz: {
      waiting: 'So\'rov yuborildi',
      checking: 'Yechib olish so\'rovingiz yuborildi. Qayta ishlash uchun 1-5 daqiqa kuting.',
      success: 'Yechib olish muvaffaqiyatli!',
      successMessage: 'Yechib olish so\'rovingiz qayta ishlandi!',
      error: 'So\'rov rad etildi',
      errorMessage: 'Afsuski, so\'rovingiz rad etildi.',
      rejectionReason: 'Rad etish sababi:',
      back: 'Orqaga',
      backHome: 'Bosh sahifaga',
      questions: 'Nima yordam beradi:',
      faq1: 'Ma\'lumotlarni tekshiring',
      faq1Desc: 'Barcha ma\'lumotlar to\'g\'ri ekanligini tekshiring',
      faq2: 'Rekvizitlarni tekshiring',
      faq2Desc: 'Yechib olish rekvizitlarining to\'g\'ri ekanligini tekshiring',
      faq3: 'Qo\'llab-quvvatlashga murojaat qiling',
      faq3Desc: 'Agar hammasi to\'g\'ri bo\'lsa, qo\'llab-quvvatlashga @operator_luxon_bot yozing'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  useEffect(() => {
    // Получаем ID заявки из localStorage
    const transactionId = localStorage.getItem('withdraw_transaction_id') || localStorage.getItem('withdraw_request_id')
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
    checkWithdrawStatus()

    // Проверяем статус каждые 3 секунды
    const interval = setInterval(() => {
      checkWithdrawStatus()
    }, 3000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  const checkWithdrawStatus = async () => {
    if (!requestId) return

    try {
      const apiUrl = getApiBase()
      
      const response = await fetch(`${apiUrl}/api/requests/${requestId}`)
      
      if (!response.ok) {
        console.error('Failed to fetch request status:', response.status)
        return
      }

      const data = await response.json()
      
      console.log('Withdraw status check:', { requestId, data })
      
      if (data.success && data.data) {
        const requestStatus = data.data.status
        const statusDetail = data.data.statusDetail || data.data.status_detail
        const amount = data.data.amount

        if (amount) {
          setRequestAmount(amount)
        }

        console.log('Request status:', { requestStatus, statusDetail })

        // Проверяем успешные статусы
        const isCompleted = requestStatus === 'completed' || 
                           requestStatus === 'approved' || 
                           requestStatus === 'paid'
        
        if (isCompleted) {
          console.log('Withdrawal successful! Setting status to success')
          setStatus('success')
          
          // Очищаем localStorage
          localStorage.removeItem('withdraw_transaction_id')
          localStorage.removeItem('withdraw_request_id')
          localStorage.removeItem('withdraw_bookmaker')
          localStorage.removeItem('withdraw_bank')
          localStorage.removeItem('withdraw_qr_photo')
          localStorage.removeItem('withdraw_phone')
          localStorage.removeItem('withdraw_user_id')
          localStorage.removeItem('withdraw_site_code')
          localStorage.removeItem('withdraw_amount')
          localStorage.removeItem('withdraw_request_created')
        } else if (['rejected', 'declined', 'failed'].includes(requestStatus)) {
          console.log('Withdrawal rejected! Setting status to error')
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
          console.log('Withdrawal still pending:', requestStatus)
        }
      } else {
        console.error('Invalid response data:', data)
      }
    } catch (error) {
      console.error('Error checking withdrawal status:', error)
      // В случае ошибки продолжаем ждать
    }
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col p-2">
      <FixedHeaderControls />

      {status === 'waiting' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md px-4">
            {/* Простая иконка загрузки */}
            <div className="w-16 h-16 mx-auto border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">{t.waiting}</h1>
              <p className="text-white/70 text-sm leading-relaxed">{t.checking}</p>
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
                  <p className="text-white/70 text-xs mb-1">Сумма вывода:</p>
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
                  onClick={() => router.push('/')}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors text-sm"
                >
                  {t.backHome}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

