import { NextRequest, NextResponse } from 'next/server'

// Функция для получения настроек бота из Django API
async function getBotSettings(): Promise<any> {
  try {
    const response = await fetch(`${process.env.DJANGO_API_URL || 'http://localhost:8081'}/bot/api/get-bot-settings/`)
    if (response.ok) {
      const data = await response.json()
      return data
    }
  } catch (error) {
    console.error('Error fetching bot settings:', error)
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount } = body
    
    if (!amount) {
      return NextResponse.json({ 
        error: 'Amount is required' 
      }, { status: 400 })
    }

    // Получаем настройки бота
    const settings = await getBotSettings()
    if (!settings) {
      return NextResponse.json({ 
        error: 'Failed to load bot settings' 
      }, { status: 500 })
    }

    // Проверяем, включены ли депозиты
    if (!settings.deposits?.enabled) {
      return NextResponse.json({ 
        error: 'Deposits are currently disabled' 
      }, { status: 403 })
    }

    // Используем реквизит из админки (пока статический)
    const requisite = '1180000353932089'
    const amountCents = Math.round(parseFloat(amount) * 100)
    const amountStr = amountCents.toString().padStart(5, '0')
    
    // Генерируем QR хеш с реквизитом
    const qrHash = `00020101021232990015qr.demirbank.kg0108ib_andro10${requisite}1109202111302112021213021211328454d5b3ee5d47c7b61c0a0b07bb939a5204482953034175405${amountStr}5909DEMIRBANK63043dc9`
    
    // Фильтруем банки согласно настройкам
    const enabledBanks = settings.deposits?.banks || []
    const allBankUrls = {
      "DemirBank": `https://retail.demirbank.kg/#${qrHash}`,
      "MegaPay": `https://megapay.kg/get#${qrHash}`,
      "O! bank": `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
      "Компаньон": `https://pay.payqr.kg/#${qrHash}`,
      "Balance.kg": `https://balance.kg/#${qrHash}`,
      "Bakai": `https://bakai24.app/#${qrHash}`,
      "MBank": `https://app.mbank.kg/qr/#${qrHash}`,
    }

    // Фильтруем только разрешенные банки
    const filteredBankUrls: Record<string, string> = {}
    const bankMapping: Record<string, string> = {
      'DemirBank': 'demir',
      'MegaPay': 'megapay',
      'O! bank': 'omoney',
      'Компаньон': 'kompanion',
      'Balance.kg': 'balance',
      'Bakai': 'bakai',
      'MBank': 'mbank'
    }

    Object.entries(allBankUrls).forEach(([bankName, url]) => {
      const bankKey = bankMapping[bankName]
      if (enabledBanks.includes(bankKey)) {
        filteredBankUrls[bankName] = url
      }
    })

    return NextResponse.json({
      success: true,
      qr_hash: qrHash,
      primary_url: filteredBankUrls.DemirBank || Object.values(filteredBankUrls)[0],
      all_bank_urls: filteredBankUrls,
      amount: parseFloat(amount),
      bank: 'DEMIRBANK',
      requisite: requisite,
      settings: {
        deposits_enabled: settings.deposits?.enabled,
        enabled_banks: enabledBanks
      }
    })

  } catch (error) {
    console.error('Error generating QR:', error)
    return NextResponse.json({ 
      error: 'Failed to generate QR code',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const amount = searchParams.get('amount')
    
    if (!amount) {
      return NextResponse.json({ 
        error: 'Amount parameter is required' 
      }, { status: 400 })
    }

    // Используем реквизит из админки (пока статический)
    const requisite = '1180000353932089'
    const amountCents = Math.round(parseFloat(amount) * 100)
    const amountStr = amountCents.toString().padStart(5, '0')
    
    // Генерируем QR хеш с реквизитом
    const qrHash = `00020101021232990015qr.demirbank.kg0108ib_andro10${requisite}1109202111302112021213021211328454d5b3ee5d47c7b61c0a0b07bb939a5204482953034175405${amountStr}5909DEMIRBANK63043dc9`
    
    const allBankUrls = {
      "DemirBank": `https://retail.demirbank.kg/#${qrHash}`,
      "MegaPay": `https://megapay.kg/get#${qrHash}`,
      "O! bank": `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
      "Компаньон": `https://pay.payqr.kg/#${qrHash}`,
      "Balance.kg": `https://balance.kg/#${qrHash}`,
      "Bakai": `https://bakai24.app/#${qrHash}`,
      "MBank": `https://app.mbank.kg/qr/#${qrHash}`,
    }

    return NextResponse.json({
      success: true,
      qr_hash: qrHash,
      primary_url: allBankUrls.DemirBank,
      all_bank_urls: allBankUrls,
      amount: parseFloat(amount),
      bank: 'DEMIRBANK',
      requisite: requisite
    })

  } catch (error) {
    console.error('Error generating QR:', error)
    return NextResponse.json({ 
      error: 'Failed to generate QR code',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}