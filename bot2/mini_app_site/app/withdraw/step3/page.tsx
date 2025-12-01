"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'

export default function WithdrawStep3() {
  const [phone, setPhone] = useState('+996')
  const [isNavigating, setIsNavigating] = useState(false)
  const { language } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    // Проверяем, что пользователь прошел предыдущие шаги
    const bookmaker = localStorage.getItem('withdraw_bookmaker')
    const bank = localStorage.getItem('withdraw_bank')
    const qrPhoto = localStorage.getItem('withdraw_qr_photo')
    if (!bookmaker || !bank || !qrPhoto) {
      router.push('/withdraw/step0')
    }
  }, [router])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    
    // Всегда начинаем с +996
    if (!value.startsWith('+996')) {
      // Если пользователь пытается удалить +996, восстанавливаем
      if (value.length < 4) {
        value = '+996'
      } else if (!value.startsWith('+')) {
        // Если начинается не с +, добавляем +996
        value = '+996' + value.replace(/[^\d]/g, '')
      } else {
        // Если начинается с + но не +996, заменяем на +996
        value = '+996' + value.replace(/^\+996/, '').replace(/[^\d]/g, '')
      }
    } else {
      // Если начинается с +996, оставляем как есть, но убираем лишние символы после
      const after996 = value.slice(4).replace(/[^\d]/g, '')
      value = '+996' + after996
    }
    
    setPhone(value)
  }

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (isNavigating) return
    
    // Убираем все кроме цифр для сохранения
    const cleanPhone = phone.replace(/[^\d]/g, '')
    // Проверяем что номер полный (996 + минимум 9 цифр номера = минимум 12 цифр)
    if (!cleanPhone || cleanPhone.length < 12) {
      alert('Введите корректный номер телефона')
      return
    }
    
    setIsNavigating(true)
    
    // Сохраняем данные (только цифры)
    localStorage.setItem('withdraw_phone', cleanPhone)
    
    // Переходим к следующему шагу
    router.push('/withdraw/step4')
  }

  const handleBack = () => {
    router.push('/withdraw/step2')
  }

  const translations = {
    ru: {
      title: 'Вывод - Шаг 3',
      subtitle: 'Номер телефона',
      instruction: 'Введите номер телефона для получения средств',
      placeholder: '+996...',
      next: 'Далее',
      back: 'Назад'
    },
    en: {
      title: 'Withdraw - Step 3',
      subtitle: 'Phone number',
      instruction: 'Enter phone number to receive funds',
      placeholder: '+996...',
      next: 'Next',
      back: 'Back'
    },
    ky: {
      title: 'Чыгаруу - 3-чү кадам',
      subtitle: 'Телефон номуру',
      instruction: 'Акча алуу үчүн телефон номурун киргизиңиз',
      placeholder: '+996...',
      next: 'Кийинки',
      back: 'Артка'
    },
    uz: {
      title: 'Yechib olish - 3-qadam',
      subtitle: 'Telefon raqami',
      instruction: 'Pul olish uchun telefon raqamini kiriting',
      placeholder: '+996...',
      next: 'Keyingi',
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
            <div className="bg-accent h-2 rounded-full" style={{width: '60%'}}></div>
          </div>
          <p className="text-sm text-white/70 mt-1">Шаг 3 из 5</p>
        </div>
        
        <p className="text-white/80 text-center">{t.instruction}</p>
        
        <div className="space-y-3">
          <div>
            <label className="label">{t.subtitle}</label>
            <input 
              className="input w-full"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder={t.placeholder}
            />
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
            onClick={handleNext}
            disabled={phone.length < 12 || isNavigating}
          >
            {isNavigating ? (language === 'ru' ? 'Загрузка...' : 'Loading...') : t.next}
          </button>
        </div>
      </div>
    </main>
  )
}
