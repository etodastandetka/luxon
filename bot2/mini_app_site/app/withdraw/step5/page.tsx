"use client"
import { useState, useEffect } from 'react'
import FixedHeaderControls from '../../../components/FixedHeaderControls'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../components/LanguageContext'
import { checkUserBlocked } from '../../../utils/telegram'
import { safeFetch } from '../../../utils/fetch'

export default function WithdrawStep5() {
  const [siteCode, setSiteCode] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkingExists, setCheckingExists] = useState(true)
  const [hasWithdrawals, setHasWithdrawals] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bookmaker, setBookmaker] = useState('')
  const { language } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    // Проверяем, что пользователь прошел предыдущие шаги
    const savedBookmaker = localStorage.getItem('withdraw_bookmaker')
    const bank = localStorage.getItem('withdraw_bank')
    const qrPhoto = localStorage.getItem('withdraw_qr_photo')
    const phone = localStorage.getItem('withdraw_phone')
    const userId = localStorage.getItem('withdraw_user_id')
    
    if (!savedBookmaker || !bank || !qrPhoto || !phone || !userId) {
      router.push('/withdraw/step0')
      return
    }

    setBookmaker(savedBookmaker)

    // Проверяем наличие выводов для этого ID
    checkWithdrawsExist(savedBookmaker, userId)
  }, [router])

  // Проверка наличия выводов при загрузке страницы
  const checkWithdrawsExist = async (bookmaker: string, userId: string) => {
    setCheckingExists(true)
    setError(null)
    
    try {
      const base = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://xendro.pro'
      
      console.log('🔄 Проверка наличия выводов:', { bookmaker, userId })
      
      const response = await safeFetch(`${base}/api/withdraw-check-exists?bookmaker=${encodeURIComponent(bookmaker)}&playerId=${encodeURIComponent(userId)}`, {
        timeout: 15000,
        retries: 1,
        retryDelay: 1000
      })
      
      if (!response.ok) {
        console.error('❌ Ошибка проверки наличия выводов:', {
          status: response.status,
          statusText: response.statusText
        })
        // При ошибке все равно разрешаем попробовать ввести код
        setHasWithdrawals(true)
        return
      }
      
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

  // Проверка кода и получение суммы ордера при изменении кода
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
      
      console.log('🔄 Проверка кода вывода:', { bookmaker, userId, codeLength: siteCode.trim().length })
      
      // Только проверяем код и получаем сумму ордера (mobile.getWithdrawalAmount)
      // Вывод будет выполнен на странице подтверждения
      const response = await safeFetch(`${base}/api/withdraw-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookmaker: bookmaker,
          playerId: userId,
          code: siteCode.trim(),
        }),
        timeout: 30000,
        retries: 2,
        retryDelay: 1000
      })

      console.log('📥 Ответ от сервера:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Ошибка ответа сервера:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        })
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      console.log('[Withdraw Step5] API Response:', JSON.stringify(data, null, 2))
      
      // Проверяем успешный ответ
      if (data.success) {
        // Пытаемся извлечь amount из разных мест ответа
        let amount: number | null = null
        let alreadyExecuted = false
        
        console.log('[Withdraw Step5] Parsing response:', {
          hasData: !!data.data,
          dataKeys: data.data ? Object.keys(data.data) : [],
          dataAmount: data.data?.amount,
          dataAlreadyExecuted: data.data?.alreadyExecuted,
          message: data.message,
          fullData: data
        })
        
        // Вариант 1: amount в data.data.amount (основной путь для всех казино)
        if (data.data && data.data.amount !== undefined && data.data.amount !== null) {
          amount = parseFloat(String(data.data.amount))
          alreadyExecuted = data.data.alreadyExecuted === true
          console.log('[Withdraw Step5] ✅ Found amount in data.data.amount:', amount)
        }
        // Вариант 2: amount напрямую в data.amount
        else if (data.amount !== undefined && data.amount !== null) {
          amount = parseFloat(String(data.amount))
          console.log('[Withdraw Step5] ✅ Found amount in data.amount:', amount)
        }
        // Вариант 3: amount в data.data напрямую (если это число)
        else if (data.data && typeof data.data === 'number') {
          amount = parseFloat(data.data.toString())
          console.log('[Withdraw Step5] ✅ Found amount in data.data (number):', amount)
        }
        // Вариант 4: проверяем все вложенные объекты в data.data
        else if (data.data && typeof data.data === 'object') {
          // Ищем amount в любом вложенном поле
          const searchForAmount = (obj: any, path = ''): number | null => {
            if (!obj || typeof obj !== 'object') return null
            for (const key in obj) {
              const value = obj[key]
              const currentPath = path ? `${path}.${key}` : key
              if (key.toLowerCase() === 'amount' && (typeof value === 'number' || typeof value === 'string')) {
                const parsed = parseFloat(String(value))
                if (!isNaN(parsed) && parsed > 0) {
                  console.log(`[Withdraw Step5] ✅ Found amount in ${currentPath}:`, parsed)
                  return parsed
                }
              }
              if (typeof value === 'object' && value !== null) {
                const found = searchForAmount(value, currentPath)
                if (found !== null) return found
              }
            }
            return null
          }
          const foundAmount = searchForAmount(data.data)
          if (foundAmount !== null) {
            amount = foundAmount
          }
        }
        
        // Проверяем message для определения, выполнен ли вывод
        const message = (data.message || data.error || '').toLowerCase()
        if (message.includes('executed') || message.includes('успешно') || message.includes('withdrawal executed')) {
          alreadyExecuted = true
          console.log('[Withdraw Step5] Withdrawal executed detected from message')
        }
        
        // Если alreadyExecuted установлен в data.data, используем его
        if (data.data && data.data.alreadyExecuted !== undefined) {
          alreadyExecuted = data.data.alreadyExecuted === true
        }
        
        // Валидация суммы
        if (amount !== null && !isNaN(amount) && amount > 0) {
          // ВАЖНО: Сначала очищаем ошибку, потом устанавливаем сумму
          setError(null)
          setWithdrawAmount(amount)
          localStorage.setItem('withdraw_amount', amount.toString())
          localStorage.setItem('withdraw_site_code', siteCode.trim())
          
          console.log('[Withdraw Step5] ✅ Success - amount:', amount, 'alreadyExecuted:', alreadyExecuted)
          console.log('[Withdraw Step5] ✅ Amount saved to localStorage:', amount.toString())
          console.log('[Withdraw Step5] ✅ Error cleared, amount set to:', amount)
        } else {
          // Если success: true, но нет amount, проверяем message
          if (message.includes('executed') || message.includes('успешно') || message.includes('withdrawal executed')) {
            // Операция успешна, но amount не найден - это критическая ошибка
            console.error('[Withdraw Step5] ❌ Success message but no valid amount found in response:', {
              data,
              parsedAmount: amount,
              isNaN: amount !== null ? isNaN(amount) : 'N/A',
              isPositive: amount !== null ? amount > 0 : 'N/A',
              dataStructure: JSON.stringify(data, null, 2)
            })
            setWithdrawAmount(null)
            setError('Вывод выполнен, но не удалось получить сумму. Обратитесь в поддержку.')
          } else {
            console.error('[Withdraw Step5] ❌ Success but no amount and no success message:', data)
            setWithdrawAmount(null)
            setError('Не удалось получить сумму вывода. Попробуйте еще раз.')
          }
        }
      } else {
        // Ошибка от API
        console.error('[Withdraw Step5] Error response:', data)
        setWithdrawAmount(null)
        const errorMessage = data.error || data.message || 'Код неверный или вывод не найден'
        setError(errorMessage)
      }
    } catch (error: any) {
      console.error('❌ Ошибка проверки кода:', {
        error,
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      })
      setWithdrawAmount(null)
      
      let errorMessage = 'Ошибка проверки кода. Попробуйте еще раз.'
      if (error?.message) {
        errorMessage = error.message
      } else if (error?.name === 'AbortError') {
        errorMessage = 'Превышено время ожидания. Проверьте интернет-соединение и попробуйте снова.'
      } else if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        errorMessage = 'Нет подключения к интернету. Проверьте соединение и попробуйте снова.'
      }
      
      setError(errorMessage)
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

  // Получаем адрес для указания в казино в зависимости от букмекера
  const getWithdrawalAddress = () => {
    const normalizedBookmaker = bookmaker.toLowerCase()
    if (normalizedBookmaker.includes('lux') || normalizedBookmaker === 'luxon' || normalizedBookmaker === 'lux on') {
      return 'Lux on'
    } else if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet' || normalizedBookmaker.includes('xbet')) {
      return 'TSUM LUX'
    }
    return null
  }

  const withdrawalAddress = getWithdrawalAddress()

  const handleBack = () => {
    router.push('/withdraw/step4')
  }

  const translations = {
    ru: {
      title: 'Вывод - Шаг 5',
      subtitle: 'Код с сайта',
      instruction: 'Введите код подтверждения с сайта букмекера. После ввода код будет проверен, и средства будут сразу сняты с вашего счета. Не забудьте указать правильный адрес при создании заявки в казино.',
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
        
        {/* Информация об адресе для указания в казино */}
        {withdrawalAddress && (
          <div className="p-4 bg-blue-900/30 border border-blue-500 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-xl">📍</span>
              <div className="flex-1">
                <p className="text-sm text-blue-300 font-semibold mb-1">
                  {language === 'ru' ? 'Важно! Укажите в казино адрес:' : language === 'en' ? 'Important! Specify in casino address:' : 'Маанилүү! Казинодо дарегиңизди көрсөтүңүз:'}
                </p>
                <p className="text-lg text-white font-bold text-center py-2 bg-blue-950/50 rounded border border-blue-400">
                  {withdrawalAddress}
                </p>
                <p className="text-xs text-blue-200 mt-2">
                  {language === 'ru' 
                    ? 'При создании заявки на вывод в казино укажите именно этот адрес'
                    : language === 'en'
                    ? 'When creating a withdrawal request in casino, specify exactly this address'
                    : 'Казинодо чыгаруу өтүнүчүн түзгөндө ушул дареги так көрсөтүңүз'}
                </p>
              </div>
            </div>
          </div>
        )}
        
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
                    ⏳ Проверка кода...
                  </p>
                  <p className="text-xs text-white/70 mt-1">
                    Пожалуйста, подождите. Проверяем код ордера на вывод.
                  </p>
                </div>
              )}
              
              {/* Показываем ошибку только если сумма не извлечена И есть ошибка */}
              {error && hasWithdrawals === true && (withdrawAmount === null || withdrawAmount === 0) && !checking && (
                <div className="mt-2 p-3 bg-red-900/30 border border-red-500 rounded-lg">
                  <p className="text-sm text-red-300 font-semibold">
                    ❌ Ошибка вывода
                  </p>
                  <p className="text-sm text-red-200 mt-1">
                    {error}
                  </p>
                </div>
              )}
              
              {/* Показываем успех, если сумма извлечена - это приоритетнее ошибки */}
              {withdrawAmount !== null && withdrawAmount > 0 && !checking && (
                <div className="mt-2 p-3 bg-green-900/30 border border-green-500 rounded-lg">
                  <p className="text-sm text-green-300 font-semibold">
                    ✅ Вывод выполнен успешно
                  </p>
                  <p className="text-sm text-green-200 mt-1">
                    Сумма: {withdrawAmount.toLocaleString()} сом
                  </p>
                  <p className="text-xs text-green-300/70 mt-1">
                    Вы можете перейти к подтверждению заявки
                  </p>
                </div>
              )}
              
              
              {withdrawAmount !== null && !error && !checking && (
                <div className="mt-3 p-4 bg-green-900/30 border border-green-500 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">✅</span>
                    <p className="text-sm text-green-300 font-semibold">
                      Код проверен успешно!
                    </p>
                  </div>
                  <div className="pt-2 border-t border-green-500/30">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Сумма ордера:</span>
                      <span className="text-2xl text-white font-bold">
                        {withdrawAmount} сом
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-green-200 mt-2">
                    Код ордера проверен. Перейдите к подтверждению для выполнения вывода.
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
