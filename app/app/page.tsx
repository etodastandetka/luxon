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


export default function HomePage() {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [userStats, setUserStats] = useState<{ deposits: number; withdraws: number } | null>(null)
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false)
  const { language } = useLanguage()
  const { settings, loading: settingsLoading } = useBotSettings()

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

  const { transactions, loading: transactionsLoading } = useHomePageData()

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

  // Обновляем статистику при загрузке транзакций
  useEffect(() => {
    // Если транзакции загружены (не loading), обновляем статистику
    if (!transactionsLoading) {
      setUserStats(computedStats)
    }
  }, [computedStats, transactionsLoading])

  // Принудительно обновляем статистику при изменении пользователя
  useEffect(() => {
    if (user && !transactionsLoading) {
      setUserStats(computedStats)
    }
  }, [user?.id, transactionsLoading, computedStats])

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
  
  // Проверяем паузу
  const isPaused = (settings as any)?.pause === true
  const maintenanceMessage = (settings as any)?.maintenance_message || 'Технические работы. Попробуйте позже.'

  // Если пауза включена, показываем сообщение
  if (ready && isPaused) {
    return (
      <main className="wb-page wb-ready" style={{ paddingTop: "0.5rem", paddingBottom: "110px" }}>
        <HolidayEffects />
        <FixedHeaderControls />
        <div className="wb-wrap space-y-6" style={{ padding: "2rem 1rem" }}>
          <div className="card text-center bg-orange-900/20 border-orange-500" style={{ padding: "2rem" }}>
            <div className="text-orange-300 text-2xl font-semibold mb-4">
              ⏸️ {language === "en" ? "Service Paused" : "Бот на паузе"}
            </div>
            <p className="text-white/80 text-lg">
              {maintenanceMessage}
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={`wb-page ${ready ? "wb-ready" : "wb-loading"}`} style={{ paddingTop: "0.5rem", paddingBottom: "110px" }}>
      <HolidayEffects />
      <FixedHeaderControls />

      <div className="wb-wrap space-y-6">
        {/* Показываем виджет входа только если НЕ в Telegram Mini App (для обычного сайта) */}
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


        @media (prefers-reduced-motion: reduce) {
          .lightrope li,
          .wb-hero-sheen,
          .wb-primary-shine {
            animation: none !important;
          }
          .wb-primary,
          .wb-row,
        }
      `}</style>
    </main>
  )
}
