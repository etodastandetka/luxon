"use client"
import Image from 'next/image'

type Item = { key: string; name: string; logo?: string; emoji?: string }

const BOOKMAKERS: Item[] = [
  { key: '1xbet', name: '1XBET', emoji: '🎯', logo: '/images/1xbet.jpg' },
  { key: '1win', name: '1WIN', emoji: '🏆', logo: '/images/1win.jpg' },
  { key: 'melbet', name: 'MELBET', emoji: '🎲', logo: '/images/melbet.jpg' },
  { key: 'mostbet', name: 'MOSTBET', emoji: '🎯', logo: '/images/mostbet.jpg' },
]

export default function BookmakerGrid({ value, onChange }:{ value?: string; onChange:(k:string)=>void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {BOOKMAKERS.map(b => (
        <button 
          key={b.key}
          onClick={() => onChange(b.key)}
          className={`relative overflow-hidden rounded-xl transition-all duration-200 hover:scale-105 h-32 ${
            value === b.key 
              ? 'ring-2 ring-green-400' 
              : 'hover:ring-1 hover:ring-white/20'
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
        </button>
      ))}
    </div>
  )
}
