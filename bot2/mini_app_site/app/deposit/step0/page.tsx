"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import PageTransition from '../../../components/PageTransition'
import VideoModal from '../../../components/VideoModal'
import { useLanguage } from '../../../components/LanguageContext'

export default function DepositStep0() {
  const [paymentType, setPaymentType] = useState<'bank' | 'crypto' | ''>('')
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const router = useRouter()
  const { language } = useLanguage()

  // Параметр bot обрабатывается в BookmakerGrid компоненте
  // Здесь не сохраняем, чтобы избежать конфликтов

  const translations = {
    ru: {
      title: 'Пополнение счета',
      subtitle: 'Выберите способ оплаты',
      bank: 'Банковский перевод',
      bankDesc: 'Оплата через QR код',
      crypto: 'Криптовалюта',
      cryptoDesc: 'Оплата через Crypto Bot',
      next: 'Далее',
      back: 'Назад',
      howToDeposit: 'Как пополнить',
      watchVideo: '📹 Посмотреть видео-инструкцию'
    },
    en: {
      title: 'Deposit',
      subtitle: 'Select payment method',
      bank: 'Bank Transfer',
      bankDesc: 'Pay via QR code',
      crypto: 'Cryptocurrency',
      cryptoDesc: 'Pay via Crypto Bot',
      next: 'Next',
      back: 'Back',
      howToDeposit: 'How to deposit',
      watchVideo: '📹 Watch video tutorial'
    },
    ky: {
      title: 'Капкалды кошуу',
      subtitle: 'Төлөм ыкмасын тандаңыз',
      bank: 'Банктык которуу',
      bankDesc: 'QR код аркылуу төлөө',
      crypto: 'Криптовалюта',
      cryptoDesc: 'Crypto Bot аркылуу төлөө',
      next: 'Кийинки',
      back: 'Артка',
      howToDeposit: 'Капкалды кантип кошуу керек',
      watchVideo: '📹 Видео көрсөтмөнү көрүү'
    },
    uz: {
      title: 'Hisobni to\'ldirish',
      subtitle: 'To\'lov usulini tanlang',
      bank: 'Bank o\'tkazmasi',
      bankDesc: 'QR kod orqali to\'lash',
      crypto: 'Kriptovalyuta',
      cryptoDesc: 'Crypto Bot orqali to\'lash',
      next: 'Keyingi',
      back: 'Orqaga',
      howToDeposit: 'Qanday to\'ldirish kerak',
      watchVideo: '📹 Video ko\'rsatmani ko\'rish'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  const handleNext = () => {
    if (!paymentType) {
      alert('Выберите способ оплаты')
      return
    }

    // Сохраняем тип оплаты
    localStorage.setItem('deposit_payment_type', paymentType)
    
    // Переходим к выбору букмекера
    router.push('/deposit/step1')
  }

  const handleBack = () => {
    router.push('/')
  }

  return (
    <PageTransition direction="backward">
      <main className="space-y-4">
        <FixedHeaderControls />
        <div className="fade-in pr-24">
          <h1 className="text-xl font-bold">{t.title}</h1>
        </div>
        
        <div className="card space-y-4 slide-in-left delay-100">
          <div className="text-center">
            <h2 className="text-lg font-semibold">{t.subtitle}</h2>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{width: '0%'}}></div>
            </div>
            <p className="text-sm text-white/70 mt-1">Шаг 0 из 4</p>
          </div>
          
          {/* Выбор типа оплаты */}
          <div className="grid grid-cols-1 gap-3">
            {/* Банковский перевод */}
            <button
              onClick={() => setPaymentType('bank')}
              className={`p-4 rounded-lg border-2 transition-all ${
                paymentType === 'bank'
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white">{t.bank}</div>
                  <div className="text-sm text-white/70">{t.bankDesc}</div>
                </div>
                {paymentType === 'bank' && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>

            {/* Криптовалюта */}
            <button
              onClick={() => setPaymentType('crypto')}
              className={`p-4 rounded-lg border-2 transition-all ${
                paymentType === 'crypto'
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white">{t.crypto}</div>
                  <div className="text-sm text-white/70">{t.cryptoDesc}</div>
                </div>
                {paymentType === 'crypto' && (
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          </div>
          
          {/* Кнопка "Как пополнить" */}
          <button
            onClick={() => setIsVideoModalOpen(true)}
            className="w-full btn btn-ghost p-4 border-2 border-dashed border-gray-600 hover:border-blue-500 transition-colors"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">{t.watchVideo}</span>
            </div>
          </button>

          <div className="flex gap-2 slide-in-right delay-200">
            <button 
              className="btn btn-ghost flex-1"
              onClick={handleBack}
            >
              {t.back}
            </button>
            <button 
              className="btn btn-primary flex-1"
              onClick={handleNext}
              disabled={!paymentType}
            >
              {t.next}
            </button>
          </div>
        </div>

        {/* Модальное окно с видео */}
        <VideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          videoSrc="https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view?usp=drive_link"
          title={t.howToDeposit}
        />
      </main>
    </PageTransition>
  )
}

