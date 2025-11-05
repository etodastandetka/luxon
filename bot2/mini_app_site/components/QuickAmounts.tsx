"use client"

const QUICK_AMOUNTS_KGS = [100, 500, 1000, 2000, 5000, 10000]
// Для крипты используем суммы в долларах (примерно эквивалентные сомам)
const QUICK_AMOUNTS_USD = [1, 5, 10, 20, 50, 100]

export default function QuickAmounts({ 
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

  return (
    <div className="space-y-2">
      <label className="label text-sm">Быстрый выбор</label>
      <div className="grid grid-cols-3 gap-2">
        {amounts.map(amount => {
          const isSelected = selected && parseFloat(selected) === amount
          return (
            <button 
              key={amount} 
              className={`btn transition-all duration-200 text-sm ${
                isSelected
                  ? 'btn-primary' 
                  : 'btn-ghost hover:btn-primary'
              }`}
              onClick={() => onPick(amount.toString())}
            >
              {currencySymbol}{amount.toLocaleString()} {currencyText}
            </button>
          )
        })}
      </div>
    </div>
  )
}