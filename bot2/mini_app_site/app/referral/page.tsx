"use client"
import { useState, useEffect } from 'react'
import LanguageSelector from '../../components/LanguageSelector'
import { useLanguage } from '../../components/LanguageContext'

export default function ReferralPage() {
  const [referralLink, setReferralLink] = useState('')
  const [earned, setEarned] = useState(0)
  const [referralCount, setReferralCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [topPlayers, setTopPlayers] = useState([])
  const [userRank, setUserRank] = useState(0)
  const [isFromBot, setIsFromBot] = useState(true)
  const { language, setLanguage } = useLanguage()
  
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage)
    localStorage.setItem('user_language', newLanguage)
  }

  useEffect(() => {
    loadReferralData()
  }, [])

  const loadReferralData = async () => {
    setLoading(true)
    try {
      // Получаем ID пользователя из Telegram WebApp
      const tg = (window as any).Telegram?.WebApp
      let userId = null
      
      console.log('=== DEBUG: Telegram WebApp Data ===')
      console.log('Telegram object:', tg)
      console.log('initDataUnsafe:', tg?.initDataUnsafe)
      console.log('initData:', tg?.initData)
      console.log('user:', tg?.initDataUnsafe?.user)
      console.log('=====================================')
      
      // Правильный способ получения user ID из Telegram WebApp
      if (tg?.initDataUnsafe?.user?.id) {
        userId = tg.initDataUnsafe.user.id
        setIsFromBot(true)
        console.log('✅ User ID from initDataUnsafe:', userId)
        console.log('Full user data:', tg.initDataUnsafe.user)
      } else if (tg?.initData) {
        // Парсим initData если он есть (правильный способ)
        try {
          console.log('Parsing initData:', tg.initData)
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          console.log('User param from initData:', userParam)
          if (userParam) {
            const userData = JSON.parse(decodeURIComponent(userParam))
            userId = userData.id
            setIsFromBot(true)
            console.log('✅ User ID from initData:', userId)
            console.log('Full user data from initData:', userData)
          }
        } catch (e) {
          console.log('❌ Error parsing initData:', e)
        }
      }
      
      // Если не из бота, используем тестовый ID
      if (!userId) {
        console.log('❌ Not opened from Telegram bot, using test user ID')
        userId = 'test_user_123'
        setIsFromBot(false)
      }

      // Генерируем реферальную ссылку с правильным именем бота
      // TODO: Обновить имя бота на актуальное после создания бота
      const link = `https://t.me/lux_on_bot?start=ref${userId}`
      setReferralLink(link)

      // Загружаем данные рефералов с Django API
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'
      const response = await fetch(`${apiUrl}/api/public/referral-data?user_id=${userId}`)
      const data = await response.json()
      
      if (data.success) {
        setEarned(data.earned || 0)
        setReferralCount(data.referral_count || 0)
        setTopPlayers(data.top_players || [])
        setUserRank(data.user_rank || 0)
      } else {
        // Если нет данных, показываем пустой список
        setTopPlayers([])
        setUserRank(0)
      }
    } catch (error) {
      console.error('Error loading referral data:', error)
      // При ошибке показываем пустой список
      setTopPlayers([])
      setUserRank(0)
    } finally {
      setLoading(false)
    }
  }

  const translations = {
    ru: {
      title: '👥 Реферальная программа',
      subtitle: 'Приглашайте друзей и зарабатывайте вместе',
      yourLink: 'Ваша реферальная ссылка',
      copyLink: 'Скопировать ссылку',
      shareLink: 'Поделиться ссылкой',
      earned: 'Заработано с рефералов',
      referrals: 'Количество рефералов',
      nextPayout: 'Следующая выплата',
      howItWorks: 'Как это работает',
      topPlayers: '🏆 Топ игроков',
      yourRank: 'Ваше место',
      prizes: 'Призы',
      firstPlace: '1 место: 10,000 сом',
      secondPlace: '2 место: 5,000 сом',
      thirdPlace: '3 место: 2,500 сом',
      steps: [
        'Поделитесь ссылкой с друзьями',
        'За каждое пополнение реферала вы получаете 5%',
        'Выплаты происходят автоматически в конце месяца',
        'Минимальная сумма для выплаты: 100 сом'
      ],
      shareText: 'Присоединяйся к платформе пополнений и выводов! 💸\nБыстро пополняй 1xBet, Melbet, Mostbet, 1Win и выводи средства без задержек 🚀\nРегистрируйся по моей ссылке',
      copied: 'Ссылка скопирована!',
      error: 'Ошибка при копировании',
      backToMain: '🔙 На главную'
    },
    en: {
      title: '👥 Referral Program',
      subtitle: 'Invite friends and earn together',
      yourLink: 'Your referral link',
      copyLink: 'Copy link',
      shareLink: 'Share link',
      earned: 'Earned from referrals',
      referrals: 'Number of referrals',
      nextPayout: 'Next payout',
      howItWorks: 'How it works',
      topPlayers: '🏆 Top Players',
      yourRank: 'Your rank',
      prizes: 'Prizes',
      firstPlace: '1st place: 10,000 som',
      secondPlace: '2nd place: 5,000 som',
      thirdPlace: '3rd place: 2,500 som',
      steps: [
        'Share the link with friends',
        'You get 5% for each referral deposit',
        'Payouts happen automatically at the end of the month',
        'Minimum payout amount: 100 som'
      ],
      shareText: 'Join the deposit and withdrawal platform! 💸\nQuickly top up 1xBet, Melbet, Mostbet, 1Win and withdraw funds without delays 🚀\nRegister using my link',
      copied: 'Link copied!',
      error: 'Error copying',
      backToMain: '🔙 Back to main'
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
      {/* Заголовок */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <p className="text-sm text-white/70">{t.subtitle}</p>
        <div className="flex justify-center">
          <LanguageSelector />
        </div>
      </div>

      {/* Предупреждение если не из бота */}
      {!isFromBot && (
        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
          <div className="text-yellow-400 font-semibold text-sm">⚠️ Внимание</div>
          <div className="text-white/80 text-sm mt-1">
            Для полной функциональности откройте приложение через Telegram бота
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
        <h2 className="text-lg font-semibold text-white">{t.yourLink}</h2>
        <div className="space-y-3">
          <div className="bg-gray-800 p-3 rounded-lg">
            <p className="text-sm text-white/80 break-all">{referralLink}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={copyToClipboard}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              {t.copyLink}
            </button>
            <button 
              onClick={shareLink}
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
              {t.shareLink}
            </button>
          </div>
        </div>
      </section>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-400">{earned} сом</div>
          <div className="text-sm text-white/70">{t.earned}</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-400">{referralCount}</div>
          <div className="text-sm text-white/70">{t.referrals}</div>
        </div>
      </div>

      {/* Топ игроков */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">{t.topPlayers}</h2>
        
        {/* Призы */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-2">
            <div className="text-xs text-yellow-400">🥇</div>
            <div className="text-xs text-white/80">{t.firstPlace}</div>
          </div>
          <div className="bg-gray-500/20 border border-gray-500/30 rounded-lg p-2">
            <div className="text-xs text-gray-400">🥈</div>
            <div className="text-xs text-white/80">{t.secondPlace}</div>
          </div>
          <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-2">
            <div className="text-xs text-orange-400">🥉</div>
            <div className="text-xs text-white/80">{t.thirdPlace}</div>
          </div>
        </div>

        {/* Ваше место */}
        {userRank > 0 && (
          <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-3 text-center">
            <div className="text-sm text-purple-400 font-semibold">{t.yourRank}: #{userRank}</div>
          </div>
        )}

        {/* Топ-3 игроки */}
        <div className="space-y-2">
          {topPlayers.length > 0 ? topPlayers.slice(0, 3).map((player: any, index: number) => (
            <div key={player.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-gray-400 text-white' :
                  index === 2 ? 'bg-orange-500 text-white' :
                  'bg-gray-600 text-white'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <div className="text-white font-semibold text-base">{player.username || `Игрок #${player.id}`}</div>
                  <div className="text-sm text-white/70">{player.referral_count} рефералов</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-bold text-lg">{player.total_deposits.toLocaleString()} сом</div>
                <div className="text-sm text-white/60">пополнений</div>
              </div>
            </div>
          )) : (
            <div className="text-center text-white/60 py-4">
              <div>Пока нет данных о топе игроков</div>
              <div className="text-xs mt-1">Данные появятся после первых пополнений</div>
            </div>
          )}
        </div>
      </section>

      {/* Следующая выплата */}
      <section className="card text-center">
        <div className="text-lg font-semibold text-white mb-2">{t.nextPayout}</div>
        <div className="text-2xl font-bold text-yellow-400">1 ноября</div>
        <div className="text-sm text-white/70 mt-1">Автоматическая выплата</div>
      </section>

      {/* Как это работает */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">{t.howItWorks}</h2>
        <div className="space-y-3">
          {t.steps.map((step, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{step}</p>
            </div>
          ))}
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

      {/* Footer с именем бота */}
      <div className="text-center text-white/60 text-sm mt-4">
        @lux_on_bot
      </div>
    </main>
  )
}