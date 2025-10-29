"use client"
import { useState } from 'react'
import Image from 'next/image'

type Item = { key: string; name: string; logo?: string; emoji?: string }

const BOOKMAKERS: Item[] = [
  { key: '1xbet', name: '1XBET', emoji: '🎯', logo: '/images/1xbet.jpg' },
  { key: '1win', name: '1WIN', emoji: '🏆', logo: '/images/1win.jpg' },
  { key: 'melbet', name: 'MELBET', emoji: '🎲', logo: '/images/melbet.jpg' },
  { key: 'mostbet', name: 'MOSTBET', emoji: '🎯', logo: '/images/mostbet.jpg' },
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

  const handleClick = (key: string) => {
    // Проверяем, отключено ли казино
    if (disabledCasinos && disabledCasinos.includes(key)) {
      setShowModal(key)
      return
    }
    onChange(key)
  }

  const getCasinoName = (key: string) => {
    const casino = BOOKMAKERS.find(b => b.key === key)
    return casino?.name || key.toUpperCase()
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {BOOKMAKERS.map(b => {
          const isDisabled = disabledCasinos && disabledCasinos.includes(b.key)
          return (
            <button 
              key={b.key}
              onClick={() => handleClick(b.key)}
              className={`relative overflow-hidden rounded-xl transition-all duration-200 h-32 ${
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
