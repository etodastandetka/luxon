"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import BookmakerGrid from '../../../components/BookmakerGrid'
import BankButtons from '../../../components/BankButtons'
import { useLanguage } from '../../../components/LanguageContext'
import { checkUserBlocked, getTelegramUserId } from '../../../utils/telegram'
import { safeFetch, getApiBase } from '../../../utils/fetch'

export default function NewWithdrawPage() {
  const router = useRouter()
  const { language } = useLanguage()
  
  // Состояния формы
  const [bookmaker, setBookmaker] = useState<string>('')
  const [bank, setBank] = useState('')
  const [phone, setPhone] = useState('+996')
  const [qrPhoto, setQrPhoto] = useState<File | null>(null)
  const [qrPhotoPreview, setQrPhotoPreview] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [siteCode, setSiteCode] = useState('')
  
  // Состояния UI
  const [enabledBanks, setEnabledBanks] = useState<string[]>([])
  const [disabledCasinos, setDisabledCasinos] = useState<string[]>([])
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null)

  // Проверка настроек выводов и казино
  useEffect(() => {
    async function loadSettings() {
      try {
        const base = getApiBase()
        const { getTelegramUserId } = await import('../../../utils/telegram')
        const telegramUserId = getTelegramUserId()
        const url = telegramUserId 
          ? `${base}/api/public/payment-settings?user_id=${telegramUserId}`
          : `${base}/api/public/payment-settings`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        
        if (data && data.withdrawals) {
          setWithdrawalsEnabled(data.withdrawals.enabled === true)
          
          // Загружаем список разрешенных банков
          if (data.withdrawals.banks && Array.isArray(data.withdrawals.banks)) {
            const bankCodeMapping: Record<string, string> = {
              'kompanion': 'kompanion',
              'odengi': 'omoney',
              'bakai': 'bakai',
              'balance': 'balance',
              'megapay': 'megapay',
              'mbank': 'mbank',
              'demir': 'demirbank',
              'demirbank': 'demirbank'
            }
            const mappedBanks: string[] = []
            for (const b of data.withdrawals.banks) {
              const code = b.code || b
              const mapped = bankCodeMapping[code] || code
              if (mapped) mappedBanks.push(mapped)
            }
            setEnabledBanks(mappedBanks)
          }
        } else {
          setWithdrawalsEnabled(false)
        }
        
        if (data && data.casinos) {
          const disabled: string[] = []
          if (data.casinos['1xbet'] === false) disabled.push('1xbet')
          if (data.casinos['1win'] === false) disabled.push('1win')
          if (data.casinos['melbet'] === false) disabled.push('melbet')
          if (data.casinos['mostbet'] === false) disabled.push('mostbet')
          if (data.casinos['winwin'] === false) disabled.push('winwin')
          if (data.casinos['888starz'] === false) disabled.push('888starz')
          setDisabledCasinos(disabled)
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      }
    }
    loadSettings()
  }, [])

  // Автозаполнение ID из cookies
  useEffect(() => {
    if (bookmaker) {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) return parts.pop()?.split(';').shift()
        return null
      }
      
      const cookieName = `user_id_${bookmaker}`
      const savedUserId = getCookie(cookieName)
      
      if (savedUserId) {
        setUserId(savedUserId)
      }
    }
  }, [bookmaker])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    
    if (!value.startsWith('+996')) {
      if (value.length < 4) {
        value = '+996'
      } else if (!value.startsWith('+')) {
        value = '+996' + value.replace(/[^\d]/g, '')
      } else {
        value = '+996' + value.replace(/^\+996/, '').replace(/[^\d]/g, '')
      }
    } else {
      const after996 = value.slice(4).replace(/[^\d]/g, '')
      value = '+996' + after996
    }
    
    setPhone(value)
  }

  const handleQrPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (typeof window === 'undefined' || typeof (window as any).FileReader === 'undefined') {
        alert('Ошибка: FileReader недоступен. Пожалуйста, используйте другой браузер.')
        return
      }
      
      setQrPhoto(file)
      const reader = new (window as any).FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const base64 = e.target?.result as string
        setQrPhotoPreview(base64)
      }
      reader.onerror = () => {
        alert('Ошибка при загрузке фото. Попробуйте еще раз.')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCheckCode = async () => {
    if (!siteCode.trim()) {
      setError('Введите код для проверки')
      return
    }

    if (!bookmaker || !userId) {
      setError('Заполните казино и ID аккаунта')
      return
    }

    setIsCheckingCode(true)
    setError(null)
    setWithdrawAmount(null)
    
    try {
      const base = getApiBase()
      
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
          setError(null)
          setWithdrawAmount(amount)
        } else {
          setError('Не удалось получить сумму вывода. Попробуйте еще раз.')
        }
      } else {
        let errorMessage = data.error || data.message || 'Код неверный или вывод не найден'
        setError(errorMessage)
      }
    } catch (error: any) {
      console.error('Ошибка проверки кода:', error)
      setError('Ошибка проверки кода. Попробуйте еще раз.')
    } finally {
      setIsCheckingCode(false)
    }
  }

  const handleSubmit = async () => {
    // Защита от повторных отправок
    if (isSubmitting) {
      return
    }

    // Валидация
    if (!bookmaker) {
      setError('Выберите казино')
      return
    }
    
    if (!bank) {
      setError('Выберите банк')
      return
    }
    
    if (!qrPhoto && !qrPhotoPreview) {
      setError('Загрузите фото QR-кода')
      return
    }
    
    const cleanPhone = phone.replace(/[^\d]/g, '')
    if (!cleanPhone || cleanPhone.length < 12) {
      setError('Введите корректный номер телефона')
      return
    }
    
    if (!userId.trim() || !userId.match(/^\d+$/)) {
      setError('Введите корректный ID (только цифры)')
      return
    }
    
    if (!siteCode.trim()) {
      setError('Введите код с сайта')
      return
    }
    
    if (!withdrawAmount || withdrawAmount <= 0) {
      setError('Проверьте код. Сумма не найдена.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    
    try {
      const base = getApiBase()
      
      // Получаем QR фото в base64
      let qrPhotoBase64 = qrPhotoPreview
      if (!qrPhotoBase64 && qrPhoto) {
        // Читаем файл в base64
        const reader = new (window as any).FileReader()
        qrPhotoBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = (e: ProgressEvent<FileReader>) => {
            resolve(e.target?.result as string)
          }
          reader.onerror = reject
          reader.readAsDataURL(qrPhoto)
        })
      }
      
      if (!qrPhotoBase64) {
        throw new Error('Ошибка загрузки QR-кода')
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
            amount: withdrawAmount,
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

      // Создаем заявку
      const requestBody = {
        type: 'withdraw',
        bookmaker: bookmaker,
        userId: telegramUserId,
        phone: cleanPhone,
        amount: withdrawAmount,
        bank: bank,
        account_id: userId,
        playerId: userId,
        qr_photo: qrPhotoBase64,
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
        localStorage.setItem(submitKey, 'true')
        
        // Сохраняем ID для обратной совместимости
        const cookieName = `user_id_${bookmaker}`
        const expires = new Date()
        expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000))
        document.cookie = `${cookieName}=${userId}; expires=${expires.toUTCString()}; path=/`
        
        alert('✅ Заявка на вывод успешно отправлена!')
        
        // Перенаправляем на главную
        router.push('/')
      } else {
        throw new Error(result.error || 'Неизвестная ошибка')
      }
    } catch (error: any) {
      console.error('Ошибка создания заявки:', error)
      setError(error?.message || 'Ошибка при создании заявки. Попробуйте еще раз.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const translations = {
    ru: {
      title: 'Вывод средств',
      selectBookmaker: 'Выберите казино',
      selectBank: 'Выберите банк',
      phone: 'Номер телефона',
      phonePlaceholder: '+996...',
      qrCode: 'QR-код кошелька',
      uploadQr: 'Загрузить фото QR-кода',
      accountId: 'ID аккаунта',
      accountIdPlaceholder: 'Введите ID',
      siteCode: 'Код с сайта',
      siteCodePlaceholder: 'Введите код',
      checkCode: 'Проверить код',
      submit: 'Отправить заявку',
      back: 'Назад'
    },
    en: {
      title: 'Withdraw',
      selectBookmaker: 'Select casino',
      selectBank: 'Select bank',
      phone: 'Phone number',
      phonePlaceholder: '+996...',
      qrCode: 'Wallet QR code',
      uploadQr: 'Upload QR code photo',
      accountId: 'Account ID',
      accountIdPlaceholder: 'Enter ID',
      siteCode: 'Site code',
      siteCodePlaceholder: 'Enter code',
      checkCode: 'Check code',
      submit: 'Submit request',
      back: 'Back'
    },
    ky: {
      title: 'Акчаны чыгаруу',
      selectBookmaker: 'Казинодо тандаңыз',
      selectBank: 'Банкты тандаңыз',
      phone: 'Телефон номуру',
      phonePlaceholder: '+996...',
      qrCode: 'Капчыктын QR-коду',
      uploadQr: 'QR-код сүрөтүн жүктөө',
      accountId: 'Аккаунт ID',
      accountIdPlaceholder: 'ID киргизиңиз',
      siteCode: 'Сайт коду',
      siteCodePlaceholder: 'Код киргизиңиз',
      checkCode: 'Кодду текшерүү',
      submit: 'Өтүнүч жөнөтүү',
      back: 'Артка'
    },
    uz: {
      title: 'Pulni yechib olish',
      selectBookmaker: 'Kazinoni tanlang',
      selectBank: 'Bankni tanlang',
      phone: 'Telefon raqami',
      phonePlaceholder: '+996...',
      qrCode: 'Hamyon QR kodi',
      uploadQr: 'QR kod rasmini yuklash',
      accountId: 'Hisob ID',
      accountIdPlaceholder: 'ID kiriting',
      siteCode: 'Sayt kodi',
      siteCodePlaceholder: 'Kod kiriting',
      checkCode: 'Kodni tekshirish',
      submit: 'So\'rov yuborish',
      back: 'Orqaga'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  if (!withdrawalsEnabled) {
    return (
      <main className="space-y-4">
        <FixedHeaderControls />
        <h1 className="text-xl font-bold pr-20">{t.title}</h1>
        <div className="card text-center bg-orange-900/20 border-orange-500">
          <div className="text-orange-300 text-lg font-semibold mb-2">
            🔧 Технические работы
          </div>
          <div className="text-white/70 mb-4">
            Вывод средств временно недоступен. Попробуйте позже.
          </div>
          <button
            onClick={() => router.push('/')}
            className="btn btn-ghost"
          >
            ← {t.back}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-4">
      <FixedHeaderControls />
      <div className="pr-20">
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>
      
      <div className="card space-y-4">
        {/* Выбор казино */}
        <div>
          <label className="label">{t.selectBookmaker}</label>
          <BookmakerGrid 
            value={bookmaker} 
            onChange={setBookmaker}
            disabledCasinos={disabledCasinos}
          />
        </div>

        {/* Выбор банка */}
        <div>
          <label className="label">{t.selectBank}</label>
          <BankButtons 
            onPick={setBank} 
            selected={bank} 
            enabledBanks={enabledBanks.length > 0 ? enabledBanks : []}
          />
        </div>

        {/* Номер телефона и QR код */}
        <div className="space-y-3">
          <div>
            <label className="label">{t.phone}</label>
            <input 
              className="input w-full"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder={t.phonePlaceholder}
            />
          </div>
          
          <div>
            <label className="label">{t.qrCode}</label>
            <input 
              type="file"
              accept="image/*"
              onChange={handleQrPhotoChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              id="qr-upload"
            />
            <label 
              htmlFor="qr-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-green-400/30 rounded-xl bg-gradient-to-br from-green-900/20 to-green-800/30 hover:border-green-400/50 hover:bg-green-800/40 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white group-hover:text-green-300 transition-colors">
                    {qrPhoto ? 'Файл выбран' : t.uploadQr}
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    {qrPhoto ? qrPhoto.name : 'PNG, JPG до 10MB'}
                  </p>
                </div>
              </div>
            </label>
            
            {qrPhotoPreview && (
              <div className="mt-4 p-4 bg-black/20 rounded-xl border border-green-400/20">
                <div className="text-center mb-3">
                  <span className="text-sm text-green-400 font-medium">Предварительный просмотр:</span>
                </div>
                <div className="flex justify-center">
                  <img 
                    src={qrPhotoPreview} 
                    alt="QR Preview" 
                    className="max-w-xs max-h-48 rounded-lg shadow-lg border border-green-400/30"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ID и код */}
        <div className="space-y-3">
          <div>
            <label className="label">{t.accountId}</label>
            <input 
              className="input w-full"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder={t.accountIdPlaceholder}
            />
          </div>
          
          <div>
            <label className="label">{t.siteCode}</label>
            <div className="flex gap-2">
              <input 
                className="input flex-1"
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
              <button
                className="btn btn-primary"
                onClick={handleCheckCode}
                disabled={!siteCode.trim() || isCheckingCode || isSubmitting || !userId.trim()}
              >
                {isCheckingCode ? '⏳' : t.checkCode}
              </button>
            </div>
          </div>
          
          {isCheckingCode && (
            <div className="p-3 bg-blue-900/30 border border-blue-500 rounded-lg">
              <p className="text-sm text-blue-300">⏳ Проверка кода...</p>
            </div>
          )}
          
          {withdrawAmount !== null && withdrawAmount > 0 && (
            <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">✅</span>
                <p className="text-sm text-green-300 font-semibold">
                  Код проверен успешно!
                </p>
              </div>
              <div className="pt-2 border-t border-green-500/30">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Сумма вывода:</span>
                  <span className="text-2xl text-white font-bold">
                    {withdrawAmount.toLocaleString()} сом
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ошибка */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
            <p className="text-sm text-red-300 font-semibold">❌ {error}</p>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-2">
          <button 
            className="btn btn-ghost flex-1"
            onClick={() => router.push('/')}
            disabled={isSubmitting}
          >
            {t.back}
          </button>
          <button 
            className="btn btn-primary flex-1"
            onClick={handleSubmit}
            disabled={isSubmitting || !withdrawAmount || withdrawAmount <= 0}
          >
            {isSubmitting ? '⏳ Отправка...' : t.submit}
          </button>
        </div>
      </div>
    </main>
  )
}

