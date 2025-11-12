"use client"
import { useState, useEffect } from 'react'
import Image from 'next/image'

type Item = { key: string; name: string; logo?: string; emoji?: string }

const ALL_BOOKMAKERS: Item[] = [
  { key: '1xbet', name: '1XBET', emoji: '🎯', logo: '/images/1xbet.jpg' },
  { key: '1win', name: '1WIN', emoji: '🏆', logo: '/images/1win.jpg' },
  { key: 'melbet', name: 'MELBET', emoji: '🎲', logo: '/images/melbet.jpg' },
  { key: 'mostbet', name: 'MOSTBET', emoji: '🎯', logo: '/images/mostbet.jpg' },
  { key: 'winwin', name: 'WINWIN', emoji: '🎰', logo: '/images/winwin.png' },
  { key: '888starz', name: '888STARZ', emoji: '⭐', logo: '/images/888starz.jpg' },
]

export default function BookmakerGrid({ 
  value, 
  onChange,
  disabledCasinos 
}: { 
  value?: string
  onChange: (k: string) => void
  disabledCasinos?: string[]
}) {
  const [showModal, setShowModal] = useState<string | null>(null)
  const [bookmakers, setBookmakers] = useState<Item[]>(ALL_BOOKMAKERS)

  // Проверяем, является ли это ботом только для 1xbet
  useEffect(() => {
    // Проверяем параметр в URL (если бот передает ?bot=1xbet)
    const urlParams = new URLSearchParams(window.location.search)
    const botTypeFromUrl = urlParams.get('bot')
    
    // Также проверяем Telegram WebApp для определения типа бота
    const tg = (window as any).Telegram?.WebApp
    let botTypeFromTelegram: string | null = null
    
    // Пытаемся определить тип бота из Telegram WebApp
    if (tg?.initDataUnsafe?.start_param) {
      // start_param может содержать тип бота
      const startParam = tg.initDataUnsafe.start_param
      if (startParam.includes('1xbet') || startParam === '1xbet') {
        botTypeFromTelegram = '1xbet'
      }
    }
    
    // Приоритет: URL параметр > Telegram start_param > localStorage (только для очистки)
    const botType = botTypeFromUrl || botTypeFromTelegram
    
    // Если определен тип бота как 1xbet, показываем только 1xbet
    if (botType === '1xbet') {
      // Сохраняем в localStorage для последующих переходов
      localStorage.setItem('bot_type', '1xbet')
      
      setBookmakers([{ key: '1xbet', name: '1XBET', emoji: '🎯', logo: '/images/1xbet.jpg' }])
      // Автоматически выбираем 1xbet, если еще не выбран
      if (!value || value !== '1xbet') {
        onChange('1xbet')
      }
    } else {
      // Если не определен тип бота как 1xbet - показываем все казино
      // Это основной бот со всеми казино
      setBookmakers(ALL_BOOKMAKERS)
      // Очищаем сохраненный тип бота, чтобы не показывать только 1xbet
      localStorage.removeItem('bot_type')
    }
  }, [value, onChange])

  const handleClick = (key: string) => {
    // Проверяем, отключено ли казино
    if (disabledCasinos && disabledCasinos.includes(key)) {
      setShowModal(key)
      return
    }
    onChange(key)
  }

  const getCasinoName = (key: string) => {
    const casino = bookmakers.find(b => b.key === key) || ALL_BOOKMAKERS.find(b => b.key === key)
    return casino?.name || key.toUpperCase()
  }

  // Определяем количество колонок: если букмекер один - на всю ширину, иначе 2 колонки
  const gridCols = bookmakers.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
  // Высота карточки: если букмекер один - больше, иначе стандартная
  const cardHeight = bookmakers.length === 1 ? 'h-48' : 'h-32'

  return (
    <>
      <div className={`grid ${gridCols} gap-3`}>
        {bookmakers.map(b => {
          const isDisabled = disabledCasinos && disabledCasinos.includes(b.key)
          return (
            <button 
              key={b.key}
              onClick={() => handleClick(b.key)}
              className={`relative overflow-hidden rounded-xl transition-all duration-200 ${cardHeight} ${
                value === b.key 
                  ? 'ring-2 ring-green-400' 
                  : isDisabled
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:scale-105 hover:ring-1 hover:ring-white/20'
              }`}
            >
              {b.logo ? (
                <Image 
                  src={b.logo} 
                  alt={b.name}
                  fill
                  className={b.key === '1xbet' ? "object-cover transform scale-150" : "object-cover"}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/30">
                  <div className="text-4xl">{b.emoji}</div>
                </div>
              )}
              {isDisabled && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white/70 text-xs">Недоступно</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Модальное окно для отключенных казино */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowModal(null)}
        >
          <div 
            className="bg-gray-900 rounded-xl p-6 max-w-sm mx-4 border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-4">
              <div className="text-orange-300 text-2xl mb-2">🔧</div>
              <h3 className="text-xl font-bold text-white">Технические работы</h3>
              <p className="text-white/70">
                В данный момент ведутся технические работы с {getCasinoName(showModal)}. 
                Попробуйте позже или выберите другое казино.
              </p>
              <button
                onClick={() => setShowModal(null)}
                className="btn btn-primary w-full mt-4"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
