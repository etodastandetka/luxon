"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LanguageSelector from '../../../components/LanguageSelector'
import { useLanguage } from '../../../components/LanguageContext'

export default function WithdrawConfirm() {
    const [bank, setBank] = useState('')
  const [qrPhoto, setQrPhoto] = useState('')
  const [phone, setPhone] = useState('')
  const [userId, setUserId] = useState('')
  const [siteCode, setSiteCode] = useState('')
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
    
    setBank(savedBank)
    setQrPhoto(savedQrPhoto)
    setPhone(savedPhone)
    setUserId(savedUserId)
    setSiteCode(savedSiteCode)
    
    // Проверяем, что все данные есть
    if (!savedBookmaker || !savedBank || !savedQrPhoto || !savedPhone || !savedUserId || !savedSiteCode) {
      router.push('/withdraw/step0')
    } else {
      // Создаем заявку на вывод сразу при загрузке страницы
      createWithdrawRequest()
    }
  }, [router])

  // Создание заявки на вывод
  const createWithdrawRequest = async () => {
    try {
      const bookmaker = localStorage.getItem('withdraw_bookmaker') || ''
      const amount = localStorage.getItem('withdraw_amount') || '0'
      
      // Получаем данные пользователя Telegram
      const telegramUser = getTelegramUser()
      
      console.log('🔄 Создаем заявку на вывод...', {
        type: 'withdraw',
        bookmaker,
        userId: parseInt(userId),
        phone,
        amount: parseFloat(amount),
        bank,
        telegramUser
      })

      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'withdraw',
          bookmaker: bookmaker,
          userId: parseInt(userId),
          phone: phone,
          amount: parseFloat(amount),
          bank: bank,
          playerId: userId, // Добавляем playerId для совместимости
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
        console.log('✅ Заявка на вывод создана успешно:', data)
        // Сохраняем ID заявки
        localStorage.setItem('withdraw_transaction_id', data.id || data.transactionId)
      } else {
        const errorData = await response.json()
        console.error('❌ Ошибка создания заявки на вывод:', errorData)
      }
    } catch (error) {
      console.error('❌ Ошибка создания заявки на вывод:', error)
    }
  }

  const handleConfirm = async () => {
    try {
      // Получаем данные из localStorage
      const bookmaker = localStorage.getItem('withdraw_bookmaker') || ''
      const amount = localStorage.getItem('withdraw_amount') || '0'
      
      // Проверяем, что все данные заполнены
      if (!bookmaker || !amount || !userId || !phone || !bank || !siteCode) {
        alert('Не все поля заполнены. Проверьте данные.')
        return
      }
      
      // Генерируем ID заявки
      const requestId = Math.random().toString(36).slice(2, 8).toUpperCase()
      
      console.log('Sending data:', {
        type: 'withdraw',
        bookmaker: bookmaker,
        user_id: parseInt(userId),
        phone: phone,
        amount: parseFloat(amount),
        bank: bank,
        qr_photo: qrPhoto,
        site_code: siteCode,
        request_id: requestId
      })
      
      // Отправляем заявку в Django API
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'withdraw',
          bookmaker: bookmaker,
          user_id: parseInt(userId),
          phone: phone,
          amount: parseFloat(amount),
          bank: bank,
          qr_photo: qrPhoto,
          site_code: siteCode,
          request_id: requestId
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('Withdraw request created:', result)
        
        // Показываем результат
        const message = `✅ Заявка на вывод создана!\n\n🏦 Банк: ${getBankName(bank)}\n📱 Телефон: +${phone}\n🆔 ID: ${userId}\n🔑 Код: ${siteCode}\n🆔 ID заявки: ${requestId}\n\n⏳ Ожидайте обработки заявки администратором.`
        
        alert(message)
        
        // Очищаем данные
        localStorage.removeItem('withdraw_bookmaker')
        localStorage.removeItem('withdraw_bank')
        localStorage.removeItem('withdraw_qr_photo')
        localStorage.removeItem('withdraw_phone')
        localStorage.removeItem('withdraw_user_id')
        localStorage.removeItem('withdraw_site_code')
        localStorage.removeItem('withdraw_amount')
        
        // Возвращаемся на главную
        router.push('/')
      } else {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        throw new Error(`Failed to create withdraw request: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating withdraw request:', error)
      alert('Ошибка при создании заявки. Попробуйте еще раз.')
    }
  }

  const handleBack = () => {
    router.push('/withdraw/step5')
  }

  const getBankName = (bankCode: string) => {
    const bankNames = {
      'demirbank': 'DemirBank',
      'odengi': 'O! bank',
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
      subtitle: 'Проверьте данные',
      confirm: 'Подтвердить',
      back: 'Назад',
      bank: 'Банк',
      phone: 'Телефон',
      userId: 'ID аккаунта',
      siteCode: 'Код с сайта',
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
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">{t.title}</h1>
        <LanguageSelector />
      </div>
      
      <div className="card space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">{t.subtitle}</h2>
        </div>
        
        <div className="space-y-3">
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