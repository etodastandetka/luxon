"use client"
import { useState, useEffect, useRef } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import BankButtons from '../../../components/BankButtons'
import { useLanguage } from '../../../components/LanguageContext'
import { getApiBase } from '../../../utils/fetch'

export default function WithdrawStep2() {
  const router = useRouter()
  const { language } = useLanguage()
  const [bank, setBank] = useState('')
  const [enabledBanks, setEnabledBanks] = useState<string[]>([])
  const [phone, setPhone] = useState('+996')
  const [qrPhoto, setQrPhoto] = useState<File | null>(null)
  const [qrPhotoPreview, setQrPhotoPreview] = useState<string | null>(null)
  const bankSectionRef = useRef<HTMLDivElement>(null)
  const phoneSectionRef = useRef<HTMLDivElement>(null)
  const qrSectionRef = useRef<HTMLDivElement>(null)

  const translations = {
    ru: {
      title: 'Вывод средств',
      selectBank: 'Выберите банк',
      phone: 'Номер телефона',
      phonePlaceholder: '+996...',
      qrCode: 'QR-код кошелька',
      uploadQr: 'Загрузить фото QR-кода',
      next: 'Далее',
      back: 'Назад'
    },
    en: {
      title: 'Withdraw',
      selectBank: 'Select bank',
      phone: 'Phone number',
      phonePlaceholder: '+996...',
      qrCode: 'Wallet QR code',
      uploadQr: 'Upload QR code photo',
      next: 'Next',
      back: 'Back'
    },
    ky: {
      title: 'Акчаны чыгаруу',
      selectBank: 'Банкты тандаңыз',
      phone: 'Телефон номуру',
      phonePlaceholder: '+996...',
      qrCode: 'Капчыктын QR-коду',
      uploadQr: 'QR-код сүрөтүн жүктөө',
      next: 'Кийинки',
      back: 'Артка'
    },
    uz: {
      title: 'Pulni yechib olish',
      selectBank: 'Bankni tanlang',
      phone: 'Telefon raqami',
      phonePlaceholder: '+996...',
      qrCode: 'Hamyon QR kodi',
      uploadQr: 'QR kod rasmini yuklash',
      next: 'Keyingi',
      back: 'Orqaga'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  useEffect(() => {
    // Проверяем, что пользователь выбрал казино
    const bookmaker = localStorage.getItem('withdraw_bookmaker')
    if (!bookmaker) {
      router.push('/withdraw/step1')
    }
  }, [router])

  // Загружаем настройки банков
  useEffect(() => {
    async function loadBankSettings() {
      try {
        const base = getApiBase()
        const { getTelegramUserId } = await import('../../../utils/telegram')
        const telegramUserId = getTelegramUserId()
        const url = telegramUserId 
          ? `${base}/api/public/payment-settings?user_id=${telegramUserId}`
          : `${base}/api/public/payment-settings`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        
        if (data && data.withdrawals && data.withdrawals.banks && Array.isArray(data.withdrawals.banks)) {
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
      } catch (error) {
        console.error('Error loading bank settings:', error)
      }
    }
    loadBankSettings()
  }, [])

  // Загружаем сохраненные данные
  useEffect(() => {
    const savedBank = localStorage.getItem('withdraw_bank')
    const savedPhone = localStorage.getItem('withdraw_phone')
    const savedQrPhoto = localStorage.getItem('withdraw_qr_photo')
    
    if (savedBank) {
      setBank(savedBank)
    }
    
    if (savedPhone) {
      setPhone(savedPhone.startsWith('+') ? savedPhone : `+${savedPhone}`)
    }
    
    if (savedQrPhoto) {
      setQrPhotoPreview(savedQrPhoto)
    }
  }, [])

  // Прокрутка после выбора банка
  useEffect(() => {
    if (bank) {
      setTimeout(() => {
        if (phoneSectionRef.current) {
          const elementPosition = phoneSectionRef.current.getBoundingClientRect().top
          const offsetPosition = elementPosition + window.pageYOffset - 20
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          })
        }
      }, 200)
    }
  }, [bank])

  // Прокрутка после загрузки QR
  useEffect(() => {
    if (qrPhotoPreview) {
      setTimeout(() => {
        if (qrSectionRef.current) {
          const elementPosition = qrSectionRef.current.getBoundingClientRect().top
          const offsetPosition = elementPosition + window.pageYOffset - 20
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          })
        }
      }, 200)
    }
  }, [qrPhotoPreview])

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
        localStorage.setItem('withdraw_qr_photo', base64)
      }
      reader.onerror = () => {
        alert('Ошибка при загрузке фото. Попробуйте еще раз.')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleNext = () => {
    if (!bank) {
      alert('Выберите банк')
      return
    }
    
    const cleanPhone = phone.replace(/[^\d]/g, '')
    if (!cleanPhone || cleanPhone.length < 12) {
      alert('Введите корректный номер телефона')
      return
    }
    
    if (!qrPhotoPreview) {
      alert('Загрузите фото QR-кода')
      return
    }
    
    localStorage.setItem('withdraw_bank', bank)
    localStorage.setItem('withdraw_phone', cleanPhone)
    router.push('/withdraw/step3')
  }

  const handleBack = () => {
    router.push('/withdraw/step1')
  }

  return (
    <main className="space-y-4" style={{ scrollBehavior: 'smooth' }}>
      <FixedHeaderControls />
      <div className="pr-20">
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>
      
      <div className="card space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Шаг 2 из 3</h2>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-accent h-2 rounded-full" style={{width: '66%'}}></div>
          </div>
        </div>

        {/* Выбор банка */}
        <div ref={bankSectionRef}>
          <label className="label">{t.selectBank}</label>
          <BankButtons 
            onPick={setBank} 
            selected={bank} 
            enabledBanks={enabledBanks.length > 0 ? enabledBanks : []}
          />
        </div>

        {/* Номер телефона */}
        <div ref={phoneSectionRef}>
          <label className="label">{t.phone}</label>
          <input 
            className="input w-full"
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            placeholder={t.phonePlaceholder}
          />
        </div>
        
        {/* QR код */}
        <div ref={qrSectionRef}>
          <label className="label">{t.qrCode}</label>
          <div className="relative">
            <input 
              type="file"
              accept="image/*"
              onChange={handleQrPhotoChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              id="qr-upload"
            />
            <label 
              htmlFor="qr-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-green-400/30 rounded-xl bg-gradient-to-br from-green-900/20 to-green-800/30 hover:border-green-400/50 hover:bg-green-800/40 transition-all duration-300 cursor-pointer group relative"
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
          </div>
          
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
            disabled={!bank || !qrPhotoPreview || phone.replace(/[^\d]/g, '').length < 12}
          >
            {t.next}
          </button>
        </div>
      </div>
    </main>
  )
}

