"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'

export default function WithdrawStep2() {
  const [qrPhoto, setQrPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const router = useRouter()
  const { language } = useLanguage()

  useEffect(() => {
    // Проверяем, что пользователь прошел предыдущие шаги
    const bookmaker = localStorage.getItem('withdraw_bookmaker')
    const bank = localStorage.getItem('withdraw_bank')
    if (!bookmaker || !bank) {
      router.push('/withdraw/step0')
    }
  }, [router])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Проверяем доступность FileReader
      if (typeof window === 'undefined' || typeof (window as any).FileReader === 'undefined') {
        console.error('❌ FileReader недоступен в этом окружении')
        alert('Ошибка: FileReader недоступен. Пожалуйста, используйте другой браузер или обновите страницу.')
        return
      }
      
      setQrPhoto(file)
      const reader = new (window as any).FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const base64 = e.target?.result as string
        setPhotoPreview(base64)
        // Сохраняем base64 в localStorage сразу после загрузки
        if (base64) {
          localStorage.setItem('withdraw_qr_photo', base64)
        }
      }
      reader.onerror = (error: ProgressEvent<FileReader>) => {
        console.error('❌ Ошибка при чтении файла:', error)
        alert('Ошибка при загрузке фото. Попробуйте еще раз.')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (isNavigating) return
    
    if (!qrPhoto) {
      alert('Загрузите фото QR-кода')
      return
    }
    
    setIsNavigating(true)
    
    // Проверяем, что base64 уже сохранен в localStorage
    const savedPhoto = localStorage.getItem('withdraw_qr_photo')
    if (!savedPhoto || savedPhoto === 'uploaded') {
      // Проверяем доступность FileReader
      if (typeof window === 'undefined' || typeof (window as any).FileReader === 'undefined') {
        console.error('❌ FileReader недоступен в этом окружении')
        setIsNavigating(false)
        alert('Ошибка: FileReader недоступен. Пожалуйста, используйте другой браузер или обновите страницу.')
        return
      }
      
      // Если base64 еще не сохранен, читаем файл еще раз
      const reader = new (window as any).FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const base64 = e.target?.result as string
        if (base64) {
          localStorage.setItem('withdraw_qr_photo', base64)
          router.push('/withdraw/step3')
        } else {
          setIsNavigating(false)
          alert('Ошибка при загрузке фото. Попробуйте еще раз.')
        }
      }
      reader.onerror = (error: ProgressEvent<FileReader>) => {
        console.error('❌ Ошибка при чтении файла:', error)
        setIsNavigating(false)
        alert('Ошибка при загрузке фото. Попробуйте еще раз.')
      }
      reader.readAsDataURL(qrPhoto)
    } else {
      // Base64 уже сохранен, переходим к следующему шагу
      router.push('/withdraw/step3')
    }
  }

  const handleBack = () => {
    router.push('/withdraw/step0')
  }

  const translations = {
    ru: {
      title: 'Вывод - Шаг 2',
      subtitle: 'QR-код кошелька',
      instruction: 'Отправьте фото QR-кода вашего кошелька',
      uploadPhoto: 'Загрузить фото QR-кода',
      next: 'Далее',
      back: 'Назад'
    },
    en: {
      title: 'Withdraw - Step 2',
      subtitle: 'Wallet QR code',
      instruction: 'Send photo of your wallet QR code',
      uploadPhoto: 'Upload QR code photo',
      next: 'Next',
      back: 'Back'
    },
    ky: {
      title: 'Чыгаруу - 2-чи кадам',
      subtitle: 'Капчыктын QR-коду',
      instruction: 'Капчыгыңыздын QR-кодунун сүрөтүн жөнөтүңүз',
      uploadPhoto: 'QR-код сүрөтүн жүктөө',
      next: 'Кийинки',
      back: 'Артка'
    },
    uz: {
      title: 'Yechib olish - 2-qadam',
      subtitle: 'Hamyon QR kodi',
      instruction: 'Hamyoningizning QR kod rasmini yuboring',
      uploadPhoto: 'QR kod rasmini yuklash',
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
            <div className="bg-accent h-2 rounded-full" style={{width: '40%'}}></div>
          </div>
          <p className="text-sm text-white/70 mt-1">Шаг 2 из 5</p>
        </div>
        
        <p className="text-white/80 text-center">{t.instruction}</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/90 mb-3">{t.uploadPhoto}</label>
            
            {/* Красивая область загрузки файла */}
            <div className="relative">
              <input 
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
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
                      {qrPhoto ? 'Файл выбран' : 'Нажмите для выбора файла'}
                    </p>
                    <p className="text-xs text-white/60 mt-1">
                      {qrPhoto ? qrPhoto.name : 'PNG, JPG до 10MB'}
                    </p>
                  </div>
                </div>
              </label>
            </div>
            
            {/* Превью изображения */}
            {photoPreview && (
              <div className="mt-4 p-4 bg-black/20 rounded-xl border border-green-400/20">
                <div className="text-center mb-3">
                  <span className="text-sm text-green-400 font-medium">Предварительный просмотр:</span>
                </div>
                <div className="flex justify-center">
                  <div className="relative">
                    <img 
                      src={photoPreview} 
                      alt="QR Preview" 
                      className="max-w-xs max-h-48 rounded-lg shadow-lg border border-green-400/30"
                    />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-3">
          <button 
            className="flex-1 px-6 py-3 bg-gray-600/50 text-white rounded-lg font-semibold hover:bg-gray-600/70 transition-all duration-200 border border-gray-500/30 hover:border-gray-400/50"
            onClick={handleBack}
          >
            {t.back}
          </button>
          <button 
            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-green-500 disabled:hover:to-green-600"
            onClick={handleNext}
            disabled={!qrPhoto || isNavigating}
          >
            {isNavigating ? (language === 'ru' ? 'Загрузка...' : 'Loading...') : t.next}
          </button>
        </div>
      </div>
    </main>
  )
}
