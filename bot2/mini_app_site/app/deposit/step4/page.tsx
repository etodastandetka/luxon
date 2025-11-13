"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import BankButtons from '../../../components/BankButtons'
import PageTransition from '../../../components/PageTransition'
import { useLanguage } from '../../../components/LanguageContext'
import { getTelegramUser, syncWithBot, notifyUser } from '../../../utils/telegram'
import { useAlert } from '../../../components/useAlert'
import { formatKgs, formatUsdt, formatUsd } from '../../../utils/crypto-pay'

export default function DepositStep4() {
  const [bank, setBank] = useState('omoney') // По умолчанию O!Money
  const [paymentUrl, setPaymentUrl] = useState('')
  const [qrData, setQrData] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(300) // 5 минут в секундах
  const [isPaid, setIsPaid] = useState(false)
  const [paymentType, setPaymentType] = useState<'bank' | 'crypto'>('bank')
  const [cryptoInvoice, setCryptoInvoice] = useState<any>(null)
  const [cryptoLoading, setCryptoLoading] = useState(false)
  const router = useRouter()
  const { showAlert, AlertComponent } = useAlert()

  // Получаем данные из предыдущих шагов
  const [bookmaker, setBookmaker] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [amount, setAmount] = useState(0)
  const [depositsEnabled, setDepositsEnabled] = useState(true)
  const [requireReceiptPhoto, setRequireReceiptPhoto] = useState(false)
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null)
  const [receiptPhotoPreview, setReceiptPhotoPreview] = useState<string | null>(null)
  const { language } = useLanguage()

  useEffect(() => {
    // Загружаем данные из localStorage
    const savedBookmaker = localStorage.getItem('deposit_bookmaker') || ''
    const savedPlayerId = localStorage.getItem('deposit_user_id') || ''
    const savedAmount = parseFloat(localStorage.getItem('deposit_amount') || '0')
    const savedPaymentType = localStorage.getItem('deposit_payment_type') as 'bank' | 'crypto' || 'bank'
    
    setBookmaker(savedBookmaker)
    setPlayerId(savedPlayerId)
    setAmount(savedAmount)
    setPaymentType(savedPaymentType)
    
    // Получаем Telegram ID пользователя
    const tg = (window as any).Telegram?.WebApp
    let telegramUserId: string | null = null
    
    if (tg?.initDataUnsafe?.user?.id) {
      telegramUserId = String(tg.initDataUnsafe.user.id)
    } else if (tg?.initData) {
      try {
        const params = new URLSearchParams(tg.initData)
        const userParam = params.get('user')
        if (userParam) {
          const user = JSON.parse(decodeURIComponent(userParam))
          telegramUserId = String(user.id)
        }
      } catch (e) {
        console.log('❌ Error parsing initData:', e)
      }
    }
    
    // Проверяем, есть ли сохраненные данные предыдущей заявки
    const previousBookmaker = localStorage.getItem('previous_deposit_bookmaker') || ''
    const previousTelegramUserId = localStorage.getItem('previous_deposit_telegram_user_id') || ''
    const previousAmount = parseFloat(localStorage.getItem('previous_deposit_amount') || '0')
    const transactionId = localStorage.getItem('deposit_transaction_id')
    
    // Сравниваем: если Telegram ID изменился или данные изменились - это новая заявка
    // Используем Telegram ID, а не ID казино для проверки новой заявки
    const isNewRequest = !previousBookmaker || 
                         !previousTelegramUserId || 
                         !telegramUserId ||
                         previousBookmaker !== savedBookmaker ||
                         previousTelegramUserId !== telegramUserId ||
                         previousAmount !== savedAmount
    
    if (isNewRequest && telegramUserId) {
      // Новая заявка - очищаем старые данные и запускаем новый таймер
      console.log('🆕 Новая заявка - очищаем старые данные и запускаем новый таймер')
      setIsPaid(false)
      setTimeLeft(300) // Начинаем с 5 минут
      localStorage.removeItem('deposit_transaction_id')
      localStorage.removeItem('deposit_request_id')
      localStorage.removeItem('deposit_timer_start')
      // Сохраняем текущие данные как "предыдущие" для сравнения (используем Telegram ID)
      localStorage.setItem('previous_deposit_bookmaker', savedBookmaker)
      localStorage.setItem('previous_deposit_telegram_user_id', telegramUserId)
      localStorage.setItem('previous_deposit_amount', savedAmount.toString())
      // Запускаем новый таймер
      localStorage.setItem('deposit_timer_start', Date.now().toString())
      return
    }
    
    // Если это та же заявка, проверяем статус
    if (transactionId) {
      // Если есть transaction_id, значит заявка уже создана, останавливаем таймер
      setIsPaid(true)
      setTimeLeft(0)
      localStorage.removeItem('deposit_timer_start') // Очищаем таймер
      console.log('✅ Обнаружена существующая заявка - таймер остановлен')
      return
    }
    
    // Восстанавливаем таймер из сохраненного времени начала (только если нет заявки)
    const timerStartTime = localStorage.getItem('deposit_timer_start')
    if (timerStartTime) {
      const startTime = parseInt(timerStartTime, 10)
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000) // Прошло секунд
      const remaining = Math.max(0, 300 - elapsed) // Осталось секунд (5 минут = 300 секунд)
      setTimeLeft(remaining)
      
      // Если время уже истекло, обрабатываем истечение
      if (remaining === 0) {
        // Вызываем через setTimeout, чтобы избежать проблем с зависимостями
        setTimeout(() => {
          handleTimeExpired()
        }, 100)
      }
    } else {
      // Если нет сохраненного времени, сохраняем текущее время
      localStorage.setItem('deposit_timer_start', Date.now().toString())
    }
  }, [])

  // Функция для создания крипто invoice
  const createCryptoInvoice = async () => {
    if (cryptoLoading || cryptoInvoice) return
    
    setCryptoLoading(true)
    try {
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'
      
      // Для крипты берем сумму в долларах из localStorage (пользователь ввел в USD)
      const savedAmountUsd = localStorage.getItem('deposit_amount_usd')
      if (!savedAmountUsd) {
        throw new Error('Сумма в долларах не найдена')
      }
      
      const amountInUsd = parseFloat(savedAmountUsd)
      
      // Получаем Telegram ID пользователя для payload
      const tg = (window as any).Telegram?.WebApp
      let telegramUserId: string | null = null
      
      if (tg?.initDataUnsafe?.user?.id) {
        telegramUserId = String(tg.initDataUnsafe.user.id)
      } else if (tg?.initData) {
        try {
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          if (userParam) {
            const user = JSON.parse(decodeURIComponent(userParam))
            telegramUserId = String(user.id)
          }
        } catch (e) {
          console.log('❌ Error parsing initData:', e)
        }
      }
      
      const payload = JSON.stringify({
        bookmaker,
        playerId,
        amount: amount, // В сомах (для пополнения в казино)
        amount_usd: amountInUsd, // В долларах (что ввел пользователь)
        telegram_user_id: telegramUserId
      })
      
      const response = await fetch(`${apiUrl}/api/crypto-pay/create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountUsd: amountInUsd, // Отправляем сумму в долларах (API конвертирует в USDT)
          asset: 'USDT',
          description: `Пополнение баланса ${bookmaker} - ID: ${playerId}\n\n⚠️ Рекомендуется выбрать сеть TRC20 (TRON) для оплаты`,
          payload: payload,
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setCryptoInvoice(data.data)
          console.log('✅ Crypto invoice created:', data.data)
          // Заявка будет создана только после нажатия кнопки "Я оплатил"
        }
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to create crypto invoice:', errorData)
        showAlert({
          type: 'error',
          title: language === 'ru' ? 'Ошибка' : 'Error',
          message: errorData.error || 'Не удалось создать счет на оплату'
        })
      }
    } catch (error: any) {
      console.error('❌ Error creating crypto invoice:', error)
      showAlert({
        type: 'error',
        title: language === 'ru' ? 'Ошибка' : 'Error',
        message: error.message || 'Ошибка при создании счета на оплату'
      })
    } finally {
      setCryptoLoading(false)
    }
  }

  // Генерируем QR код или крипто invoice в зависимости от типа оплаты
  useEffect(() => {
    if (bookmaker && playerId && amount > 0) {
      // Сохраняем время начала таймера при генерации (если еще не сохранено)
      if (!localStorage.getItem('deposit_timer_start')) {
        localStorage.setItem('deposit_timer_start', Date.now().toString())
      }
      
      if (paymentType === 'crypto') {
        // Создаем крипто invoice (заявка будет создана только после нажатия "Я оплатил")
        createCryptoInvoice()
      } else {
        // Генерируем QR код для банковского перевода
        generateQRCode()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmaker, playerId, amount, paymentType])

  // Таймер обратного отсчета и проверка почты (только для банковских переводов)
  useEffect(() => {
    // Для крипты не нужен таймер
    if (paymentType === 'crypto') {
      return
    }
    
    if (timeLeft > 0 && !isPaid) {
      const timer = setTimeout(() => {
        // Вычисляем оставшееся время от сохраненного времени начала
        const timerStartTime = localStorage.getItem('deposit_timer_start')
        if (timerStartTime) {
          const startTime = parseInt(timerStartTime, 10)
          const now = Date.now()
          const elapsed = Math.floor((now - startTime) / 1000)
          const remaining = Math.max(0, 300 - elapsed)
          setTimeLeft(remaining)
          
          // Если время истекло
          if (remaining === 0) {
            handleTimeExpired()
            return
          }
        } else {
          // Если нет сохраненного времени, уменьшаем счетчик
          setTimeLeft(timeLeft - 1)
        }
      }, 1000)
      
      // Проверяем почту каждые 10 секунд
      if (timeLeft % 10 === 0) {
        checkPaymentStatus()
      }
      
        return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !isPaid) {
      // Время истекло - автоматически отклоняем заявку
      handleTimeExpired()
    }
  }, [timeLeft, isPaid, paymentType])

  // Проверка статуса крипто-платежа убрана - теперь проверка происходит на странице ожидания

  // Функция обработки истечения времени
  const handleTimeExpired = async () => {
    // Если заявка уже отправлена (нажали "Я оплатил"), не обрабатываем истечение времени
    if (isPaid) {
      console.log('⏸️ Таймер истек, но заявка уже отправлена - игнорируем')
      return
    }
    
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
      localStorage.removeItem('deposit_timer_start') // Очищаем таймер
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

  // Функция проверки статуса оплаты
  const checkPaymentStatus = async () => {
    try {
      // Проверяем статус заявки через API
      const transactionId = localStorage.getItem('deposit_transaction_id')
      if (transactionId) {
        const base = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3001' 
          : 'https://xendro.pro'
        const response = await fetch(`${base}/api/payment/${transactionId}`)
        if (response.ok) {
          const data = await response.json()
          // Если заявка оплачена (completed, approved, auto_completed, autodeposit_success)
          if (data.status && ['completed', 'approved', 'auto_completed', 'autodeposit_success'].includes(data.status)) {
            if (!isPaid) {
              setIsPaid(true)
              // Останавливаем таймер
              localStorage.removeItem('deposit_timer_start')
              // Отправляем уведомление о принятии заявки
              await sendPaymentConfirmation()
            }
          }
        }
      }
      // Fallback: если время меньше 2 минут, считаем что оплачено (старая логика для теста)
      // if (timeLeft < 120 && !isPaid) {
      //   setIsPaid(true)
      //   await sendPaymentConfirmation()
      // }
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

      // Конвертируем фото чека в base64, если есть
      let receiptPhotoBase64: string | null = null
      if (receiptPhoto) {
        receiptPhotoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64String = reader.result as string
            resolve(base64String)
          }
          reader.onerror = reject
          reader.readAsDataURL(receiptPhoto)
        })
      }

      // Для крипты получаем сумму в долларах
      const savedAmountUsd = paymentType === 'crypto' ? localStorage.getItem('deposit_amount_usd') : null
      const amountUsd = savedAmountUsd ? parseFloat(savedAmountUsd) : null

      // Для крипты проверяем invoice_id
      let invoiceId = null
      if (paymentType === 'crypto' && cryptoInvoice) {
        invoiceId = cryptoInvoice.invoice_id || cryptoInvoice.invoiceId || null
        console.log('🔍 Crypto invoice ID для заявки:', invoiceId)
        console.log('📦 Полный cryptoInvoice объект:', cryptoInvoice)
      }

      console.log('📤 Создаем заявку с данными:', {
        type: 'deposit',
        amount,
        amount_usd: amountUsd,
        payment_method: paymentType,
        crypto_invoice_id: invoiceId
      })

      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'deposit',
          amount: amount, // В сомах (для пополнения в казино)
          amount_usd: amountUsd, // В долларах (только для крипты)
          userId: playerId,
          bookmaker: bookmaker,
          bank: bank,
          playerId: playerId, // Добавляем playerId для совместимости
          payment_method: paymentType, // 'bank' или 'crypto'
          crypto_invoice_id: invoiceId,
          // Данные пользователя Telegram
          telegram_user_id: telegramUser?.id,
          telegram_username: telegramUser?.username,
          telegram_first_name: telegramUser?.first_name,
          telegram_last_name: telegramUser?.last_name,
          telegram_language_code: telegramUser?.language_code,
          // Фото чека (если загружено)
          receipt_photo: receiptPhotoBase64,
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Заявка создана успешно:', data)
        // Сохраняем ID заявки для последующего обновления статуса
        localStorage.setItem('deposit_transaction_id', data.id || data.transactionId)
        localStorage.setItem('deposit_request_id', data.id || data.transactionId) // Сохраняем request_id
        
        // Сохраняем время начала таймера при создании заявки (если еще не сохранено)
        if (!localStorage.getItem('deposit_timer_start')) {
          localStorage.setItem('deposit_timer_start', Date.now().toString())
          console.log('⏱️ Timer start saved:', new Date().toISOString())
        }
        
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

  // Отправка подтверждения оплаты (только для банковских переводов)
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

  // Обработка нажатия "Я оплатил" для crypto
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

    try {
      console.log('🔘 "Я оплатил" нажата для crypto, создаем заявку...')
      console.log('📦 cryptoInvoice:', cryptoInvoice)
      
      // Создаем заявку (cryptoInvoice уже есть в state, передается в createDepositRequest)
      await createDepositRequest()
      
      console.log('✅ Заявка создана, переходим на страницу ожидания')
      
      // Переходим на страницу ожидания
      router.push('/deposit/waiting')
    } catch (error: any) {
      console.error('❌ Error creating deposit request:', error)
      showAlert({
        type: 'error',
        title: language === 'ru' ? 'Ошибка' : 'Error',
        message: error.message || (language === 'ru' 
          ? 'Ошибка при создании заявки'
          : 'Error creating request')
      })
    }
  }

  // Обработка загрузки фото чека
  const handleReceiptPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptPhoto(file)
      // Создаем превью
      const reader = new FileReader()
      reader.onloadend = () => {
        setReceiptPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Кнопка "Я оплатил" — отправляем заявку в админку только по нажатию (только для банковских переводов)
  const handleIPaid = async () => {
    // Для крипты используется отдельная функция handleCryptoIPaid
    if (paymentType === 'crypto') {
      return
    }

    // Проверяем, требуется ли фото чека
    if (requireReceiptPhoto && !receiptPhoto) {
      showAlert({
        type: 'error',
        title: language === 'ru' ? 'Ошибка' : 'Error',
        message: language === 'ru'
          ? 'Пожалуйста, загрузите фото чека об оплате'
          : 'Please upload receipt photo'
      })
      return
    }

    // Проверяем, не отправлена ли уже заявка
    if (isPaid) {
      showAlert({
        type: 'info',
        title: language === 'ru' ? 'Информация' : 'Info',
        message: language === 'ru'
          ? 'Заявка уже отправлена. Ожидайте обработки.'
          : 'Request already submitted. Please wait for processing.'
      })
      return
    }

    // Сохраняем время начала таймера при создании заявки (если еще не сохранено)
    if (!localStorage.getItem('deposit_timer_start')) {
      localStorage.setItem('deposit_timer_start', Date.now().toString())
    }
    try {
      await createDepositRequest()
      
      // Останавливаем таймер - устанавливаем isPaid в true
      setIsPaid(true)
      setTimeLeft(0) // Останавливаем таймер
      
      // Очищаем таймер из localStorage, чтобы при повторном заходе не показывался
      localStorage.removeItem('deposit_timer_start')
      
      // Получаем Telegram ID для сохранения
      const tg = (window as any).Telegram?.WebApp
      let telegramUserId: string | null = null
      
      if (tg?.initDataUnsafe?.user?.id) {
        telegramUserId = String(tg.initDataUnsafe.user.id)
      } else if (tg?.initData) {
        try {
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          if (userParam) {
            const user = JSON.parse(decodeURIComponent(userParam))
            telegramUserId = String(user.id)
          }
        } catch (e) {
          console.log('❌ Error parsing initData:', e)
        }
      }
      
      // Сохраняем текущие данные как "предыдущие" для проверки новой заявки (используем Telegram ID)
      if (telegramUserId) {
        localStorage.setItem('previous_deposit_bookmaker', bookmaker)
        localStorage.setItem('previous_deposit_telegram_user_id', telegramUserId)
        localStorage.setItem('previous_deposit_amount', amount.toString())
      }
      
      console.log('✅ Таймер остановлен после отправки заявки')
      
      // Перенаправляем на страницу ожидания
      router.push('/deposit/waiting')
    } catch (e) {
      console.error(e)
      showAlert({
        type: 'error',
        title: language === 'ru' ? 'Ошибка' : 'Error',
        message: language === 'ru'
          ? 'Ошибка при отправке заявки.\n\nПожалуйста, попробуйте ещё раз или обратитесь в поддержку.'
          : 'Error submitting request.\n\nPlease try again or contact support.'
      })
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
  const getActiveRequisite = async (): Promise<{ value: string; bank: string | null; name: string | null } | null> => {
    try {
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'
      // Используем публичный API админ-панели
      const response = await fetch(`${apiUrl}/api/public/requisites/list/`)
      if (response.ok) {
        const data = await response.json()
        console.log('📋 Requisites data:', data)
        // Ищем активный реквизит по active_id или по is_active
        if (data.success && data.requisites && data.requisites.length > 0) {
          // Сначала пробуем найти по active_id
          if (data.active_id) {
            const activeRequisite = data.requisites.find((req: any) => req.id === data.active_id)
            if (activeRequisite) {
              console.log('✅ Found active requisite by active_id:', activeRequisite.value, 'Bank:', activeRequisite.bank)
              return { 
                value: activeRequisite.value, 
                bank: activeRequisite.bank || null,
                name: activeRequisite.name || null
              }
            }
          }
          // Если не нашли, пробуем найти по is_active
          const activeRequisite = data.requisites.find((req: any) => req.is_active === true)
          if (activeRequisite) {
            console.log('✅ Found active requisite by is_active:', activeRequisite.value, 'Bank:', activeRequisite.bank)
            return { 
              value: activeRequisite.value, 
              bank: activeRequisite.bank || null,
              name: activeRequisite.name || null
            }
          }
        }
      } else {
        console.error('❌ Requisites API response not OK:', response.status, await response.text())
      }
    } catch (error) {
      console.error('Ошибка получения реквизита:', error)
    }
    return null
  }

  // Функция для генерации Bakai QR кода
  const generateBakaiQR = async (baseHash: string, amount: number): Promise<string> => {
    // Проверяем, что base_hash содержит данные только для Bakai
    // Если есть данные DemirBank, это ошибка конфигурации
    if (baseHash.includes('qr.demirbank.kg') || baseHash.includes('DEMIRBANK')) {
      throw new Error('Base_hash для Bakai содержит данные DemirBank. Проверьте настройки кошелька в админке.')
    }
    
    // Проверяем, что base_hash содержит данные для Bakai
    if (!baseHash.includes('qr.bakai.kg') && !baseHash.includes('BAKAIAPP')) {
      throw new Error('Base_hash не содержит данные для Bakai. Проверьте настройки кошелька в админке.')
    }
    
    // Конвертируем сумму в копейки
    const amountCents = Math.round(parseFloat(String(amount)) * 100)
    const amountStr = amountCents.toString()
    const amountLen = amountStr.length.toString().padStart(2, '0')
    
    // Находим последнее поле 54 перед полем 63 (контрольная сумма)
    // Ищем все вхождения поля 54
    const field54Matches: Array<{ index: number; match: string; fullMatch: string }> = []
    const field54Pattern = /54(\d{2})(\d+)/g
    let match54
    while ((match54 = field54Pattern.exec(baseHash)) !== null) {
      field54Matches.push({
        index: match54.index,
        match: match54[0],
        fullMatch: match54[0]
      })
    }
    
    if (field54Matches.length === 0) {
      throw new Error('Не найдено поле 54 в base_hash')
    }
    
    // Находим индекс поля 63
    const index63 = baseHash.indexOf('6304')
    if (index63 === -1) {
      throw new Error('Не найдено поле 63 в base_hash')
    }
    
    // Находим последнее поле 54 перед полем 63
    const lastField54Before63 = field54Matches
      .filter(m => m.index < index63)
      .sort((a, b) => b.index - a.index)[0]
    
    if (!lastField54Before63) {
      throw new Error('Не найдено поле 54 перед полем 63 в base_hash')
    }
    
    // Заменяем последнее поле 54 на новое значение
    const oldField54 = lastField54Before63.fullMatch // например "540510053"
    const newField54 = `54${amountLen}${amountStr}` // например "0510053" или "046533"
    
    // Заменяем последнее вхождение поля 54 (перед полем 63)
    let updatedHash = baseHash.substring(0, lastField54Before63.index) + 
                     newField54 + 
                     baseHash.substring(lastField54Before63.index + oldField54.length)
    
    // Находим поле 63 (контрольная сумма) - должно быть последнее
    const field63Pattern = /6304([A-Fa-f0-9]{4})/
    const last63Index = updatedHash.lastIndexOf('6304')
    if (last63Index === -1) {
      throw new Error('Не найдено поле 63 в base_hash после замены')
    }
    
    // Извлекаем данные до последнего объекта 63 (ID "00" - "90", исключая ID 63)
    let dataBefore63 = updatedHash.substring(0, last63Index)
    
    // Согласно алгоритму:
    // 1. Все значения до объекта 63 преобразуются в строку (уже есть)
    // 2. Декодируем процентное кодирование (%20 -> пробел и т.д.)
    // 3. Строка переводится в массив байт с кодировкой UTF-8
    // 4. Вычисляется SHA256 хеш от массива байт
    // 5. Массив байт преобразуется в строку (hex)
    // 6. Удаляются все символы "-" если есть
    // 7. Берутся последние 4 символа
    
    // Декодируем процентное кодирование (%20 -> пробел и т.д.)
    try {
      dataBefore63 = decodeURIComponent(dataBefore63)
    } catch (e) {
      // Если декодирование не удалось, используем исходную строку
      console.warn('Could not decode URI component, using original string')
    }
    
    // Вычисляем SHA256 от данных до объекта 63 (уже работает с UTF-8 байтами)
    const checksumFull = await calculateSHA256(dataBefore63)
    
    // Удаляем все символы "-" если есть (хотя в hex их обычно нет)
    const checksumCleaned = checksumFull.replace(/-/g, '')
    
    // Берем последние 4 символа в верхнем регистре (как в примере)
    const checksum = checksumCleaned.slice(-4).toUpperCase()
    
    // Заменяем последнее поле 63 (контрольная сумма)
    const oldField63 = updatedHash.substring(last63Index, last63Index + 8) // "6304" + 4 символа
    const newField63 = `6304${checksum}`
    
    const finalHash = updatedHash.substring(0, last63Index) + newField63
    
    return finalHash
  }

  // Функция для генерации fallback QR кода
  const generateFallbackQR = async (currentBank: string) => {
    try {
      // Получаем активный реквизит из админки
      let requisiteData = await getActiveRequisite()
      
      // Если реквизит не найден, показываем ошибку
      if (!requisiteData) {
        console.error('❌ Не найден активный реквизит в админке! Пожалуйста, выберите активный кошелек в админ-панели.')
        showAlert({
          type: 'error',
          title: language === 'ru' ? 'Ошибка' : 'Error',
          message: language === 'ru'
            ? 'Активный кошелек не настроен. Обратитесь в поддержку.'
            : 'Active wallet not configured. Please contact support.'
        })
        return
      }
      
      const { value: requisite, bank } = requisiteData
      
      console.log('✅ Используется активный реквизит из админки:', requisite.slice(0, 4) + '****' + requisite.slice(-4), 'Bank:', bank)
      
      // Если банк Bakai, используем другую логику генерации
      if (bank === 'BAKAI') {
        try {
          const qrHash = await generateBakaiQR(requisite, amount)
          
          // Создаем ссылки для всех банков
          const bankLinks: Record<string, string> = {
            'DemirBank': `https://retail.demirbank.kg/#${qrHash}`,
            'O!Money': `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
            'Balance.kg': `https://balance.kg/#${qrHash}`,
            'Bakai': `https://bakai24.app/#${qrHash}`,
            'MegaPay': `https://megapay.kg/get#${qrHash}`,
            'MBank': `https://app.mbank.kg/qr/#${qrHash}`,
            'demirbank': `https://retail.demirbank.kg/#${qrHash}`,
            'omoney': `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
            'balance': `https://balance.kg/#${qrHash}`,
            'bakai': `https://bakai24.app/#${qrHash}`,
            'megapay': `https://megapay.kg/get#${qrHash}`,
            'mbank': `https://app.mbank.kg/qr/#${qrHash}`
          }
          
          setPaymentUrl(bankLinks[currentBank] || bankLinks['Bakai'])
          setQrData({
            qr_hash: qrHash,
            all_bank_urls: bankLinks,
            primary_url: bankLinks[currentBank] || bankLinks['Bakai']
          })
          return
        } catch (error) {
          console.error('❌ Ошибка генерации Bakai QR:', error)
          showAlert({
            type: 'error',
            title: language === 'ru' ? 'Ошибка' : 'Error',
            message: language === 'ru'
              ? 'Ошибка генерации QR кода для Bakai. Обратитесь в поддержку.'
              : 'Error generating QR code for Bakai. Please contact support.'
          })
          return
        }
      }
      
      // Для Demir Bank используем существующую логику
      const requisiteLen = requisite.length.toString().padStart(2, '0')
      
      const amountCents = Math.round(parseFloat(String(amount)) * 100)
      const amountStr = amountCents.toString().padStart(5, '0')
      const amountLen = amountStr.length.toString().padStart(2, '0')
      
      // Создаем TLV структуру до контрольной суммы (БЕЗ 6304)
      // Структура как в Django API для совместимости
      const merchantAccountValue = (
        `0015qr.demirbank.kg` +  // Под-тег 00: домен
        `01047001` +              // Под-тег 01: короткий тип (7001)
        `10${requisiteLen}${requisite}` +  // Под-тег 10: реквизит
        `120211130212`            // Под-теги 12, 13: дополнительные поля
      )
      const merchantAccountLen = merchantAccountValue.length.toString().padStart(2, '0')
      
      // Payload БЕЗ контрольной суммы и без 6304
      const payload = (
        `000201` +  // 00 - Payload Format Indicator
        `010211` +  // 01 - Point of Initiation Method (статический QR)
        `32${merchantAccountLen}${merchantAccountValue}` +  // 32 - Merchant Account
        `52044829` +  // 52 - Merchant Category Code
        `5303417` +   // 53 - Transaction Currency
        `54${amountLen}${amountStr}` +  // 54 - Amount
        `5909DEMIRBANK`  // 59 - Merchant Name
      )
      
      // Вычисляем SHA256 контрольную сумму от payload (БЕЗ 6304)
      const checksumFull = await calculateSHA256(payload)
      // Берем последние 4 символа (как в Django API)
      const checksum = checksumFull.slice(-4).toLowerCase()
      
      // Полный QR хеш: payload + '6304' + checksum
      const qrHash = payload + '6304' + checksum
      
      // Создаем ссылки для всех банков (с ключами как в Django API для совместимости)
      const bankLinks = {
        'DemirBank': `https://retail.demirbank.kg/#${qrHash}`,
        'O!Money': `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
        'Balance.kg': `https://balance.kg/#${qrHash}`,
        'Bakai': `https://bakai24.app/#${qrHash}`,
        'MegaPay': `https://megapay.kg/get#${qrHash}`,
        'MBank': `https://app.mbank.kg/qr/#${qrHash}`,
        // Также добавляем варианты с нижним регистром для совместимости
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
        enabled_banks: ['demirbank', 'omoney', 'balance', 'bakai', 'megapay', 'mbank'],
        settings: {
          deposits_enabled: true
        }
      })
      // Используем ключ с заглавными буквами для primary_url
      const primaryUrlMap: Record<string, keyof typeof bankLinks> = {
        'demirbank': 'DemirBank',
        'omoney': 'O!Money',
        'balance': 'Balance.kg',
        'bakai': 'Bakai',
        'megapay': 'MegaPay',
        'mbank': 'MBank'
      }
      const primaryKey: keyof typeof bankLinks = primaryUrlMap[currentBank] || 'DemirBank'
      setPaymentUrl(bankLinks[primaryKey] || bankLinks['DemirBank'])
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
      
      // Если есть qr_hash, создаем ссылки для всех банков
      if (data.qr_hash) {
        const qrHash = data.qr_hash
        // Создаем ссылки для всех банков с правильным форматом
        const bankLinks = {
          'DemirBank': `https://retail.demirbank.kg/#${qrHash}`,
          'O!Money': `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
          'Balance.kg': `https://balance.kg/#${qrHash}`,
          'Bakai': `https://bakai24.app/#${qrHash}`,
          'MegaPay': `https://megapay.kg/get#${qrHash}`,
          'MBank': `https://app.mbank.kg/qr/#${qrHash}`,
          // Также добавляем варианты с нижним регистром для совместимости
          'demirbank': `https://retail.demirbank.kg/#${qrHash}`,
          'omoney': `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
          'balance': `https://balance.kg/#${qrHash}`,
          'bakai': `https://bakai24.app/#${qrHash}`,
          'megapay': `https://megapay.kg/get#${qrHash}`,
          'mbank': `https://app.mbank.kg/qr/#${qrHash}`
        }
        
        // Обновляем data с правильными ссылками
        data.all_bank_urls = bankLinks
        data.primary_url = bankLinks['DemirBank'] || data.primary_url
      }
      
      setQrData(data)
      // Безопасный доступ к ссылкам
      const defaultUrl = (data.all_bank_urls as Record<string, string>)?.['DemirBank'] || 
                        (data.all_bank_urls as Record<string, string>)?.['demirbank'] || 
                        data.primary_url
      setPaymentUrl(defaultUrl || '')
      
      // Сохраняем настройки депозитов
      if (data.settings) {
        setDepositsEnabled(data.settings.deposits_enabled !== false)
      }
      
      // Также загружаем актуальные настройки из админки для enabled_banks
      try {
        const base = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3001' 
          : 'https://xendro.pro'
        const settingsRes = await fetch(`${base}/api/public/payment-settings`, { cache: 'no-store' })
        const settingsData = await settingsRes.json()
        if (settingsData && settingsData.deposits) {
          setDepositsEnabled(settingsData.deposits.enabled !== false)
          // Проверяем настройку require_receipt_photo
          if (settingsData.require_receipt_photo !== undefined) {
            setRequireReceiptPhoto(settingsData.require_receipt_photo === true)
          }
          // Обновляем enabled_banks в qrData (маппим коды банков из админки в коды компонента)
          if (settingsData.deposits.banks) {
            const bankCodeMapping: Record<string, string> = {
              'demir': 'demirbank',
              'demirbank': 'demirbank',
              'omoney': 'omoney',
              'balance': 'balance',
              'bakai': 'bakai',
              'megapay': 'megapay',
              'mbank': 'mbank'
            }
            const mappedBanks = settingsData.deposits.banks
              .map((b: any) => {
                const code = b.code || b
                return bankCodeMapping[code] || code
              })
              .filter(Boolean)
            setQrData((prev: any) => ({
              ...prev,
              settings: {
                ...prev?.settings,
                enabled_banks: mappedBanks
              }
            }))
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки настроек платежей:', error)
      }
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

  // Если депозиты отключены, показываем сообщение о технических работах
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
      {/* Заголовок */}
      <div className="text-center space-y-2 fade-in">
        <div className="pr-20">
          <h1 className="text-xl font-bold text-white">{t.title}</h1>
        </div>
        <p className="text-sm text-white/70">{t.subtitle}</p>
      </div>

      {/* Таймер (только для банковских переводов) */}
      {paymentType === 'bank' && (
        <div className="card text-center pulse">
          <div className="text-3xl font-bold text-red-500 mb-2">
            {formatTime(timeLeft)}
          </div>
          <p className="text-sm text-white/70">{t.timer}</p>
        </div>
      )}

      {/* Индикатор загрузки крипто invoice */}
      {paymentType === 'crypto' && cryptoLoading && (
        <div className="card text-center">
          <div className="text-white/70">Создание счета на оплату...</div>
        </div>
      )}

      {/* Crypto Bot Invoice - открытие через Telegram WebApp API внутри Telegram */}
      {paymentType === 'crypto' && cryptoInvoice && !isPaid && (
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
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              
              console.log('🔘 Button clicked!')
              console.log('📦 cryptoInvoice:', cryptoInvoice)
              
              try {
                const tg = (window as any).Telegram?.WebApp
                
                console.log('🔍 Telegram WebApp check:', {
                  hasTelegram: !!(window as any).Telegram,
                  hasWebApp: !!tg,
                  hasOpenInvoice: !!(tg && tg.openInvoice),
                  hasOpenLink: !!(tg && tg.openLink),
                  fullTg: tg
                })
                
                // Согласно документации Crypto Bot API:
                // - bot_invoice_url используется для openInvoice() в Telegram WebApp API
                // - mini_app_invoice_url предназначен для встраивания через iframe в Mini App
                // - web_app_invoice_url для веб-версии
                
                // Проверяем наличие invoice данных
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
                
                // Для открытия внутри Telegram через openInvoice() используем bot_invoice_url
                const invoiceUrl = cryptoInvoice.bot_invoice_url || 
                                  cryptoInvoice.mini_app_invoice_url || 
                                  cryptoInvoice.web_app_invoice_url
                
                console.log('📋 Invoice URLs:', {
                  bot_invoice_url: cryptoInvoice.bot_invoice_url,
                  mini_app_invoice_url: cryptoInvoice.mini_app_invoice_url,
                  web_app_invoice_url: cryptoInvoice.web_app_invoice_url,
                  selected: invoiceUrl
                })
                
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

                // Согласно документации Crypto Bot API:
                // mini_app_invoice_url (String) - Use this URL to pay an invoice to the Telegram Mini App version
                // Это специальный URL для использования внутри Telegram Mini App
                const miniAppUrl = cryptoInvoice.mini_app_invoice_url
                
                console.log('📋 Available invoice URLs:', {
                  mini_app_invoice_url: miniAppUrl,
                  bot_invoice_url: cryptoInvoice.bot_invoice_url,
                  web_app_invoice_url: cryptoInvoice.web_app_invoice_url
                })

                // Приоритет 1: Используем mini_app_invoice_url через openLink (как указано в документации)
                if (tg && tg.openLink && miniAppUrl) {
                  console.log('✅ Using openLink() with mini_app_invoice_url (Telegram Mini App version)')
                  try {
                    // Согласно документации, mini_app_invoice_url предназначен для Telegram Mini App
                    // Используем openLink для открытия внутри Telegram
                    tg.openLink(miniAppUrl)
                    console.log('✅ Invoice opened via openLink with mini_app_invoice_url')
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
                // Приоритет 2: Fallback на bot_invoice_url через openInvoice
                else if (tg && tg.openInvoice && cryptoInvoice.bot_invoice_url) {
                  console.log('⚠️ Using openInvoice() with bot_invoice_url (fallback)')
                  try {
                    tg.openInvoice(cryptoInvoice.bot_invoice_url, (status: string) => {
                      console.log('📊 Invoice payment status:', status)
                      if (status === 'paid' || status === 'completed') {
                        console.log('✅ Payment successful!')
                        setIsPaid(true)
                        setTimeout(() => {
                          router.push('/deposit/waiting')
                        }, 1000)
                      } else if (status === 'cancelled' || status === 'failed') {
                        console.log('⚠️ Invoice was cancelled or failed:', status)
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
                // Приоритет 3: Fallback на web_app_invoice_url
                else if (tg && tg.openLink && cryptoInvoice.web_app_invoice_url) {
                  console.log('⚠️ Using openLink() with web_app_invoice_url (fallback)')
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
                // Приоритет 4: Последний fallback - открыть в новой вкладке
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
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
          
          {/* Debug info (only in development) */}
          {process.env.NODE_ENV === 'development' && cryptoInvoice && (
            <div className="text-xs text-white/30 text-center mt-2 p-2 bg-black/20 rounded">
              <div>Invoice ID: {cryptoInvoice.invoice_id}</div>
              <div>Has bot_invoice_url: {cryptoInvoice.bot_invoice_url ? '✅' : '❌'}</div>
              <div>Has mini_app_invoice_url: {cryptoInvoice.mini_app_invoice_url ? '✅' : '❌'}</div>
            </div>
          )}
        </div>
      )}

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



      {/* Выбор банка (только для банковских переводов) */}
      {paymentType === 'bank' && (
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
      )}

      {/* Статус оплаты (только для банковских переводов, для crypto используется страница ожидания) */}
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

      {/* Загрузка фото чека (если требуется, только для банковских переводов) */}
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

      {/* Большая кнопка "Я оплатил" (для банковских переводов) */}
      {!isPaid && paymentType === 'bank' && (
        <button
          onClick={handleIPaid}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t.iPaid}
        </button>
      )}

      {/* Большая кнопка "Я оплатил" (для crypto платежей) */}
      {!isPaid && paymentType === 'crypto' && cryptoInvoice && (
        <button
          onClick={handleCryptoIPaid}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t.iPaid}
        </button>
      )}

      {/* Кнопка "Назад" */}
      {!isPaid && (
        <button
          onClick={handleBack}
          className="btn btn-ghost w-full"
        >
          ← {t.back}
        </button>
      )}

      {/* Инструкция (только для банковских переводов) */}
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

      {/* Инструкция для крипты */}
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

      {/* Кастомный алерт */}
      {AlertComponent}
    </main>
    </PageTransition>
  )
}
