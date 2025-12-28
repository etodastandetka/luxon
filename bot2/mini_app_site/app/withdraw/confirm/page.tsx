"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'
import { checkUserBlocked, getTelegramUserId } from '../../../utils/telegram'
import { safeFetch, getApiBase } from '../../../utils/fetch'

export default function WithdrawConfirm() {
    const [bank, setBank] = useState('')
  const [qrPhoto, setQrPhoto] = useState('')
  const [phone, setPhone] = useState('')
  const [userId, setUserId] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null)
  const [bookmaker, setBookmaker] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { language } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    // Загружаем данные из localStorage
    const savedBookmaker = localStorage.getItem('withdraw_bookmaker')
    const savedBank = localStorage.getItem('withdraw_bank')
    const savedQrPhoto = localStorage.getItem('withdraw_qr_photo')
    const savedPhone = localStorage.getItem('withdraw_phone')
    const savedUserId = localStorage.getItem('withdraw_user_id')
    const savedSiteCode = localStorage.getItem('withdraw_site_code')
    const savedAmount = localStorage.getItem('withdraw_amount')
    
    // Проверяем, что все данные есть
    if (!savedBookmaker || !savedBank || !savedQrPhoto || !savedPhone || !savedUserId || !savedSiteCode || !savedAmount) {
      // Если данных нет, перенаправляем на step5
      router.push('/withdraw/step5')
      return
    }
    
    // Загружаем данные в state
    setBookmaker(savedBookmaker)
    setBank(savedBank)
    setQrPhoto(savedQrPhoto)
    setPhone(savedPhone)
    setUserId(savedUserId)
    setSiteCode(savedSiteCode)
    
    const amount = parseFloat(savedAmount)
    if (!isNaN(amount) && amount > 0) {
      setWithdrawAmount(amount)
    } else {
      // Если сумма невалидна, перенаправляем на step5
      router.push('/withdraw/step5')
    }
  }, [router])


  const handleConfirm = async () => {
    // Защита от повторных кликов
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    
    try {
      // Используем данные из state (уже загружены из localStorage в useEffect)
      if (!bookmaker || !withdrawAmount || withdrawAmount <= 0 || !userId || !phone || !bank || !siteCode) {
        alert('Не все данные заполнены. Вернитесь на предыдущий шаг.')
        router.push('/withdraw/step5')
        setIsSubmitting(false)
        return
      }
      
      const amount = withdrawAmount

      const base = getApiBase()

      // Для 1xbet сначала выполняем вывод (mobile.withdrawal)
      // Для 888starz вывод уже выполнен на step5 (Payout сразу выполняет вывод)
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
            code: siteCode.trim(), // Обрезаем пробелы
            amount: amount, // amount уже число
          }),
          timeout: 30000,
          retries: 2,
          retryDelay: 1000
        })


        // Читаем ответ один раз
        let withdrawResponseText = ''
        try {
          withdrawResponseText = await withdrawResponse.text()
        } catch (e) {
          throw new Error(`Ошибка чтения ответа: ${withdrawResponse.status}`)
        }

        if (!withdrawResponse.ok) {
          
          // Пробуем распарсить ошибку
          let errorData: any = null
          try {
            if (withdrawResponseText) {
              errorData = JSON.parse(withdrawResponseText)
            }
          } catch (e) {
            // Не JSON
          }
          
          const errorMsg = errorData?.error || errorData?.message || `Ошибка выполнения вывода: ${withdrawResponse.status}`
          throw new Error(errorMsg)
        }

        // Парсим успешный ответ
        let withdrawData: any
        try {
          if (!withdrawResponseText) {
            throw new Error('Пустой ответ от сервера')
          }
          withdrawData = JSON.parse(withdrawResponseText)
        } catch (parseError: any) {
          throw new Error('Не удалось обработать ответ сервера при выполнении вывода.')
        }

        if (!withdrawData.success) {
          alert(`Ошибка выполнения вывода: ${withdrawData.message || withdrawData.error || 'Неизвестная ошибка'}`)
          setIsSubmitting(false)
          return
        }

      }
      
      // Для 888starz вывод уже выполнен на step5, просто создаем заявку
      if (normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888') || normalizedBookmaker === '888starz') {
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
        }
      }

      // Получаем Telegram ID пользователя (оптимизированная функция)
      const telegramUserId = getTelegramUserId()

      if (!telegramUserId) {
        alert('Ошибка: не удалось определить ID пользователя. Пожалуйста, перезагрузите страницу.')
        setIsSubmitting(false)
        return
      }

      // Проверяем, не заблокирован ли пользователь
      const isBlocked = await checkUserBlocked(telegramUserId)
      if (isBlocked) {
        alert('Ваш аккаунт заблокирован. Вы не можете создавать заявки на вывод.')
        window.location.href = '/blocked'
        return
      }

      // Создаем заявку в админке
      
      // Получаем transactionId из localStorage если есть (для Mostbet)
      const savedTransactionId = localStorage.getItem('withdraw_transaction_id') || null
      
      const requestBody = {
        type: 'withdraw',
        bookmaker: bookmaker,
        userId: telegramUserId,
        phone: phone,
        amount: amount, // amount уже число после parseFloat выше
        bank: bank,
        account_id: userId,
        playerId: userId,
        qr_photo: qrPhoto,
        site_code: siteCode,
        transaction_id: savedTransactionId, // ID транзакции от Mostbet API
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
      

      // Читаем ответ один раз - Response можно прочитать только один раз!
      let responseText = ''
      try {
        responseText = await response.text()
      } catch (e) {
        throw new Error(`Ошибка чтения ответа сервера: ${response.status} ${response.statusText}`)
      }
      
      if (!response.ok) {
        
        // Пробуем распарсить как JSON
        let errorData: any = null
        try {
          if (responseText) {
            errorData = JSON.parse(responseText)
          }
        } catch (e) {
          // Не JSON, оставляем как текст
        }
        
        // Извлекаем реальное сообщение об ошибке из ответа
        let errorMessage = `Ошибка создания заявки (${response.status})`
        if (errorData) {
          if (errorData.error) {
            errorMessage = errorData.error
          } else if (errorData.message) {
            errorMessage = errorData.message
          } else if (errorData.data?.error) {
            errorMessage = errorData.data.error
          } else if (errorData.data?.message) {
            errorMessage = errorData.data.message
          }
        } else if (responseText && responseText.length < 200 && !responseText.includes('<html')) {
          // Если текст короткий и не HTML, используем его
          errorMessage = responseText
        }
        
        throw new Error(errorMessage)
      }
      
      // Парсим успешный ответ
      let result: any
      try {
        if (!responseText) {
          throw new Error('Пустой ответ от сервера')
        }
        result = JSON.parse(responseText)
      } catch (parseError: any) {
        throw new Error('Не удалось обработать ответ сервера. Попробуйте еще раз.')
      }
      
      if (result.success !== false) {
        
        // Сохраняем ID заявки для страницы ожидания
        const withdrawRequestId = result.id || result.data?.id
        if (withdrawRequestId) {
          localStorage.setItem('withdraw_request_id', String(withdrawRequestId))
          localStorage.setItem('withdraw_transaction_id', String(withdrawRequestId))
        }
        
        // Перенаправляем на страницу ожидания
        router.push('/withdraw/waiting')
      } else {
        throw new Error(`Failed to create withdraw request: ${result.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      
      let errorMessage = 'Ошибка при создании заявки. Попробуйте еще раз.'
      
      // Проверяем тип ошибки более точно
      const errorMsg = String(error?.message || '')
      const errorName = error?.name || ''
      
      // Приоритет 1: Если это ошибка сервера (HTTP статус), показываем сообщение сервера
      if (error?.status || errorMsg.includes('HTTP') || errorMsg.includes('Status:') || errorMsg.includes('Ошибка создания заявки') || errorMsg.includes('Ошибка выполнения вывода')) {
        // Используем сообщение об ошибке как есть (оно уже содержит реальное сообщение от сервера)
        errorMessage = errorMsg || 'Ошибка сервера. Попробуйте еще раз.'
      } 
      // Приоритет 2: Таймаут
      else if (errorName === 'AbortError' || errorMsg.includes('Таймаут') || errorMsg.includes('timeout')) {
        errorMessage = 'Превышено время ожидания. Попробуйте еще раз.'
      } 
      // Приоритет 3: Только реальные сетевые ошибки (не ошибки парсинга, не HTTP ошибки)
      else if (
        errorName === 'TypeError' && 
        errorMsg.includes('Failed to fetch') && 
        !errorMsg.includes('HTTP') &&
        !errorMsg.includes('Status:') &&
        !errorMsg.includes('Ошибка')
      ) {
        errorMessage = 'Нет подключения к интернету. Проверьте соединение и попробуйте снова.'
      }
      // Приоритет 4: Другие реальные сетевые ошибки
      else if (
        (errorMsg.includes('NetworkError') && !errorMsg.includes('HTTP') && !errorMsg.includes('Status:') && !errorMsg.includes('Ошибка')) ||
        errorMsg.includes('ERR_INTERNET_DISCONNECTED') ||
        errorMsg.includes('ERR_NETWORK_CHANGED')
      ) {
        errorMessage = 'Нет подключения к интернету. Проверьте соединение и попробуйте снова.'
      }
      // Приоритет 5: Используем сообщение об ошибке, если оно есть
      else if (errorMsg && !errorMsg.includes('Нет подключения к интернету')) {
        errorMessage = errorMsg
      }
      
      alert(`Ошибка: ${errorMessage}`)
    } finally {
      // Сбрасываем флаг отправки в любом случае
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    router.push('/withdraw/step5')
  }

  const getBankName = (bankCode: string) => {
    const bankNames = {
      'kompanion': 'Компаньон',
      'demirbank': 'DemirBank',
      'odengi': 'O!Money',
      'omoney': 'O!Money',
      'balance': 'Balance.kg',
      'bakai': 'Bakai',
      'megapay': 'MegaPay',
      'mbank': 'MBank'
    }
    return bankNames[bankCode as keyof typeof bankNames] || bankCode
  }

  const translations = {
    ru: {
      title: 'Подтверждение вывода',
      subtitle: 'Проверьте данные заявки',
      confirm: 'Отправить заявку',
      back: 'Назад',
      bank: 'Банк для получения',
      phone: 'Номер телефона',
      userId: 'ID аккаунта в казино',
      siteCode: 'Код подтверждения',
      qrCode: 'QR-код'
    },
    en: {
      title: 'Confirm withdrawal',
      subtitle: 'Check data',
      confirm: 'Confirm',
      back: 'Back',
      bank: 'Bank',
      phone: 'Phone',
      userId: 'Account ID',
      siteCode: 'Site code',
      qrCode: 'QR code'
    },
    ky: {
      title: 'Чыгарууну ырастоо',
      subtitle: 'Маалыматтарды текшериңиз',
      confirm: 'Ырастоо',
      back: 'Артка',
      bank: 'Банк',
      phone: 'Телефон',
      userId: 'Аккаунт ID',
      siteCode: 'Сайт коду',
      qrCode: 'QR-код'
    },
    uz: {
      title: 'Yechib olishni tasdiqlash',
      subtitle: 'Ma\'lumotlarni tekshiring',
      confirm: 'Tasdiqlash',
      back: 'Orqaga',
      bank: 'Bank',
      phone: 'Telefon',
      userId: 'Hisob ID',
      siteCode: 'Sayt kodi',
      qrCode: 'QR kod'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <main className="space-y-4">
      <FixedHeaderControls />
      <div className="pr-20">
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>
      
      <div className="card space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">{t.subtitle}</h2>
        </div>
        
        <div className="space-y-3">
          {withdrawAmount !== null && (
            <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">✅</span>
                <span className="text-green-300 font-semibold">Вывод выполнен</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-green-500/30">
                <span className="text-white/70">Сумма вывода:</span>
                <span className="font-bold text-xl text-green-300">{withdrawAmount} сом</span>
              </div>
              <p className="text-xs text-green-200 mt-2">
                Вывод выполнен. Ожидайте поступление денег.
              </p>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-white/70">{t.bank}:</span>
            <span className="font-semibold">{getBankName(bank)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-white/70">{t.phone}:</span>
            <span className="font-semibold">+{phone}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-white/70">{t.userId}:</span>
            <span className="font-semibold">{userId}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-white/70">{t.siteCode}:</span>
            <span className="font-semibold">{siteCode}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-white/70">{t.qrCode}:</span>
            <span className="font-semibold text-xs break-all">
              📷 Фото загружено
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            className="btn btn-ghost flex-1"
            onClick={handleBack}
          >
            {t.back}
          </button>
          <button 
            className="btn btn-primary flex-1"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? '⏳ Отправка...' : t.confirm}
          </button>
        </div>
      </div>
    </main>
  )
}
