"use client"
import { useState, useEffect, useRef } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'
import { checkUserBlocked, getTelegramUserId } from '../../../utils/telegram'
import { safeFetch, getApiBase } from '../../../utils/fetch'

export default function WithdrawStep3() {
  const router = useRouter()
  const { language } = useLanguage()
  const [userId, setUserId] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null)
  const [bookmaker, setBookmaker] = useState('')
  const [bank, setBank] = useState('')
  const [phone, setPhone] = useState('')
  const [qrPhoto, setQrPhoto] = useState('')
  const idSectionRef = useRef<HTMLDivElement>(null)
  const codeSectionRef = useRef<HTMLDivElement>(null)

  const translations = {
    ru: {
      title: 'Вывод средств',
      accountId: 'ID аккаунта',
      accountIdPlaceholder: 'Введите ID',
      siteCode: 'Код с сайта',
      siteCodePlaceholder: 'Введите код',
      checking: 'Проверка кода...',
      submitting: 'Отправка заявки...',
      back: 'Назад'
    },
    en: {
      title: 'Withdraw',
      accountId: 'Account ID',
      accountIdPlaceholder: 'Enter ID',
      siteCode: 'Site code',
      siteCodePlaceholder: 'Enter code',
      checking: 'Checking code...',
      submitting: 'Submitting request...',
      back: 'Back'
    },
    ky: {
      title: 'Акчаны чыгаруу',
      accountId: 'Аккаунт ID',
      accountIdPlaceholder: 'ID киргизиңиз',
      siteCode: 'Сайт коду',
      siteCodePlaceholder: 'Код киргизиңиз',
      checking: 'Код текшерилуүдө...',
      submitting: 'Өтүнүч жөнөтүлүүдө...',
      back: 'Артка'
    },
    uz: {
      title: 'Pulni yechib olish',
      accountId: 'Hisob ID',
      accountIdPlaceholder: 'ID kiriting',
      siteCode: 'Sayt kodi',
      siteCodePlaceholder: 'Kod kiriting',
      checking: 'Kod tekshirilmoqda...',
      submitting: 'So\'rov yuborilmoqda...',
      back: 'Orqaga'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  useEffect(() => {
    // Проверяем, что пользователь прошел предыдущие шаги
    const savedBookmaker = localStorage.getItem('withdraw_bookmaker')
    const savedBank = localStorage.getItem('withdraw_bank')
    const savedQrPhoto = localStorage.getItem('withdraw_qr_photo')
    const savedPhone = localStorage.getItem('withdraw_phone')
    
    if (!savedBookmaker || !savedBank || !savedQrPhoto || !savedPhone) {
      router.push('/withdraw/step1')
      return
    }

    setBookmaker(savedBookmaker)
    setBank(savedBank)
    setQrPhoto(savedQrPhoto)
    setPhone(savedPhone)

    // Автозаполнение ID из cookies
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }
    
    const cookieName = `user_id_${savedBookmaker}`
    const savedUserId = getCookie(cookieName)
    
    if (savedUserId) {
      setUserId(savedUserId)
    }
  }, [router])

  // Автоматическая проверка кода и отправка заявки при заполнении обоих полей
  useEffect(() => {
    // Проверяем только если оба поля заполнены, нет активных операций и нет уже проверенной суммы
    if (userId.trim() && siteCode.trim() && !isCheckingCode && !isSubmitting && !withdrawAmount && !error) {
      // Небольшая задержка перед автоматической проверкой
      const timer = setTimeout(() => {
        handleCheckAndSubmit()
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [userId, siteCode])

  const handleCheckAndSubmit = async () => {
    if (!userId.trim() || !siteCode.trim()) {
      return
    }

    if (isCheckingCode || isSubmitting) {
      return
    }

    setIsCheckingCode(true)
    setError(null)
    setWithdrawAmount(null)
    
    try {
      const base = getApiBase()
      
      // Проверяем код и получаем сумму
      const response = await safeFetch(`${base}/api/withdraw-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookmaker: bookmaker,
          playerId: userId,
          code: siteCode.trim(),
        }),
        timeout: 30000,
        retries: 2,
        retryDelay: 1000
      })

      if (!response.ok) {
        let errorText = ''
        let errorData: any = null
        try {
          errorText = await response.text()
          try {
            errorData = JSON.parse(errorText)
          } catch (e) {}
        } catch (e) {}
        
        let errorMessage = `Ошибка сервера: ${response.status}`
        if (errorData?.error) {
          errorMessage = errorData.error
        } else if (errorData?.message) {
          errorMessage = errorData.message
        } else if (errorText && errorText.length < 200) {
          errorMessage = errorText
        }
        
        setError(errorMessage)
        setIsCheckingCode(false)
        return
      }

      const data = await response.json()
      
      if (data.success) {
        let amount: number | null = null
        
        if (data.data && data.data.amount !== undefined && data.data.amount !== null) {
          amount = parseFloat(String(data.data.amount))
        } else if (data.amount !== undefined && data.amount !== null) {
          amount = parseFloat(String(data.amount))
        }
        
        if (amount !== null && !isNaN(amount) && amount > 0) {
          setWithdrawAmount(amount)
          setIsCheckingCode(false)
          
          // Автоматически отправляем заявку после успешной проверки
          await submitRequest(amount)
        } else {
          setError('Не удалось получить сумму вывода. Попробуйте еще раз.')
          setIsCheckingCode(false)
        }
      } else {
        let errorMessage = data.error || data.message || 'Код неверный или вывод не найден'
        setError(errorMessage)
        setIsCheckingCode(false)
      }
    } catch (error: any) {
      console.error('Ошибка проверки кода:', error)
      setError('Ошибка проверки кода. Попробуйте еще раз.')
      setIsCheckingCode(false)
    }
  }

  const submitRequest = async (amount: number) => {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const base = getApiBase()
      const telegramUserId = getTelegramUserId()
      
      if (!telegramUserId) {
        throw new Error('Не удалось определить ID пользователя. Перезагрузите страницу.')
      }

      // Проверяем, не заблокирован ли пользователь
      const isBlocked = await checkUserBlocked(telegramUserId)
      if (isBlocked) {
        alert('Ваш аккаунт заблокирован. Вы не можете создавать заявки на вывод.')
        window.location.href = '/blocked'
        return
      }

      // Проверяем, не отправлял ли пользователь уже заявку
      const submitKey = `withdraw_submitted_${telegramUserId}`
      const hasSubmitted = localStorage.getItem(submitKey)
      if (hasSubmitted) {
        alert('Вы уже отправили заявку на вывод. Дождитесь обработки.')
        router.push('/')
        return
      }

      // Для 1xbet сначала выполняем вывод
      const normalizedBookmaker = bookmaker.toLowerCase()
      if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet') {
        const withdrawResponse = await safeFetch(`${base}/api/withdraw-execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookmaker: bookmaker,
            playerId: userId,
            code: siteCode.trim(),
            amount: amount,
          }),
          timeout: 30000,
          retries: 2,
          retryDelay: 1000
        })

        if (!withdrawResponse.ok) {
          const errorText = await withdrawResponse.text()
          let errorData: any = null
          try {
            if (errorText) {
              errorData = JSON.parse(errorText)
            }
          } catch (e) {}
          
          const errorMsg = errorData?.error || errorData?.message || `Ошибка выполнения вывода: ${withdrawResponse.status}`
          throw new Error(errorMsg)
        }

        const withdrawData = await withdrawResponse.json()
        if (!withdrawData.success) {
          throw new Error(withdrawData.message || withdrawData.error || 'Ошибка выполнения вывода')
        }
      }
      
      // Получаем данные пользователя Telegram
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
          console.log('Error parsing initData:', e)
        }
      }

      // Создаем заявку
      const requestBody = {
        type: 'withdraw',
        bookmaker: bookmaker,
        userId: telegramUserId,
        phone: phone,
        amount: amount,
        bank: bank,
        account_id: userId,
        playerId: userId,
        qr_photo: qrPhoto,
        site_code: siteCode.trim(),
        telegram_user_id: telegramUserId,
        telegram_username: telegramUser?.username,
        telegram_first_name: telegramUser?.first_name,
        telegram_last_name: telegramUser?.last_name,
        telegram_language_code: telegramUser?.language_code
      }
      
      const response = await safeFetch(`${base}/api/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        timeout: 30000,
        retries: 2,
        retryDelay: 1000
      })
      
      let responseText = ''
      try {
        responseText = await response.text()
      } catch (e) {
        throw new Error(`Ошибка чтения ответа сервера: ${response.status}`)
      }
      
      if (!response.ok) {
        let errorData: any = null
        try {
          if (responseText) {
            errorData = JSON.parse(responseText)
          }
        } catch (e) {}
        
        let errorMessage = `Ошибка создания заявки (${response.status})`
        if (errorData?.error) {
          errorMessage = errorData.error
        } else if (errorData?.message) {
          errorMessage = errorData.message
        } else if (responseText && responseText.length < 200 && !responseText.includes('<html')) {
          errorMessage = responseText
        }
        
        throw new Error(errorMessage)
      }
      
      let result: any
      try {
        if (!responseText) {
          throw new Error('Пустой ответ от сервера')
        }
        result = JSON.parse(responseText)
      } catch (parseError: any) {
        throw new Error('Не удалось обработать ответ сервера.')
      }
      
      if (result.success !== false) {
        // Сохраняем флаг отправки
        const submitKey = `withdraw_submitted_${telegramUserId}`
        localStorage.setItem(submitKey, 'true')
        
        // Сохраняем ID для обратной совместимости
        const cookieName = `user_id_${bookmaker}`
        const expires = new Date()
        expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000))
        document.cookie = `${cookieName}=${userId}; expires=${expires.toUTCString()}; path=/`
        
        // Очищаем данные
        localStorage.removeItem('withdraw_bookmaker')
        localStorage.removeItem('withdraw_bank')
        localStorage.removeItem('withdraw_qr_photo')
        localStorage.removeItem('withdraw_phone')
        
        // Перенаправляем на главную
        router.push('/')
      } else {
        throw new Error(result.error || 'Неизвестная ошибка')
      }
    } catch (error: any) {
      console.error('Ошибка создания заявки:', error)
      setError(error?.message || 'Ошибка при создании заявки. Попробуйте еще раз.')
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    router.push('/withdraw/step2')
  }

  return (
    <main className="space-y-4" style={{ scrollBehavior: 'smooth' }}>
      <FixedHeaderControls />
      <div className="pr-20">
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>
      
      <div className="card space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Шаг 3 из 3</h2>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-accent h-2 rounded-full" style={{width: '100%'}}></div>
          </div>
        </div>

        {/* ID аккаунта */}
        <div ref={idSectionRef}>
          <label className="label">{t.accountId}</label>
          <input 
            className="input w-full"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder={t.accountIdPlaceholder}
            disabled={isCheckingCode || isSubmitting}
          />
        </div>
        
        {/* Код с сайта */}
        <div ref={codeSectionRef}>
          <label className="label">{t.siteCode}</label>
          <input 
            className="input w-full"
            type="text"
            value={siteCode}
            onChange={(e) => {
              setSiteCode(e.target.value)
              setWithdrawAmount(null)
              setError(null)
            }}
            placeholder={t.siteCodePlaceholder}
            disabled={isCheckingCode || isSubmitting}
          />
        </div>
        
        {/* Статус проверки/отправки */}
        {isCheckingCode && (
          <div className="p-3 bg-blue-900/30 border border-blue-500 rounded-lg">
            <p className="text-sm text-blue-300">⏳ {t.checking}</p>
          </div>
        )}
        
        {isSubmitting && (
          <div className="p-3 bg-green-900/30 border border-green-500 rounded-lg">
            <p className="text-sm text-green-300">⏳ {t.submitting}</p>
          </div>
        )}
        
        {withdrawAmount !== null && withdrawAmount > 0 && (
          <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✅</span>
              <p className="text-sm text-green-300 font-semibold">
                Код проверен! Сумма: {withdrawAmount.toLocaleString()} сом
              </p>
            </div>
          </div>
        )}
        
        {/* Ошибка */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
            <p className="text-sm text-red-300 font-semibold">❌ {error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button 
            className="btn btn-ghost flex-1"
            onClick={handleBack}
            disabled={isCheckingCode || isSubmitting}
          >
            {t.back}
          </button>
        </div>
      </div>
    </main>
  )
}

