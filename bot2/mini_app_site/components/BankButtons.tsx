"use client"

type Bank = { code: string; name: string; emoji?: string; image?: string }
const BANKS: Bank[] = [
  { code: 'demirbank', name: 'DemirBank', emoji: '🏦', image: '/images/demirbank.jpg' },
  { code: 'omoney', name: 'O!Money', emoji: '🟡', image: '/images/omoney.jpg' },
  { code: 'balance', name: 'Balance.kg', emoji: '⚖️', image: '/images/balance.jpg' },
  { code: 'bakai', name: 'Bakai', emoji: '🏪', image: '/images/bakai.jpg' },
  { code: 'megapay', name: 'MegaPay', emoji: '💳', image: '/images/megapay.jpg' },
  { code: 'mbank', name: 'MBank', emoji: '📱', image: '/images/mbank.png' },
  { code: 'optima', name: 'Optima', emoji: '💎', image: '/images/optima.jpg' },
  { code: 'kompanion', name: 'Kompanion', emoji: '🤝', image: '/images/companion.png' },
]

export default function BankButtons({ onPick, selected, disabled, paymentUrl, allBankUrls, enabledBanks }: { 
  onPick: (code: string) => void; 
  selected?: string; 
  disabled?: boolean;
  paymentUrl?: string;
  allBankUrls?: Record<string, string>;
  enabledBanks?: string[];
}) {
  const handleBankClick = (bankCode: string) => {
    // Сначала выбираем банк
    onPick(bankCode)
    
    // Определяем ссылку для банка
    let bankUrl = paymentUrl // По умолчанию используем общую ссылку
    
    if (allBankUrls) {
      // Маппинг кодов банков на названия в API
      const bankMapping: Record<string, string> = {
        'demirbank': 'DemirBank',
        'omoney': 'O! bank',
        'balance': 'Balance.kg',
        'bakai': 'Bakai',
        'megapay': 'MegaPay',
        'mbank': 'MBank',
        'kompanion': 'Компаньон'
      }
      
      const apiBankName = bankMapping[bankCode]
      if (apiBankName && allBankUrls[apiBankName]) {
        bankUrl = allBankUrls[apiBankName]
      }
    }
    
    // Если есть ссылка для оплаты, открываем её
    if (bankUrl) {
      window.open(bankUrl, '_blank')
    }
  }

  // Фильтруем банки согласно настройкам
  const bankMapping: Record<string, string> = {
    'demirbank': 'demir',
    'omoney': 'omoney',
    'balance': 'balance',
    'bakai': 'bakai',
    'megapay': 'megapay',
    'mbank': 'mbank',
    'kompanion': 'kompanion'
  }

  const filteredBanks = BANKS.filter(bank => {
    if (!enabledBanks || enabledBanks.length === 0) return true
    const bankKey = bankMapping[bank.code]
    return enabledBanks.includes(bankKey)
  })

  return (
    <div className="grid grid-cols-2 gap-1">
      {filteredBanks.map(b => (
        <button 
          key={b.code} 
          className={`btn transition-all duration-200 text-sm flex items-center justify-center gap-3 py-3 px-4 h-16 ${
            selected === b.code 
              ? 'btn-primary' 
              : 'btn-ghost'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:btn-primary'}`}
          onClick={() => !disabled && handleBankClick(b.code)}
          disabled={disabled}
        >
          {b.image ? (
            <img 
              src={b.image} 
              alt={b.name}
              className="w-8 h-8 object-contain rounded"
            />
          ) : (
            <span className="mr-1 text-xl">{b.emoji}</span>
          )}
          <span className="truncate">{b.name}</span>
        </button>
      ))}
    </div>
  )
}