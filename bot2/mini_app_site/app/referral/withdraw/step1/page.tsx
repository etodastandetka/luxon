"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import LanguageSelector from '../../../../components/LanguageSelector'
import { useLanguage } from '../../../../components/LanguageContext'
import PageTransition from '../../../../components/PageTransition'

const bookmakers = [
  { id: '1xbet', name: '1xBet', icon: '🎰' },
  { id: '1win', name: '1WIN', icon: '🎲' },
  { id: 'melbet', name: 'Melbet', icon: '🎯' },
  { id: 'mostbet', name: 'Mostbet', icon: '🎪' },
]

export default function ReferralWithdrawStep1() {
  const router = useRouter()
  const { language } = useLanguage()
  const [selectedBookmaker, setSelectedBookmaker] = useState<string>('')

  const handleContinue = () => {
    if (!selectedBookmaker) {
      alert('Выберите казино')
      return
    }
    router.push(`/referral/withdraw/step2?bookmaker=${selectedBookmaker}`)
  }

  const translations = {
    ru: {
      title: 'Вывод средств из рефералки',
      subtitle: 'Выберите казино для вывода',
      continue: 'Продолжить',
      back: 'Назад'
    },
    en: {
      title: 'Withdraw referral funds',
      subtitle: 'Select casino for withdrawal',
      continue: 'Continue',
      back: 'Back'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <PageTransition direction="forward">
      <main className="space-y-6 min-h-screen flex flex-col p-4">
        {/* Заголовок */}
        <div className="text-center space-y-2">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">{t.title}</h1>
            <div className="scale-75">
              <LanguageSelector />
            </div>
          </div>
          <p className="text-sm text-white/70">{t.subtitle}</p>
        </div>

        {/* Выбор казино */}
        <div className="space-y-3 flex-1">
          {bookmakers.map((bookmaker) => (
            <button
              key={bookmaker.id}
              onClick={() => setSelectedBookmaker(bookmaker.id)}
              className={`w-full p-4 rounded-lg border-2 transition-all ${
                selectedBookmaker === bookmaker.id
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-white/5 border-gray-700 text-white/70 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{bookmaker.icon}</span>
                  <span className="font-semibold text-lg">{bookmaker.name}</span>
                </div>
                {selectedBookmaker === bookmaker.id && (
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Кнопки */}
        <div className="space-y-3">
          <button
            onClick={handleContinue}
            disabled={!selectedBookmaker}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              selectedBookmaker
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {t.continue}
          </button>
          <button
            onClick={() => router.push('/referral')}
            className="w-full py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
          >
            {t.back}
          </button>
        </div>
      </main>
    </PageTransition>
  )
}

