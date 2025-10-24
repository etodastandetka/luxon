"use client"

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000, 10000]

export default function QuickAmounts({ onPick, selected }: { onPick: (value: string) => void; selected?: string }) {
  return (
    <div className="space-y-2">
      <label className="label text-sm">Быстрый выбор</label>
      <div className="grid grid-cols-3 gap-2">
        {QUICK_AMOUNTS.map(amount => (
          <button 
            key={amount} 
            className={`btn transition-all duration-200 text-sm ${
              selected === amount.toFixed(2)
                ? 'btn-primary' 
                : 'btn-ghost hover:btn-primary'
            }`}
            onClick={() => onPick(amount.toString())}
          >
            {amount.toLocaleString()} сом
          </button>
        ))}
      </div>
    </div>
  )
}