"use client"
import { useState, useEffect, Suspense } from 'react'
import FixedHeaderControls from '../../../../components/FixedHeaderControls'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '../../../../components/LanguageContext'
import PageTransition from '../../../../components/PageTransition'

function ReferralWithdrawStep2Content() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [availableBalance, setAvailableBalance] = useState(0)
  const bookmaker = searchParams.get('bookmaker') || ''

  useEffect(() => {
    // Загружаем доступный баланс
    loadAvailableBalance()
  }, [])

  const loadAvailableBalance = async () => {
    try {
      const tg = (window as any).Telegram?.WebApp
      let userId = null
      
      if (tg?.initDataUnsafe?.user?.id) {
        userId = tg.initDataUnsafe.user.id
      } else if (tg?.initData) {
        try {
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          if (userParam) {
            const userData = JSON.parse(decodeURIComponent(userParam))
            userId = userData.id
          }
        } catch (e) {
          console.error('Error parsing initData:', e)
        }
      }

      if (!userId) {
        console.error('No user ID found')
        return
      }

      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'
      
      const response = await fetch(`${apiUrl}/api/public/referral-data?user_id=${userId}`)
      const data = await response.json()
      
      if (data.success) {
        setAvailableBalance(data.available_balance || 0)
      }
    } catch (error) {
      console.error('Error loading available balance:', error)
    }
  }

  const handleSubmit = async () => {
    if (!accountId.trim()) {
      alert('Введите ID аккаунта в казино')
      return
    }

    if (!bookmaker) {
      alert('Ошибка: не выбран казино')
      return
    }

    try {
      setLoading(true)

      const tg = (window as any).Telegram?.WebApp
      let userId = null
      
      if (tg?.initDataUnsafe?.user?.id) {
        userId = tg.initDataUnsafe.user.id
      } else if (tg?.initData) {
        try {
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          if (userParam) {
            const userData = JSON.parse(decodeURIComponent(userParam))
            userId = userData.id
          }
        } catch (e) {
          console.error('Error parsing initData:', e)
        }
      }

      if (!userId) {
        alert('Ошибка: не удалось получить ID пользователя')
        return
      }

      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'

      const response = await fetch(`${apiUrl}/api/referral/withdraw/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          bookmaker: bookmaker,
          account_id: accountId.trim(),
          amount: availableBalance, // Выводим весь баланс
          telegram_data: {
            username: tg?.initDataUnsafe?.user?.username || null,
            first_name: tg?.initDataUnsafe?.user?.first_name || null,
            last_name: tg?.initDataUnsafe?.user?.last_name || null,
            phone_number: tg?.initDataUnsafe?.user?.phone_number || null,
          }
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('Заявка на вывод создана успешно! Ожидайте подтверждения администратора.')
        router.push('/referral')
      } else {
        alert(`Ошибка: ${data.error || 'Не удалось создать заявку'}`)
      }
    } catch (error: any) {
      console.error('Error creating withdrawal request:', error)
      alert(`Ошибка: ${error.message || 'Не удалось создать заявку'}`)
    } finally {
      setLoading(false)
    }
  }

  const getBookmakerName = (bm: string) => {
    const names: Record<string, string> = {
      '1xbet': '1xBet',
      '1win': '1WIN',
      'melbet': 'Melbet',
      'mostbet': 'Mostbet',
      'winwin': 'Winwin',
      '888starz': '888starz',
    }
    return names[bm.toLowerCase()] || bm
  }

  const translations = {
    ru: {
      title: 'Вывод средств',
      subtitle: 'Введите ID аккаунта в казино',
      accountId: 'ID аккаунта в казино',
      accountIdPlaceholder: 'Введите ID аккаунта',
      amount: 'Сумма вывода',
      submit: 'Отправить заявку',
      back: 'Назад',
      note: 'Выводится весь доступный баланс'
    },
    en: {
      title: 'Withdraw funds',
      subtitle: 'Enter casino account ID',
      accountId: 'Casino account ID',
      accountIdPlaceholder: 'Enter account ID',
      amount: 'Withdrawal amount',
      submit: 'Submit request',
      back: 'Back',
      note: 'Full available balance will be withdrawn'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  return (
    <PageTransition direction="forward">
      <main className="space-y-6 min-h-screen flex flex-col p-4">
        <FixedHeaderControls />
        {/* Заголовок */}
        <div className="text-center space-y-2">
          <div className="pr-20">
            <h1 className="text-xl font-bold text-white">{t.title}</h1>
            <div className="scale-75">
            </div>
          </div>
          <p className="text-sm text-white/70">{t.subtitle}</p>
        </div>

        {/* Информация о казино */}
        <div className="card space-y-2">
          <div className="text-white/70 text-sm">Казино</div>
          <div className="text-white font-semibold text-lg">{getBookmakerName(bookmaker)}</div>
        </div>

        {/* Сумма вывода */}
        <div className="card space-y-2">
          <div className="text-white/70 text-sm">{t.amount}</div>
          <div className="text-green-400 font-bold text-2xl">
            {availableBalance.toLocaleString()} сом
          </div>
          <div className="text-white/60 text-xs">{t.note}</div>
        </div>

        {/* ID аккаунта */}
        <div className="card space-y-2">
          <label className="text-white/70 text-sm">{t.accountId}</label>
          <input
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder={t.accountIdPlaceholder}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Кнопки */}
        <div className="space-y-3 flex-1 flex flex-col justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading || !accountId.trim()}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              loading || !accountId.trim()
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {loading ? 'Отправка...' : t.submit}
          </button>
          <button
            onClick={() => router.back()}
            className="w-full py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
          >
            {t.back}
          </button>
        </div>
      </main>
    </PageTransition>
  )
}

export default function ReferralWithdrawStep2() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <FixedHeaderControls />
        <div className="text-white">Загрузка...</div>
      </div>
    }>
      <ReferralWithdrawStep2Content />
    </Suspense>
  )
}


