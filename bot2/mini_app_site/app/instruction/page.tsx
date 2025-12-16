"use client"
import { useState, useEffect } from 'react'
import { useLanguage } from '../../components/LanguageContext'
import FixedHeaderControls from '../../components/FixedHeaderControls'
import VideoModal from '../../components/VideoModal'
import { InstructionIcon, DepositIcon, WithdrawIcon, SupportIcon, BackIcon, VideoIcon } from '../../components/Icons'

export default function InstructionPage() {
  const { language } = useLanguage()
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [depositVideoUrl, setDepositVideoUrl] = useState<string>('')
  const [withdrawVideoUrl, setWithdrawVideoUrl] = useState<string>('')

  // Загружаем видео URL из API
  useEffect(() => {
    const fetchVideoUrls = async () => {
      try {
        const response = await fetch('/api/video-instructions', { cache: 'no-store' })
        const data = await response.json()
        
        if (data.success && data.data) {
          setDepositVideoUrl(data.data.deposit_video_url || 'https://youtube.com/shorts/FkOJz238N2w?feature=share')
          setWithdrawVideoUrl(data.data.withdraw_video_url || 'https://youtube.com/shorts/qBYploQ5zFc?feature=share')
        }
      } catch (error) {
        console.error('Failed to fetch video instructions:', error)
        // Используем значения по умолчанию при ошибке
        setDepositVideoUrl('https://youtube.com/shorts/FkOJz238N2w?feature=share')
        setWithdrawVideoUrl('https://youtube.com/shorts/qBYploQ5zFc?feature=share')
      }
    }
    
    fetchVideoUrls()
  }, [])

  const translations = {
    ru: {
      title: 'Инструкция',
      subtitle: 'Пошаговое руководство по использованию платформы',
      depositTitle: 'Пополнение счета',
      depositSteps: [
        'Выберите букмекера из списка (1XBET, 1WIN, MELBET, MOSTBET, WINWIN, 888STARZ)',
        'Введите ваш ID игрока в казино',
        'Укажите сумму пополнения (от 35 до 100,000 сом)',
        'Выберите банк для оплаты (DemirBank, O! bank, Balance.kg, Bakai, MegaPay, MBank)',
        'Перейдите по сгенерированной ссылке и оплатите',
        'Дождитесь автоматического пополнения (1-5 минут)'
      ],
      withdrawTitle: 'Вывод средств',
      withdrawSteps: [
        'Выберите букмекера из списка',
        'Введите ваш ID игрока в казино',
        'Укажите сумму вывода (от 100 до 50,000 сом)',
        'Выберите банк для получения средств',
        'Введите номер телефона для получения',
        'Введите код подтверждения с сайта букмекера',
        'Ожидайте подтверждения администратора (5-30 минут)'
      ],
      importantTitle: 'Важные замечания',
      importantNotes: [
        'Все операции проходят через администратора',
        'Время обработки: 5-30 минут',
        'При проблемах обращайтесь в поддержку',
        'Сохраняйте скриншоты операций',
        'Не передавайте коды подтверждения третьим лицам'
      ],
      supportTitle: 'Поддержка',
      supportText: 'Если у вас возникли вопросы или проблемы, обратитесь в поддержку:',
      supportContact: '@operator_luxon_bot',
      backToMain: 'На главную',
      watchDepositVideo: 'Посмотреть видео-инструкцию по пополнению',
      watchWithdrawVideo: 'Посмотреть видео-инструкцию по выводу',
      videoTitle: 'Видео-инструкция'
    },
    en: {
      title: 'Instruction',
      subtitle: 'Step-by-step guide to using the platform',
      depositTitle: 'Account Deposit',
      depositSteps: [
        'Choose a bookmaker from the list (1XBET, 1WIN, MELBET, MOSTBET, WINWIN, 888STARZ)',
        'Enter your player ID in the casino',
        'Specify the deposit amount (from 35 to 100,000 som)',
        'Choose a bank for payment (DemirBank, O! bank, Balance.kg, Bakai, MegaPay, MBank)',
        'Follow the generated link and pay',
        'Wait for automatic deposit (1-5 minutes)'
      ],
      withdrawTitle: 'Withdraw Funds',
      withdrawSteps: [
        'Choose a bookmaker from the list',
        'Enter your player ID in the casino',
        'Specify the withdrawal amount (from 100 to 50,000 som)',
        'Choose a bank to receive funds',
        'Enter phone number for receiving',
        'Enter confirmation code from bookmaker website',
        'Wait for administrator confirmation (5-30 minutes)'
      ],
      importantTitle: 'Important Notes',
      importantNotes: [
        'All operations go through administrator',
        'Processing time: 5-30 minutes',
        'Contact support if you have problems',
        'Save screenshots of operations',
        'Do not share confirmation codes with third parties'
      ],
      supportTitle: 'Support',
      supportText: 'If you have questions or problems, contact support:',
      supportContact: '@operator_luxon_bot',
      backToMain: 'Back to main',
      watchDepositVideo: 'Watch deposit video tutorial',
      watchWithdrawVideo: 'Watch withdraw video tutorial',
      videoTitle: 'Video Tutorial'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <main className="space-y-6">
      <FixedHeaderControls />
      {/* Заголовок */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <InstructionIcon className="w-6 h-6 text-white" />
          <h1 className="text-2xl font-bold text-white pr-20">{t.title}</h1>
        </div>
        <p className="text-sm text-white/70">{t.subtitle}</p>
        <div className="flex justify-center">
        </div>
      </div>

      {/* YouTube видео инструкция */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">{t.videoTitle}</h2>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute top-0 left-0 w-full h-full rounded-lg"
            src="https://www.youtube.com/embed/qBYploQ5zFc"
            title="Видео-инструкция"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ border: 'none' }}
          />
        </div>
      </section>

      {/* Пополнение */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DepositIcon className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">{t.depositTitle}</h2>
          </div>
          <button
            onClick={() => {
              setSelectedVideo('https://www.youtube.com/embed/FkOJz238N2w')
              setVideoTitle(t.depositTitle)
              setIsVideoModalOpen(true)
            }}
            className="btn btn-ghost btn-sm text-xs flex items-center gap-1"
          >
            <VideoIcon className="w-4 h-4" />
            {t.watchDepositVideo}
          </button>
        </div>
        
        {/* YouTube Shorts видео для пополнения */}
        <div className="relative w-full" style={{ paddingBottom: '177.78%' }}>
          <iframe
            className="absolute top-0 left-0 w-full h-full rounded-lg"
            src="https://www.youtube.com/embed/FkOJz238N2w"
            title="Видео-инструкция по пополнению"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ border: 'none' }}
          />
        </div>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WithdrawIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">{t.withdrawTitle}</h2>
          </div>
          <button
            onClick={() => {
              setSelectedVideo(withdrawVideoUrl || 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view')
              setVideoTitle(t.withdrawTitle)
              setIsVideoModalOpen(true)
            }}
            className="btn btn-ghost btn-sm text-xs flex items-center gap-1"
          >
            <VideoIcon className="w-4 h-4" />
            {t.watchWithdrawVideo}
          </button>
        </div>
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
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-lg font-semibold text-white">{t.importantTitle}</h2>
        </div>
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
        <div className="flex items-center gap-2">
          <SupportIcon className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold text-white">{t.supportTitle}</h2>
        </div>
        <p className="text-sm text-white/80">{t.supportText}</p>
        <a 
          href="https://t.me/operator_luxon_bot" 
          className="inline-block bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
        >
          {t.supportContact}
        </a>
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

      {/* Модальное окно с видео */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoSrc={selectedVideo}
        title={videoTitle}
      />
    </main>
  )
}

