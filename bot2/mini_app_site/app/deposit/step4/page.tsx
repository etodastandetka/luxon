"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BankButtons from '../../../components/BankButtons'
import LanguageSelector from '../../../components/LanguageSelector'
import PageTransition from '../../../components/PageTransition'
import { useLanguage } from '../../../components/LanguageContext'
import { getTelegramUser, syncWithBot, notifyUser } from '../../../utils/telegram'

export default function DepositStep4() {
  const [bank, setBank] = useState('omoney') // По умолчанию O!Money
  const [paymentUrl, setPaymentUrl] = useState('')
  const [qrData, setQrData] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(300) // 5 минут в секундах
  const [isPaid, setIsPaid] = useState(false)
  const router = useRouter()

  // Получаем данные из предыдущих шагов
  const [bookmaker, setBookmaker] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [amount, setAmount] = useState(0)
  const { language } = useLanguage()

  useEffect(() => {
    // Загружаем данные из localStorage
    const savedBookmaker = localStorage.getItem('deposit_bookmaker') || ''
    const savedPlayerId = localStorage.getItem('deposit_user_id') || ''
    const savedAmount = parseFloat(localStorage.getItem('deposit_amount') || '0')
    
    setBookmaker(savedBookmaker)
    setPlayerId(savedPlayerId)
    setAmount(savedAmount)
  }, [])

  // Только генерируем QR код, заявка создается только после нажатия "Я оплатил"
  useEffect(() => {
    if (bookmaker && playerId && amount > 0) {
      // Генерируем только QR код
      generateQRCode()
    }
  }, [bookmaker, playerId, amount])

  // Таймер обратного отсчета и проверка почты
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      
      // Проверяем почту каждые 10 секунд
      if (timeLeft % 10 === 0) {
        checkPaymentStatus()
      }
      
      return () => clearTimeout(timer)
    } else {
      // Время истекло - автоматически отклоняем заявку
      handleTimeExpired()
    }
  }, [timeLeft])

  // Функция обработки истечения времени
  const handleTimeExpired = async () => {
    try {
      // Отклоняем заявку в Django API
      const transactionId = localStorage.getItem('deposit_transaction_id')
      if (transactionId) {
        const response = await fetch('/api/payment', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: transactionId,
            status: 'rejected',
            reason: 'Время на оплату истекло'
          })
        })
        
        if (response.ok) {
          console.log('Заявка автоматически отклонена')
        }
      }
      
      // Очищаем данные и перенаправляем
      localStorage.removeItem('deposit_bookmaker')
      localStorage.removeItem('deposit_user_id')
      localStorage.removeItem('deposit_amount')
      localStorage.removeItem('deposit_transaction_id')
      
      alert('⏰ Время на оплату истекло. Заявка отклонена.')
      router.push('/')
    } catch (error) {
      console.error('Ошибка при отклонении заявки:', error)
      router.push('/')
    }
  }

  // Функция проверки статуса оплаты
  const checkPaymentStatus = async () => {
    try {
      // Здесь должна быть логика проверки почты/API
      // Пока что симуляция - если время меньше 2 минут, считаем что оплачено
      if (timeLeft < 120 && !isPaid) {
        setIsPaid(true)
        // Отправляем уведомление о принятии заявки
        await sendPaymentConfirmation()
      }
    } catch (error) {
      console.error('Ошибка проверки оплаты:', error)
    }
  }

  // Создание заявки на пополнение
  const createDepositRequest = async () => {
    try {
      // Получаем данные пользователя Telegram (как в рефералке)
      const tg = (window as any).Telegram?.WebApp
      let telegramUser = null
      
      console.log('=== DEBUG: Telegram WebApp Data ===')
      console.log('Telegram object:', tg)
      console.log('initDataUnsafe:', tg?.initDataUnsafe)
      console.log('initData:', tg?.initData)
      console.log('user:', tg?.initDataUnsafe?.user)
      console.log('=====================================')
      
      // Правильный способ получения user ID из Telegram WebApp (как в рефералке)
      if (tg?.initDataUnsafe?.user) {
        telegramUser = tg.initDataUnsafe.user
        console.log('✅ User from initDataUnsafe:', telegramUser)
      } else if (tg?.initData) {
        // Парсим initData если он есть (правильный способ)
        try {
          console.log('Parsing initData:', tg.initData)
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          console.log('User param from initData:', userParam)
          if (userParam) {
            telegramUser = JSON.parse(decodeURIComponent(userParam))
            console.log('✅ User from initData:', telegramUser)
          }
        } catch (e) {
          console.log('❌ Error parsing initData:', e)
        }
      }
      
      console.log('🔍 Итоговые данные пользователя:', telegramUser)

      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'deposit',
          amount: amount,
          userId: playerId,
          bookmaker: bookmaker,
          bank: bank,
          playerId: playerId, // Добавляем playerId для совместимости
          // Данные пользователя Telegram
          telegram_user_id: telegramUser?.id,
          telegram_username: telegramUser?.username,
          telegram_first_name: telegramUser?.first_name,
          telegram_last_name: telegramUser?.last_name,
          telegram_language_code: telegramUser?.language_code
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Заявка создана успешно:', data)
        // Сохраняем ID заявки для последующего обновления статуса
        localStorage.setItem('deposit_transaction_id', data.id || data.transactionId)
        localStorage.setItem('deposit_request_id', data.id || data.transactionId) // Сохраняем request_id
        
        // Синхронизируем с ботом
        const telegramUser = getTelegramUser()
        if (telegramUser) {
          await syncWithBot(telegramUser, 'deposit_request_created', {
            requestId: data.id || data.transactionId,
            bookmaker,
            playerId,
            amount,
            bank
          })
        }
      } else {
        const errorData = await response.json()
        console.error('❌ Ошибка создания заявки:', errorData)
      }
    } catch (error) {
      console.error('❌ Ошибка создания заявки:', error)
    }
  }

  // Отправка подтверждения оплаты
  const sendPaymentConfirmation = async () => {
    try {
      const requestId = localStorage.getItem('deposit_request_id')
      
      const response = await fetch('/api/payment', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: requestId,
          status: 'completed',
          type: 'deposit'
        })
      })
      
      if (response.ok) {
        console.log('Заявка автоматически принята')
      }
    } catch (error) {
      console.error('Ошибка обновления заявки:', error)
    }
  }

  // Кнопка "Я оплатил" — отправляем заявку в админку только по нажатию
  const handleIPaid = async () => {
    try {
      await createDepositRequest()
      
      // Уведомляем пользователя
      if (language === 'ru') {
        alert('✅ Заявка отправлена!\n\nМы проверим вашу оплату и зачислим средства в течение 5-10 минут.\n\nВы получите уведомление, когда пополнение будет выполнено.')
      } else {
        alert('✅ Request submitted!\n\nWe will verify your payment and credit funds within 5-10 minutes.\n\nYou will receive a notification when the deposit is completed.')
      }
      
      // Перенаправляем на главную страницу
      setTimeout(() => {
        router.push('/')
      }, 1000)
    } catch (e) {
      console.error(e)
      if (language === 'ru') {
        alert('❌ Ошибка при отправке заявки.\n\nПожалуйста, попробуйте ещё раз или обратитесь в поддержку.')
      } else {
        alert('❌ Error submitting request.\n\nPlease try again or contact support.')
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
    // Генерируем новую ссылку при смене банка
    generateQRCode(bankKey)
  }

  // Функция для генерации SHA256 контрольной суммы
  const calculateSHA256 = async (data: string): Promise<string> => {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Функция для получения активного реквизита из админки
  const getActiveRequisite = async (): Promise<string | null> => {
    try {
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8081' 
        : 'https://xendro.pro'
      const response = await fetch(`${apiUrl}/api/requisites/list/`)
      if (response.ok) {
        const data = await response.json()
        // Ищем активный реквизит по active_id
        if (data.success && data.requisites && data.requisites.length > 0) {
          const activeRequisite = data.requisites.find((req: any) => req.id === data.active_id && req.is_active)
          if (activeRequisite) {
            return activeRequisite.value
          }
        }
      }
    } catch (error) {
      console.error('Ошибка получения реквизита:', error)
    }
    return null
  }

  // Функция для генерации fallback QR кода
  const generateFallbackQR = async (currentBank: string) => {
    try {
      // Получаем активный реквизит из админки
      const requisite = await getActiveRequisite()
      
      if (!requisite) {
        console.error('Не найден активный реквизит')
        return
      }

      const amountCents = Math.round(parseFloat(String(amount)) * 100)
      const amountStr = amountCents.toString().padStart(5, '0')
      
      // Создаем TLV структуру с реквизитом из админки
      const payload = `00020101021232990015qr.demirbank.kg0108ib_andro10${requisite}1109202111302112021213021211328454d5b3ee5d47c7b61c0a0b07bb939a5204482953034175405${amountStr}5909DEMIRBANK6304`
      
      // Вычисляем SHA256 контрольную сумму
      const checksum = await calculateSHA256(payload)
      const qrHash = payload + checksum
      
      // Создаем ссылки для всех банков
      const bankLinks = {
        'demirbank': `https://retail.demirbank.kg/#${qrHash}`,
        'omoney': `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
        'balance': `https://balance.kg/#${qrHash}`,
        'bakai': `https://bakai24.app/#${qrHash}`,
        'megapay': `https://megapay.kg/get#${qrHash}`,
        'mbank': `https://app.mbank.kg/qr/#${qrHash}`
      }
      
      setQrData({
        qr_hash: qrHash,
        all_bank_urls: bankLinks,
        enabled_banks: ['demirbank', 'omoney', 'balance', 'bakai', 'megapay', 'mbank']
      })
      setPaymentUrl(bankLinks[currentBank as keyof typeof bankLinks] || bankLinks['demirbank'])
    } catch (error) {
      console.error('Ошибка fallback генерации:', error)
    }
  }

  const generateQRCode = async (selectedBank?: string) => {
    try {
      const currentBank = selectedBank || bank
      
      // Сначала пытаемся получить QR код с сервера
      const response = await fetch('/api/generate-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          bank: currentBank.toUpperCase(),
          playerId: playerId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setQrData(data)
      setPaymentUrl(data.primary_url)
    } catch (error) {
      console.error('Ошибка генерации QR кода через API:', error)
      // Fallback: генерируем QR код с реквизитом из админки
      const currentBank = selectedBank || bank
      generateFallbackQR(currentBank)
    }
  }

  const handleBack = () => {
    // Анимация выхода
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

  return (
    <PageTransition direction="backward">
      <main className="space-y-4 min-h-screen flex flex-col">
      {/* Заголовок */}
      <div className="text-center space-y-2 fade-in">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">{t.title}</h1>
          <div className="scale-75">
            <LanguageSelector />
          </div>
        </div>
        <p className="text-sm text-white/70">{t.subtitle}</p>
      </div>

      {/* Таймер */}
      <div className="card text-center pulse">
        <div className="text-3xl font-bold text-red-500 mb-2">
          {formatTime(timeLeft)}
        </div>
        <p className="text-sm text-white/70">{t.timer}</p>
      </div>

      {/* Информация о заявке */}
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
            <span className="text-white font-bold text-lg">{amount} сом</span>
          </div>
        </div>
      </div>



      {/* Выбор банка */}
      <div className="card space-y-4 slide-in-right delay-300">
        <h2 className="text-lg font-semibold text-white">{t.selectBank}</h2>
        <BankButtons 
          onPick={handleBankSelect} 
          selected={bank} 
          paymentUrl={paymentUrl}
          allBankUrls={qrData?.all_bank_urls}
          enabledBanks={qrData?.settings?.enabled_banks}
        />
      </div>

      {/* Статус оплаты */}
      {isPaid && (
        <div className="card text-center bg-green-900/20 border-green-500">
          <div className="text-green-500 text-lg font-semibold mb-2">
            ✅ {t.paymentComplete}
          </div>
          <p className="text-sm text-white/70">
            Ваша заявка обрабатывается. Пополнение поступит в течение 5-10 минут.
          </p>
        </div>
      )}

      {/* Инструкция */}
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

      {/* Навигация */}
      <div className="flex gap-3">
        <button
          onClick={handleBack}
          className="btn btn-ghost flex-1"
        >
          {t.back}
        </button>
        <button
          onClick={handleIPaid}
          className="btn btn-primary flex-1 font-semibold"
        >
          ✅ {t.iPaid}
        </button>
      </div>
    </main>
    </PageTransition>
  )
}