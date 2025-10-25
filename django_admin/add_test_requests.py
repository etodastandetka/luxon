#!/usr/bin/env python3
"""
Скрипт для добавления тестовых заявок в таблицу requests
"""

import os
import sys
import django
import sqlite3
from datetime import datetime, timedelta
import random

# Добавляем путь к Django проекту
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

def add_test_requests():
    """Добавляет тестовые заявки в таблицу requests"""
    
    # Путь к базе данных Django
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'admin.sqlite3')
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем, что таблица существует
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'")
        if not cursor.fetchone():
            print("❌ Таблица requests не найдена!")
            return False
        
        # Очищаем существующие тестовые данные
        cursor.execute("DELETE FROM requests WHERE user_id LIKE 'test_%'")
        
        # Создаем тестовые заявки
        test_requests = [
            {
                'user_id': 123456789,
                'username': 'test_user_1',
                'first_name': 'Тест',
                'last_name': 'Пользователь',
                'bookmaker': '1xBet',
                'account_id': '12345678',
                'amount': 1000.0,
                'request_type': 'deposit',
                'status': 'completed',
                'created_at': datetime.now() - timedelta(hours=2),
                'processed_at': datetime.now() - timedelta(hours=1)
            },
            {
                'user_id': 987654321,
                'username': 'test_user_2',
                'first_name': 'Анна',
                'last_name': 'Смирнова',
                'bookmaker': 'Melbet',
                'account_id': '87654321',
                'amount': 2500.0,
                'request_type': 'withdraw',
                'status': 'pending',
                'created_at': datetime.now() - timedelta(minutes=30)
            },
            {
                'user_id': 555666777,
                'username': 'test_user_3',
                'first_name': 'Иван',
                'last_name': 'Петров',
                'bookmaker': 'Mostbet',
                'account_id': '55555555',
                'amount': 500.0,
                'request_type': 'deposit',
                'status': 'rejected',
                'created_at': datetime.now() - timedelta(hours=1),
                'processed_at': datetime.now() - timedelta(minutes=30)
            }
        ]
        
        for request in test_requests:
            cursor.execute('''
                INSERT INTO requests (
                    user_id, username, first_name, last_name, bookmaker, account_id,
                    amount, request_type, status, created_at, processed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                request['user_id'],
                request['username'],
                request['first_name'],
                request['last_name'],
                request['bookmaker'],
                request['account_id'],
                request['amount'],
                request['request_type'],
                request['status'],
                request['created_at'],
                request.get('processed_at')
            ))
        
        conn.commit()
        print("✅ Тестовые заявки добавлены успешно!")
        
        # Проверяем количество заявок
        cursor.execute("SELECT COUNT(*) FROM requests")
        count = cursor.fetchone()[0]
        print(f"📊 Всего заявок в базе: {count}")
        
        # Показываем последние заявки
        cursor.execute("""
            SELECT id, user_id, bookmaker, amount, request_type, status, created_at 
            FROM requests 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        
        print("\n📋 Последние заявки:")
        for row in cursor.fetchall():
            print(f"  ID: {row[0]}, User: {row[1]}, {row[2]} - {row[3]} сом ({row[4]}) - {row[5]} - {row[6]}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Ошибка при добавлении тестовых данных: {e}")
        return False

if __name__ == "__main__":
    print("🔧 Добавление тестовых заявок...")
    
    if add_test_requests():
        print("🎉 Готово! Тестовые заявки добавлены.")
    else:
        print("💥 Ошибка! Не удалось добавить тестовые заявки.")
