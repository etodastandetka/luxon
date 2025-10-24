"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LanguageSelector from '../../../components/LanguageSelector'
import { useLanguage } from '../../../components/LanguageContext'

export default function WithdrawStep5() {
  const [siteCode, setSiteCode] = useState('')
  const { language } = useLanguage()
    const router = useRouter()

  useEffect(() => {
    // Проверяем, что пользователь прошел предыдущие шаги
    const bookmaker = localStorage.getItem('withdraw_bookmaker')
    const bank = localStorage.getItem('withdraw_bank')
    const qrPhoto = localStorage.getItem('withdraw_qr_photo')
    const phone = localStorage.getItem('withdraw_phone')
    const userId = localStorage.getItem('withdraw_user_id')
    if (!bookmaker || !bank || !qrPhoto || !phone || !userId) {
      router.push('/withdraw/step0')
    }
  }, [router])

  const handleSubmit = () => {
    if (!siteCode.trim()) {
      alert('Введите код с сайта')
      return
    }
    
    // Сохраняем данные
    localStorage.setItem('withdraw_site_code', siteCode)
    
    // Переходим к подтверждению
    router.push('/withdraw/confirm')
  }

  const handleBack = () => {
    router.push('/withdraw/step4')
  }

  const translations = {
    ru: {
      title: 'Вывод - Шаг 5',
      subtitle: 'Код с сайта',
      instruction: 'Введите код подтверждения с сайта букмекера',
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
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">{t.title}</h1>
        <LanguageSelector />
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
        
        <div className="space-y-3">
          <div>
            <label className="label">{t.subtitle}</label>
            <input 
              className="input w-full"
              type="text"
              value={siteCode}
              onChange={(e) => setSiteCode(e.target.value)}
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
            onClick={handleSubmit}
            disabled={!siteCode.trim()}
          >
            {t.submit}
          </button>
        </div>
      </div>
    </main>
  )
}