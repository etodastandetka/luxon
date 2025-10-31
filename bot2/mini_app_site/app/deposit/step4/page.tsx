"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BankButtons from '../../../components/BankButtons'
import LanguageSelector from '../../../components/LanguageSelector'
import PageTransition from '../../../components/PageTransition'
import { useLanguage } from '../../../components/LanguageContext'
import { getTelegramUser, syncWithBot, notifyUser } from '../../../utils/telegram'
import { useAlert } from '../../../components/useAlert'

export default function DepositStep4() {
  const [bank, setBank] = useState('omoney') // По умолчанию O!Money
  const [paymentUrl, setPaymentUrl] = useState('')
  const [qrData, setQrData] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(300) // 5 минут в секундах
  const [isPaid, setIsPaid] = useState(false)
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
    
    setBookmaker(savedBookmaker)
    setPlayerId(savedPlayerId)
    setAmount(savedAmount)
    
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

  // Только генерируем QR код, заявка создается только после нажатия "Я оплатил"
  useEffect(() => {
    if (bookmaker && playerId && amount > 0) {
      // Сохраняем время начала таймера при генерации QR (если еще не сохранено)
      if (!localStorage.getItem('deposit_timer_start')) {
        localStorage.setItem('deposit_timer_start', Date.now().toString())
      }
      // Генерируем только QR код
      generateQRCode()
    }
  }, [bookmaker, playerId, amount])

  // Таймер обратного отсчета и проверка почты
  useEffect(() => {
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
  }, [timeLeft, isPaid])

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

  // Кнопка "Я оплатил" — отправляем заявку в админку только по нажатию
  const handleIPaid = async () => {
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
      
      // Уведомляем пользователя
      showAlert({
        type: 'success',
        title: language === 'ru' ? 'Заявка отправлена!' : 'Request submitted!',
        message: language === 'ru'
          ? 'Мы проверим вашу оплату и зачислим средства в течение 5-10 минут.\n\nВы получите уведомление, когда пополнение будет выполнено.'
          : 'We will verify your payment and credit funds within 5-10 minutes.\n\nYou will receive a notification when the deposit is completed.',
        autoClose: 3000
      })
      
      // Перенаправляем на главную страницу
      setTimeout(() => {
        router.push('/')
      }, 3000)
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
  const getActiveRequisite = async (): Promise<string | null> => {
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
              console.log('✅ Found active requisite by active_id:', activeRequisite.value)
              return activeRequisite.value
            }
          }
          // Если не нашли, пробуем найти по is_active
          const activeRequisite = data.requisites.find((req: any) => req.is_active === true)
          if (activeRequisite) {
            console.log('✅ Found active requisite by is_active:', activeRequisite.value)
            return activeRequisite.value
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

  // Функция для генерации fallback QR кода
  const generateFallbackQR = async (currentBank: string) => {
    try {
      // Получаем активный реквизит из админки
      let requisite = await getActiveRequisite()
      
      // Если реквизит не найден, показываем ошибку
      if (!requisite) {
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
      
      console.log('✅ Используется активный реквизит из админки:', requisite.slice(0, 4) + '****' + requisite.slice(-4))

      const amountCents = Math.round(parseFloat(String(amount)) * 100)
      const amountStr = amountCents.toString().padStart(5, '0')
      const amountLen = amountStr.length.toString().padStart(2, '0')
      
      const requisiteLen = requisite.length.toString().padStart(2, '0')
      
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
          <div className="text-center space-y-2 fade-in">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold text-white">{t.title}</h1>
              <div className="scale-75">
                <LanguageSelector />
              </div>
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

      {/* Загрузка фото чека (если требуется) */}
      {!isPaid && requireReceiptPhoto && (
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

      {/* Большая кнопка "Я оплатил" */}
      {!isPaid && (
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

      {/* Кнопка "Назад" сразу под "Я оплатил" */}
      {!isPaid && (
        <button
          onClick={handleBack}
          className="btn btn-ghost w-full"
        >
          ← {t.back}
        </button>
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

      {/* Кастомный алерт */}
      {AlertComponent}
    </main>
    </PageTransition>
  )
}