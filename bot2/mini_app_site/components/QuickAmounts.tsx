"use client"
import { memo, useCallback } from 'react'
import { throttle } from '../utils/debounce'

const QUICK_AMOUNTS_KGS = [100, 500, 1000, 2000, 5000, 10000]
// Для крипты используем суммы в долларах (примерно эквивалентные сомам)
const QUICK_AMOUNTS_USD = [1, 5, 10, 20, 50, 100]

function QuickAmounts({ 
  onPick, 
  selected, 
  currency = 'kgs' 
}: { 
  onPick: (value: string) => void
  selected?: string
  currency?: 'kgs' | 'usd'
}) {
  const amounts = currency === 'usd' ? QUICK_AMOUNTS_USD : QUICK_AMOUNTS_KGS
  const currencySymbol = currency === 'usd' ? '$' : ''
  const currencyText = currency === 'usd' ? 'долл.' : 'сом'

  const handlePick = useCallback((amount: number) => {
    onPick(amount.toString())
  }, [onPick])

  const throttledHandlePick = useCallback(
    throttle(handlePick, 200),
    [handlePick]
  )

  return (
    <div className="space-y-2">
      <label className="label text-sm">Быстрый выбор</label>
      <div className="grid grid-cols-3 gap-2">
        {amounts.map(amount => {
          const isSelected = selected && parseFloat(selected) === amount
          return (
            <button 
              key={amount} 
              className={`btn transition-transform duration-150 text-sm ${
                isSelected
                  ? 'btn-primary' 
                  : 'btn-ghost hover:btn-primary'
              }`}
              onClick={() => throttledHandlePick(amount)}
              style={{ willChange: 'transform' }}
            >
              {currencySymbol}{amount.toLocaleString()} {currencyText}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default memo(QuickAmounts)