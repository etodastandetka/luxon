#!/usr/bin/env python3
"""
Скрипт для чтения токенов MobCash из файла
Используется для проверки текущих токенов
"""

import json
import sys
from pathlib import Path
from datetime import datetime

TOKENS_FILE = Path(__file__).parent.parent / '.mobcash_tokens.json'


def main():
    try:
        with open(TOKENS_FILE, 'r') as f:
            tokens = json.load(f)
        
        print('📋 Текущие токены MobCash:')
        print(f'  Bearer Token: {tokens.get("bearer_token", "N/A")[:50]}...')
        print(f'  User ID: {tokens.get("user_id", "N/A")}')
        print(f'  Session ID: {tokens.get("session_id", "N/A")}')
        print(f'  Обновлено: {tokens.get("updated_at", "N/A")}')
        
        expires_at = tokens.get('expires_at')
        if expires_at:
            expires_dt = datetime.fromtimestamp(expires_at)
            now = datetime.now()
            if expires_dt > now:
                remaining = expires_dt - now
                print(f'  Действителен еще: {remaining}')
            else:
                print(f'  ⚠️  Токены истекли!')
        
        # Вывод в формате для .env
        print('\n📝 Для .env файла:')
        print(f'MOBCASH_BEARER_TOKEN={tokens.get("bearer_token", "")}')
        print(f'MOBCASH_USER_ID={tokens.get("user_id", "")}')
        print(f'MOBCASH_SESSION_ID={tokens.get("session_id", "")}')
        
    except FileNotFoundError:
        print('❌ Файл с токенами не найден. Запустите update_mobcash_tokens.py')
        sys.exit(1)
    except Exception as e:
        print(f'❌ Ошибка чтения токенов: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()

