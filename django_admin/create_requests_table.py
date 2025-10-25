#!/usr/bin/env python3
"""
Скрипт для создания таблицы requests в базе данных Django
"""

import os
import sys
import django
import sqlite3
from pathlib import Path

# Добавляем путь к Django проекту
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

def create_requests_table():
    """Создает таблицу requests в базе данных Django"""
    
    # Путь к базе данных Django
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'admin.sqlite3')
    
    if not os.path.exists(db_path):
        print(f"❌ База данных не найдена: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Создаем таблицу requests
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            bookmaker TEXT,
            account_id TEXT,
            amount REAL NOT NULL DEFAULT 0,
            request_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            withdrawal_code TEXT,
            photo_file_id TEXT,
            photo_file_url TEXT,
            bank TEXT,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP NULL
        )
        ''')
        
        # Создаем индексы
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_type_status ON requests(request_type, status)")
        
        conn.commit()
        print("✅ Таблица requests создана успешно!")
        
        # Проверяем, что таблица создана
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'")
        if cursor.fetchone():
            print("✅ Таблица requests существует в базе данных")
        else:
            print("❌ Таблица requests не найдена")
            return False
            
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Ошибка при создании таблицы: {e}")
        return False

def check_existing_tables():
    """Проверяет существующие таблицы в базе данных"""
    
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'admin.sqlite3')
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        print("📋 Существующие таблицы:")
        for table in tables:
            print(f"  - {table[0]}")
            
        conn.close()
        
    except Exception as e:
        print(f"❌ Ошибка при проверке таблиц: {e}")

if __name__ == "__main__":
    print("🔧 Создание таблицы requests...")
    
    # Проверяем существующие таблицы
    check_existing_tables()
    
    # Создаем таблицу
    if create_requests_table():
        print("🎉 Готово! Таблица requests создана.")
    else:
        print("💥 Ошибка! Не удалось создать таблицу requests.")
