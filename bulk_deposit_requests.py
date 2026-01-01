#!/usr/bin/env python3
"""
Скрипт для массового создания и подтверждения заявок на пополнение баланса
Создает заявки на пополнение по 100 сом для всех указанных пользователей и сразу их подтверждает
"""

import sys
import os
import re
from datetime import datetime
from typing import Optional, Tuple
from urllib.parse import urlparse

# Добавляем путь к проекту для импорта переменных окружения
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'admin_nextjs'))

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("❌ Ошибка: Не установлен psycopg2")
    print("Установите: pip install psycopg2-binary")
    sys.exit(1)


def load_env_file():
    """Загружает переменные окружения из .env файла"""
    # Ищем .env файл в нескольких возможных местах
    script_dir = os.path.dirname(os.path.abspath(__file__))
    possible_paths = [
        os.path.join(script_dir, 'admin_nextjs', '.env'),  # Из корня проекта
        os.path.join(os.path.dirname(script_dir), 'admin_nextjs', '.env'),  # Если скрипт в корне
        os.path.join(script_dir, '.env'),  # В той же папке что и скрипт
        os.path.join(os.path.dirname(script_dir), '.env'),  # В корне проекта
    ]
    
    env_path = None
    for path in possible_paths:
        if os.path.exists(path):
            env_path = path
            break
    
    if not env_path:
        print(f"⚠️  Файл .env не найден. Проверенные пути:")
        for path in possible_paths:
            print(f"   - {path}")
        return
    
    print(f"📄 Загрузка переменных из: {env_path}")
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                # Убираем кавычки если есть
                value = value.strip('"\'')
                os.environ[key.strip()] = value


def get_db_connection():
    """Получает подключение к базе данных"""
    load_env_file()
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        # Пробуем собрать из отдельных переменных
        db_host = os.getenv('DB_HOST', 'localhost')
        db_port = os.getenv('DB_PORT', '5432')
        db_name = os.getenv('DB_NAME', 'luxon')
        db_user = os.getenv('DB_USER', 'postgres')
        db_password = os.getenv('DB_PASSWORD', '')
        
        if not db_password and not db_user:
            print("❌ Не указан DATABASE_URL или DB_* переменные в .env файле")
            print("   Убедитесь, что файл .env находится в admin_nextjs/.env")
            sys.exit(1)
        
        database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        print(f"🔗 Используется DATABASE_URL из отдельных переменных: {db_user}@{db_host}:{db_port}/{db_name}")
    else:
        # Скрываем пароль в выводе
        safe_url = database_url.split('@')[1] if '@' in database_url else database_url[:50]
        print(f"🔗 Используется DATABASE_URL: ...@{safe_url}")
    
    try:
        # Используем встроенный парсер URL для правильной обработки query параметров
        # Парсим DATABASE_URL
        if database_url.startswith('postgresql://'):
            parsed = urlparse(database_url)
            user = parsed.username
            password = parsed.password
            host = parsed.hostname
            port = parsed.port or 5432
            # Извлекаем имя БД из path, убирая первый слэш и query параметры
            database = parsed.path.lstrip('/')
            # Убираем query параметры из имени БД (например, "default_db?schema=public" -> "default_db")
            if '?' in database:
                database = database.split('?')[0]
            
            if not all([host, database, user, password]):
                raise ValueError("Missing required connection parameters")
        else:
            raise ValueError("DATABASE_URL must start with postgresql://")
        
        print(f"🔌 Подключение к {host}:{port}/{database}...")
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password
        )
        print("✅ Подключение успешно!")
        return conn
    except Exception as e:
        print(f"❌ Ошибка подключения к базе данных: {e}")
        print(f"\n💡 Проверьте:")
        print(f"   1. Файл .env существует в admin_nextjs/.env")
        print(f"   2. DATABASE_URL указан в .env файле")
        print(f"   3. База данных доступна с указанными параметрами")
        print(f"   4. Правильность пароля и имени пользователя")
        sys.exit(1)


def normalize_bookmaker(text: str) -> str:
    """Нормализует название букмекера из текста"""
    text_lower = text.lower().strip()
    
    # Маппинг названий
    if '1xbet' in text_lower or 'хбет' in text_lower or 'xbet' in text_lower:
        return '1xbet'
    elif 'мелбет' in text_lower or 'melbet' in text_lower:
        return 'melbet'
    elif '888' in text_lower or 'старз' in text_lower or 'starz' in text_lower:
        return '888starz'
    elif 'mostbet' in text_lower:
        return 'mostbet'
    elif '1win' in text_lower or 'onewin' in text_lower:
        return '1win'
    elif 'winwin' in text_lower or 'win win' in text_lower:
        return 'winwin'
    else:
        return '1xbet'  # По умолчанию


def get_user_info(conn, telegram_user_id: str) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Получает информацию о пользователе из БД
    Возвращает: (username, firstName, lastName, selectedBookmaker)
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT username, first_name, last_name, selected_bookmaker
            FROM users
            WHERE user_id = %s
        """, (telegram_user_id,))
        user = cursor.fetchone()
        if user:
            return (
                user.get('username'),
                user.get('first_name'),
                user.get('last_name'),
                user.get('selected_bookmaker')
            )
        return (None, None, None, None)
    finally:
        cursor.close()


def get_user_account_id(conn, telegram_user_id: str, bookmaker: str) -> Optional[str]:
    """Получает account_id пользователя для указанного букмекера"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        data_type = f"casino_account_id_{bookmaker.lower()}"
        cursor.execute("""
            SELECT data_value
            FROM user_data
            WHERE user_id = %s AND data_type = %s
            LIMIT 1
        """, (telegram_user_id, data_type))
        result = cursor.fetchone()
        if result:
            return result.get('data_value')
        
        # Если не нашли, ищем в последней заявке пользователя
        cursor.execute("""
            SELECT account_id, bookmaker
            FROM requests
            WHERE user_id = %s AND account_id IS NOT NULL AND account_id != ''
            ORDER BY created_at DESC
            LIMIT 1
        """, (telegram_user_id,))
        request = cursor.fetchone()
        if request and request.get('bookmaker', '').lower() == bookmaker.lower():
            return request.get('account_id')
        
        return None
    finally:
        cursor.close()


def create_deposit_request(conn, account_id: str, bookmaker: str, telegram_user_id: Optional[str] = None, amount: float = 100.0) -> Optional[int]:
    """Создает заявку на пополнение и сразу подтверждает её
    
    Args:
        conn: соединение с БД
        account_id: ID аккаунта в казино (обязательно)
        bookmaker: название букмекера (обязательно)
        telegram_user_id: Telegram ID пользователя (опционально, будет найден по account_id если не указан)
        amount: сумма пополнения (по умолчанию 100.0)
    """
    cursor = conn.cursor()
    
    try:
        # Если telegram_user_id не указан, пытаемся найти по account_id
        if not telegram_user_id:
            telegram_user_id = find_user_by_account_id(conn, account_id, bookmaker)
            if not telegram_user_id:
                print(f"   ⚠️ Пользователь с account_id {account_id} не найден в предыдущих заявках")
                return None
        
        # Получаем информацию о пользователе
        username, firstName, lastName, selectedBookmaker = get_user_info(conn, telegram_user_id)
        
        # Используем bookmaker из параметра или из профиля пользователя
        final_bookmaker = bookmaker or selectedBookmaker or '1xbet'
        
        # Создаем заявку
        now = datetime.now()
        cursor.execute("""
            INSERT INTO requests (
                user_id, username, first_name, last_name, bookmaker, account_id,
                amount, request_type, status, processed_by, processed_at, created_at, updated_at, source
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            telegram_user_id,
            username,
            firstName,
            lastName,
            final_bookmaker,
            account_id,
            amount,
            'deposit',
            'completed',  # Сразу ставим статус completed
            'script',  # Обработано скриптом
            now,  # processed_at
            now,  # created_at
            now,  # updated_at
            'bot'  # source
        ))
        
        request_id = cursor.fetchone()[0]
        conn.commit()
        return request_id
    except Exception as e:
        conn.rollback()
        print(f"   ❌ Ошибка при создании заявки: {e}")
        return None
    finally:
        cursor.close()


def find_user_by_account_id(conn, account_id: str, bookmaker: str) -> Optional[str]:
    """Находит telegram_user_id по account_id и bookmaker из предыдущих заявок"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT user_id
            FROM requests
            WHERE account_id = %s AND LOWER(bookmaker) = LOWER(%s)
            ORDER BY created_at DESC
            LIMIT 1
        """, (account_id, bookmaker))
        result = cursor.fetchone()
        if result:
            return str(result.get('user_id'))
        return None
    finally:
        cursor.close()


def parse_user_list(user_text: str) -> list:
    """Парсит список пользователей из текста (ID казино, не Telegram ID)"""
    users = []
    lines = user_text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Извлекаем ID казино (числа в начале строки)
        match = re.match(r'^(\d+)', line)
        if match:
            account_id = match.group(1)
            
            # Извлекаем название букмекера из остальной части строки
            bookmaker_text = line[len(account_id):].strip()
            bookmaker = normalize_bookmaker(bookmaker_text) if bookmaker_text else '1xbet'
            
            users.append({
                'account_id': account_id,
                'bookmaker': bookmaker,
                'raw_text': line
            })
    
    return users


def main():
    # Список пользователей из сообщения
    user_list_text = """
788819155 1хбет
713402979 1хбет
1164791189 хбет
1447146825 Хбет
664419875 хбет
793740797хбет
1081797903 Хбет
965304111 мелбет
1318578339 хбет
1016424437 хбет
1328900805 888 старз
1282653593 хбет
1322202041 хбет
637351495 хбет
1169440995 хбет
727560649 ❤️
896833357 хбет
884234801 хбет
241470417 хбет
1484306949 МЕЛБЕТ
    """
    
    print("🚀 Запуск скрипта массового создания заявок на пополнение")
    print("=" * 60)
    
    # Парсим список пользователей
    users = parse_user_list(user_list_text)
    print(f"📋 Найдено пользователей: {len(users)}\n")
    
    # Подключаемся к БД
    conn = get_db_connection()
    print()
    
    # Обрабатываем каждого пользователя
    success_count = 0
    error_count = 0
    created_requests = []
    
    for idx, user_info in enumerate(users, 1):
        account_id = user_info['account_id']
        bookmaker = user_info['bookmaker']
        
        print(f"[{idx}/{len(users)}] Обработка account_id {account_id} ({bookmaker})...", end=' ')
        
        request_id = create_deposit_request(conn, account_id, bookmaker, None, 100.0)
        
        if request_id:
            print(f"✅ Заявка #{request_id} создана и подтверждена")
            success_count += 1
            created_requests.append({
                'account_id': account_id,
                'request_id': request_id,
                'bookmaker': bookmaker
            })
        else:
            print(f"❌ Ошибка")
            error_count += 1
    
    conn.close()
    
    # Итоги
    print("\n" + "=" * 60)
    print(f"📊 Итоги:")
    print(f"   ✅ Успешно создано: {success_count}")
    print(f"   ❌ Ошибок: {error_count}")
    print(f"   📝 Всего обработано: {len(users)}")
    
    if created_requests:
        print(f"\n📋 Созданные заявки:")
        for req in created_requests[:10]:  # Показываем первые 10
            print(f"   - ID заявки #{req['request_id']}: account_id {req['account_id']} ({req['bookmaker']})")
        if len(created_requests) > 10:
            print(f"   ... и еще {len(created_requests) - 10} заявок")


if __name__ == '__main__':
    main()

