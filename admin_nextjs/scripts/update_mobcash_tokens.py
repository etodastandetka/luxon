#!/usr/bin/env python3
"""
Скрипт для автоматического обновления токенов MobCash API
Выполняет полный OAuth2 flow и сохраняет токены для использования в админке

Запуск:
    python3 scripts/update_mobcash_tokens.py

Или через cron каждые 20 часов:
    0 */20 * * * cd /var/www/luxon/admin_nextjs && /usr/bin/python3 scripts/update_mobcash_tokens.py
"""

import os
import json
import sys
import requests
import uuid
import re
from datetime import datetime
from pathlib import Path

# Загрузка переменных из .env файла
def load_env_file(env_path):
    """Загружает переменные из .env файла"""
    if not os.path.exists(env_path):
        log(f'Файл .env не найден: {env_path}', 'WARNING')
        return
    
    log(f'Загрузка переменных из .env файла: {env_path}', 'INFO')
    
    with open(env_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            # Пропускаем комментарии и пустые строки
            if not line or line.startswith('#'):
                continue
            
            # Парсим KEY="VALUE" или KEY=VALUE или KEY='VALUE'
            # Поддерживаем значения в двойных и одинарных кавычках
            match = re.match(r'^([^=#]+?)=(?:"([^"]*)"|\'([^\']*)\'|([^#\s]+))', line)
            if match:
                key = match.group(1).strip()
                # Значение может быть в группе 2 (двойные кавычки), 3 (одинарные) или 4 (без кавычек)
                value = match.group(2) or match.group(3) or match.group(4) or ''
                value = value.strip()
                
                # Устанавливаем переменную окружения, если она еще не установлена
                if key not in os.environ and value:
                    os.environ[key] = value
                    log(f'  Загружено: {key}', 'INFO')
            else:
                log(f'  Пропущена строка {line_num}: {line[:50]}...', 'WARNING')

# Загружаем .env файл
script_dir = Path(__file__).parent
project_dir = script_dir.parent
env_file = project_dir / '.env'

# Временная функция log для использования до определения основной функции log
def log(message, level='INFO'):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    prefix = {
        'INFO': 'ℹ️',
        'SUCCESS': '✅',
        'ERROR': '❌',
        'WARNING': '⚠️',
        'STEP': '🔐',
    }.get(level, 'ℹ️')
    print(f'[{timestamp}] {prefix} {message}')

load_env_file(env_file)

# Конфигурация из переменных окружения
MOBCASH_LOGIN = os.getenv('MOBCASH_LOGIN')
MOBCASH_PASSWORD = os.getenv('MOBCASH_PASSWORD')
MOBCASH_CASHDESK_ID = os.getenv('MOBCASH_CASHDESK_ID', '1001098')
MOBCASH_DEFAULT_LAT = float(os.getenv('MOBCASH_DEFAULT_LAT', '42.845778'))
MOBCASH_DEFAULT_LON = float(os.getenv('MOBCASH_DEFAULT_LON', '74.568778'))

# Путь для сохранения токенов
TOKENS_FILE = Path(__file__).parent.parent / '.mobcash_tokens.json'

# Базовые URL
OAUTH_BASE_URL = 'https://admin.mob-cash.com'
API_BASE_URL = 'https://admin.mob-cash.com/api/'

# Заголовки для запросов
OAUTH_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
    'Connection': 'keep-alive',
    'Origin': 'https://app.mob-cash.com',
    'Referer': 'https://app.mob-cash.com/login',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Chromium";v="104", " Not A;Brand";v="99", "Google Chrome";v="104"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
}

API_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/json',
    'Origin': 'https://app.mob-cash.com',
    'Pragma': 'no-cache',
    'Priority': 'u=1, i',
    'Referer': 'https://app.mob-cash.com/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    'x-request-source': 'pwa',
}


def log(message, level='INFO'):
    """Логирование с временной меткой"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    prefix = {
        'INFO': 'ℹ️',
        'SUCCESS': '✅',
        'ERROR': '❌',
        'WARNING': '⚠️',
        'STEP': '🔐',
    }.get(level, 'ℹ️')
    print(f'[{timestamp}] {prefix} {message}')


def step1_get_login_challenge():
    """Шаг 1.1: Получение LoginChallenge"""
    log('Шаг 1.1: Получение LoginChallenge...', 'STEP')
    
    state = str(uuid.uuid4())
    data = {
        'response_type': 'code',
        'grant_type': 'refresh_token',
        'scope': 'offline',
        'client_id': '4e779103-d67b-42ef-bc9d-ab5ecdec40f8',
        'prompt': 'consent',
        'state': state,
    }
    
    try:
        response = requests.post(
            f'{OAUTH_BASE_URL}/hydra/oauth2/auth',
            headers=OAUTH_HEADERS,
            data=data,
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        login_challenge = result.get('LoginChallenge')
        
        if not login_challenge:
            raise ValueError('LoginChallenge не найден в ответе')
        
        log(f'LoginChallenge получен: {login_challenge[:20]}...', 'SUCCESS')
        return login_challenge, response.cookies
        
    except Exception as e:
        log(f'Ошибка получения LoginChallenge: {e}', 'ERROR')
        raise


def step2_get_consent_challenge(login_challenge, cookies):
    """Шаг 1.2: Получение ConsentChallenge"""
    log('Шаг 1.2: Получение ConsentChallenge...', 'STEP')
    
    if not MOBCASH_LOGIN or not MOBCASH_PASSWORD:
        raise ValueError('MOBCASH_LOGIN и MOBCASH_PASSWORD должны быть установлены')
    
    state = str(uuid.uuid4())
    data = {
        'nickname': MOBCASH_LOGIN,
        'password': MOBCASH_PASSWORD,
        'state': state,
        'remember_me': 'true',
    }
    
    try:
        response = requests.post(
            f'{OAUTH_BASE_URL}/authentication/login',
            params={'login_challenge': login_challenge},
            headers=OAUTH_HEADERS,
            data=data,
            cookies=cookies,
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        consent_challenge = result.get('ConsentChallenge')
        
        if not consent_challenge:
            raise ValueError('ConsentChallenge не найден в ответе')
        
        log(f'ConsentChallenge получен: {consent_challenge[:20]}...', 'SUCCESS')
        return consent_challenge, response.cookies
        
    except Exception as e:
        log(f'Ошибка получения ConsentChallenge: {e}', 'ERROR')
        raise


def step3_get_access_token(consent_challenge, cookies):
    """Шаг 1.3: Получение access_token"""
    log('Шаг 1.3: Получение access_token...', 'STEP')
    
    state = str(uuid.uuid4())
    data = {
        'client_id': '4e779103-d67b-42ef-bc9d-ab5ecdec40f8',
        'grant_scope': 'offline',
        'state': state,
    }
    
    try:
        response = requests.post(
            f'{OAUTH_BASE_URL}/authentication/consent',
            params={'consent_challenge': consent_challenge},
            headers={
                **OAUTH_HEADERS,
                'Authorization': 'Bearer ',  # Пустой токен для первого запроса
            },
            data=data,
            cookies=cookies,
            timeout=30,
            allow_redirects=False
        )
        
        # access_token может быть в теле ответа или в redirect URL
        access_token = None
        
        # Проверяем тело ответа
        if response.status_code == 200:
            try:
                result = response.json()
                access_token = result.get('access_token')
            except:
                pass
        
        # Проверяем redirect URL
        if not access_token and response.status_code in [302, 303, 307, 308]:
            location = response.headers.get('Location', '')
            if 'access_token=' in location:
                import urllib.parse
                parsed = urllib.parse.urlparse(location)
                params = urllib.parse.parse_qs(parsed.fragment or parsed.query)
                if 'access_token' in params:
                    access_token = params['access_token'][0]
        
        # Если не нашли, пробуем из текста ответа
        if not access_token:
            text = response.text
            if 'access_token' in text:
                import re
                match = re.search(r'access_token["\']?\s*[:=]\s*["\']?([^"\'\s]+)', text)
                if match:
                    access_token = match.group(1)
        
        if not access_token:
            raise ValueError('access_token не найден в ответе')
        
        log(f'access_token получен: {access_token[:30]}...', 'SUCCESS')
        return access_token, response.cookies
        
    except Exception as e:
        log(f'Ошибка получения access_token: {e}', 'ERROR')
        raise


def step4_get_user_id(access_token):
    """Шаг 1.4: Получение userID"""
    log('Шаг 1.4: Получение userID...', 'STEP')
    
    payload = [{
        'jsonrpc': '2.0',
        'id': 11,
        'method': 'user.profile',
        'params': {}
    }]
    
    try:
        response = requests.post(
            API_BASE_URL,
            headers={
                **API_HEADERS,
                'Authorization': f'Bearer {access_token}',
            },
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        if not result or len(result) == 0:
            raise ValueError('Пустой ответ от API')
        
        user_id = result[0].get('result', {}).get('id')
        
        if not user_id:
            raise ValueError('userID не найден в ответе')
        
        log(f'userID получен: {user_id}', 'SUCCESS')
        return user_id
        
    except Exception as e:
        log(f'Ошибка получения userID: {e}', 'ERROR')
        raise


def step5_get_session_id(access_token, user_id):
    """Шаг 1.5: Получение sessionID (логин на кассу)"""
    log('Шаг 1.5: Получение sessionID (логин на кассу)...', 'STEP')
    
    payload = [{
        'jsonrpc': '2.0',
        'id': 12,
        'method': 'mobile.login',
        'params': {
            'location': {
                'lat': MOBCASH_DEFAULT_LAT,
                'lon': MOBCASH_DEFAULT_LON,
            },
            'cashboxCode': int(MOBCASH_CASHDESK_ID),
            'userID': str(user_id),
        }
    }]
    
    try:
        response = requests.post(
            API_BASE_URL,
            headers={
                **API_HEADERS,
                'Authorization': f'Bearer {access_token}',
            },
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        if not result or len(result) == 0:
            raise ValueError('Пустой ответ от API')
        
        session_id = (
            result[0].get('result', {}).get('sessionID') or
            result[0].get('result', {}).get('session_id') or
            result[0].get('result', {}).get('id') or
            ''
        )
        
        if not session_id:
            raise ValueError('sessionID не найден в ответе')
        
        log(f'sessionID получен: {session_id}', 'SUCCESS')
        return session_id
        
    except Exception as e:
        log(f'Ошибка получения sessionID: {e}', 'ERROR')
        raise


def save_tokens(access_token, user_id, session_id):
    """Сохранение токенов в файл"""
    log('Сохранение токенов...', 'STEP')
    
    tokens_data = {
        'bearer_token': access_token,
        'user_id': str(user_id),
        'session_id': str(session_id),
        'updated_at': datetime.now().isoformat(),
        'expires_at': (datetime.now().timestamp() + 24 * 60 * 60),  # 24 часа
    }
    
    try:
        with open(TOKENS_FILE, 'w') as f:
            json.dump(tokens_data, f, indent=2)
        
        log(f'Токены сохранены в {TOKENS_FILE}', 'SUCCESS')
        return True
        
    except Exception as e:
        log(f'Ошибка сохранения токенов: {e}', 'ERROR')
        return False


def main():
    """Главная функция"""
    log('=' * 60)
    log('Запуск обновления токенов MobCash API')
    log('=' * 60)
    
    # Проверка конфигурации
    if not MOBCASH_LOGIN or not MOBCASH_PASSWORD:
        log('Ошибка: MOBCASH_LOGIN и MOBCASH_PASSWORD должны быть установлены', 'ERROR')
        log('Установите переменные окружения или добавьте их в .env файл', 'ERROR')
        sys.exit(1)
    
    log(f'Конфигурация:')
    log(f'  Login: {MOBCASH_LOGIN}')
    log(f'  Password: {"*" * len(MOBCASH_PASSWORD)}')
    log(f'  Cashdesk ID: {MOBCASH_CASHDESK_ID}')
    log(f'  Location: {MOBCASH_DEFAULT_LAT}, {MOBCASH_DEFAULT_LON}')
    log('')
    
    try:
        # Шаг 1.1: Получение LoginChallenge
        login_challenge, cookies = step1_get_login_challenge()
        
        # Шаг 1.2: Получение ConsentChallenge
        consent_challenge, cookies = step2_get_consent_challenge(login_challenge, cookies)
        
        # Шаг 1.3: Получение access_token
        access_token, cookies = step3_get_access_token(consent_challenge, cookies)
        
        # Шаг 1.4: Получение userID
        user_id = step4_get_user_id(access_token)
        
        # Шаг 1.5: Получение sessionID
        session_id = step5_get_session_id(access_token, user_id)
        
        # Сохранение токенов
        if save_tokens(access_token, user_id, session_id):
            log('=' * 60)
            log('✅ ОБНОВЛЕНИЕ ТОКЕНОВ УСПЕШНО ЗАВЕРШЕНО!', 'SUCCESS')
            log('=' * 60)
            log('')
            log('Полученные токены:')
            log(f'  Bearer Token: {access_token[:50]}...')
            log(f'  User ID: {user_id}')
            log(f'  Session ID: {session_id}')
            log('')
            log(f'Токены сохранены в: {TOKENS_FILE}')
            log('Токены действительны 24 часа')
            log('Рекомендуется обновлять каждые 20 часов')
            sys.exit(0)
        else:
            log('Ошибка при сохранении токенов', 'ERROR')
            sys.exit(1)
            
    except Exception as e:
        log(f'Критическая ошибка: {e}', 'ERROR')
        import traceback
        log(traceback.format_exc(), 'ERROR')
        sys.exit(1)


if __name__ == '__main__':
    main()

