"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'
import { checkUserBlocked } from '../../../utils/telegram'
import { safeFetch, getApiBase } from '../../../utils/fetch'

export default function WithdrawStep5() {
  const [siteCode, setSiteCode] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null)
  const [checkingExists, setCheckingExists] = useState(false)
  const [hasWithdrawals, setHasWithdrawals] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bookmaker, setBookmaker] = useState('')
  const [bank, setBank] = useState('')
  const [phone, setPhone] = useState('')
  const [userId, setUserId] = useState('')
  const [qrPhoto, setQrPhoto] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [autoSubmitAttempted, setAutoSubmitAttempted] = useState(false)
  const [autoSubmitSuccess, setAutoSubmitSuccess] = useState(false)
  const [autoSubmitFailed, setAutoSubmitFailed] = useState(false)
  const { language } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    // Проверяем, что пользователь прошел предыдущие шаги
    const savedBookmaker = localStorage.getItem('withdraw_bookmaker')
    const savedBank = localStorage.getItem('withdraw_bank')
    const savedQrPhoto = localStorage.getItem('withdraw_qr_photo')
    const savedPhone = localStorage.getItem('withdraw_phone')
    const savedUserId = localStorage.getItem('withdraw_user_id')
    
    if (!savedBookmaker || !savedBank || !savedQrPhoto || !savedPhone || !savedUserId) {
      router.push('/withdraw/step0')
      return
    }

    setBookmaker(savedBookmaker)
    setBank(savedBank)
    setQrPhoto(savedQrPhoto)
    setPhone(savedPhone)
    setUserId(savedUserId)

    // Проверяем наличие выводов для этого ID
    checkWithdrawsExist(savedBookmaker, savedUserId)
  }, [router])

  const checkWithdrawsExist = async (bookmaker: string, userId: string) => {
    setCheckingExists(true)
    setError(null)
    
    try {
      const base = getApiBase()
      
      console.log('🔄 Проверка наличия выводов:', { bookmaker, userId })
      
      const response = await safeFetch(`${base}/api/withdraw-check-exists?bookmaker=${encodeURIComponent(bookmaker)}&playerId=${encodeURIComponent(userId)}`, {
        timeout: 15000,
        retries: 1,
        retryDelay: 1000
      })
      
      if (!response.ok) {
        console.error('❌ Ошибка проверки наличия выводов:', {
          status: response.status,
          statusText: response.statusText
        })
        // При ошибке все равно разрешаем попробовать ввести код
        setHasWithdrawals(true)
        return
      }
      
      const data = await response.json()
      
      if (data.success && data.data) {
        // Для казино, где нет метода проверки без кода, считаем что можно проверить
        if (data.data.canCheck && data.data.hasWithdrawals !== false) {
          setHasWithdrawals(true)
        } else if (data.data.hasWithdrawals === false) {
          setHasWithdrawals(false)
          setError('Нет вывода на этот ID. Проверьте правильность ID аккаунта.')
        } else {
          setHasWithdrawals(true) // Можно попробовать ввести код
        }
      } else {
        // Если проверка не удалась, все равно разрешаем ввести код
        setHasWithdrawals(true)
      }
    } catch (error: any) {
      console.error('Ошибка проверки наличия выводов:', error)
      // При ошибке все равно разрешаем попробовать ввести код
      setHasWithdrawals(true)
    } finally {
      setCheckingExists(false)
    }
  }

  // Проверка кода и получение суммы ордера при изменении кода
  useEffect(() => {
    const bookmaker = localStorage.getItem('withdraw_bookmaker')
    const userId = localStorage.getItem('withdraw_user_id')
    
    // Выполняем вывод только если код полный (минимум 4 символа для большинства кодов)
    if (siteCode.trim().length >= 4 && bookmaker && userId) {
      // Сбрасываем флаги автоматической отправки при изменении кода
      setAutoSubmitAttempted(false)
      setAutoSubmitSuccess(false)
      setAutoSubmitFailed(false)
      processWithdraw(bookmaker, userId)
    } else {
      setWithdrawAmount(null)
      setError(null)
      setAutoSubmitAttempted(false)
      setAutoSubmitSuccess(false)
      setAutoSubmitFailed(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode])

  const processWithdraw = async (bookmaker: string, userId: string) => {
    if (!siteCode.trim()) {
      return
    }

    setError(null)
    
    try {
      const base = getApiBase()
      
      console.log('🔄 Проверка кода вывода:', { bookmaker, userId, codeLength: siteCode.trim().length })
      
      // Только проверяем код и получаем сумму ордера (mobile.getWithdrawalAmount)
      // Вывод будет выполнен на странице подтверждения
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

      console.log('📥 Ответ от сервера:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Ошибка ответа сервера:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        })
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      console.log('[Withdraw Step5] API Response:', JSON.stringify(data, null, 2))
      
      // Проверяем успешный ответ
      if (data.success) {
        // Пытаемся извлечь amount из разных мест ответа
        let amount: number | null = null
        let alreadyExecuted = false
        
        console.log('[Withdraw Step5] Parsing response:', {
          hasData: !!data.data,
          dataKeys: data.data ? Object.keys(data.data) : [],
          dataAmount: data.data?.amount,
          dataAlreadyExecuted: data.data?.alreadyExecuted,
          message: data.message,
          fullData: data
        })
        
        // Вариант 1: amount в data.data.amount (основной путь для всех казино)
        if (data.data && data.data.amount !== undefined && data.data.amount !== null) {
          amount = parseFloat(String(data.data.amount))
          alreadyExecuted = data.data.alreadyExecuted === true
          console.log('[Withdraw Step5] ✅ Found amount in data.data.amount:', amount)
        }
        // Вариант 2: amount напрямую в data.amount
        else if (data.amount !== undefined && data.amount !== null) {
          amount = parseFloat(String(data.amount))
          console.log('[Withdraw Step5] ✅ Found amount in data.amount:', amount)
        }
        // Вариант 3: amount в data.data напрямую (если это число)
        else if (data.data && typeof data.data === 'number') {
          amount = parseFloat(data.data.toString())
          console.log('[Withdraw Step5] ✅ Found amount in data.data (number):', amount)
        }
        // Вариант 4: проверяем все вложенные объекты в data.data
        else if (data.data && typeof data.data === 'object') {
          // Ищем amount в любом вложенном поле
          const searchForAmount = (obj: any, path = ''): number | null => {
            if (!obj || typeof obj !== 'object') return null
            for (const key in obj) {
              const value = obj[key]
              const currentPath = path ? `${path}.${key}` : key
              if (key.toLowerCase() === 'amount' && (typeof value === 'number' || typeof value === 'string')) {
                const parsed = parseFloat(String(value))
                if (!isNaN(parsed) && parsed > 0) {
                  console.log(`[Withdraw Step5] ✅ Found amount in ${currentPath}:`, parsed)
                  return parsed
                }
              }
              if (typeof value === 'object' && value !== null) {
                const found = searchForAmount(value, currentPath)
                if (found !== null) return found
              }
            }
            return null
          }
          const foundAmount = searchForAmount(data.data)
          if (foundAmount !== null) {
            amount = foundAmount
          }
        }
        
        // Проверяем message для определения, выполнен ли вывод
        const message = (data.message || data.error || '').toLowerCase()
        if (message.includes('executed') || message.includes('успешно') || message.includes('withdrawal executed')) {
          alreadyExecuted = true
          console.log('[Withdraw Step5] Withdrawal executed detected from message')
        }
        
        // Если alreadyExecuted установлен в data.data, используем его
        if (data.data && data.data.alreadyExecuted !== undefined) {
          alreadyExecuted = data.data.alreadyExecuted === true
        }
        
        // Валидация суммы
        console.log('[Withdraw Step5] Amount validation:', {
          amount,
          isNull: amount === null,
          isNaN: amount !== null ? isNaN(amount) : 'N/A',
          isPositive: amount !== null ? amount > 0 : 'N/A',
          type: typeof amount,
          rawAmount: data.data?.amount,
          rawAmountType: typeof data.data?.amount,
          dataDataKeys: data.data ? Object.keys(data.data) : []
        })
        
        // КРИТИЧНО: Если сумма найдена и валидна - ВСЕГДА очищаем ошибку и устанавливаем сумму
        // НЕ устанавливаем ошибку, если сумма найдена, даже если message содержит "executed"
        if (amount !== null && !isNaN(amount) && amount > 0) {
          console.log('[Withdraw Step5] ✅ Amount is valid, clearing error and setting amount')
          
          // ВАЖНО: Сначала очищаем ошибку, потом устанавливаем сумму
          setError(null)
          setWithdrawAmount(amount)
          
          // Сохраняем в localStorage для использования при создании заявки
          const amountStr = amount.toString()
          localStorage.setItem('withdraw_amount', amountStr)
          localStorage.setItem('withdraw_site_code', siteCode.trim())
          
          // Сохраняем transactionId если он есть (для Mostbet и других казино)
          if (data.data?.transactionId) {
            localStorage.setItem('withdraw_transaction_id', String(data.data.transactionId))
            console.log('[Withdraw Step5] ✅ TransactionId saved:', data.data.transactionId)
          } else if (data.transactionId) {
            localStorage.setItem('withdraw_transaction_id', String(data.transactionId))
            console.log('[Withdraw Step5] ✅ TransactionId saved (from data root):', data.transactionId)
          }
          
          // Проверяем, что сумма сохранилась
          const savedAmount = localStorage.getItem('withdraw_amount')
          console.log('[Withdraw Step5] ✅ Success - amount:', amount, 'alreadyExecuted:', alreadyExecuted)
          console.log('[Withdraw Step5] ✅ Amount saved to localStorage:', amountStr)
          console.log('[Withdraw Step5] ✅ Verified localStorage amount:', savedAmount)
          console.log('[Withdraw Step5] ✅ Error cleared, amount set to:', amount)
          
          // Дополнительная проверка через небольшую задержку
          setTimeout(() => {
            const currentAmount = localStorage.getItem('withdraw_amount')
            console.log('[Withdraw Step5] ✅ Post-set verification - localStorage amount:', currentAmount)
            if (currentAmount !== amountStr) {
              console.error('[Withdraw Step5] ❌ Amount mismatch! Expected:', amountStr, 'Got:', currentAmount)
              // Пересохраняем, если не совпадает
              localStorage.setItem('withdraw_amount', amountStr)
            }
          }, 50)

          // АВТОМАТИЧЕСКАЯ ОТПРАВКА ЗАЯВКИ после успешной проверки кода
          // Ждем немного, чтобы состояние обновилось, затем автоматически отправляем заявку
          if (!autoSubmitAttempted) {
            setAutoSubmitAttempted(true)
            console.log('[Withdraw Step5] 🚀 Автоматическая отправка заявки...')
            (async () => {
              // Проверяем, что все данные есть
              const savedBookmaker = localStorage.getItem('withdraw_bookmaker')
              const savedBank = localStorage.getItem('withdraw_bank')
              const savedQrPhoto = localStorage.getItem('withdraw_qr_photo')
              const savedPhone = localStorage.getItem('withdraw_phone')
              const savedUserId = localStorage.getItem('withdraw_user_id')
              
              if (savedBookmaker && savedBank && savedQrPhoto && savedPhone && savedUserId && amount > 0) {
                console.log('[Withdraw Step5] 🚀 Все данные готовы, автоматически отправляем заявку...')
                // Вызываем handleSubmit автоматически
                await handleSubmitAuto(amount)
              } else {
                console.log('[Withdraw Step5] ⚠️ Не все данные готовы для автоматической отправки:', {
                  bookmaker: !!savedBookmaker,
                  bank: !!savedBank,
                  qrPhoto: !!savedQrPhoto,
                  phone: !!savedPhone,
                  userId: !!savedUserId,
                  amount: amount > 0
                })
                setAutoSubmitAttempted(false) // Разрешаем попробовать еще раз
              }
            })() // Задержка 1 секунда для обновления состояния
          }
        } else {
          // Если success: true, но нет amount, проверяем message
          console.error('[Withdraw Step5] ❌ Amount validation failed:', {
            amount,
            isNull: amount === null,
            isNaN: amount !== null ? isNaN(amount) : 'N/A',
            isPositive: amount !== null ? amount > 0 : 'N/A',
            message,
            dataData: data.data,
            fullData: JSON.stringify(data, null, 2)
          })
          
          // ТОЛЬКО если сумма НЕ найдена, устанавливаем ошибку
          if (message.includes('executed') || message.includes('успешно') || message.includes('withdrawal executed')) {
            // Операция успешна, но amount не найден - это критическая ошибка
            setWithdrawAmount(null)
            setError('Вывод выполнен, но не удалось получить сумму. Обратитесь в поддержку.')
          } else {
            setWithdrawAmount(null)
            setError('Не удалось получить сумму вывода. Попробуйте еще раз.')
          }
        }
      } else {
        // Ошибка от API
        console.error('[Withdraw Step5] Error response:', data)
        setWithdrawAmount(null)
        
        // Улучшенные сообщения об ошибках
        let errorMessage = data.error || data.message || 'Код неверный или вывод не найден'
        
        // Специальные сообщения для разных типов ошибок
        if (errorMessage.includes('нет активных запросов') || errorMessage.includes('No withdrawal request')) {
          errorMessage = 'У вас нет активных запросов на вывод. Убедитесь, что вы создали заявку на вывод в казино Mostbet и ввели правильный ID аккаунта.'
        } else if (errorMessage.includes('просрочен') || errorMessage.includes('EXPIRED')) {
          errorMessage = 'Код подтверждения просрочен. Создайте новую заявку на вывод в казино Mostbet.'
        } else if (errorMessage.includes('отменена') || errorMessage.includes('CANCELED')) {
          errorMessage = 'Транзакция была отменена. Создайте новую заявку на вывод в казино Mostbet.'
        } else if (errorMessage.includes('неверный код') || errorMessage.includes('Invalid code')) {
          errorMessage = 'Неверный код подтверждения. Проверьте код, который вы получили в казино Mostbet.'
        }
        
        setError(errorMessage)
      }
    } catch (error: any) {
      console.error('❌ Ошибка проверки кода:', {
        error,
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      })
      setWithdrawAmount(null)
      
      let errorMessage = 'Ошибка проверки кода. Попробуйте еще раз.'
      if (error?.message) {
        errorMessage = error.message
      } else if (error?.name === 'AbortError') {
        errorMessage = 'Превышено время ожидания. Проверьте интернет-соединение и попробуйте снова.'
      } else if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        errorMessage = 'Нет подключения к интернету. Проверьте соединение и попробуйте снова.'
      }
      
      setError(errorMessage)
    }
  }

  // Автоматическая отправка заявки после успешной проверки кода
  const handleSubmitAuto = async (amount: number) => {
    // Защита от повторных отправок
    if (isSubmitting) {
      console.log('[Withdraw Step5] ⚠️ Запрос уже отправляется, игнорируем автоматическую отправку')
      return
    }

    console.log('[Withdraw Step5] 🚀 Автоматическая отправка заявки...')
    setIsSubmitting(true)
    
    try {
      const base = getApiBase()
      const savedBookmaker = localStorage.getItem('withdraw_bookmaker') || bookmaker
      const savedBank = localStorage.getItem('withdraw_bank') || bank
      const savedQrPhoto = localStorage.getItem('withdraw_qr_photo') || qrPhoto
      const savedPhone = localStorage.getItem('withdraw_phone') || phone
      const savedUserId = localStorage.getItem('withdraw_user_id') || userId
      const savedSiteCode = localStorage.getItem('withdraw_site_code') || siteCode.trim()
      const savedTransactionId = localStorage.getItem('withdraw_transaction_id') || null

      // Для 1xbet сначала выполняем вывод (mobile.withdrawal)
      const normalizedBookmaker = savedBookmaker.toLowerCase()
      if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet') {
        console.log('🔄 Выполняем вывод для 1xbet перед созданием заявки...')
        
        const withdrawResponse = await safeFetch(`${base}/api/withdraw-execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookmaker: savedBookmaker,
            playerId: savedUserId,
            code: savedSiteCode,
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
          } catch (e) {
            // Не JSON
          }
          
          const errorMsg = errorData?.error || errorData?.message || `Ошибка выполнения вывода: ${withdrawResponse.status}`
          throw new Error(errorMsg)
        }

        const withdrawData = await withdrawResponse.json()
        if (!withdrawData.success) {
          alert(`Ошибка выполнения вывода: ${withdrawData.message || withdrawData.error || 'Неизвестная ошибка'}`)
          setIsSubmitting(false)
          setAutoSubmitAttempted(false)
          return
        }

        console.log('✅ Вывод выполнен успешно:', withdrawData)
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
          console.log('❌ Error parsing initData:', e)
        }
      }

      // Получаем Telegram ID пользователя
      let telegramUserId: string | null = null
      
      if (tg?.initDataUnsafe?.user?.id) {
        telegramUserId = String(tg.initDataUnsafe.user.id)
      } else if (tg?.initData) {
        try {
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          if (userParam) {
            const userData = JSON.parse(decodeURIComponent(userParam))
            telegramUserId = String(userData.id)
          }
        } catch (e) {
          console.error('Error parsing initData for telegram_user_id:', e)
        }
      }
      
      if (!telegramUserId && telegramUser?.id) {
        telegramUserId = String(telegramUser.id)
      }

      if (!telegramUserId) {
        console.error('❌ Telegram user ID not found!')
        alert('Ошибка: не удалось определить ID пользователя. Пожалуйста, перезагрузите страницу.')
        setIsSubmitting(false)
        setAutoSubmitAttempted(false)
        return
      }

      // Проверяем, не заблокирован ли пользователь
      const isBlocked = await checkUserBlocked(telegramUserId)
      if (isBlocked) {
        console.error('❌ Пользователь заблокирован!')
        alert('Ваш аккаунт заблокирован. Вы не можете создавать заявки на вывод.')
        window.location.href = '/blocked'
        setIsSubmitting(false)
        setAutoSubmitAttempted(false)
        return
      }

      // Создаем заявку в админке
      console.log('📤 Автоматически создаем заявку в админке...')
      
      const cleanPhone = savedPhone.replace(/[^\d]/g, '')
      
      const requestBody = {
        type: 'withdraw',
        bookmaker: savedBookmaker,
        userId: telegramUserId,
        phone: cleanPhone,
        amount: amount,
        bank: savedBank,
        account_id: savedUserId,
        playerId: savedUserId,
        qr_photo: savedQrPhoto,
        site_code: savedSiteCode,
        transaction_id: savedTransactionId, // ID транзакции от Mostbet API
        telegram_user_id: telegramUserId,
        telegram_username: telegramUser?.username,
        telegram_first_name: telegramUser?.first_name,
        telegram_last_name: telegramUser?.last_name,
        telegram_language_code: telegramUser?.language_code
      }
      
      console.log('[Withdraw Step5] 📤 Автоматическое создание заявки с данными:', {
        ...requestBody,
        qr_photo: savedQrPhoto ? `[base64, ${savedQrPhoto.length} chars]` : null,
        apiUrl: `${base}/api/payment`
      })
      
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
        console.error('❌ Ошибка чтения ответа:', e)
        throw new Error(`Ошибка чтения ответа сервера: ${response.status} ${response.statusText}`)
      }
      
      if (!response.ok) {
        let errorData: any = null
        try {
          if (responseText) {
            errorData = JSON.parse(responseText)
          }
        } catch (e) {
          // Не JSON
        }
        
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
        console.error('❌ Ошибка парсинга ответа:', parseError)
        throw new Error('Не удалось обработать ответ сервера. Попробуйте еще раз.')
      }
      
      if (result.success !== false) {
        console.log('✅ Заявка на вывод создана успешно автоматически:', result)
        
        // Устанавливаем флаг успешной автоматической отправки
        setAutoSubmitSuccess(true)
        
        const getBankName = (bankCode: string) => {
          const bankNames: Record<string, string> = {
            'kompanion': 'Компаньон',
            'demirbank': 'DemirBank',
            'odengi': 'O!Money',
            'omoney': 'O!Money',
            'balance': 'Balance.kg',
            'bakai': 'Bakai',
            'megapay': 'MegaPay',
            'mbank': 'MBank'
          }
          return bankNames[bankCode] || bankCode
        }
        
        const message = `✅ Заявка на вывод создана автоматически!\n\n🏦 Банк: ${getBankName(savedBank)}\n📱 Телефон: +${cleanPhone}\n🆔 ID: ${savedUserId}\n🔑 Код: ${savedSiteCode}\n💰 Сумма: ${amount} сом\n🆔 ID заявки: #${result.id || result.data?.id}\n\n⏳ Ожидайте обработки заявки администратором.`
        
        alert(message)
        
        // Очищаем данные
        localStorage.removeItem('withdraw_bookmaker')
        localStorage.removeItem('withdraw_bank')
        localStorage.removeItem('withdraw_qr_photo')
        localStorage.removeItem('withdraw_phone')
        localStorage.removeItem('withdraw_user_id')
        localStorage.removeItem('withdraw_site_code')
        localStorage.removeItem('withdraw_amount')
        localStorage.removeItem('withdraw_transaction_id')
        localStorage.removeItem('withdraw_request_created')
        
        // Перенаправляем на главную через 2 секунды
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } else {
        console.error('❌ API Error:', result)
        throw new Error(`Failed to create withdraw request: ${result.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      console.error('❌ Error creating withdraw request automatically:', {
        error,
        message: error?.message,
        name: error?.name,
      })
      
      let errorMessage = 'Ошибка при автоматическом создании заявки. Попробуйте отправить вручную.'
      const errorMsg = String(error?.message || '')
      const errorName = error?.name || ''
      
      if (error?.status || errorMsg.includes('HTTP') || errorMsg.includes('Status:') || errorMsg.includes('Ошибка создания заявки') || errorMsg.includes('Ошибка выполнения вывода')) {
        errorMessage = errorMsg || 'Ошибка сервера. Попробуйте отправить вручную.'
      } else if (errorName === 'AbortError' || errorMsg.includes('Таймаут') || errorMsg.includes('timeout')) {
        errorMessage = 'Превышено время ожидания. Попробуйте отправить вручную.'
      } else if (errorName === 'TypeError' && errorMsg.includes('Failed to fetch') && !errorMsg.includes('HTTP') && !errorMsg.includes('Status:') && !errorMsg.includes('Ошибка')) {
        errorMessage = 'Нет подключения к интернету. Попробуйте отправить вручную.'
      } else if (errorMsg && !errorMsg.includes('Нет подключения к интернету')) {
        errorMessage = errorMsg
      }
      
      alert(`Ошибка: ${errorMessage}`)
      setAutoSubmitAttempted(false) // Разрешаем попробовать еще раз вручную
      setAutoSubmitFailed(true) // Устанавливаем флаг ошибки, чтобы показать кнопку
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    // Защита от повторных кликов
    if (isSubmitting) {
      console.log('[Withdraw Step5] ⚠️ Запрос уже отправляется, игнорируем повторный клик')
      return
    }

    if (!siteCode.trim()) {
      alert('Введите код с сайта')
      return
    }

    if (!withdrawAmount || withdrawAmount <= 0) {
      alert('Код неверный или вывод не найден. Проверьте код и попробуйте еще раз.')
      return
    }
    
    // Проверяем, что все данные заполнены
    if (!bookmaker || !bank || !phone || !userId || !qrPhoto) {
      alert('Не все данные заполнены. Вернитесь на предыдущие шаги.')
      return
    }

    setIsSubmitting(true)
    
    try {
      const base = getApiBase()

      // Для 1xbet сначала выполняем вывод (mobile.withdrawal)
      const normalizedBookmaker = bookmaker.toLowerCase()
      if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet') {
        console.log('🔄 Выполняем вывод для 1xbet перед созданием заявки...')
        
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
          } catch (e) {
            // Не JSON
          }
          
          const errorMsg = errorData?.error || errorData?.message || `Ошибка выполнения вывода: ${withdrawResponse.status}`
          throw new Error(errorMsg)
        }

        const withdrawData = await withdrawResponse.json()
        if (!withdrawData.success) {
          alert(`Ошибка выполнения вывода: ${withdrawData.message || withdrawData.error || 'Неизвестная ошибка'}`)
          setIsSubmitting(false)
          return
        }

        console.log('✅ Вывод выполнен успешно:', withdrawData)
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
          console.log('❌ Error parsing initData:', e)
        }
      }

      // Получаем Telegram ID пользователя
      let telegramUserId: string | null = null
      
      if (tg?.initDataUnsafe?.user?.id) {
        telegramUserId = String(tg.initDataUnsafe.user.id)
      } else if (tg?.initData) {
        try {
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          if (userParam) {
            const userData = JSON.parse(decodeURIComponent(userParam))
            telegramUserId = String(userData.id)
          }
        } catch (e) {
          console.error('Error parsing initData for telegram_user_id:', e)
        }
      }
      
      if (!telegramUserId && telegramUser?.id) {
        telegramUserId = String(telegramUser.id)
      }

      if (!telegramUserId) {
        console.error('❌ Telegram user ID not found!')
        alert('Ошибка: не удалось определить ID пользователя. Пожалуйста, перезагрузите страницу.')
        setIsSubmitting(false)
        return
      }

      // Проверяем, не заблокирован ли пользователь
      const isBlocked = await checkUserBlocked(telegramUserId)
      if (isBlocked) {
        console.error('❌ Пользователь заблокирован!')
        alert('Ваш аккаунт заблокирован. Вы не можете создавать заявки на вывод.')
        window.location.href = '/blocked'
        setIsSubmitting(false)
        return
      }

      // Создаем заявку в админке
      console.log('📤 Создаем заявку в админке...')
      
      const cleanPhone = phone.replace(/[^\d]/g, '')
      
      // Получаем transactionId из localStorage если есть
      const savedTransactionId = localStorage.getItem('withdraw_transaction_id') || null
      
      const requestBody = {
        type: 'withdraw',
        bookmaker: bookmaker,
        userId: telegramUserId,
        phone: cleanPhone,
        amount: withdrawAmount,
        bank: bank,
        account_id: userId,
        playerId: userId,
        qr_photo: qrPhoto,
        site_code: siteCode.trim(),
        transaction_id: savedTransactionId, // ID транзакции от Mostbet API
        telegram_user_id: telegramUserId,
        telegram_username: telegramUser?.username,
        telegram_first_name: telegramUser?.first_name,
        telegram_last_name: telegramUser?.last_name,
        telegram_language_code: telegramUser?.language_code
      }
      
      console.log('[Withdraw Step5] 📤 Создание заявки с данными:', {
        ...requestBody,
        qr_photo: qrPhoto ? `[base64, ${qrPhoto.length} chars]` : null,
        apiUrl: `${base}/api/payment`
      })
      
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
        console.error('❌ Ошибка чтения ответа:', e)
        throw new Error(`Ошибка чтения ответа сервера: ${response.status} ${response.statusText}`)
      }
      
      if (!response.ok) {
        let errorData: any = null
        try {
          if (responseText) {
            errorData = JSON.parse(responseText)
          }
        } catch (e) {
          // Не JSON
        }
        
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
        console.error('❌ Ошибка парсинга ответа:', parseError)
        throw new Error('Не удалось обработать ответ сервера. Попробуйте еще раз.')
      }
      
      if (result.success !== false) {
        console.log('✅ Заявка на вывод создана успешно:', result)
        
        const getBankName = (bankCode: string) => {
          const bankNames: Record<string, string> = {
            'kompanion': 'Компаньон',
            'demirbank': 'DemirBank',
            'odengi': 'O!Money',
            'omoney': 'O!Money',
            'balance': 'Balance.kg',
            'bakai': 'Bakai',
            'megapay': 'MegaPay',
            'mbank': 'MBank'
          }
          return bankNames[bankCode] || bankCode
        }
        
        const message = `✅ Заявка на вывод создана!\n\n🏦 Банк: ${getBankName(bank)}\n📱 Телефон: +${cleanPhone}\n🆔 ID: ${userId}\n🔑 Код: ${siteCode.trim()}\n💰 Сумма: ${withdrawAmount} сом\n🆔 ID заявки: #${result.id || result.data?.id}\n\n⏳ Ожидайте обработки заявки администратором.`
        
        alert(message)
        
        // Очищаем данные
        localStorage.removeItem('withdraw_bookmaker')
        localStorage.removeItem('withdraw_bank')
        localStorage.removeItem('withdraw_qr_photo')
        localStorage.removeItem('withdraw_phone')
        localStorage.removeItem('withdraw_user_id')
        localStorage.removeItem('withdraw_site_code')
        localStorage.removeItem('withdraw_amount')
        localStorage.removeItem('withdraw_transaction_id')
        localStorage.removeItem('withdraw_request_created')
        
        // Перенаправляем на главную через 2 секунды
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } else {
        console.error('❌ API Error:', result)
        throw new Error(`Failed to create withdraw request: ${result.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      console.error('❌ Error creating withdraw request:', {
        error,
        message: error?.message,
        name: error?.name,
      })
      
      let errorMessage = 'Ошибка при создании заявки. Попробуйте еще раз.'
      const errorMsg = String(error?.message || '')
      const errorName = error?.name || ''
      
      if (error?.status || errorMsg.includes('HTTP') || errorMsg.includes('Status:') || errorMsg.includes('Ошибка создания заявки') || errorMsg.includes('Ошибка выполнения вывода')) {
        errorMessage = errorMsg || 'Ошибка сервера. Попробуйте еще раз.'
      } else if (errorName === 'AbortError' || errorMsg.includes('Таймаут') || errorMsg.includes('timeout')) {
        errorMessage = 'Превышено время ожидания. Попробуйте еще раз.'
      } else if (errorName === 'TypeError' && errorMsg.includes('Failed to fetch') && !errorMsg.includes('HTTP') && !errorMsg.includes('Status:') && !errorMsg.includes('Ошибка')) {
        errorMessage = 'Нет подключения к интернету. Проверьте соединение и попробуйте снова.'
      } else if (errorMsg && !errorMsg.includes('Нет подключения к интернету')) {
        errorMessage = errorMsg
      }
      
      alert(`Ошибка: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Получаем адрес для указания в казино в зависимости от букмекера
  const getWithdrawalAddress = () => {
    const normalizedBookmaker = bookmaker.toLowerCase()
    if (normalizedBookmaker.includes('lux') || normalizedBookmaker === 'luxon' || normalizedBookmaker === 'lux on') {
      return 'Lux on'
    } else if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet' || normalizedBookmaker.includes('xbet')) {
      return 'TSUM LUX'
    }
    return null
  }

  const getBankName = (bankCode: string) => {
    const bankNames: Record<string, string> = {
      'kompanion': 'Компаньон',
      'demirbank': 'DemirBank',
      'odengi': 'O!Money',
      'omoney': 'O!Money',
      'balance': 'Balance.kg',
      'bakai': 'Bakai',
      'megapay': 'MegaPay',
      'mbank': 'MBank'
    }
    return bankNames[bankCode] || bankCode
  }

  const withdrawalAddress = getWithdrawalAddress()

  const handleBack = () => {
    router.push('/withdraw/step4')
  }

  const translations = {
      ru: {
      title: 'Вывод - Шаг 5',
      subtitle: 'Код с сайта',
      instruction: 'Введите код подтверждения с сайта букмекера. После ввода код будет проверен, и заявка будет отправлена.',
      placeholder: 'Введите код',
      submit: 'Отправить заявку',
      back: 'Назад'
    },
    en: {
      title: 'Withdraw - Step 5',
      subtitle: 'Site code',
      instruction: 'Enter confirmation code from bookmaker site',
      placeholder: 'Enter code',
      submit: 'Submit request',
      back: 'Back'
    },
    ky: {
      title: 'Чыгаруу - 5-чи кадам',
      subtitle: 'Сайт коду',
      instruction: 'Букмекер сайтынан ырастоо кодун киргизиңиз',
      placeholder: 'Код киргизиңиз',
      submit: 'Өтүнүч жөнөтүү',
      back: 'Артка'
    },
    uz: {
      title: 'Yechib olish - 5-qadam',
      subtitle: 'Sayt kodi',
      instruction: 'Bukmeker saytidan tasdiqlash kodini kiriting',
      placeholder: 'Kod kiriting',
      submit: 'So\'rov yuborish',
      back: 'Orqaga'
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
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-accent h-2 rounded-full" style={{width: '100%'}}></div>
          </div>
          <p className="text-sm text-white/70 mt-1">Шаг 5 из 5</p>
        </div>
        
        <p className="text-white/80 text-center">{t.instruction}</p>
        
        {/* Информация об адресе для указания в казино */}
        {withdrawalAddress && (
          <div className="p-4 bg-blue-900/30 border border-blue-500 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-xl">📍</span>
              <div className="flex-1">
                <p className="text-sm text-blue-300 font-semibold mb-1">
                  {language === 'ru' ? 'Важно! Укажите в казино адрес:' : language === 'en' ? 'Important! Specify in casino address:' : 'Маанилүү! Казинодо дарегиңизди көрсөтүңүз:'}
                </p>
                <p className="text-lg text-white font-bold text-center py-2 bg-blue-950/50 rounded border border-blue-400">
                  {withdrawalAddress}
                </p>
                <p className="text-xs text-blue-200 mt-2">
                  {language === 'ru' 
                    ? 'При создании заявки на вывод в казино укажите именно этот адрес'
                    : language === 'en'
                    ? 'When creating a withdrawal request in casino, specify exactly this address'
                    : 'Казинодо чыгаруу өтүнүчүн түзгөндө ушул дареги так көрсөтүңүз'}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          
          {hasWithdrawals === false && (
            <div className="p-4 bg-red-900/30 border border-red-500 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">❌</span>
                <p className="text-red-300 font-semibold">
                  Вывод не найден
                </p>
              </div>
              <p className="text-sm text-red-200">
                Нет вывода на этот ID. Проверьте правильность ID аккаунта в казино.
              </p>
            </div>
          )}
          
          {hasWithdrawals !== false && (
            <>
              <div>
                <label className="label">{t.subtitle}</label>
                <input 
                  className="input w-full"
                  type="text"
                  value={siteCode}
                  onChange={(e) => setSiteCode(e.target.value)}
                  placeholder={t.placeholder}
                  disabled={false}
                />
              </div>
              
              {checking && (
                <div className="mt-2 p-3 bg-blue-900/30 border border-blue-500 rounded-lg">
                  <p className="text-sm text-blue-300 font-semibold">
                    ⏳ Проверка кода...
                  </p>
                  <p className="text-xs text-white/70 mt-1">
                    Пожалуйста, подождите. Проверяем код ордера на вывод.
                  </p>
                </div>
              )}
              
              {/* КРИТИЧНО: Показываем успех ПЕРВЫМ, если сумма извлечена - это приоритетнее ошибки */}
              {withdrawAmount !== null && withdrawAmount > 0 && (
                <>
                  <div className="mt-3 p-4 bg-green-900/30 border border-green-500 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
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
                    {autoSubmitFailed && (
                      <div className="pt-2 border-t border-yellow-500/30 mt-2">
                        <p className="text-xs text-yellow-200">
                          ⚠️ Автоматическая отправка не удалась. Нажмите кнопку "Отправить заявку" вручную.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Отображение всех данных */}
                  <div className="mt-3 p-4 bg-black/40 border border-white/20 rounded-lg space-y-3">
                    <h3 className="text-white font-semibold text-sm mb-2">Данные заявки:</h3>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Банк:</span>
                      <span className="font-semibold text-sm">{getBankName(bank)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Телефон:</span>
                      <span className="font-semibold text-sm">+{phone.replace(/[^\d]/g, '')}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">ID аккаунта:</span>
                      <span className="font-semibold text-sm">{userId}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Код подтверждения:</span>
                      <span className="font-semibold text-sm">{siteCode.trim()}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">QR-код:</span>
                      <span className="font-semibold text-xs text-green-400">📷 Загружено</span>
                    </div>
                  </div>
                </>
              )}
              
              {/* Показываем ошибку ТОЛЬКО если сумма НЕ извлечена И есть ошибка */}
              {error && hasWithdrawals === true && (withdrawAmount === null || withdrawAmount === 0) && (
                <div className="mt-2 p-3 bg-red-900/30 border border-red-500 rounded-lg">
                  <p className="text-sm text-red-300 font-semibold">
                    ❌ Ошибка вывода
                  </p>
                  <p className="text-sm text-red-200 mt-1">
                    {error}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="flex gap-2 justify-center">
          <button 
            className="btn btn-ghost"
            onClick={handleBack}
          >
            {t.back}
          </button>
          {/* Показываем кнопку отправки только если:
              1. Автоматическая отправка не была успешной (autoSubmitSuccess === false)
              2. ИЛИ автоматическая отправка завершилась с ошибкой (autoSubmitFailed === true)
              3. И сумма извлечена (withdrawAmount > 0)
          */}
          {!autoSubmitSuccess && (
            <button 
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!siteCode.trim() || !withdrawAmount || hasWithdrawals === false || isSubmitting || (autoSubmitAttempted && !autoSubmitFailed)}
            >
              {isSubmitting ? '⏳ Отправка заявки...' : hasWithdrawals === false ? 'Вывод не найден' : (autoSubmitAttempted && !autoSubmitFailed) ? 'Автоматическая отправка...' : t.submit}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
