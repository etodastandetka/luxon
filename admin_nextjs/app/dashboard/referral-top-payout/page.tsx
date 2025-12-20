"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PayoutResult {
  userId: string
  username: string | null
  rank: number
  amount: number
  accountId: string | null
  bookmaker: string | null
  success: boolean
}

interface PayoutError {
  userId: string
  username: string | null
  rank: number
  error: string
}

export default function ReferralTopPayoutPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PayoutResult[]>([])
  const [errors, setErrors] = useState<PayoutError[]>([])
  const [showConfirm, setShowConfirm] = useState(false)

  const handlePayout = async () => {
    if (!confirm('Выполнить выплату топ-5 рефералам?\n\n1 место: 10 000 сом\n2 место: 5 000 сом\n3 место: 2 500 сом\n4 место: 1 500 сом\n5 место: 1 000 сом')) {
      return
    }

    try {
      setLoading(true)
      setResults([])
      setErrors([])
      
      const response = await fetch('/api/referral/top-payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (data.success) {
        if (data.results) {
          setResults(data.results)
        }
        if (data.errors) {
          setErrors(data.errors)
        }
        alert(`Баланс добавлен!\n\nУспешно: ${data.results?.length || 0}\nОшибок: ${data.errors?.length || 0}\n\nТеперь топ-рефералы могут создать заявку на вывод через реферальную страницу.`)
      } else {
        alert(`Ошибка: ${data.error || 'Не удалось выполнить выплату'}`)
      }
    } catch (error: any) {
      console.error('Error processing top payout:', error)
      alert(`Ошибка: ${error.message || 'Не удалось выполнить выплату'}`)
    } finally {
      setLoading(false)
    }
  }

  const prizeAmounts = [10000, 5000, 2500, 1500, 1000]

  return (
    <div className="py-4 px-4 space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-10">
          <button
            onClick={() => router.push('/dashboard/menu')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-white">Выплата топ-рефералам</h1>
        </div>
        <div className="w-10"></div>
      </div>

      {/* Информация о призах */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h2 className="text-white font-semibold mb-3">🏆 Призы топ-5 рефералов:</h2>
        <div className="space-y-2">
          {prizeAmounts.map((prize, index) => (
            <div key={index} className="flex items-center justify-between text-white/70">
              <span>{index + 1} место:</span>
              <span className="font-semibold text-green-400">{prize.toLocaleString()} сом</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between text-white">
            <span className="font-semibold">Всего:</span>
            <span className="font-bold text-green-400">
              {prizeAmounts.reduce((sum, p) => sum + p, 0).toLocaleString()} сом
            </span>
          </div>
        </div>
      </div>

      {/* Кнопка выплаты */}
      <button
        onClick={handlePayout}
        disabled={loading}
        className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
          loading
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
        }`}
      >
        {loading ? 'Выполняется выплата...' : 'Выплатить топ-5 рефералам'}
      </button>

      {/* Результаты */}
      {results.length > 0 && (
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
          <h3 className="text-green-400 font-semibold mb-3">✅ Успешно добавлен баланс ({results.length}):</h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div key={index} className="text-white/80 text-sm">
                <span className="font-semibold">{result.rank} место:</span> {result.username || `ID: ${result.userId}`} - {result.amount.toLocaleString()} сом
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-green-500/30">
            <p className="text-green-400/80 text-xs">
              💡 Теперь они могут создать заявку на вывод этих средств через реферальную страницу.
            </p>
          </div>
        </div>
      )}

      {/* Ошибки */}
      {errors.length > 0 && (
        <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
          <h3 className="text-red-400 font-semibold mb-3">❌ Ошибки ({errors.length}):</h3>
          <div className="space-y-2">
            {errors.map((error, index) => (
              <div key={index} className="text-white/80 text-sm">
                <span className="font-semibold">{error.rank} место:</span> {error.username || `ID: ${error.userId}`} - {error.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Информация */}
      <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
        <p className="text-blue-400 text-sm">
          💡 Деньги будут добавлены на баланс рефералов в системе. После этого они смогут создать заявку на вывод, и вы подтвердите её для пополнения баланса в казино.
        </p>
      </div>
    </div>
  )
}

