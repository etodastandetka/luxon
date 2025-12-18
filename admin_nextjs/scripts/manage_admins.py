#!/usr/bin/env python3
"""
Скрипт для управления админами в системе Luxon
Поддерживает создание, удаление, просмотр списка админов и получение QR-кода для 2FA
"""

import sys
import os
import argparse
import bcrypt
import json
from datetime import datetime
from typing import Optional, List, Dict
import pyotp
import qrcode
from io import StringIO
import subprocess

# Добавляем путь к проекту для импорта переменных окружения
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("❌ Ошибка: Не установлен psycopg2")
    print("Установите: pip install psycopg2-binary")
    sys.exit(1)

try:
    from qrcode import QRCode
    from qrcode.constants import ERROR_CORRECT_L
except ImportError:
    print("❌ Ошибка: Не установлен qrcode")
    print("Установите: pip install qrcode[pil]")
    sys.exit(1)

try:
    import qrcode_terminal
    QRCODE_TERMINAL_AVAILABLE = True
except ImportError:
    QRCODE_TERMINAL_AVAILABLE = False


def load_env_file():
    """Загружает переменные окружения из .env файла"""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(env_path):
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
        
        database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    
    try:
        # Парсим DATABASE_URL
        if database_url.startswith('postgresql://'):
            # Формат: postgresql://user:password@host:port/database
            url = database_url.replace('postgresql://', '')
            if '@' in url:
                auth, rest = url.split('@', 1)
                user, password = auth.split(':', 1)
                if ':' in rest:
                    host_port, database = rest.rsplit('/', 1)
                    host, port = host_port.split(':')
                else:
                    host = rest.split('/')[0]
                    port = '5432'
                    database = rest.split('/')[1] if '/' in rest else rest
            else:
                raise ValueError("Invalid DATABASE_URL format")
        else:
            raise ValueError("DATABASE_URL must start with postgresql://")
        
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password
        )
        return conn
    except Exception as e:
        print(f"❌ Ошибка подключения к базе данных: {e}")
        print(f"   DATABASE_URL: {database_url[:50]}...")
        sys.exit(1)


def hash_password(password: str) -> str:
    """Хеширует пароль с помощью bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Проверяет пароль"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_admin(username: str, password: str, email: Optional[str] = None, is_super_admin: bool = False):
    """Создает нового админа"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Проверяем, существует ли уже такой админ
        cursor.execute(
            "SELECT id, username FROM admin_users WHERE username = %s",
            (username,)
        )
        existing = cursor.fetchone()
        
        if existing:
            print(f"⚠️  Админ с username '{username}' уже существует (ID: {existing['id']})")
            response = input("Обновить пароль? (y/n): ")
            if response.lower() != 'y':
                print("❌ Отменено")
                return
            
            hashed_password = hash_password(password)
            cursor.execute(
                """
                UPDATE admin_users 
                SET password = %s, email = %s, is_super_admin = %s, updated_at = NOW()
                WHERE username = %s
                RETURNING id, username, email, is_super_admin, is_active
                """,
                (hashed_password, email, is_super_admin, username)
            )
            admin = cursor.fetchone()
            conn.commit()
            print("✅ Админ успешно обновлен!")
        else:
            hashed_password = hash_password(password)
            cursor.execute(
                """
                INSERT INTO admin_users (username, password, email, is_super_admin, is_active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, TRUE, NOW(), NOW())
                RETURNING id, username, email, is_super_admin, is_active
                """,
                (username, hashed_password, email, is_super_admin)
            )
            admin = cursor.fetchone()
            conn.commit()
            print("✅ Админ успешно создан!")
        
        print(f"   ID: {admin['id']}")
        print(f"   Username: {admin['username']}")
        if admin['email']:
            print(f"   Email: {admin['email']}")
        print(f"   Super Admin: {'Да' if admin['is_super_admin'] else 'Нет'}")
        print(f"   Active: {'Да' if admin['is_active'] else 'Нет'}")
        print(f"   Password: {password}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Ошибка при создании админа: {e}")
        sys.exit(1)
    finally:
        conn.close()


def delete_admin(username: str, confirm: bool = False):
    """Удаляет админа"""
    if not confirm:
        response = input(f"⚠️  Вы уверены, что хотите удалить админа '{username}'? (yes/no): ")
        if response.lower() != 'yes':
            print("❌ Отменено")
            return
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute(
            "SELECT id, username, email FROM admin_users WHERE username = %s",
            (username,)
        )
        admin = cursor.fetchone()
        
        if not admin:
            print(f"❌ Админ с username '{username}' не найден")
            return
        
        cursor.execute("DELETE FROM admin_users WHERE username = %s", (username,))
        conn.commit()
        
        print(f"✅ Админ '{username}' (ID: {admin['id']}) успешно удален!")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Ошибка при удалении админа: {e}")
        sys.exit(1)
    finally:
        conn.close()


def list_admins():
    """Показывает список всех админов"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute(
            """
            SELECT id, username, email, is_super_admin, is_active, 
                   two_factor_enabled, created_at, updated_at
            FROM admin_users
            ORDER BY id
            """
        )
        admins = cursor.fetchall()
        
        if not admins:
            print("📋 Список админов пуст")
            return
        
        print(f"\n📋 Список админов (всего: {len(admins)}):\n")
        print(f"{'ID':<5} {'Username':<20} {'Email':<30} {'Super':<8} {'Active':<8} {'2FA':<6} {'Created':<12}")
        print("-" * 100)
        
        for admin in admins:
            email = admin['email'] or '-'
            super_admin = 'Да' if admin['is_super_admin'] else 'Нет'
            active = 'Да' if admin['is_active'] else 'Нет'
            two_fa = 'Да' if admin['two_factor_enabled'] else 'Нет'
            created = admin['created_at'].strftime('%Y-%m-%d') if admin['created_at'] else '-'
            
            print(f"{admin['id']:<5} {admin['username']:<20} {email:<30} {super_admin:<8} {active:<8} {two_fa:<6} {created:<12}")
        
        print()
        
    except Exception as e:
        print(f"❌ Ошибка при получении списка админов: {e}")
        sys.exit(1)
    finally:
        conn.close()


def get_2fa_qr(username: str):
    """Получает QR-код для 2FA админа"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute(
            """
            SELECT id, username, two_factor_secret, two_factor_enabled
            FROM admin_users
            WHERE username = %s
            """,
            (username,)
        )
        admin = cursor.fetchone()
        
        if not admin:
            print(f"❌ Админ с username '{username}' не найден")
            return
        
        if admin['two_factor_enabled']:
            print(f"⚠️  2FA уже включена для админа '{username}'")
            response = input("Показать существующий QR-код? (y/n): ")
            if response.lower() != 'y':
                return
        
        # Генерируем новый секрет если его нет
        if not admin['two_factor_secret']:
            print("🔐 Генерируем новый секрет для 2FA...")
            secret = pyotp.random_base32()
            
            # Сохраняем секрет в базу (но не включаем 2FA пока не подтверждено)
            cursor.execute(
                """
                UPDATE admin_users 
                SET two_factor_secret = %s, updated_at = NOW()
                WHERE id = %s
                """,
                (secret, admin['id'])
            )
            conn.commit()
        else:
            secret = admin['two_factor_secret']
        
        # Генерируем otpauth URI
        otpauth_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=admin['username'],
            issuer_name='Luxon Admin'
        )
        
        # Генерируем QR-код
        qr = qrcode.QRCode(version=1, box_size=10, border=4, error_correction=ERROR_CORRECT_L)
        qr.add_data(otpauth_uri)
        qr.make(fit=True)
        
        print(f"\n📱 QR-код для 2FA админа '{username}':\n")
        print(f"Secret: {secret}\n")
        print(f"otpauth URI: {otpauth_uri}\n")
        
        # Показываем QR-код в терминале
        if QRCODE_TERMINAL_AVAILABLE:
            try:
                print("QR-код (терминал):")
                qrcode_terminal.draw(otpauth_uri)
            except Exception as e:
                print(f"⚠️  Не удалось отобразить QR через qrcode-terminal: {e}")
                print("QR-код (ASCII):")
                qr.print_ascii(invert=True)
        else:
            # Альтернативный способ - ASCII art
            print("QR-код (ASCII):")
            qr.print_ascii(invert=True)
        
        print("\n💡 Инструкция:")
        print("   1. Отсканируйте QR-код приложением-аутентификатором (Google Authenticator, Authy и т.д.)")
        print("   2. Или введите секрет вручную:", secret)
        print("   3. После сканирования, админ должен подтвердить 2FA через веб-интерфейс")
        print()
        
    except Exception as e:
        print(f"❌ Ошибка при получении QR-кода: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description='Управление админами в системе Luxon',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:

  # Создать админа
  python3 manage_admins.py create admin1 password123 admin1@example.com

  # Создать супер-админа
  python3 manage_admins.py create admin2 password456 --super

  # Удалить админа
  python3 manage_admins.py delete admin1

  # Показать список админов
  python3 manage_admins.py list

  # Получить QR-код для 2FA
  python3 manage_admins.py 2fa admin1
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Команда')
    
    # Команда create
    create_parser = subparsers.add_parser('create', help='Создать нового админа')
    create_parser.add_argument('username', help='Имя пользователя')
    create_parser.add_argument('password', help='Пароль')
    create_parser.add_argument('email', nargs='?', default=None, help='Email (опционально)')
    create_parser.add_argument('--super', action='store_true', help='Создать супер-админа')
    
    # Команда delete
    delete_parser = subparsers.add_parser('delete', help='Удалить админа')
    delete_parser.add_argument('username', help='Имя пользователя')
    delete_parser.add_argument('--yes', action='store_true', help='Подтвердить удаление без запроса')
    
    # Команда list
    subparsers.add_parser('list', help='Показать список всех админов')
    
    # Команда 2fa
    qr_parser = subparsers.add_parser('2fa', help='Получить QR-код для 2FA')
    qr_parser.add_argument('username', help='Имя пользователя')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    if args.command == 'create':
        create_admin(args.username, args.password, args.email, args.super)
    elif args.command == 'delete':
        delete_admin(args.username, args.yes)
    elif args.command == 'list':
        list_admins()
    elif args.command == '2fa':
        get_2fa_qr(args.username)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()

