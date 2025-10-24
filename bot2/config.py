#!/usr/bin/env python3
"""
Конфигурация для бота v2
"""
import os
from typing import Dict, Any

# Токен бота
BOT_TOKEN = os.getenv("BOT_TOKEN", "7796879640:AAFKi7SFuqNJKUv8hapAYFeeJsFN3OCJF0Y")

# URL мини-приложения
MINI_APP_URL = os.getenv("MINI_APP_URL", "http://localhost:3030")

# Настройки базы данных
DATABASE_PATH = os.getenv("DATABASE_PATH", "bot2/bot_data.db")

# Букмекеры
BOOKMAKERS = {
    '1xbet': {
        'name': '1XBET',
        'emoji': '🎯',
        'enabled': True
    },
    '1win': {
        'name': '1WIN', 
        'emoji': '🏆',
        'enabled': True
    },
    'melbet': {
        'name': 'MELBET',
        'emoji': '🎲',
        'enabled': True
    },
    'mostbet': {
        'name': 'MOSTBET',
        'emoji': '🎯',
        'enabled': True
    }
}

# Банки (кыргызские) - как в старом боте
BANKS = {
    'demirbank': {
        'name': 'DemirBank',
        'emoji': '🏦',
        'enabled': True,
        'bank_code': 'DEMIRBANK',
        'url_template': 'https://retail.demirbank.kg/#{qr_hash}',
        'qr_generator': 'demirbank'
    },
    'odengi': {
        'name': 'O! bank',
        'emoji': '🟡',
        'enabled': True,
        'bank_code': 'ODENGI',
        'url_template': 'https://api.dengi.o.kg/ru/qr/#{qr_hash}',
        'qr_generator': 'generic'
    },
    'balance': {
        'name': 'Balance.kg',
        'emoji': '⚖️',
        'enabled': True,
        'bank_code': 'BALANCE',
        'url_template': 'https://balance.kg/#{qr_hash}',
        'qr_generator': 'generic'
    },
    'bakai': {
        'name': 'Bakai',
        'emoji': '🏪',
        'enabled': True,
        'bank_code': 'BAKAI',
        'url_template': 'https://bakai24.app/#{qr_hash}',
        'qr_generator': 'bakai'
    },
    'megapay': {
        'name': 'MegaPay',
        'emoji': '💳',
        'enabled': True,
        'bank_code': 'MEGAPAY',
        'url_template': 'https://megapay.kg/get#{qr_hash}',
        'qr_generator': 'generic'
    },
    'mbank': {
        'name': 'MBank',
        'emoji': '📱',
        'enabled': True,
        'bank_code': 'MBANK',
        'url_template': 'https://app.mbank.kg/qr/#{qr_hash}',
        'qr_generator': 'mbank'
    },
    'optima': {
        'name': 'Optima Bank',
        'emoji': '🏛️',
        'enabled': True,
        'bank_code': 'OPTIMA',
        'url_template': 'https://optima.kg/#{qr_hash}',
        'qr_generator': 'optima'
    }
}

# Лимиты
LIMITS = {
    'min_amount': 200,
    'max_amount': 50000,
    'min_withdraw': 100,
    'max_withdraw': 100000
}

# Настройки реферальной системы
REFERRAL_SETTINGS = {
    'enabled': True,
    'bonus_percent': 5,  # 5% от суммы депозита реферала
    'min_deposit_for_bonus': 500
}

# Настройки уведомлений
NOTIFICATION_SETTINGS = {
    'admin_username': '@luxon_support',
    'admin_chat_id': None,  # Будет установлен через переменную окружения
    'notify_on_deposit': True,
    'notify_on_withdraw': True,
    'notify_on_referral': True
}

# Настройки API
API_SETTINGS = {
    'timeout': 30,
    'retry_attempts': 3,
    'retry_delay': 1
}

# Настройки логирования
LOGGING_CONFIG = {
    'level': 'INFO',
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    'file': 'bot2/bot.log'
}

def get_config() -> Dict[str, Any]:
    """Получение конфигурации"""
    return {
        'bot_token': BOT_TOKEN,
        'mini_app_url': MINI_APP_URL,
        'database_path': DATABASE_PATH,
        'bookmakers': BOOKMAKERS,
        'banks': BANKS,
        'limits': LIMITS,
        'referral_settings': REFERRAL_SETTINGS,
        'notification_settings': NOTIFICATION_SETTINGS,
        'api_settings': API_SETTINGS,
        'logging_config': LOGGING_CONFIG
    }
