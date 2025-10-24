#!/usr/bin/env python3
"""
Скрипт для обновления таблиц в базе данных бота
Добавляет новые поля для заявок на вывод
"""

import sqlite3
import os
from pathlib import Path

# Путь к базе данных
DB_PATH = Path(__file__).parent.parent / 'universal_bot.db'

def update_tables():
    """Обновляет таблицы в базе данных"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        # Проверяем существование таблиц
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('deposit_requests', 'withdrawals')")
        tables = cursor.fetchall()
        
        print(f"Найдены таблицы: {[table[0] for table in tables]}")
        
        # Обновляем таблицу deposit_requests
        if ('deposit_requests',) in tables:
            print("Обновляем таблицу deposit_requests...")
            
            # Добавляем новые поля, если их нет
            try:
                cursor.execute("ALTER TABLE deposit_requests ADD COLUMN qr_photo TEXT")
                print("Добавлено поле qr_photo в deposit_requests")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print("Поле qr_photo уже существует в deposit_requests")
                else:
                    print(f"Ошибка при добавлении qr_photo: {e}")
            
            try:
                cursor.execute("ALTER TABLE deposit_requests ADD COLUMN request_id TEXT")
                print("Добавлено поле request_id в deposit_requests")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print("Поле request_id уже существует в deposit_requests")
                else:
                    print(f"Ошибка при добавлении request_id: {e}")
        
        # Обновляем таблицу withdrawals
        if ('withdrawals',) in tables:
            print("Обновляем таблицу withdrawals...")
            
            # Добавляем новые поля, если их нет
            try:
                cursor.execute("ALTER TABLE withdrawals ADD COLUMN qr_photo TEXT")
                print("Добавлено поле qr_photo в withdrawals")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print("Поле qr_photo уже существует в withdrawals")
                else:
                    print(f"Ошибка при добавлении qr_photo: {e}")
            
            try:
                cursor.execute("ALTER TABLE withdrawals ADD COLUMN request_id TEXT")
                print("Добавлено поле request_id в withdrawals")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print("Поле request_id уже существует в withdrawals")
                else:
                    print(f"Ошибка при добавлении request_id: {e}")
        
        conn.commit()
        print("✅ Таблицы успешно обновлены!")
        
        # Показываем структуру таблиц
        print("\nСтруктура таблицы deposit_requests:")
        cursor.execute("PRAGMA table_info(deposit_requests)")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
        
        print("\nСтруктура таблицы withdrawals:")
        cursor.execute("PRAGMA table_info(withdrawals)")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
            
    except Exception as e:
        print(f"Ошибка при обновлении таблиц: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    update_tables()
