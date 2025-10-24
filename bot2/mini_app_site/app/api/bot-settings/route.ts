import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Возвращаем настройки по умолчанию
    const settings = {
      success: true,
      data: {
        is_active: true,
        maintenance_message: '🔧 Технические работы\nБот временно недоступен. Попробуйте позже.',
        deposits_enabled: true,
        withdrawals_enabled: true,
        channel_subscription_required: false,
        channel_username: '',
        enabled_deposit_banks: ['mbank', 'bakai', 'balance', 'demir', 'omoney', 'megapay'],
        enabled_withdrawal_banks: ['kompanion', 'odengi', 'bakai', 'balance', 'megapay', 'mbank']
      }
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error in bot-settings API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Bot settings update:', body);
    
    // В демо режиме просто возвращаем успех
    return NextResponse.json({
      success: true,
      message: 'Настройки сохранены (демо режим)'
    });
  } catch (error) {
    console.error('Error saving bot settings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}