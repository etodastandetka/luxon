"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'

export default function WithdrawStep5() {
  const [siteCode, setSiteCode] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkingExists, setCheckingExists] = useState(true)
  const [hasWithdrawals, setHasWithdrawals] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requestCreated, setRequestCreated] = useState(false)
  const [creatingRequest, setCreatingRequest] = useState(false)
  const { language } = useLanguage()
    const router = useRouter()

  useEffect(() => {
    // Проверяем, что пользователь прошел предыдущие шаги
    const bookmaker = localStorage.getItem('withdraw_bookmaker')
    const bank = localStorage.getItem('withdraw_bank')
    const qrPhoto = localStorage.getItem('withdraw_qr_photo')
    const phone = localStorage.getItem('withdraw_phone')
    const userId = localStorage.getItem('withdraw_user_id')
    if (!bookmaker || !bank || !qrPhoto || !phone || !userId) {
      router.push('/withdraw/step0')
      return
    }

    // Проверяем наличие выводов для этого ID
    checkWithdrawsExist(bookmaker, userId)
  }, [router])

  // Проверка наличия выводов при загрузке страницы
  const checkWithdrawsExist = async (bookmaker: string, userId: string) => {
    setCheckingExists(true)
    setError(null)
    
    try {
      const base = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'
      
      const response = await fetch(`${base}/api/withdraw-check-exists?bookmaker=${encodeURIComponent(bookmaker)}&playerId=${encodeURIComponent(userId)}`)
      const data = await response.json()
      
      if (data.success && data.data) {
        // Для казино, где нет метода проверки без кода, считаем что можно проверить
        if (data.data.canCheck && data.data.hasWithdrawals !== false) {
          setHasWithdrawals(true)
        } else if (data.data.hasWithdrawals === false) {
          setHasWithdrawals(false)
          setError('Нет вывода на этот ID. Проверьте правильность ID аккаунта.')
        } else {
          setHasWithdrawals(true) // Можно попробовать ввести код
        }
      } else {
        // Если проверка не удалась, все равно разрешаем ввести код
        setHasWithdrawals(true)
      }
    } catch (error: any) {
      console.error('Ошибка проверки наличия выводов:', error)
      // При ошибке все равно разрешаем попробовать ввести код
      setHasWithdrawals(true)
    } finally {
      setCheckingExists(false)
    }
  }

  // Создание заявки на вывод в админке
  const createWithdrawRequest = async (amountValue?: number) => {
    if (requestCreated || creatingRequest) {
      return // Уже создана или создается
    }

    setCreatingRequest(true)
    
    try {
      const bookmaker = localStorage.getItem('withdraw_bookmaker') || ''
      const bank = localStorage.getItem('withdraw_bank') || ''
      const qrPhoto = localStorage.getItem('withdraw_qr_photo') || ''
      const phone = localStorage.getItem('withdraw_phone') || ''
      const userId = localStorage.getItem('withdraw_user_id') || ''
      const amount = amountValue?.toString() || withdrawAmount?.toString() || localStorage.getItem('withdraw_amount') || '0'
      
      // Получаем данные пользователя Telegram
      const tg = (window as any).Telegram?.WebApp
      let telegramUser = null
      
      if (tg?.initDataUnsafe?.user) {
        telegramUser = tg.initDataUnsafe.user
      } else if (tg?.initData) {
        try {
          const params = new URLSearchParams(tg.initData)
          const userParam = params.get('user')
          if (userParam) {
            telegramUser = JSON.parse(decodeURIComponent(userParam))
          }
        } catch (e) {
          console.log('❌ Error parsing initData:', e)
        }
      }
      
      console.log('🔄 Создаем заявку на вывод на step5...', {
        type: 'withdraw',
        bookmaker,
        userId: parseInt(userId),
        phone,
        amount: parseFloat(amount),
        bank,
        qrPhoto: qrPhoto ? 'uploaded' : '',
        siteCode
      })

      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'withdraw',
          bookmaker: bookmaker,
          userId: parseInt(userId),
          phone: phone,
          amount: parseFloat(amount),
          bank: bank,
          playerId: userId,
          qr_photo: qrPhoto,
          site_code: siteCode,
          // Данные пользователя Telegram
          telegram_user_id: telegramUser?.id,
          telegram_username: telegramUser?.username,
          telegram_first_name: telegramUser?.first_name,
          telegram_last_name: telegramUser?.last_name,
          telegram_language_code: telegramUser?.language_code
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Заявка на вывод создана успешно на step5:', data)
        // Сохраняем ID заявки
        localStorage.setItem('withdraw_transaction_id', data.id || data.transactionId || '')
        localStorage.setItem('withdraw_request_created', 'true')
        setRequestCreated(true)
      } else {
        const errorData = await response.json()
        console.error('❌ Ошибка создания заявки на вывод:', errorData)
      }
    } catch (error) {
      console.error('❌ Ошибка создания заявки на вывод:', error)
    } finally {
      setCreatingRequest(false)
    }
  }

  // Выполнение вывода при изменении кода
  useEffect(() => {
    const bookmaker = localStorage.getItem('withdraw_bookmaker')
    const userId = localStorage.getItem('withdraw_user_id')
    
    // Выполняем вывод только если код полный (минимум 4 символа для большинства кодов)
    if (siteCode.trim().length >= 4 && bookmaker && userId) {
      // Задержка для debounce - ждем пока пользователь закончит ввод
      const timer = setTimeout(() => {
        processWithdraw(bookmaker, userId)
      }, 500)
      
      return () => clearTimeout(timer)
    } else {
      setWithdrawAmount(null)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode])

  const processWithdraw = async (bookmaker: string, userId: string) => {
    if (!siteCode.trim()) {
      return
    }

    setChecking(true)
    setError(null)
    
    try {
      const base = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'
      
      // Выполняем вывод через API - это сразу снимает деньги
      const response = await fetch(`${base}/api/withdraw-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookmaker: bookmaker,
          playerId: userId,
          code: siteCode.trim(),
        }),
      })

      const data = await response.json()
      
      if (data.success && data.data && data.data.amount) {
        // Вывод выполнен успешно - сохраняем данные
        const amount = data.data.amount
        setWithdrawAmount(amount)
        localStorage.setItem('withdraw_amount', amount.toString())
        localStorage.setItem('withdraw_transaction_id', data.data.transactionId?.toString() || '')
        setError(null)
        
        // Создаем заявку в админке сразу после успешного вывода
        // Передаем amount напрямую, чтобы не ждать обновления state
        if (!requestCreated && !creatingRequest) {
          createWithdrawRequest(amount)
        }
      } else {
        setWithdrawAmount(null)
        setError(data.message || 'Код неверный или вывод не найден')
      }
    } catch (error: any) {
      console.error('Ошибка выполнения вывода:', error)
      setWithdrawAmount(null)
      setError('Ошибка выполнения вывода. Попробуйте еще раз.')
    } finally {
      setChecking(false)
    }
  }

  const handleSubmit = () => {
    if (!siteCode.trim()) {
      alert('Введите код с сайта')
      return
    }

    if (!withdrawAmount) {
      alert('Код неверный или вывод не найден. Проверьте код и попробуйте еще раз.')
      return
    }
    
    // Сохраняем данные
    localStorage.setItem('withdraw_site_code', siteCode)
    localStorage.setItem('withdraw_amount', withdrawAmount.toString())
    
    // Переходим к подтверждению
    router.push('/withdraw/confirm')
  }

  const handleBack = () => {
    router.push('/withdraw/step4')
  }

  const translations = {
    ru: {
      title: 'Вывод - Шаг 5',
      subtitle: 'Код с сайта',
      instruction: 'Введите код подтверждения с сайта букмекера. После ввода код будет проверен и средства будут сняты с вашего счета.',
      placeholder: 'Введите код',
      submit: 'Перейти к подтверждению',
      back: 'Назад'
    },
    en: {
      title: 'Withdraw - Step 5',
      subtitle: 'Site code',
      instruction: 'Enter confirmation code from bookmaker site',
      placeholder: 'Enter code',
      submit: 'Submit request',
      back: 'Back'
    },
    ky: {
      title: 'Чыгаруу - 5-чи кадам',
      subtitle: 'Сайт коду',
      instruction: 'Букмекер сайтынан ырастоо кодун киргизиңиз',
      placeholder: 'Код киргизиңиз',
      submit: 'Өтүнүч жөнөтүү',
      back: 'Артка'
    },
    uz: {
      title: 'Yechib olish - 5-qadam',
      subtitle: 'Sayt kodi',
      instruction: 'Bukmeker saytidan tasdiqlash kodini kiriting',
      placeholder: 'Kod kiriting',
      submit: 'So\'rov yuborish',
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
            <div className="bg-accent h-2 rounded-full" style={{width: '100%'}}></div>
          </div>
          <p className="text-sm text-white/70 mt-1">Шаг 5 из 5</p>
        </div>
        
        <p className="text-white/80 text-center">{t.instruction}</p>
        
        <div className="space-y-3">
          {checkingExists && (
            <div className="p-3 bg-blue-900/30 border border-blue-500 rounded-lg">
              <p className="text-sm text-blue-300 font-semibold">
                🔍 Проверка наличия вывода...
              </p>
            </div>
          )}
          
          {hasWithdrawals === false && (
            <div className="p-4 bg-red-900/30 border border-red-500 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">❌</span>
                <p className="text-red-300 font-semibold">
                  Вывод не найден
                </p>
              </div>
              <p className="text-sm text-red-200">
                Нет вывода на этот ID. Проверьте правильность ID аккаунта в казино.
              </p>
            </div>
          )}
          
          {hasWithdrawals !== false && !checkingExists && (
            <>
              <div>
                <label className="label">{t.subtitle}</label>
                <input 
                  className="input w-full"
                  type="text"
                  value={siteCode}
                  onChange={(e) => setSiteCode(e.target.value)}
                  placeholder={t.placeholder}
                  disabled={checking || checkingExists}
                />
              </div>
              
              {checking && (
                <div className="mt-2 p-3 bg-blue-900/30 border border-blue-500 rounded-lg">
                  <p className="text-sm text-blue-300 font-semibold">
                    ⏳ Выполняется вывод...
                  </p>
                  <p className="text-xs text-white/70 mt-1">
                    Пожалуйста, подождите
                  </p>
                </div>
              )}
              
              {error && hasWithdrawals === true && (
                <div className="mt-2 p-3 bg-red-900/30 border border-red-500 rounded-lg">
                  <p className="text-sm text-red-300 font-semibold">
                    ❌ Ошибка вывода
                  </p>
                  <p className="text-sm text-red-200 mt-1">
                    {error}
                  </p>
                </div>
              )}
              
              {creatingRequest && (
                <div className="mt-2 p-3 bg-blue-900/30 border border-blue-500 rounded-lg">
                  <p className="text-sm text-blue-300 font-semibold">
                    📤 Создание заявки в админке...
                  </p>
                </div>
              )}
              
              {requestCreated && (
                <div className="mt-2 p-3 bg-green-900/30 border border-green-500 rounded-lg">
                  <p className="text-sm text-green-300 font-semibold">
                    ✅ Заявка успешно создана в админке
                  </p>
                </div>
              )}
              
              {withdrawAmount !== null && !error && !checking && (
                <div className="mt-3 p-4 bg-green-900/30 border border-green-500 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">✅</span>
                    <p className="text-sm text-green-300 font-semibold">
                      Вывод выполнен успешно!
                    </p>
                  </div>
                  <div className="pt-2 border-t border-green-500/30">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Сумма вывода:</span>
                      <span className="text-2xl text-white font-bold">
                        {withdrawAmount} сом
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-green-200 mt-2">
                    Деньги сняты с вашего счета в казино. Проверьте детали и подтвердите заявку.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="flex gap-2 justify-center">
          <button 
            className="btn btn-ghost"
            onClick={handleBack}
          >
            {t.back}
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!siteCode.trim() || !withdrawAmount || checking || checkingExists || hasWithdrawals === false}
          >
            {checking || checkingExists ? 'Обработка...' : hasWithdrawals === false ? 'Вывод не найден' : t.submit}
          </button>
        </div>
      </div>
    </main>
  )
}
