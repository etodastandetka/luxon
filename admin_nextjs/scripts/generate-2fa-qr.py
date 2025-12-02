#!/usr/bin/env python3
"""
Скрипт для генерации QR кода для настройки 2FA
Использование: python scripts/generate-2fa-qr.py <username>
"""

import sys
import os
import qrcode
from io import StringIO
import pyotp
import secrets
import string
import json

# Добавляем путь к проекту
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Загружаем .env файл если есть
def load_env_file():
    """Загружает переменные из .env файла"""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    # Убираем кавычки если есть
                    value = value.strip('"').strip("'")
                    os.environ[key.strip()] = value

load_env_file()

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("❌ Ошибка: Установите psycopg2: pip install psycopg2-binary")
    sys.exit(1)

def get_db_connection():
    """Подключается к базе данных"""
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ Ошибка: Установите переменную окружения DATABASE_URL")
        print("Пример: export DATABASE_URL='postgresql://user:password@localhost:5432/dbname'")
        print("Или добавьте в .env файл: DATABASE_URL=postgresql://...")
        sys.exit(1)
    
    try:
        # Парсим DATABASE_URL
        # Формат: postgresql://user:password@host:port/dbname
        if database_url.startswith('postgresql://'):
            conn = psycopg2.connect(database_url)
        else:
            print("❌ Неверный формат DATABASE_URL")
            sys.exit(1)
        
        return conn
    except Exception as e:
        print(f"❌ Ошибка подключения к БД: {e}")
        sys.exit(1)

def generate_secret():
    """Генерирует секретный ключ для TOTP"""
    return pyotp.random_base32()

def generate_backup_codes(count=10):
    """Генерирует резервные коды"""
    codes = []
    for _ in range(count):
        # Генерируем 8-значный код из букв и цифр
        code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
        codes.append(code)
    return codes

def generate_qr_code(secret, username, issuer="Luxon Admin"):
    """Генерирует QR код и возвращает его как ASCII art"""
    # Создаем TOTP URI
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=username,
        issuer_name=issuer
    )
    
    # Генерируем QR код
    qr = qrcode.QRCode(version=1, box_size=2, border=1)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    
    # Создаем ASCII art
    qr_ascii = StringIO()
    qr.print_ascii(out=qr_ascii, invert=True)
    qr_ascii.seek(0)
    
    return qr_ascii.read(), totp_uri

def save_to_database(conn, user_id, secret, backup_codes):
    """Сохраняет 2FA настройки в базу данных"""
    try:
        cursor = conn.cursor()
        
        # Проверяем, существует ли колонка two_factor_enabled
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='admin_users' AND column_name='two_factor_enabled'
        """)
        
        if not cursor.fetchone():
            print("⚠️  Колонки для 2FA не найдены в таблице admin_users")
            print("   Запустите: npm run db:push в директории admin_nextjs")
            return False
        
        # Обновляем пользователя
        backup_codes_json = json.dumps(backup_codes)
        cursor.execute("""
            UPDATE admin_users 
            SET two_factor_enabled = %s,
                two_factor_secret = %s,
                two_factor_backup_codes = %s
            WHERE id = %s
        """, (True, secret, backup_codes_json, user_id))
        
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"⚠️  Ошибка при сохранении в БД: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Использование: python scripts/generate-2fa-qr.py <username> [--save]")
        print("  --save  - Сохранить настройки в базу данных")
        sys.exit(1)
    
    username = sys.argv[1]
    save_to_db = '--save' in sys.argv
    
    print(f"\n🔐 Генерация QR кода для 2FA")
    print(f"👤 Пользователь: {username}\n")
    
    # Подключаемся к БД
    conn = get_db_connection()
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Находим пользователя
        cursor.execute("SELECT id, username, email FROM admin_users WHERE username = %s", (username,))
        user = cursor.fetchone()
        
        if not user:
            print(f"❌ Пользователь '{username}' не найден")
            sys.exit(1)
        
        # Проверяем, не включена ли уже 2FA
        cursor.execute("""
            SELECT two_factor_enabled 
            FROM admin_users 
            WHERE id = %s
        """, (user['id'],))
        
        result = cursor.fetchone()
        if result and result.get('two_factor_enabled'):
            print("⚠️  2FA уже включена для этого пользователя")
            response = input("Продолжить и перезаписать? (y/N): ")
            if response.lower() != 'y':
                print("Отменено")
                sys.exit(0)
        
        # Генерируем секрет
        secret = generate_secret()
        print(f"🔑 Секретный ключ: {secret}\n")
        
        # Генерируем резервные коды
        backup_codes = generate_backup_codes(10)
        
        # Генерируем QR код
        qr_ascii, totp_uri = generate_qr_code(secret, username)
        
        print("=" * 60)
        print("📱 QR КОД (отсканируйте приложением-аутентификатором):")
        print("=" * 60)
        print(qr_ascii)
        print("=" * 60)
        
        print(f"\n🔗 TOTP URI (для ручного ввода):")
        print(totp_uri)
        
        print(f"\n💾 Резервные коды (сохраните в безопасном месте!):")
        print("=" * 60)
        for i, code in enumerate(backup_codes, 1):
            print(f"  {i:2d}. {code}")
        print("=" * 60)
        
        # Сохраняем в БД если указан флаг --save
        if save_to_db:
            print(f"\n💾 Сохранение в базу данных...")
            if save_to_database(conn, user['id'], secret, backup_codes):
                print("✅ Настройки 2FA сохранены в базу данных")
            else:
                print("❌ Не удалось сохранить в БД")
        else:
            print(f"\n💡 Для сохранения в БД запустите с флагом --save:")
            print(f"   python scripts/generate-2fa-qr.py {username} --save")
        
        # Сохраняем в файл
        output_file = f"2fa-{username}.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"2FA настройки для пользователя: {username}\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"Секретный ключ: {secret}\n\n")
            f.write("QR код:\n")
            f.write(qr_ascii)
            f.write("\n\nTOTP URI:\n")
            f.write(totp_uri)
            f.write("\n\nРезервные коды:\n")
            for i, code in enumerate(backup_codes, 1):
                f.write(f"  {i:2d}. {code}\n")
        
        print(f"\n📄 Информация сохранена в файл: {output_file}")
        print(f"\n✅ Готово! Теперь пользователь может войти с 2FA токеном")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    main()

