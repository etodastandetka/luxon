"use client"
import LanguageSelector from '../../components/LanguageSelector'
import { useLanguage } from '../../components/LanguageContext'

export default function SupportPage() {
  const { language } = useLanguage()

  const translations = {
    ru: {
      title: '🎧 Поддержка',
      subtitle: 'Мы всегда готовы помочь вам',
      contactUs: 'Свяжитесь с нами',
      responseTime: 'Время ответа: 5-30 минут',
      contactMethods: 'Способы связи',
      telegram: 'Telegram',
      telegramLink: 'https://t.me/luxon_support',
      workingHours: 'Время работы',
      workingHoursText: '24/7 - круглосуточно',
      commonQuestions: 'Частые вопросы',
      questions: [
        {
          question: 'Как пополнить баланс?',
          answer: 'Выберите букмекера, введите ID игрока, укажите сумму, выберите банк и перейдите по ссылке для оплаты.'
        },
        {
          question: 'Как вывести средства?',
          answer: 'Выберите букмекера, введите ID игрока, укажите сумму, выберите банк, введите телефон и код подтверждения.'
        },
        {
          question: 'Сколько времени занимает обработка?',
          answer: 'Пополнение: 1-5 минут, вывод: 5-30 минут. Все зависит от загрузки системы.'
        },
        {
          question: 'Что делать, если пополнение не пришло?',
          answer: 'Проверьте статус в истории операций. Если статус "ожидает", обратитесь в поддержку с номером заявки.'
        },
        {
          question: 'Как работает реферальная программа?',
          answer: 'Поделитесь ссылкой с друзьями. За каждое пополнение реферала вы получаете 5%. Выплаты в конце месяца.'
        }
      ],
      backToMain: '🔙 На главную'
    },
    en: {
      title: '🎧 Support',
      subtitle: 'We are always ready to help you',
      contactUs: 'Contact us',
      responseTime: 'Response time: 5-30 minutes',
      writeMessage: 'Write a message',
      messagePlaceholder: 'Describe your problem or question...',
      sendMessage: 'Send message',
      messageSent: 'Message sent! We will contact you soon.',
      contactMethods: 'Contact methods',
      telegram: 'Telegram',
      telegramLink: 'https://t.me/luxon_support',
      workingHours: 'Working hours',
      workingHoursText: '24/7 - around the clock',
      commonQuestions: 'Frequently asked questions',
      questions: [
        {
          question: 'How to deposit?',
          answer: 'Choose a bookmaker, enter player ID, specify amount, choose bank and follow the payment link.'
        },
        {
          question: 'How to withdraw?',
          answer: 'Choose a bookmaker, enter player ID, specify amount, choose bank, enter phone and confirmation code.'
        },
        {
          question: 'How long does processing take?',
          answer: 'Deposit: 1-5 minutes, withdrawal: 5-30 minutes. Depends on system load.'
        },
        {
          question: 'What if deposit did not arrive?',
          answer: 'Check status in transaction history. If status is "pending", contact support with request number.'
        },
        {
          question: 'How does referral program work?',
          answer: 'Share link with friends. You get 5% for each referral deposit. Payouts at the end of month.'
        }
      ],
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

      {/* Контактная информация - компактная */}
      <section className="card space-y-3">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-white/80">{t.telegram}:</span>
            <a 
              href={t.telegramLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 font-semibold"
            >
              @luxon_support
            </a>
          </div>
          <div className="text-sm text-white/70">
            {t.responseTime}
          </div>
        </div>
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