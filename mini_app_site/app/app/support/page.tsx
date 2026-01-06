"use client"
import { useLanguage } from '../../components/LanguageContext'
import FixedHeaderControls from '../../components/FixedHeaderControls'
import { SupportIcon, BackIcon } from '../../components/Icons'

export default function SupportPage() {
  const { language } = useLanguage()

  const translations = {
    ru: {
      title: 'Поддержка',
      subtitle: 'Мы всегда готовы помочь вам',
      contactUs: 'Свяжитесь с нами',
      responseTime: 'Время ответа: 5-30 минут',
      contactMethods: 'Способы связи',
      telegram: 'Telegram',
      telegramLink: 'https://t.me/operator_luxon_bot',
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
          answer: 'Поделитесь ссылкой с друзьями. Чем больше ваши рефералы пополняют, тем выше ваш рейтинг. Топ игроки по сумме пополнений рефералов получают призы в конце месяца.'
        }
      ],
      backToMain: 'На главную'
    },
    en: {
      title: 'Support',
      subtitle: 'We are always ready to help you',
      contactUs: 'Contact us',
      responseTime: 'Response time: 5-30 minutes',
      writeMessage: 'Write a message',
      messagePlaceholder: 'Describe your problem or question...',
      sendMessage: 'Send message',
      messageSent: 'Message sent! We will contact you soon.',
      contactMethods: 'Contact methods',
      telegram: 'Telegram',
      telegramLink: 'https://t.me/operator_luxon_bot',
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
          answer: 'Share link with friends. The more your referrals deposit, the higher your ranking. Top players by total referral deposits receive prizes at the end of month.'
        }
      ],
      backToMain: 'Back to main'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <main className="space-y-6">
      <FixedHeaderControls />
      {/* Заголовок */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <SupportIcon className="w-6 h-6 text-orange-400" />
          <h1 className="text-2xl font-bold text-white pr-20">{t.title}</h1>
        </div>
        <p className="text-sm text-white/70">{t.subtitle}</p>
        <div className="flex justify-center">
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
              @operator_luxon_bot
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
          className="inline-flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
        >
          <BackIcon className="w-5 h-5" />
          {t.backToMain}
        </a>
      </div>
    </main>
  )
}
