"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'
import { checkUserBlocked } from '../../../utils/telegram'
import { safeFetch } from '../../../utils/fetch'

export default function WithdrawConfirm() {
    const [bank, setBank] = useState('')
  const [qrPhoto, setQrPhoto] = useState('')
  const [phone, setPhone] = useState('')
  const [userId, setUserId] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null)
  const [bookmaker, setBookmaker] = useState('')
  const { language } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    // Загружаем данные из localStorage
    const savedBookmaker = localStorage.getItem('withdraw_bookmaker') || ''
    const savedBank = localStorage.getItem('withdraw_bank') || ''
    const savedQrPhoto = localStorage.getItem('withdraw_qr_photo') || ''
    const savedPhone = localStorage.getItem('withdraw_phone') || ''
    const savedUserId = localStorage.getItem('withdraw_user_id') || ''
    const savedSiteCode = localStorage.getItem('withdraw_site_code') || ''
    const savedAmount = localStorage.getItem('withdraw_amount')
    
    setBookmaker(savedBookmaker)
    setBank(savedBank)
    setQrPhoto(savedQrPhoto)
    setPhone(savedPhone)
    setUserId(savedUserId)
    setSiteCode(savedSiteCode)
    if (savedAmount) {
      setWithdrawAmount(parseFloat(savedAmount))
    }
    
    // Проверяем, что все данные есть
    if (!savedBookmaker || !savedBank || !savedQrPhoto || !savedPhone || !savedUserId || !savedSiteCode || !savedAmount) {
      router.push('/withdraw/step0')
    }
  }, [router])


  const handleConfirm = async () => {
    try {
      // Получаем данные из localStorage
      const bookmaker = localStorage.getItem('withdraw_bookmaker') || ''
      const amountStr = localStorage.getItem('withdraw_amount') || '0'
      
      console.log('[Withdraw Confirm] Данные из localStorage:', {
        bookmaker,
        amountStr,
        userId,
        phone,
        bank,
        siteCode
      })
      
      // Проверяем, что сумма валидна
      const amount = parseFloat(amountStr)
      if (isNaN(amount) || amount <= 0) {
        console.error('[Withdraw Confirm] ❌ Невалидная сумма:', amountStr)
        alert(`Ошибка: невалидная сумма вывода (${amountStr}). Вернитесь на предыдущий шаг и проверьте код.`)
        return
      }
      
      // Проверяем, что все данные заполнены
      if (!bookmaker || !amountStr || amountStr === '0' || !userId || !phone || !bank || !siteCode) {
        console.error('[Withdraw Confirm] ❌ Не все поля заполнены')
        alert('Не все поля заполнены. Проверьте данные.')
        return
      }
      
      console.log('[Withdraw Confirm] ✅ Все данные валидны, сумма:', amount, 'тип:', typeof amount)

      const base = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'

      // Для 1xbet сначала выполняем вывод (mobile.withdrawal)
      // Для 888starz вывод уже выполнен на step5 (Payout сразу выполняет вывод)
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
            code: siteCode,
            amount: amount, // amount уже число
          }),
          timeout: 30000,
          retries: 2,
          retryDelay: 1000
        })

        console.log('📥 Ответ от withdraw-execute:', {
          status: withdrawResponse.status,
          statusText: withdrawResponse.statusText,
          ok: withdrawResponse.ok
        })

        if (!withdrawResponse.ok) {
          const errorText = await withdrawResponse.text()
          console.error('❌ Ошибка выполнения вывода:', {
            status: withdrawResponse.status,
            statusText: withdrawResponse.statusText,
            errorText
          })
          throw new Error(`Ошибка выполнения вывода: ${withdrawResponse.status} ${withdrawResponse.statusText}`)
        }

        const withdrawData = await withdrawResponse.json()

        if (!withdrawData.success) {
          console.error('❌ Ошибка выполнения вывода:', withdrawData)
          alert(`Ошибка выполнения вывода: ${withdrawData.message || withdrawData.error || 'Неизвестная ошибка'}`)
          return
        }

        console.log('✅ Вывод выполнен успешно:', withdrawData)
      }
      
      // Для 888starz вывод уже выполнен на step5, просто создаем заявку
      if (normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888') || normalizedBookmaker === '888starz') {
        console.log('✅ Для 888starz вывод уже выполнен на step5, создаем заявку с суммой:', amount)
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
        return
      }

      // Проверяем, не заблокирован ли пользователь
      const isBlocked = await checkUserBlocked(telegramUserId)
      if (isBlocked) {
        console.error('❌ Пользователь заблокирован!')
        alert('Ваш аккаунт заблокирован. Вы не можете создавать заявки на вывод.')
        window.location.href = '/blocked'
        return
      }

      // Создаем заявку в админке
      console.log('📤 Создаем заявку в админке...')
      
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
        telegram_user_id: telegramUserId,
        telegram_username: telegramUser?.username,
        telegram_first_name: telegramUser?.first_name,
        telegram_last_name: telegramUser?.last_name,
        telegram_language_code: telegramUser?.language_code
      }
      
      console.log('[Withdraw Confirm] 📤 Создание заявки с данными:', {
        ...requestBody,
        qr_photo: qrPhoto ? `[base64, ${qrPhoto.length} chars]` : null
      })
      
      const response = await safeFetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        timeout: 30000,
        retries: 2,
        retryDelay: 1000
      })
      
      console.log('📥 Ответ от /api/payment:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Ошибка создания заявки:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        })
        throw new Error(`Ошибка создания заявки: ${response.status} ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success !== false) {
        console.log('✅ Заявка на вывод создана успешно:', result)
        
        // Показываем результат
        const message = `✅ Заявка на вывод создана!\n\n🏦 Банк: ${getBankName(bank)}\n📱 Телефон: +${phone}\n🆔 ID: ${userId}\n🔑 Код: ${siteCode}\n💰 Сумма: ${amount} сом\n🆔 ID заявки: #${result.id || result.data?.id}\n\n⏳ Ожидайте обработки заявки администратором.`
        
        alert(message)
        
        // Очищаем данные
        localStorage.removeItem('withdraw_bookmaker')
        localStorage.removeItem('withdraw_bank')
        localStorage.removeItem('withdraw_qr_photo')
        localStorage.removeItem('withdraw_phone')
        localStorage.removeItem('withdraw_user_id')
        localStorage.removeItem('withdraw_site_code')
        localStorage.removeItem('withdraw_amount')
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
        stack: error?.stack
      })
      
      let errorMessage = 'Ошибка при создании заявки. Попробуйте еще раз.'
      if (error?.message) {
        errorMessage = error.message
      } else if (error?.name === 'AbortError') {
        errorMessage = 'Превышено время ожидания. Проверьте интернет-соединение и попробуйте снова.'
      } else if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        errorMessage = 'Нет подключения к интернету. Проверьте соединение и попробуйте снова.'
      }
      
      alert(`Ошибка: ${errorMessage}`)
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
                Средства сняты с вашего счета в казино. Заявка будет обработана администратором.
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
          >
            {t.confirm}
          </button>
        </div>
      </div>
    </main>
  )
}
