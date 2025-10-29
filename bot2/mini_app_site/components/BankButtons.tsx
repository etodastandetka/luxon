"use client"

type Bank = { code: string; name: string; emoji?: string; image?: string }
const BANKS: Bank[] = [
  { code: 'demirbank', name: 'DemirBank', emoji: '🏦', image: '/images/demirbank.jpg' },
  { code: 'omoney', name: 'O!Money', emoji: '🟡', image: '/images/omoney.jpg' },
  { code: 'balance', name: 'Balance.kg', emoji: '⚖️', image: '/images/balance.jpg' },
  { code: 'bakai', name: 'Bakai', emoji: '🏪', image: '/images/bakai.jpg' },
  { code: 'megapay', name: 'MegaPay', emoji: '💳', image: '/images/megapay.jpg' },
  { code: 'mbank', name: 'MBank', emoji: '📱', image: '/images/mbank.png' },
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
    
    console.log('🏦 Bank clicked:', bankCode)
    console.log('📦 All bank URLs:', allBankUrls)
    console.log('🔗 Default payment URL:', paymentUrl)
    
    if (allBankUrls) {
      // Маппинг кодов банков на названия в API
      const bankMapping: Record<string, string> = {
        'demirbank': 'DemirBank',
        'omoney': 'O!Money',
        'balance': 'Balance.kg',
        'bakai': 'Bakai',
        'megapay': 'MegaPay',
        'mbank': 'MBank'
      }
      
      const apiBankName = bankMapping[bankCode]
      console.log('🔍 Looking for bank:', apiBankName)
      
      if (apiBankName && allBankUrls[apiBankName]) {
        bankUrl = allBankUrls[apiBankName]
        console.log('✅ Found bank URL:', bankUrl)
      } else {
        console.warn('⚠️ Bank URL not found for:', apiBankName)
      }
    }
    
    // Если есть ссылка для оплаты, открываем её
    if (bankUrl) {
      console.log('🚀 Opening URL:', bankUrl)
      // Используем Telegram WebApp API для открытия ссылки вне мини-приложения
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        console.log('✅ Opening with Telegram WebApp API')
        window.Telegram.WebApp.openLink(bankUrl)
      } else {
        console.log('⚠️ Telegram WebApp not available, using fallback')
        window.open(bankUrl, '_blank')
      }
    } else {
      console.error('❌ No payment URL available!')
    }
  }

  // Фильтруем банки согласно настройкам
  // Маппинг: код банка в компоненте -> код банка в настройках админки
  const bankMappingToAdmin: Record<string, string> = {
    'demirbank': 'demir',
    'omoney': 'omoney',
    'balance': 'balance',
    'bakai': 'bakai',
    'megapay': 'megapay',
    'mbank': 'mbank',
    'kompanion': 'kompanion' // Для выводов
  }
  
  // Обратный маппинг: код из админки -> код в компоненте
  const bankMappingFromAdmin: Record<string, string> = {
    'demir': 'demirbank',
    'demirbank': 'demirbank',
    'omoney': 'omoney',
    'balance': 'balance',
    'bakai': 'bakai',
    'megapay': 'megapay',
    'mbank': 'mbank',
    'kompanion': 'kompanion',
    'odengi': 'omoney' // O!Money для выводов
  }

  // Фильтруем банки согласно настройкам
  // Если enabledBanks не передан (undefined), показываем все банки
  // Если enabledBanks передан (даже пустой массив), фильтруем строго
  const filteredBanks = BANKS.filter(bank => {
    // Если enabledBanks не передан вообще - показываем все
    if (enabledBanks === undefined) {
      return true
    }
    
    // Если enabledBanks передан, даже пустой - фильтруем строго
    // Проверяем, есть ли банк в списке разрешенных (учитываем оба маппинга)
    const adminCode = bankMappingToAdmin[bank.code]
    const componentCode = bankMappingFromAdmin[bank.code] || bank.code
    
    return enabledBanks.includes(adminCode) || 
           enabledBanks.includes(componentCode) || 
           enabledBanks.includes(bank.code)
  })
  
  console.log('🏦 BankButtons - enabledBanks:', enabledBanks)
  console.log('🏦 BankButtons - filteredBanks:', filteredBanks.map(b => b.code))

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