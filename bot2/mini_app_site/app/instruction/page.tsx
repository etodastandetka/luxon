"use client"
import { useState, useEffect } from 'react'
import LanguageSelector from '../../components/LanguageSelector'
import { useLanguage } from '../../components/LanguageContext'

export default function InstructionPage() {
  const { language } = useLanguage()

  const translations = {
    ru: {
      title: '🧾 Инструкция',
      subtitle: 'Пошаговое руководство по использованию платформы',
      depositTitle: '💰 Пополнение счета',
      depositSteps: [
        'Выберите букмекера из списка (1XBET, 1WIN, MELBET, MOSTBET)',
        'Введите ваш ID игрока в казино',
        'Укажите сумму пополнения (от 200 до 50,000 сом)',
        'Выберите банк для оплаты (DemirBank, O! bank, Balance.kg, Bakai, MegaPay, MBank)',
        'Перейдите по сгенерированной ссылке и оплатите',
        'Дождитесь автоматического пополнения (1-5 минут)'
      ],
      withdrawTitle: '💸 Вывод средств',
      withdrawSteps: [
        'Выберите букмекера из списка',
        'Введите ваш ID игрока в казино',
        'Укажите сумму вывода (от 100 до 100,000 сом)',
        'Выберите банк для получения средств',
        'Введите номер телефона для получения',
        'Введите код подтверждения с сайта букмекера',
        'Ожидайте подтверждения администратора (5-30 минут)'
      ],
      importantTitle: '⚠️ Важные замечания',
      importantNotes: [
        'Все операции проходят через администратора',
        'Время обработки: 5-30 минут',
        'При проблемах обращайтесь в поддержку',
        'Сохраняйте скриншоты операций',
        'Не передавайте коды подтверждения третьим лицам'
      ],
      supportTitle: '🎧 Поддержка',
      supportText: 'Если у вас возникли вопросы или проблемы, обратитесь в поддержку:',
      supportContact: '@luxon_support',
      backToMain: '🔙 На главную'
    },
    en: {
      title: '🧾 Instruction',
      subtitle: 'Step-by-step guide to using the platform',
      depositTitle: '💰 Account Deposit',
      depositSteps: [
        'Choose a bookmaker from the list (1XBET, 1WIN, MELBET, MOSTBET)',
        'Enter your player ID in the casino',
        'Specify the deposit amount (from 200 to 50,000 som)',
        'Choose a bank for payment (DemirBank, O! bank, Balance.kg, Bakai, MegaPay, MBank)',
        'Follow the generated link and pay',
        'Wait for automatic deposit (1-5 minutes)'
      ],
      withdrawTitle: '💸 Withdraw Funds',
      withdrawSteps: [
        'Choose a bookmaker from the list',
        'Enter your player ID in the casino',
        'Specify the withdrawal amount (from 100 to 100,000 som)',
        'Choose a bank to receive funds',
        'Enter phone number for receiving',
        'Enter confirmation code from bookmaker website',
        'Wait for administrator confirmation (5-30 minutes)'
      ],
      importantTitle: '⚠️ Important Notes',
      importantNotes: [
        'All operations go through administrator',
        'Processing time: 5-30 minutes',
        'Contact support if you have problems',
        'Save screenshots of operations',
        'Do not share confirmation codes with third parties'
      ],
      supportTitle: '🎧 Support',
      supportText: 'If you have questions or problems, contact support:',
      supportContact: '@luxon_support',
      backToMain: '🔙 Back to main'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <main className="space-y-6">
      {/* Заголовок */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <p className="text-sm text-white/70">{t.subtitle}</p>
        <div className="flex justify-center">
          <LanguageSelector />
        </div>
      </div>

      {/* Пополнение */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">{t.depositTitle}</h2>
        <div className="space-y-3">
          {t.depositSteps.map((step, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Вывод */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">{t.withdrawTitle}</h2>
        <div className="space-y-3">
          {t.withdrawSteps.map((step, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Важные замечания */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">{t.importantTitle}</h2>
        <div className="space-y-2">
          {t.importantNotes.map((note, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <p className="text-sm text-white/80 leading-relaxed">{note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Поддержка */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">{t.supportTitle}</h2>
        <p className="text-sm text-white/80">{t.supportText}</p>
        <a 
          href="https://t.me/luxon_support" 
          className="inline-block bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
        >
          {t.supportContact}
        </a>
      </section>

      {/* Навигация */}
      <div className="text-center">
        <a 
          href="/" 
          className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
        >
          {t.backToMain}
        </a>
      </div>
    </main>
  )
}

