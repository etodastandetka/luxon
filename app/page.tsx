"use client"
import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import ServiceStatus from "../components/ServiceStatus"
import FixedHeaderControls from "../components/FixedHeaderControls"
import { useLanguage } from "../components/LanguageContext"
import { useBotSettings } from "../components/SettingsLoader"
import { initTelegramWebApp, syncWithBot, TelegramUser, getTelegramUser, clearTelegramUserCache } from "../utils/telegram"
import { useHomePageData } from "../hooks/useHomePageData"
import { ReferralIcon, HistoryIcon, InstructionIcon, SupportIcon } from "../components/Icons"
import UserProfile from "../components/UserProfile"
import RatingBlock from "../components/RatingBlock"
import Achievements from "../components/Achievements"
import TelegramLoginWidget from "../components/TelegramLoginWidget"


function getCookie(name: string) {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp("(^| )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]+)"))
  return m ? decodeURIComponent(m[2]) : null
}

function setCookie(name: string, value: string, maxAgeSec = 31536000) {
  if (typeof document === "undefined") return
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax`
}

function HolidayEffects() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const particlesRef = useRef<
    Array<{ x: number; y: number; r: number; vy: number; vx: number; a: number; tw: number }>
  >([])

  const setup = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(1, window.innerWidth)
    const h = Math.max(1, window.innerHeight)
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const count = reduceMotion ? 0 : Math.min(110, Math.max(60, Math.floor((w * h) / 22000)))
    const p: typeof particlesRef.current = []
    for (let i = 0; i < count; i++) {
      const r = 0.8 + Math.random() * 2.4
      p.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r,
        vy: 0.35 + Math.random() * 1.25,
        vx: -0.25 + Math.random() * 0.5,
        a: 0.12 + Math.random() * 0.28,
        tw: 0.8 + Math.random() * 1.6,
      })
    }
    particlesRef.current = p
  }, [])

  useEffect(() => {
    setup()
    const onResize = () => setup()
    window.addEventListener("resize", onResize, { passive: true })
    return () => window.removeEventListener("resize", onResize)
  }, [setup])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(34, now - last)
      last = now

      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)

      const p = particlesRef.current
      if (p.length) {
        const t = now / 1000
        for (let i = 0; i < p.length; i++) {
          const s = p[i]
          s.x += s.vx * (dt / 16)
          s.y += s.vy * (dt / 16)
          s.x += Math.sin((t * s.tw + s.x * 0.002) * 2.0) * 0.25 * (dt / 16)

          if (s.y - s.r > h) {
            s.y = -10 - Math.random() * 40
            s.x = Math.random() * w
          }
          if (s.x < -20) s.x = w + 20
          if (s.x > w + 20) s.x = -20

          ctx.beginPath()
          ctx.globalAlpha = s.a
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
          ctx.fillStyle = "#ffffff"
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const bulbs = useMemo(() => Array.from({ length: 42 }, (_, i) => i), [])

  return (
    <>
      <canvas ref={canvasRef} className="wb-snow" aria-hidden="true" />
      <div className="wb-garland" aria-hidden="true">
        <ul className="lightrope">
          {bulbs.map((i) => (
            <li key={i} />
          ))}
        </ul>
      </div>
    </>
  )
}

function LuxOnSlots({
  userId,
  language,
}: {
  userId: number | null
  language: string
}) {
  const reelsRef = useRef<Array<HTMLDivElement | null>>([null, null, null])
  const spinningRef = useRef(false)
  const cookieKey = useMemo(() => `lux_balance_${userId ?? "guest"}`, [userId])
  const [balance, setBalance] = useState<number>(0)
  const [message, setMessage] = useState<string>("")
  const reelSoundRef = useRef<HTMLAudioElement | null>(null)
  const winSoundRef = useRef<HTMLAudioElement | null>(null)

  const symbols = useMemo(() => ["🍒", "🔔", "🍋", "🍉", "⭐", "7️⃣", "🍊", "🍓", "🍈", "🍍"], [])
  const betAmount = 10
  const maxWin = 100

  const spinningStatesRef = useRef<boolean[]>([false, false, false])
  const finalPositionsRef = useRef<number[]>([0, 0, 0])

  const renderReel = useCallback((index: number, finalSymbol?: string) => {
    const el = reelsRef.current[index]
    if (!el) return
    
    // Создаем длинный список символов для плавного вращения
    const extendedSymbols: string[] = []
    for (let i = 0; i < 50; i++) {
      extendedSymbols.push(symbols[Math.floor(Math.random() * symbols.length)])
    }
    
    // Если указан финальный символ, вставляем его в нужную позицию
    if (finalSymbol) {
      const targetIndex = 20 // Позиция, где будет виден символ после остановки
      extendedSymbols[targetIndex] = finalSymbol
      extendedSymbols[targetIndex + 1] = finalSymbol
      extendedSymbols[targetIndex + 2] = finalSymbol
    }
    
    // Создаем контейнер для символов
    let container = el.querySelector('.lux-reel-container') as HTMLDivElement
    if (!container) {
      container = document.createElement("div")
      container.className = "lux-reel-container"
      el.innerHTML = ""
      el.appendChild(container)
    } else {
      container.innerHTML = ""
    }
    
    const frag = document.createDocumentFragment()
    extendedSymbols.forEach((symbol, i) => {
      const d = document.createElement("div")
      d.className = "lux-symbol"
      d.textContent = symbol
      d.setAttribute("data-index", i.toString())
      frag.appendChild(d)
    })
    
    container.appendChild(frag)
    
    // Всегда устанавливаем позицию после создания символов
    const symbolHeight = 50
    const centerOffset = 75 // центр видимой области (150px / 2 = 75px)
    const targetSymbolIndex = 20
    const initialPosition = targetSymbolIndex * symbolHeight - centerOffset
    
    // Устанавливаем позицию сразу, синхронно, с !important для гарантии
    container.style.setProperty('transform', `translateY(${initialPosition}px)`, 'important')
    container.style.setProperty('transition', 'none', 'important')
    // Принудительный reflow для применения стилей
    void container.offsetHeight
    
    // Восстанавливаем transition только если не идет анимация
    if (!finalSymbol) {
      // Используем setTimeout для восстановления transition после применения позиции
      setTimeout(() => {
        container.style.removeProperty('transition')
      }, 100)
    }
  }, [symbols])

  const renderAll = useCallback(() => {
    renderReel(0)
    renderReel(1)
    renderReel(2)
    // Дополнительно убеждаемся, что позиции установлены после рендера
    setTimeout(() => {
      reelsRef.current.forEach((reel, index) => {
        if (reel && !spinningStatesRef.current[index]) {
          const container = reel.querySelector('.lux-reel-container') as HTMLElement
          if (container) {
            const symbolHeight = 50
            const centerOffset = 75
            const targetSymbolIndex = 20
            const initialPosition = targetSymbolIndex * symbolHeight - centerOffset
            // Принудительно устанавливаем позицию с !important
            container.style.setProperty('transform', `translateY(${initialPosition}px)`, 'important')
            container.style.setProperty('transition', 'none', 'important')
            // Принудительный reflow
            void container.offsetHeight
            // Восстанавливаем transition
            setTimeout(() => {
              container.style.removeProperty('transition')
            }, 150)
          }
        }
      })
    }, 100)
  }, [renderReel])

  useEffect(() => {
    const raw = getCookie(cookieKey)
    const v = raw ? Number(raw) : NaN
    const init = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 1000
    setBalance(init)
    setMessage(language === "en" ? "Good luck!" : "Удачи! Крути и выигрывай LuxToken.")
  }, [cookieKey, language])

  useEffect(() => {
    setCookie(cookieKey, String(Math.max(0, Math.floor(balance))))
  }, [cookieKey, balance])

  useEffect(() => {
    if (typeof window === "undefined") return
    // Рендерим все барабаны при загрузке
    renderAll()
    // Дополнительно убеждаемся, что позиции установлены после небольшой задержки
    const timeoutId = setTimeout(() => {
      reelsRef.current.forEach((reel, index) => {
        if (reel && !spinningStatesRef.current[index]) {
          const container = reel.querySelector('.lux-reel-container') as HTMLElement
          if (container) {
            const symbolHeight = 50
            const centerOffset = 75
            const targetSymbolIndex = 20
            const initialPosition = targetSymbolIndex * symbolHeight - centerOffset
            // Всегда устанавливаем позицию для гарантии
            container.style.transform = `translateY(${initialPosition}px)`
            container.style.transition = 'none'
            void container.offsetHeight
            setTimeout(() => {
              container.style.transition = ''
            }, 50)
          }
        }
      })
    }, 200)
    return () => clearTimeout(timeoutId)
  }, [renderAll])

  useEffect(() => {
    if (language === "en") {
      setMessage("Good luck! Spin and earn LuxToken.")
    } else {
      setMessage("Удачи! Крути и выигрывай LuxToken.")
    }
  }, [language])

  const stopSounds = useCallback(() => {
    const rs = reelSoundRef.current
    if (rs) {
      rs.pause()
      rs.currentTime = 0
    }
  }, [])

  const playReelSound = useCallback(() => {
    const rs = reelSoundRef.current
    if (!rs) return
    rs.currentTime = 0
    rs.play().catch(() => {})
  }, [])

  const playWinSound = useCallback(() => {
    const ws = winSoundRef.current
    if (!ws) return
    ws.currentTime = 0
    ws.play().catch(() => {})
  }, [])

  const checkWin = useCallback(() => {
    // Получаем символы из центральной позиции (индекс 20)
    const reel0 = reelsRef.current[0]
    const reel1 = reelsRef.current[1]
    const reel2 = reelsRef.current[2]
    
    if (!reel0 || !reel1 || !reel2) return
    
    // Получаем символ из центральной позиции каждого барабана
    const symbol0 = reel0.querySelector('[data-index="20"]')?.textContent || ""
    const symbol1 = reel1.querySelector('[data-index="20"]')?.textContent || ""
    const symbol2 = reel2.querySelector('[data-index="20"]')?.textContent || ""
    
    const win = symbol0 === symbol1 && symbol1 === symbol2

    if (win) {
      const payout = Math.min(betAmount * 5, maxWin)
      setBalance((b) => b + payout)
      playWinSound()
      setMessage(language === "en" ? `You won +${payout} LuxToken` : `Вы выиграли +${payout} LuxToken`)
    } else {
      setMessage(language === "en" ? "Try again" : "Не повезло. Попробуйте ещё раз.")
    }
  }, [betAmount, maxWin, language, playWinSound])

  const spinReel = useCallback(
    (index: number, finalSymbol: string, baseSpinTime: number, stopDelay: number) => {
      const reel = reelsRef.current[index]
      if (!reel) return Promise.resolve()
      
      spinningStatesRef.current[index] = true
      reel.classList.add("lux-reel-spinning")
      
      // Определяем финальную позицию (в пикселях)
      const symbolHeight = 50 // высота символа
      const targetSymbolIndex = 20 // индекс символа, который должен быть в центре
      const centerOffset = 75 // центр видимой области (150px / 2 = 75px)
      const targetPosition = targetSymbolIndex * symbolHeight - centerOffset
      finalPositionsRef.current[index] = targetPosition
      
      // Устанавливаем финальный символ
      renderReel(index, finalSymbol)
      
      // Запускаем анимацию - начинаем сверху (отрицательное значение) и опускаемся вниз
      // Все барабаны крутятся одинаковое время, но останавливаются с задержкой
      const spinDuration = baseSpinTime + stopDelay // базовое время + задержка остановки
      const startPosition = -2000 // начальная позиция сверху
      reel.style.setProperty("--spin-duration", `${spinDuration}ms`)
      reel.style.setProperty("--start-position", `${startPosition}px`)
      reel.style.setProperty("--target-position", `${targetPosition}px`)
      
      return new Promise<void>((resolve) => {
        const container = reel.querySelector('.lux-reel-container') as HTMLElement
        if (!container) {
          spinningStatesRef.current[index] = false
          reel.classList.remove("lux-reel-spinning")
          resolve()
          return
        }
        
        const handleAnimationEnd = (e: AnimationEvent) => {
          // Проверяем, что это событие от нашего контейнера
          if (e.target !== container) return
          
          spinningStatesRef.current[index] = false
          reel.classList.remove("lux-reel-spinning")
          
          // Устанавливаем финальную позицию после завершения анимации
          container.style.transform = `translateY(${targetPosition}px)`
          container.style.transition = 'none'
          // Принудительный reflow
          void container.offsetHeight
          // Восстанавливаем transition для будущих анимаций
          setTimeout(() => {
            container.style.transition = ''
          }, 50)
          
          container.removeEventListener('animationend', handleAnimationEnd as EventListener)
          resolve()
        }
        
        container.addEventListener('animationend', handleAnimationEnd as EventListener, { once: true })
        
        // Fallback на случай, если событие не сработает
        setTimeout(() => {
          if (spinningStatesRef.current[index]) {
            spinningStatesRef.current[index] = false
            reel.classList.remove("lux-reel-spinning")
            container.style.transform = `translateY(${targetPosition}px)`
            container.style.transition = 'none'
            void container.offsetHeight
            setTimeout(() => {
              container.style.transition = ''
            }, 50)
            container.removeEventListener('animationend', handleAnimationEnd as EventListener)
            resolve()
          }
        }, spinDuration + 200)
      })
    },
    [renderReel]
  )

  const spin = useCallback(async () => {
    if (spinningRef.current) return
    if (balance < betAmount) {
      setMessage(language === "en" ? "Not enough balance" : "Недостаточно LuxToken для ставки.")
      return
    }

    spinningRef.current = true
    setBalance((b) => b - betAmount)
    setMessage(language === "en" ? "Spinning..." : "Крутим...")

    playReelSound()

    // Генерируем случайные финальные символы
    const finalSymbols = [
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)]
    ]

    // Базовое время вращения для всех барабанов (одинаковое)
    const baseSpinTime = 2500 + Math.random() * 500 // 2.5-3 секунды базового вращения
    
    // Задержки остановки для создания эффекта последовательной остановки
    const stopDelay1 = 0 // Первый останавливается сразу после базового времени
    const stopDelay2 = 400 // Второй останавливается через 400мс после первого
    const stopDelay3 = 800 // Третий останавливается через 800мс после первого (400мс после второго)

    // Запускаем все барабаны одновременно, но они останавливаются последовательно
    await Promise.all([
      spinReel(0, finalSymbols[0], baseSpinTime, stopDelay1),
      spinReel(1, finalSymbols[1], baseSpinTime, stopDelay2),
      spinReel(2, finalSymbols[2], baseSpinTime, stopDelay3)
    ])

    stopSounds()
    spinningRef.current = false
    checkWin()
  }, [balance, betAmount, language, playReelSound, spinReel, stopSounds, checkWin, symbols])

  const resetBalance = useCallback(() => {
    const v = 1000
    setBalance(v)
    setMessage(language === "en" ? "Balance reset" : "Баланс сброшен.")
  }, [language])

  const balanceLabel = language === "en" ? "Balance" : "Баланс"
  const spinLabel = language === "en" ? "SPIN" : "КРУТИТЬ"
  const brandTitle = language === "en" ? "Lux On Slots" : "Lux On Слоты"

  return (
    <section className="lux-card" aria-label="Lux On game">
      <div className="lux-head">
        <div className="lux-titleblock">
          <div className="lux-brand">{brandTitle}</div>
          <div className="lux-sub">
            {language === "en" ? "LuxToken game inside the app" : "Игра внутри приложения за LuxToken"}
          </div>
        </div>

        <div className="lux-balance">
          <div className="lux-balance-label">{balanceLabel}</div>
          <div className="lux-balance-val">
            {Math.max(0, Math.floor(balance)).toLocaleString("ru-RU")} <span className="lux-token">LuxToken</span>
          </div>
        </div>
      </div>

      <div className="lux-reels">
        <div className="lux-reel" ref={(el) => { reelsRef.current[0] = el }} />
        <div className="lux-reel" ref={(el) => { reelsRef.current[1] = el }} />
        <div className="lux-reel" ref={(el) => { reelsRef.current[2] = el }} />
        <div className="lux-line" aria-hidden="true" />
      </div>

      <div className="lux-controls">
        <button className="lux-btn" onClick={spin} type="button">
          {spinLabel}
        </button>
        <button className="lux-btn lux-btn-ghost" onClick={resetBalance} type="button">
          {language === "en" ? "Reset" : "Сброс"}
        </button>
      </div>

      <div className="lux-message" role="status" aria-live="polite">
        {message}
      </div>

      <audio ref={reelSoundRef} preload="auto" src="https://essykings.github.io/JavaScript/wheel.wav" />
      <audio ref={winSoundRef} preload="auto" src="https://essykings.github.io/JavaScript/payout.mp3" />
    </section>
  )
}

export default function HomePage() {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [userStats, setUserStats] = useState<{ deposits: number; withdraws: number } | null>(null)
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false)
  const { language } = useLanguage()
  const { loading: settingsLoading } = useBotSettings()

  const userInitialized = useRef(false)
  
  // Функция для проверки и обновления пользователя
  const checkAndUpdateUser = useCallback(() => {
    // Проверяем, запущено ли приложение в Telegram WebApp
    const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null
    if (tg) {
      setIsTelegramWebApp(true)
    }
    
    // Сначала пробуем через мини-приложение
    const telegramUser = initTelegramWebApp()
    if (telegramUser) {
      if (!userInitialized.current) {
        userInitialized.current = true
        setUser(telegramUser)
        syncWithBot(telegramUser, "app_opened", {
          page: "home",
          language,
        }).catch(() => {})
      } else {
        // Обновляем пользователя если ID изменился
        setUser((currentUser) => {
          if (!currentUser || currentUser.id !== telegramUser.id) {
            return telegramUser
          }
          return currentUser
        })
      }
    } else {
      // Если не через мини-приложение, проверяем localStorage (виджет авторизации)
      const savedUser = getTelegramUser(false) // Не используем кэш
      if (savedUser) {
        setUser((currentUser) => {
          if (!currentUser || currentUser.id !== savedUser.id) {
            return savedUser
          }
          return currentUser
        })
      }
    }
  }, [language])
  
  useEffect(() => {
    checkAndUpdateUser()
    
    // Периодически проверяем наличие пользователя (на случай если авторизация произошла в другом окне)
    const interval = setInterval(() => {
      if (!user) {
        checkAndUpdateUser()
      }
    }, 1000) // Проверяем каждую секунду, если пользователь не авторизован
    
    // Проверяем при фокусе окна
    const handleFocus = () => {
      if (!user) {
        checkAndUpdateUser()
      }
    }
    window.addEventListener('focus', handleFocus)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [checkAndUpdateUser])

  // Слушаем сообщения от окна авторизации (для виджета)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'telegram_auth_success' && event.data?.user) {
        const userData = event.data.user
        setUser(userData)
        // Обновляем localStorage через функцию getTelegramUser (она использует localStorage)
        if (typeof window !== 'undefined') {
          localStorage.setItem('telegram_user', JSON.stringify(userData))
          // Очищаем кэш, чтобы следующая проверка получила свежие данные
          clearTelegramUserCache()
        }
        // Вызываем callback если он есть
        if (userInitialized.current === false) {
          userInitialized.current = true
        }
      }
    }

    // Также слушаем изменения localStorage (если авторизация произошла в другом окне)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'telegram_user' && e.newValue) {
        try {
          const userData = JSON.parse(e.newValue)
          setUser((currentUser) => {
            if (!currentUser || currentUser.id !== userData.id) {
              clearTelegramUserCache()
              return userData
            }
            return currentUser
          })
        } catch (error) {
          console.error('Error parsing user data from storage:', error)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [user])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return language === "en" ? "Good morning" : "Доброе утро"
    if (hour >= 12 && hour < 18) return language === "en" ? "Good afternoon" : "Добрый день"
    if (hour >= 18 && hour < 22) return language === "en" ? "Good evening" : "Добрый вечер"
    return language === "en" ? "Good night" : "Доброй ночи"
  }, [language])

  const { transactions } = useHomePageData()

  const computedStats = useMemo(() => {
    let deposits = 0
    let withdraws = 0
    for (let i = 0; i < transactions.length; i++) {
      const t: any = transactions[i]
      const ok = t?.status === "completed" || t?.status === "approved"
      if (!ok) continue
      if (t?.type === "deposit") deposits++
      else if (t?.type === "withdraw") withdraws++
    }
    return { deposits, withdraws }
  }, [transactions])

  useEffect(() => {
    if (userStats?.deposits !== computedStats.deposits || userStats?.withdraws !== computedStats.withdraws) {
      setUserStats(computedStats)
    }
  }, [computedStats])

  const translations = {
    ru: {
      subtitle: "Платформа для пополнения и вывода средств в казино",
      deposit: "Пополнить",
      withdraw: "Вывести",
      referral: "Рефералы",
      support: "Поддержка",
      history: "История",
      instruction: "Инструкция",
      quickActions: "Быстрые действия",
      services: "Сервисы",
      activity: "Активность",
      depCount: "Пополнений",
      wdrCount: "Выводов",
      secure: "Защита",
      open: "Открыть",
    },
    en: {
      subtitle: "Platform for deposits and withdrawals in casinos",
      deposit: "Deposit",
      withdraw: "Withdraw",
      referral: "Referrals",
      support: "Support",
      history: "History",
      instruction: "Instruction",
      quickActions: "Quick Actions",
      services: "Services",
      activity: "Activity",
      depCount: "Deposits",
      wdrCount: "Withdrawals",
      secure: "Security",
      open: "Open",
    },
  }

  const t = translations[language as keyof typeof translations] || translations.ru
  const ready = !settingsLoading

  return (
    <main className={`wb-page ${ready ? "wb-ready" : "wb-loading"}`} style={{ paddingTop: "0.5rem", paddingBottom: "110px" }}>
      <HolidayEffects />
      <FixedHeaderControls />

      <div className="wb-wrap space-y-6">
        {!user && !isTelegramWebApp && (
          <section className="wb-section" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <h2 className="wb-h2" style={{ marginBottom: '1rem' }}>
              {language === 'en' ? 'Sign in with Telegram' : 'Вход через Telegram'}
            </h2>
            <p className="wb-p" style={{ marginBottom: '1.5rem', opacity: 0.8 }}>
              {language === 'en' 
                ? 'Please sign in to continue' 
                : 'Пожалуйста, войдите, чтобы продолжить'}
            </p>
            <TelegramLoginWidget botName="Lux_on_bot" />
          </section>
        )}
        <UserProfile />

        <section className="wb-hero">
          <div className="wb-hero-top">
            <div className="wb-hero-title">
              <div className="wb-kicker">{t.secure}</div>
              <h1 className="wb-h1">
                {greeting}
                {user ? `, ${user.first_name}` : ""}!
              </h1>
              <p className="wb-p">{t.subtitle}</p>
            </div>

            <div className="wb-hero-badges">
              <div className="wb-badge">
                <span className="wb-dot" />
                <span className="wb-badge-text">{language === "en" ? "Online" : "Онлайн"}</span>
              </div>
              <div className="wb-badge wb-badge-soft">
                <span className="wb-badge-text">{language === "en" ? "Fast load" : "Быстро"}</span>
              </div>
            </div>
          </div>

          <div className="wb-hero-cards">
            <div className="wb-mini">
              <div className="wb-mini-label">{t.depCount}</div>
              <div className="wb-mini-value">{userStats?.deposits ?? 0}</div>
            </div>
            <div className="wb-mini">
              <div className="wb-mini-label">{t.wdrCount}</div>
              <div className="wb-mini-value">{userStats?.withdraws ?? 0}</div>
            </div>
          </div>

          <div className="wb-hero-sheen" aria-hidden="true" />
        </section>

        <section className="wb-section">
          <div className="wb-section-head">
            <h2 className="wb-h2">{t.quickActions}</h2>
            <span className="wb-pill">{t.activity}</span>
          </div>

          <div className="wb-actions">
            <ServiceStatus service="deposits">
              <a href="/deposit" className="wb-primary wb-primary-dep">
                <div className="wb-primary-left">
                  <div className="wb-primary-icon">
                    <svg className="wb-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="wb-primary-text">
                    <div className="wb-primary-title">{t.deposit}</div>
                    <div className="wb-primary-sub">{language === "en" ? "Instant top up" : "Мгновенное пополнение"}</div>
                  </div>
                </div>
                <div className="wb-primary-cta">
                  <span className="wb-cta">{t.open}</span>
                  <span className="wb-chevron" aria-hidden="true">
                    ›
                  </span>
                </div>
                <span className="wb-primary-shine" aria-hidden="true" />
              </a>
            </ServiceStatus>

            <ServiceStatus service="withdrawals">
              <a href="/withdraw" className="wb-primary wb-primary-wdr">
                <div className="wb-primary-left">
                  <div className="wb-primary-icon">
                    <svg className="wb-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </div>
                  <div className="wb-primary-text">
                    <div className="wb-primary-title">{t.withdraw}</div>
                    <div className="wb-primary-sub">{language === "en" ? "Fast payout" : "Быстрый вывод"}</div>
                  </div>
                </div>
                <div className="wb-primary-cta">
                  <span className="wb-cta">{t.open}</span>
                  <span className="wb-chevron" aria-hidden="true">
                    ›
                  </span>
                </div>
                <span className="wb-primary-shine" aria-hidden="true" />
              </a>
            </ServiceStatus>
          </div>
        </section>

        <LuxOnSlots userId={user?.id ?? null} language={language} />

        <section className="wb-section">
          <div className="wb-section-head">
            <h2 className="wb-h2">{t.services}</h2>
            <span className="wb-pill wb-pill-soft">{language === "en" ? "Tools" : "Инструменты"}</span>
          </div>

          <div className="wb-list">
            <a href="/referral" className="wb-row">
              <div className="wb-row-left">
                <div className="wb-row-icon wb-i-green">
                  <ReferralIcon className="wb-row-svg" />
                </div>
                <div className="wb-row-text">
                  <div className="wb-row-title">{t.referral}</div>
                  <div className="wb-row-sub">
                    {language === "en" ? "Invite friends, earn rewards" : "Приглашай друзей и получай бонусы"}
                  </div>
                </div>
              </div>
              <div className="wb-row-right">
                <span className="wb-row-arrow">›</span>
              </div>
            </a>

            <a href="/history" className="wb-row">
              <div className="wb-row-left">
                <div className="wb-row-icon wb-i-blue">
                  <HistoryIcon className="wb-row-svg" />
                </div>
                <div className="wb-row-text">
                  <div className="wb-row-title">{t.history}</div>
                  <div className="wb-row-sub">{language === "en" ? "All operations in one place" : "Все операции в одном месте"}</div>
                </div>
              </div>
              <div className="wb-row-right">
                <span className="wb-row-arrow">›</span>
              </div>
            </a>

            <a href="/instruction" className="wb-row">
              <div className="wb-row-left">
                <div className="wb-row-icon wb-i-purple">
                  <InstructionIcon className="wb-row-svg" />
                </div>
                <div className="wb-row-text">
                  <div className="wb-row-title">{t.instruction}</div>
                  <div className="wb-row-sub">{language === "en" ? "Step-by-step guide" : "Пошаговая инструкция"}</div>
                </div>
              </div>
              <div className="wb-row-right">
                <span className="wb-row-arrow">›</span>
              </div>
            </a>

            <a href="/support" className="wb-row">
              <div className="wb-row-left">
                <div className="wb-row-icon wb-i-orange">
                  <SupportIcon className="wb-row-svg" />
                </div>
                <div className="wb-row-text">
                  <div className="wb-row-title">{t.support}</div>
                  <div className="wb-row-sub">{language === "en" ? "Support is here 24/7" : "Поддержка 24/7"}</div>
                </div>
              </div>
              <div className="wb-row-right">
                <span className="wb-row-arrow">›</span>
              </div>
            </a>
          </div>
        </section>

        <RatingBlock />
        <Achievements />
      </div>

      <style jsx global>{`
        :root {
          --wb-bg-0: #07150d;
          --wb-bg-1: #0b2014;
          --wb-ink: #ffffff;
          --wb-muted: rgba(255, 255, 255, 0.72);
          --wb-dim: rgba(255, 255, 255, 0.52);
          --wb-line: rgba(255, 255, 255, 0.12);
          --wb-glass: rgba(255, 255, 255, 0.08);
          --wb-glass2: rgba(255, 255, 255, 0.12);
          --wb-shadow: 0 16px 42px rgba(0, 0, 0, 0.38);
          --wb-shadow2: 0 10px 24px rgba(0, 0, 0, 0.24);

          --p-1: #125932;
          --p-2: #4eab3f;
          --p-3: #52d16a;
          --p-4: #9ed1a8;
          --p-5: #e4fbe8;
        }

        body {
          background: radial-gradient(900px 700px at 20% -10%, rgba(82, 209, 106, 0.20), transparent 60%),
            radial-gradient(900px 700px at 90% 0%, rgba(78, 171, 63, 0.16), transparent 62%),
            radial-gradient(900px 700px at 50% 110%, rgba(18, 89, 50, 0.34), transparent 58%),
            linear-gradient(180deg, var(--wb-bg-0), var(--wb-bg-1));
          overscroll-behavior-y: none;
        }

        .wb-page {
          position: relative;
          z-index: 2;
        }

        .wb-wrap {
          max-width: 520px;
          margin: 0 auto;
          padding-left: 14px;
          padding-right: 14px;
        }

        .wb-snow {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.9;
          filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.07));
        }

        .wb-garland {
          position: fixed;
          left: 0;
          top: 0;
          width: 100%;
          z-index: 6;
          pointer-events: none;
        }

        .lightrope {
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          margin: -14px 0 0 0;
          padding: 0;
          width: 100%;
          transform: translateZ(0);
          filter: drop-shadow(0 12px 22px rgba(0, 0, 0, 0.35));
        }

        .lightrope li {
          position: relative;
          list-style: none;
          margin: 20px;
          padding: 0;
          display: inline-block;
          width: 12px;
          height: 28px;
          border-radius: 50%;
          background: rgba(0, 247, 165, 1);
          box-shadow: 0px 4.6667px 24px 3px rgba(0, 247, 165, 1);
          animation-name: flash-1;
          animation-duration: 2s;
          animation-iteration-count: infinite;
          animation-fill-mode: both;
          transform: translateZ(0);
        }

        .lightrope li:nth-child(2n + 1) {
          background: rgba(0, 255, 255, 1);
          box-shadow: 0px 4.6667px 24px 3px rgba(0, 255, 255, 0.5);
          animation-name: flash-2;
          animation-duration: 0.4s;
        }

        .lightrope li:nth-child(4n + 2) {
          background: rgba(247, 0, 148, 1);
          box-shadow: 0px 4.6667px 24px 3px rgba(247, 0, 148, 1);
          animation-name: flash-3;
          animation-duration: 1.1s;
        }

        .lightrope li:nth-child(odd) {
          animation-duration: 1.8s;
        }

        .lightrope li:nth-child(3n + 1) {
          animation-duration: 1.4s;
        }

        .lightrope li:before {
          content: "";
          position: absolute;
          background: #222;
          width: 10px;
          height: 9.3333px;
          border-radius: 3px;
          top: -4.6667px;
          left: 1px;
        }

        .lightrope li:after {
          content: "";
          top: -14px;
          left: 9px;
          position: absolute;
          width: 52px;
          height: 18.6667px;
          border-bottom: solid #222 2px;
          border-radius: 50%;
          opacity: 0.9;
        }

        .lightrope li:last-child:after {
          content: none;
        }

        .lightrope li:first-child {
          margin-left: -40px;
        }

        @keyframes flash-1 {
          0%,
          100% {
            background: rgba(0, 247, 165, 1);
            box-shadow: 0px 4.6667px 24px 3px rgba(0, 247, 165, 1);
          }
          50% {
            background: rgba(0, 247, 165, 0.4);
            box-shadow: 0px 4.6667px 24px 3px rgba(0, 247, 165, 0.2);
          }
        }
        @keyframes flash-2 {
          0%,
          100% {
            background: rgba(0, 255, 255, 1);
            box-shadow: 0px 4.6667px 24px 3px rgba(0, 255, 255, 1);
          }
          50% {
            background: rgba(0, 255, 255, 0.4);
            box-shadow: 0px 4.6667px 24px 3px rgba(0, 255, 255, 0.2);
          }
        }
        @keyframes flash-3 {
          0%,
          100% {
            background: rgba(247, 0, 148, 1);
            box-shadow: 0px 4.6667px 24px 3px rgba(247, 0, 148, 1);
          }
          50% {
            background: rgba(247, 0, 148, 0.4);
            box-shadow: 0px 4.6667px 24px 3px rgba(247, 0, 148, 0.2);
          }
        }

        .wb-hero {
          position: relative;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: radial-gradient(900px 260px at 20% 0%, rgba(82, 209, 106, 0.26), transparent 60%),
            radial-gradient(900px 260px at 90% 0%, rgba(78, 171, 63, 0.18), transparent 62%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.05));
          box-shadow: var(--wb-shadow);
          overflow: hidden;
          padding: 18px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transform: translateZ(0);
        }

        .wb-hero-top {
          display: flex;
          gap: 14px;
          justify-content: space-between;
          align-items: flex-start;
        }

        .wb-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          padding: 6px 10px;
          border-radius: 999px;
          width: fit-content;
        }

        .wb-h1 {
          margin-top: 10px;
          font-size: 22px;
          line-height: 1.15;
          color: var(--wb-ink);
          letter-spacing: 0.2px;
          text-shadow: 0 14px 34px rgba(0, 0, 0, 0.35);
        }

        .wb-p {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.35;
          color: var(--wb-muted);
          max-width: 320px;
        }

        .wb-hero-badges {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: flex-end;
          min-width: 112px;
        }

        .wb-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.88);
          font-size: 12px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .wb-badge-soft {
          background: rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.78);
        }

        .wb-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--p-3);
          box-shadow: 0 0 0 6px rgba(82, 209, 106, 0.12);
        }

        .wb-hero-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 14px;
        }

        .wb-mini {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.05));
          box-shadow: var(--wb-shadow2);
          padding: 12px 12px 11px;
        }

        .wb-mini-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.70);
        }

        .wb-mini-value {
          margin-top: 6px;
          font-size: 20px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          letter-spacing: 0.2px;
        }

        .wb-hero-sheen {
          position: absolute;
          inset: -40%;
          background: linear-gradient(120deg, transparent 35%, rgba(255, 255, 255, 0.10), transparent 62%);
          transform: translateX(-50%) rotate(10deg);
          animation: wb-sheen 5.4s ease-in-out infinite;
          pointer-events: none;
          will-change: transform;
        }

        @keyframes wb-sheen {
          0% {
            transform: translateX(-55%) rotate(10deg);
          }
          50% {
            transform: translateX(55%) rotate(10deg);
          }
          100% {
            transform: translateX(55%) rotate(10deg);
          }
        }

        .wb-section-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 2px;
        }

        .wb-h2 {
          color: rgba(255, 255, 255, 0.92);
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .wb-pill {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          padding: 6px 10px;
          border-radius: 999px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .wb-pill-soft {
          color: rgba(255, 255, 255, 0.78);
          background: rgba(255, 255, 255, 0.04);
        }

        .wb-actions {
          display: grid;
          gap: 10px;
          margin-top: 10px;
        }

        .wb-primary {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: var(--wb-shadow);
          padding: 14px 14px;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
          transform: translateZ(0);
          transition: transform 140ms ease, filter 140ms ease;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .wb-primary:active {
          transform: scale(0.988);
          filter: brightness(0.99);
        }

        .wb-primary-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .wb-primary-icon {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
          flex: 0 0 auto;
        }

        .wb-svg {
          width: 22px;
          height: 22px;
          color: rgba(255, 255, 255, 0.95);
        }

        .wb-primary-text {
          min-width: 0;
        }

        .wb-primary-title {
          font-size: 16px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.95);
          line-height: 1.1;
        }

        .wb-primary-sub {
          margin-top: 3px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.68);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 240px;
        }

        .wb-primary-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 8px 10px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
        }

        .wb-cta {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.90);
          font-weight: 700;
        }

        .wb-chevron {
          font-size: 18px;
          line-height: 1;
          color: rgba(255, 255, 255, 0.90);
          transform: translateY(-1px);
        }

        .wb-primary-shine {
          position: absolute;
          inset: -40%;
          background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.10), transparent 62%);
          transform: translateX(-55%) rotate(10deg);
          animation: wb-shine 4.6s ease-in-out infinite;
          pointer-events: none;
          will-change: transform;
        }

        @keyframes wb-shine {
          0% {
            transform: translateX(-55%) rotate(10deg);
          }
          45% {
            transform: translateX(55%) rotate(10deg);
          }
          100% {
            transform: translateX(55%) rotate(10deg);
          }
        }

        .wb-primary-dep {
          background: radial-gradient(900px 240px at 20% 0%, rgba(82, 209, 106, 0.30), transparent 62%),
            linear-gradient(135deg, rgba(78, 171, 63, 0.64), rgba(18, 89, 50, 0.52));
        }

        .wb-primary-wdr {
          background: radial-gradient(900px 240px at 20% 0%, rgba(158, 209, 168, 0.22), transparent 62%),
            linear-gradient(135deg, rgba(18, 89, 50, 0.62), rgba(7, 21, 13, 0.52));
        }

        .wb-list {
          margin-top: 10px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: var(--wb-shadow2);
          overflow: hidden;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .wb-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.10);
          -webkit-tap-highlight-color: transparent;
          transition: transform 140ms ease, background 140ms ease;
        }

        .wb-row:last-child {
          border-bottom: none;
        }

        .wb-row:active {
          transform: scale(0.992);
          background: rgba(255, 255, 255, 0.05);
        }

        .wb-row-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .wb-row-icon {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.20);
          flex: 0 0 auto;
          color: rgba(255, 255, 255, 0.90);
        }

        .wb-row-svg {
          width: 20px;
          height: 20px;
        }

        .wb-i-green {
          background: radial-gradient(120px 80px at 35% 0%, rgba(82, 209, 106, 0.22), rgba(255, 255, 255, 0.04));
        }
        .wb-i-blue {
          background: radial-gradient(120px 80px at 35% 0%, rgba(120, 200, 255, 0.18), rgba(255, 255, 255, 0.04));
        }
        .wb-i-purple {
          background: radial-gradient(120px 80px at 35% 0%, rgba(190, 150, 255, 0.18), rgba(255, 255, 255, 0.04));
        }
        .wb-i-orange {
          background: radial-gradient(120px 80px at 35% 0%, rgba(255, 190, 120, 0.18), rgba(255, 255, 255, 0.04));
        }

        .wb-row-text {
          min-width: 0;
        }

        .wb-row-title {
          font-size: 14px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.92);
          line-height: 1.15;
        }

        .wb-row-sub {
          margin-top: 3px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.60);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 260px;
        }

        .wb-row-arrow {
          font-size: 20px;
          color: rgba(255, 255, 255, 0.70);
          line-height: 1;
          padding-left: 10px;
        }

        .lux-card {
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: radial-gradient(900px 260px at 20% 0%, rgba(235, 183, 1, 0.10), transparent 60%),
            radial-gradient(900px 260px at 90% 0%, rgba(82, 209, 106, 0.16), transparent 62%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.05));
          box-shadow: var(--wb-shadow);
          overflow: hidden;
          padding: 16px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .lux-head {
          display: flex;
          gap: 12px;
          justify-content: space-between;
          align-items: flex-start;
        }

        .lux-brand {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0.2px;
          color: rgba(255, 255, 255, 0.96);
        }

        .lux-sub {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.70);
        }

        .lux-balance {
          text-align: right;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          padding: 10px 10px;
          min-width: 150px;
        }

        .lux-balance-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.70);
        }

        .lux-balance-val {
          margin-top: 4px;
          font-size: 14px;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.96);
          letter-spacing: 0.2px;
          white-space: nowrap;
        }

        .lux-token {
          color: rgba(235, 183, 1, 0.95);
          font-weight: 900;
        }

        .lux-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .lux-chip {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          padding: 6px 10px;
          border-radius: 999px;
        }

        .lux-chip-soft {
          color: rgba(255, 255, 255, 0.78);
          background: rgba(255, 255, 255, 0.04);
        }

        .lux-reels {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-top: 14px;
          position: relative;
          padding-bottom: 6px;
        }

        .lux-line {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 2px;
          background: rgba(255, 255, 255, 0.16);
          transform: translateY(-1px);
          pointer-events: none;
        }

        .lux-reel {
          height: 150px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.16));
          box-shadow: 0px 14px 15px -5px rgba(0, 0, 0, 0.30) inset, 1px -14px 15px -5px rgba(0, 0, 0, 0.30) inset;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 0;
        }

        .lux-reel::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.4), transparent);
          z-index: 2;
          pointer-events: none;
        }

        .lux-reel::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: linear-gradient(0deg, rgba(0, 0, 0, 0.4), transparent);
          z-index: 2;
          pointer-events: none;
        }

        .lux-reel-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: transform 0.1s linear;
          will-change: transform;
          position: relative;
          z-index: 1;
          /* Начальная позиция: символ с индексом 20 в центре (20 * 50 - 75 = 925px) */
          transform: translateY(925px);
        }

        .lux-reel-spinning .lux-reel-container {
          animation: lux-reel-spin var(--spin-duration, 2000ms) cubic-bezier(0.17, 0.67, 0.12, 0.99) forwards;
          animation-fill-mode: forwards;
        }

        @keyframes lux-reel-spin {
          0% {
            transform: translateY(var(--start-position, -2000px)) !important;
          }
          100% {
            transform: translateY(var(--target-position, 0px)) !important;
          }
        }

        .lux-symbol {
          font-size: 48px;
          line-height: 1;
          height: 50px;
          min-height: 50px;
          display: grid;
          place-items: center;
          opacity: 0.9;
          filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.30));
          flex-shrink: 0;
        }

        .lux-controls {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 14px;
        }

        .lux-btn {
          height: 46px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: linear-gradient(135deg, rgba(235, 183, 1, 0.22), rgba(82, 209, 106, 0.14));
          color: rgba(255, 255, 255, 0.95);
          font-weight: 900;
          letter-spacing: 0.4px;
          box-shadow: var(--wb-shadow2);
          -webkit-tap-highlight-color: transparent;
          transition: transform 140ms ease, filter 140ms ease;
        }

        .lux-btn:active {
          transform: scale(0.988);
          filter: brightness(0.99);
        }

        .lux-btn-ghost {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.88);
        }

        .lux-message {
          margin-top: 12px;
          text-align: center;
          font-size: 14px;
          font-weight: 800;
          color: rgba(235, 183, 1, 0.95);
          min-height: 20px;
        }

        @media (prefers-reduced-motion: reduce) {
          .lightrope li,
          .wb-hero-sheen,
          .wb-primary-shine {
            animation: none !important;
          }
          .wb-primary,
          .wb-row,
          .lux-btn {
            transition: none !important;
          }
        }
      `}</style>
    </main>
  )
}
