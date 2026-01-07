'use client'

import { useRouter } from 'next/navigation'
import FixedHeaderControls from './components/FixedHeaderControls'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-950 to-green-900 flex flex-col items-center justify-center p-4">
      <FixedHeaderControls />
      <div className="text-center space-y-6 max-w-md">
        <div className="text-8xl font-bold text-white/20">404</div>
        <h1 className="text-2xl font-bold text-white">Страница не найдена</h1>
        <p className="text-white/70">
          К сожалению, запрашиваемая страница не существует или была перемещена.
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-colors shadow-lg"
        >
          Вернуться на главную
        </button>
      </div>
    </div>
  )
}

