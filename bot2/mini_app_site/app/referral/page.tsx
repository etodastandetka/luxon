"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../components/LanguageContext'
import FixedHeaderControls from '../../components/FixedHeaderControls'
import { getApiBase, safeFetchJson } from '../../utils/fetch'

export default function ReferralPage() {
  const [referralLink, setReferralLink] = useState('')
  const [earned, setEarned] = useState(0)
  const [referralCount, setReferralCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [topPlayers, setTopPlayers] = useState([])
  const [userRank, setUserRank] = useState(0)
  const [isFromBot, setIsFromBot] = useState(true)
  const [availableBalance, setAvailableBalance] = useState(0)
  const [hasPendingWithdrawal, setHasPendingWithdrawal] = useState(false)
  const [referralSettings, setReferralSettings] = useState({
    referral_percentage: 5,
    min_payout: 100,
    first_place_prize: 10000,
    second_place_prize: 5000,
    third_place_prize: 2500,
    fourth_place_prize: 1500,
    fifth_place_prize: 1000,
    total_prize_pool: 20000,
    next_payout_date: '1 ноября'
  })
  const { language, setLanguage } = useLanguage()
  const router = useRouter()
  
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage)
    localStorage.setItem('user_language', newLanguage)
  }

  useEffect(() => {
    // Загружаем данные сразу, без задержки
    loadReferralData()
  }, [])

  const loadReferralData = async () => {
    setLoading(true)
    setError(null)
    let userId: string | null = null
    try {
      // Получаем ID пользователя из Telegram WebApp
      const tg = (window as any).Telegram?.WebApp
      
      // Минимальное логирование только для отладки
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Telegram WebApp:', !!tg, 'User ID:', tg?.initDataUnsafe?.user?.id)
      }
      
      // Если Telegram WebApp еще не инициализирован, ждем короткое время
      if (!tg) {
        console.warn('⚠️ Telegram WebApp не доступен, ждем инициализации...')
        await new Promise(resolve => setTimeout(resolve, 200)) // Уменьшено с 1000 до 200ms
        const tgRetry = (window as any).Telegram?.WebApp
        if (!tgRetry) {
          throw new Error('Telegram WebApp не инициализирован. Откройте приложение через Telegram бота.')
        }
      }
      
      // Правильный способ получения user ID из Telegram WebApp
      if (tg?.initDataUnsafe?.user?.id) {
        userId = String(tg.initDataUnsafe.user.id)
        setIsFromBot(true)
      } else if (tg?.initData) {
        // Парсим initData если он есть (правильный способ)
        try {
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          if (userParam) {
            const userData = JSON.parse(decodeURIComponent(userParam))
            userId = String(userData.id)
            setIsFromBot(true)
          }
        } catch (e) {
          // Тихая ошибка парсинга
        }
      }
      
      // Если не из бота, показываем ошибку вместо использования тестового ID
      // API требует валидный Telegram user_id (только цифры)
      if (!userId) {
        console.error('❌ Not opened from Telegram bot, user ID not found')
        setIsFromBot(false)
        setError('Не удалось определить ID пользователя. Откройте приложение через Telegram бота.')
        setLoading(false)
        return
      }
      
      // Проверяем, что user_id состоит только из цифр (требование API)
      if (!/^\d+$/.test(String(userId))) {
        console.error('❌ Invalid user ID format:', userId)
        setError('Неверный формат ID пользователя. Откройте приложение через Telegram бота.')
        setLoading(false)
        return
      }

      // Генерируем реферальную ссылку с правильным именем бота
      // TODO: Обновить имя бота на актуальное после создания бота
      const link = `https://t.me/lux_on_bot?start=ref${userId}`
      setReferralLink(link)

      // Загружаем данные рефералов с API
      const apiUrl = getApiBase()
      const apiEndpoint = `${apiUrl}/api/public/referral-data?user_id=${userId}`
      
      try {
        const data = await safeFetchJson<any>(apiEndpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 8000, // 8 секунд таймаут (быстрее)
          retries: 1, // 1 попытка (быстрее)
        })
        
        // Проверяем, что данные успешно получены
        // API всегда возвращает success: true при успешном запросе, даже если данных нет
        if (data && data.success === true) {
          // Обрабатываем данные, даже если они нулевые (это нормально для нового пользователя)
          setEarned(typeof data.earned === 'number' ? data.earned : 0)
          setAvailableBalance(typeof data.available_balance === 'number' ? data.available_balance : 0)
          setHasPendingWithdrawal(Boolean(data.has_pending_withdrawal))
          // Используем total_referrals (общее количество) вместо referral_count (только активные)
          setReferralCount(typeof data.total_referrals === 'number' ? data.total_referrals : (typeof data.referral_count === 'number' ? data.referral_count : 0))
          setTopPlayers(Array.isArray(data.top_players) ? data.top_players : [])
          setUserRank(typeof data.user_rank === 'number' ? data.user_rank : (data.user_rank === null ? 0 : 0))
          
          // Обновляем настройки рефералов, если они есть
          if (data.settings) {
            setReferralSettings({
              referral_percentage: data.settings.referral_percentage || 5,
              min_payout: data.settings.min_payout || 100,
              first_place_prize: data.settings.first_place_prize || 10000,
              second_place_prize: data.settings.second_place_prize || 5000,
              third_place_prize: data.settings.third_place_prize || 2500,
              fourth_place_prize: data.settings.fourth_place_prize || 1500,
              fifth_place_prize: data.settings.fifth_place_prize || 1000,
              total_prize_pool: data.settings.total_prize_pool || 20000,
              next_payout_date: data.settings.next_payout_date || '1 ноября'
            })
          } else {
            // Если настроек нет, используем значения по умолчанию
            console.log('⚠️ Настройки рефералов не получены, используем значения по умолчанию')
          }
          setError(null)
          console.log('✅ Данные рефералов успешно загружены:', {
            earned: data.earned,
            total_referrals: data.total_referrals,
            referral_count: data.referral_count,
            top_players_count: Array.isArray(data.top_players) ? data.top_players.length : 0
          })
        } else if (data && data.success === false) {
          // Если API вернул явную ошибку
          const errorMessage = data?.error || 'Не удалось загрузить данные реферальной программы'
          console.error('❌ API вернул ошибку:', errorMessage, 'Полные данные:', data)
          setError(errorMessage)
          setTopPlayers([])
          setUserRank(0)
        } else {
          // Если данные не в ожидаемом формате, но есть поля earned или total_referrals, все равно обрабатываем
          if (data && (data.earned !== undefined || data.total_referrals !== undefined)) {
            console.warn('⚠️ API вернул данные без success флага, но обрабатываем их:', data)
            setEarned(typeof data.earned === 'number' ? data.earned : 0)
            setAvailableBalance(typeof data.available_balance === 'number' ? data.available_balance : 0)
            setHasPendingWithdrawal(Boolean(data.has_pending_withdrawal))
            setReferralCount(typeof data.total_referrals === 'number' ? data.total_referrals : (typeof data.referral_count === 'number' ? data.referral_count : 0))
            setTopPlayers(Array.isArray(data.top_players) ? data.top_players : [])
            setUserRank(typeof data.user_rank === 'number' ? data.user_rank : 0)
            setError(null)
          } else {
            // Если данные действительно не в ожидаемом формате
            console.error('❌ Неожиданный формат ответа API:', data)
            setError('Сервер вернул данные в неожиданном формате')
            setTopPlayers([])
            setUserRank(0)
          }
        }
      } catch (fetchError: any) {
        console.error('❌ Ошибка при загрузке данных рефералов:', {
          error: fetchError,
          errorName: fetchError?.name,
          message: fetchError?.message,
          status: fetchError?.status,
          statusText: fetchError?.statusText,
          data: fetchError?.data,
          stack: fetchError?.stack,
          apiEndpoint,
          userId,
          apiUrl,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        })
        
        // Дополнительная диагностика для сетевых ошибок
        if (fetchError?.message?.includes('Failed to fetch') || 
            fetchError?.message?.includes('NetworkError') ||
            fetchError?.name === 'TypeError') {
          console.error('🌐 Сетевая ошибка обнаружена. Проверьте:')
          console.error('  1. Доступность API:', apiEndpoint)
          console.error('  2. CORS настройки на сервере')
          console.error('  3. Интернет соединение')
          
          // Пробуем простой fetch для диагностики
          try {
            console.log('🔍 Диагностика: пробуем простой fetch...')
            const testResponse = await fetch(apiEndpoint, {
              method: 'GET',
              mode: 'cors',
              headers: {
                'Content-Type': 'application/json',
              }
            })
            console.log('🔍 Диагностика: статус ответа:', testResponse.status, testResponse.statusText)
            const testText = await testResponse.text()
            console.log('🔍 Диагностика: первые 200 символов ответа:', testText.substring(0, 200))
          } catch (diagError: any) {
            console.error('🔍 Диагностика: ошибка простого fetch:', diagError)
          }
        }
        let errorMessage = 'Ошибка подключения к серверу. Проверьте интернет-соединение.'
        
        // Более детальные сообщения об ошибках
        if (fetchError?.message) {
          if (fetchError.message.includes('таймаут') || fetchError.message.includes('timeout')) {
            errorMessage = 'Превышено время ожидания ответа от сервера. Попробуйте позже.'
          } else if (fetchError.message.includes('интернет') || fetchError.message.includes('network')) {
            errorMessage = 'Нет подключения к интернету. Проверьте соединение и попробуйте снова.'
          } else if (fetchError.message.includes('CORS') || fetchError.message.includes('cors')) {
            errorMessage = 'Ошибка CORS. Проверьте настройки сервера.'
          } else if (fetchError.status === 429) {
            errorMessage = 'Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.'
          } else if (fetchError.status === 403) {
            errorMessage = 'Доступ запрещен. Проверьте настройки сервера.'
          } else if (fetchError.status === 404) {
            errorMessage = 'API endpoint не найден. Проверьте настройки сервера.'
          } else if (fetchError.status === 500) {
            errorMessage = 'Ошибка на сервере. Попробуйте позже.'
          } else {
            errorMessage = fetchError.message || `Ошибка ${fetchError.status || 'неизвестная'}`
          }
        }
        
        setError(errorMessage)
        setTopPlayers([])
        setUserRank(0)
      }
    } catch (error: any) {
      console.error('❌ Общая ошибка при загрузке данных рефералов:', {
        error,
        message: error?.message,
        stack: error?.stack,
        userId,
        timestamp: new Date().toISOString()
      })
      setError(error?.message || 'Произошла ошибка при загрузке данных')
      setTopPlayers([])
      setUserRank(0)
    } finally {
      setLoading(false)
    }
  }

  const translations = {
    ru: {
      title: 'Реферальная программа',
      subtitle: 'Приглашайте друзей и зарабатывайте вместе',
      yourLink: 'Ваша реферальная ссылка',
      copyLink: 'Скопировать ссылку',
      shareLink: 'Поделиться ссылкой',
      earned: 'Заработано с рефералов',
      referrals: 'Количество рефералов',
      nextPayout: 'Следующая выплата',
      howItWorks: 'Как это работает',
      topPlayers: 'Топ игроков',
      yourRank: 'Ваше место',
      prizes: 'Призы',
      firstPlace: () => `1 место: ${referralSettings.first_place_prize.toLocaleString()} сом`,
      secondPlace: () => `2 место: ${referralSettings.second_place_prize.toLocaleString()} сом`,
      thirdPlace: () => `3 место: ${referralSettings.third_place_prize.toLocaleString()} сом`,
      fourthPlace: () => `4 место: ${referralSettings.fourth_place_prize.toLocaleString()} сом`,
      fifthPlace: () => `5 место: ${referralSettings.fifth_place_prize.toLocaleString()} сом`,
      steps: () => [
        'Поделитесь ссылкой с друзьями',
        'Чем больше ваши рефералы пополняют, тем выше ваш рейтинг',
        'Топ игроки по сумме пополнений рефералов получают призы',
        'Призы распределяются по местам (1-5 место) в конце месяца'
      ],
      shareText: 'Присоединяйся к платформе пополнений и выводов!\nБыстро пополняй 1xBet, Melbet, Mostbet, 1Win, Winwin, 888starz и выводи средства без задержек\nРегистрируйся по моей ссылке',
      copied: 'Ссылка скопирована!',
      error: 'Ошибка при копировании',
      backToMain: 'На главную'
    },
    en: {
      title: 'Referral Program',
      subtitle: 'Invite friends and earn together',
      yourLink: 'Your referral link',
      copyLink: 'Copy link',
      shareLink: 'Share link',
      earned: 'Earned from referrals',
      referrals: 'Number of referrals',
      nextPayout: 'Next payout',
      howItWorks: 'How it works',
      topPlayers: 'Top Players',
      yourRank: 'Your rank',
      prizes: 'Prizes',
      firstPlace: () => `1st place: ${referralSettings.first_place_prize.toLocaleString()} som`,
      secondPlace: () => `2nd place: ${referralSettings.second_place_prize.toLocaleString()} som`,
      thirdPlace: () => `3rd place: ${referralSettings.third_place_prize.toLocaleString()} som`,
      fourthPlace: () => `4th place: ${referralSettings.fourth_place_prize.toLocaleString()} som`,
      fifthPlace: () => `5th place: ${referralSettings.fifth_place_prize.toLocaleString()} som`,
      steps: () => [
        'Share the link with friends',
        'The more your referrals deposit, the higher your ranking',
        'Top players by total referral deposits receive prizes',
        'Prizes are distributed by ranking (1st-5th place) at the end of the month'
      ],
      shareText: 'Join the deposit and withdrawal platform!\nQuickly top up 1xBet, Melbet, Mostbet, 1Win, Winwin, 888starz and withdraw funds without delays\nRegister using my link',
      copied: 'Link copied!',
      error: 'Error copying',
      backToMain: 'Back to main'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      alert(t.copied)
    } catch (err) {
      alert(t.error)
    }
  }

  const shareLink = () => {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(t.shareText)}`
    window.open(shareUrl, '_blank')
  }

  return (
    <main className="space-y-6">
      <FixedHeaderControls />
      {/* Заголовок */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white pr-20">{t.title}</h1>
        </div>
        <p className="text-sm text-white/70">{t.subtitle}</p>
        <div className="flex justify-center">
        </div>
      </div>

      {/* Предупреждение если не из бота */}
      {!isFromBot && (
        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-yellow-400 font-semibold text-sm">Внимание</div>
          </div>
          <div className="text-white/80 text-sm mt-1">
            Для полной функциональности откройте приложение через Telegram бота
          </div>
        </div>
      )}

      {/* Сообщение об ошибке */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-red-400 font-semibold text-sm">Ошибка загрузки данных</div>
            </div>
            <button
              onClick={loadReferralData}
              className="text-red-400 hover:text-red-300 text-sm underline"
            >
              Повторить
            </button>
          </div>
          <div className="text-white/80 text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Индикатор загрузки */}
      {loading && (
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="text-blue-400 font-semibold text-sm">Загрузка данных...</div>
          </div>
        </div>
      )}

      {/* Отладочная информация */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-3 mb-4">
          <div className="text-gray-400 text-xs">
            <div>Debug: isFromBot = {isFromBot.toString()}</div>
            <div>Debug: referralLink = {referralLink}</div>
            <div>Debug: Telegram WebApp = {typeof window !== 'undefined' && window.Telegram?.WebApp ? 'Available' : 'Not available'}</div>
          </div>
        </div>
      )}

      {/* Реферальная ссылка */}
      <section className="card space-y-4">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <h2 className="text-lg font-semibold text-white">{t.yourLink}</h2>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <p className="text-sm text-white/80 break-all font-mono">{referralLink}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={copyToClipboard}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{t.copyLink}</span>
            </button>
            <button 
              onClick={shareLink}
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342c-.400 0-.584-.046-.869-.16a2.47 2.47 0 01-.88-.731 2.48 2.48 0 01-.23-1.08 2.45 2.45 0 01.23-1.08 2.47 2.47 0 01.88-.731c.285-.113.469-.16.869-.16h.892a2.48 2.48 0 012.316-1.674c.896 0 1.656.673 2.316 1.674H15.3c.4 0 .584.047.869.16.345.136.638.319.88.731.137.284.23.603.23 1.08 0 .477-.093.796-.23 1.08a2.48 2.48 0 01-.88.731c-.285.113-.469.16-.869.16h-.892a2.48 2.48 0 01-2.316 1.674c-.896 0-1.656-.673-2.316-1.674H8.684z" />
              </svg>
              <span>{t.shareLink}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center space-y-2">
          <div className="flex items-center justify-center">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-green-400">{earned} сом</div>
          <div className="text-sm text-white/70">{t.earned}</div>
        </div>
        <div className="card text-center space-y-2">
          <div className="flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-blue-400">{referralCount}</div>
          <div className="text-sm text-white/70">{t.referrals}</div>
        </div>
      </div>

      {/* Кнопка вывода */}
      {availableBalance > 0 && !hasPendingWithdrawal && (
        <section className="card text-center space-y-3">
          <div className="text-lg font-semibold text-white">Доступно для вывода</div>
          <div className="text-3xl font-bold text-green-400">{availableBalance.toLocaleString()} сом</div>
          <button
            onClick={() => router.push('/referral/withdraw/step1')}
            className="w-full bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
          >
            Вывести средства
          </button>
          <p className="text-xs text-white/60">
            Можно вывести только весь баланс сразу
          </p>
        </section>
      )}

      {hasPendingWithdrawal && (
        <section className="card bg-yellow-500/20 border border-yellow-500/30 text-center space-y-2">
          <div className="text-yellow-400 font-semibold">Заявка на вывод в обработке</div>
          <div className="text-sm text-white/80">Ожидайте подтверждения администратора</div>
        </section>
      )}

      {/* Топ игроков */}
      <section className="card space-y-4">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <h2 className="text-lg font-semibold text-white">{t.topPlayers}</h2>
        </div>
        
        {topPlayers.length > 0 ? (
          <>
            {/* Призы - Топ-5 (показываем только если есть данные) */}
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-2 space-y-1">
                <div className="w-7 h-7 bg-yellow-500 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-black font-bold text-xs">1</span>
                </div>
                <div className="text-xs text-white/80 font-medium leading-tight">{t.firstPlace()}</div>
              </div>
              <div className="bg-gray-500/20 border border-gray-500/30 rounded-lg p-2 space-y-1">
                <div className="w-7 h-7 bg-gray-400 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-white font-bold text-xs">2</span>
                </div>
                <div className="text-xs text-white/80 font-medium leading-tight">{t.secondPlace()}</div>
              </div>
              <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-2 space-y-1">
                <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-white font-bold text-xs">3</span>
                </div>
                <div className="text-xs text-white/80 font-medium leading-tight">{t.thirdPlace()}</div>
              </div>
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-2 space-y-1">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-white font-bold text-xs">4</span>
                </div>
                <div className="text-xs text-white/80 font-medium leading-tight">{t.fourthPlace()}</div>
              </div>
              <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-2 space-y-1">
                <div className="w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-white font-bold text-xs">5</span>
                </div>
                <div className="text-xs text-white/80 font-medium leading-tight">{t.fifthPlace()}</div>
              </div>
            </div>

            {/* Ваше место */}
            {userRank > 0 && (
              <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <div className="text-sm text-purple-400 font-semibold">{t.yourRank}: #{userRank}</div>
                </div>
              </div>
            )}

            {/* Топ-5 реферов */}
            <div className="space-y-2">
              {topPlayers.slice(0, 5).map((player: any, index: number) => (
                <div key={player.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-500 text-white' :
                      index === 3 ? 'bg-blue-500 text-white' :
                      index === 4 ? 'bg-purple-500 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-white font-semibold text-base">{player.username || `Игрок #${player.id}`}</div>
                      <div className="text-sm text-white/70">{player.referral_count || 0} рефералов</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold text-lg">{player.total_deposits?.toLocaleString() || 0} сом</div>
                    <div className="text-sm text-white/60">пополнений рефералов</div>
                    {player.prize && (
                      <div className="text-xs text-yellow-400 font-medium mt-1">Приз: {player.prize.toLocaleString()} сом</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Пустое состояние - красивая заглушка */
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-lg p-6 text-center border border-gray-700/50">
              <div className="flex justify-center mb-4">
                <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-white/80 font-medium mb-2">Пока нет данных о топе игроков</div>
              <div className="text-white/60 text-sm">Данные появятся после первых пополнений рефералов</div>
            </div>
            
            {/* Показываем призы в виде информационного блока */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="text-blue-400 font-semibold text-sm mb-3 text-center">Призовой фонд</div>
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="space-y-1">
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-black font-bold text-[10px]">1</span>
                  </div>
                  <div className="text-[10px] text-white/70">{referralSettings.first_place_prize.toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-white font-bold text-[10px]">2</span>
                  </div>
                  <div className="text-[10px] text-white/70">{referralSettings.second_place_prize.toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-white font-bold text-[10px]">3</span>
                  </div>
                  <div className="text-[10px] text-white/70">{referralSettings.third_place_prize.toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-white font-bold text-[10px]">4</span>
                  </div>
                  <div className="text-[10px] text-white/70">{referralSettings.fourth_place_prize.toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-white font-bold text-[10px]">5</span>
                  </div>
                  <div className="text-[10px] text-white/70">{referralSettings.fifth_place_prize.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Следующая выплата */}
      <section className="card text-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="text-lg font-semibold text-white">{t.nextPayout}</div>
        </div>
        <div className="text-2xl font-bold text-yellow-400">{referralSettings.next_payout_date}</div>
        <div className="text-sm text-white/70 mt-1">Автоматическая выплата</div>
      </section>

      {/* Как это работает */}
      <section className="card space-y-4">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-white">{t.howItWorks}</h2>
        </div>
        <div className="space-y-3">
          {t.steps().map((step, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </div>
              <p className="text-sm text-white/80 leading-relaxed flex-1">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Навигация */}
      <div className="text-center">
        <a 
          href="/" 
          className="inline-flex items-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>{t.backToMain}</span>
        </a>
      </div>

      {/* Footer с именем бота */}
      <div className="text-center text-white/60 text-sm mt-4">
        @lux_on_bot
      </div>
    </main>
  )
}
