#!/usr/bin/env python3
"""
База данных для бота v2
"""
import sqlite3
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_path: str = None):
        if db_path is None:
            import os
            self.db_path = os.path.join(os.path.dirname(__file__), "bot_data.db")
        else:
            self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Инициализация базы данных"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Таблица пользователей
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    language TEXT DEFAULT 'ru',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Таблица пользовательских данных
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    key TEXT,
                    value TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            ''')
            
            # Таблица рефералов
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS referrals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    referrer_id INTEGER,
                    referred_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (referrer_id) REFERENCES users (user_id),
                    FOREIGN KEY (referred_id) REFERENCES users (user_id)
                )
            ''')
            
            # Таблица заявок на пополнение
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS deposit_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    bookmaker TEXT,
                    player_id TEXT,
                    amount INTEGER,
                    bank TEXT,
                    payment_url TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            ''')
            
            # Таблица заявок на вывод
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS withdraw_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    bookmaker TEXT,
                    player_id TEXT,
                    amount INTEGER,
                    bank TEXT,
                    phone TEXT,
                    site_code TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            ''')
            
            # Таблица транзакций
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    type TEXT, -- 'deposit' or 'withdraw'
                    bookmaker TEXT,
                    amount REAL,
                    status TEXT DEFAULT 'pending',
                    data TEXT, -- JSON с дополнительными данными
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            ''')
            
            conn.commit()
            conn.close()
            logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
    
    def save_user(self, user_id: int, username: str = None, first_name: str = None, last_name: str = None):
        """Сохранение пользователя"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO users (user_id, username, first_name, last_name, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (user_id, username, first_name, last_name))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error saving user: {e}")
            return False
    
    def get_user(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Получение пользователя"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return {
                    'user_id': row[0],
                    'username': row[1],
                    'first_name': row[2],
                    'last_name': row[3],
                    'language': row[4],
                    'created_at': row[5],
                    'updated_at': row[6]
                }
            return None
        except Exception as e:
            logger.error(f"Error getting user: {e}")
            return None
    
    def save_user_data(self, user_id: int, key: str, value: str):
        """Сохранение пользовательских данных"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO user_data (user_id, key, value)
                VALUES (?, ?, ?)
            ''', (user_id, key, value))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error saving user data: {e}")
            return False
    
    def get_user_data(self, user_id: int, key: str) -> Optional[str]:
        """Получение пользовательских данных"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM user_data WHERE user_id = ? AND key = ?', (user_id, key))
            row = cursor.fetchone()
            conn.close()
            return row[0] if row else None
        except Exception as e:
            logger.error(f"Error getting user data: {e}")
            return None
    
    def get_user_language(self, user_id: int) -> str:
        """Получение языка пользователя"""
        user = self.get_user(user_id)
        return user.get('language', 'ru') if user else 'ru'
    
    def set_user_language(self, user_id: int, language: str):
        """Установка языка пользователя"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('UPDATE users SET language = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', (language, user_id))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error setting user language: {e}")
            return False
    
    def save_referral(self, referrer_id: int, referred_id: int) -> bool:
        """Сохранение реферала"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Проверяем, не привязан ли уже к другому рефереру
            cursor.execute('SELECT referrer_id FROM referrals WHERE referred_id = ?', (referred_id,))
            existing = cursor.fetchone()
            
            if existing:
                conn.close()
                return False
            
            cursor.execute('''
                INSERT INTO referrals (referrer_id, referred_id)
                VALUES (?, ?)
            ''', (referrer_id, referred_id))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error saving referral: {e}")
            return False
    
    def get_referrer_id(self, user_id: int) -> Optional[int]:
        """Получение ID реферера"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('SELECT referrer_id FROM referrals WHERE referred_id = ?', (user_id,))
            row = cursor.fetchone()
            conn.close()
            return row[0] if row else None
        except Exception as e:
            logger.error(f"Error getting referrer ID: {e}")
            return None
    
    def save_transaction(self, user_id: int, transaction_type: str, bookmaker: str, amount: float, data: Dict[str, Any] = None) -> int:
        """Сохранение транзакции"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO transactions (user_id, type, bookmaker, amount, data)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, transaction_type, bookmaker, amount, json.dumps(data or {})))
            conn.commit()
            transaction_id = cursor.lastrowid
            conn.close()
            return transaction_id
        except Exception as e:
            logger.error(f"Error saving transaction: {e}")
            return None
    
    def create_deposit_request(self, user_id: int, bookmaker: str, player_id: str, 
                             amount: int, bank: str, payment_url: str) -> int:
        """Создание заявки на пополнение"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO deposit_requests (user_id, bookmaker, player_id, amount, bank, payment_url)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, bookmaker, player_id, amount, bank, payment_url))
            
            request_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return request_id
            
        except Exception as e:
            logger.error(f"Error creating deposit request: {e}")
            return 0
    
    def create_withdraw_request(self, user_id: int, bookmaker: str, player_id: str,
                              amount: int, bank: str, phone: str, site_code: str) -> int:
        """Создание заявки на вывод"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO withdraw_requests (user_id, bookmaker, player_id, amount, bank, phone, site_code)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, bookmaker, player_id, amount, bank, phone, site_code))
            
            request_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return request_id
            
        except Exception as e:
            logger.error(f"Error creating withdraw request: {e}")
            return 0
    
    def get_user_deposits(self, user_id: int, limit: int = 10) -> list:
        """Получение пополнений пользователя"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM deposit_requests 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            ''', (user_id, limit))
            
            columns = [description[0] for description in cursor.description]
            deposits = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            conn.close()
            return deposits
            
        except Exception as e:
            logger.error(f"Error getting user deposits: {e}")
            return []
    
    def get_user_withdrawals(self, user_id: int, limit: int = 10) -> list:
        """Получение выводов пользователя"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM withdraw_requests 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            ''', (user_id, limit))
            
            columns = [description[0] for description in cursor.description]
            withdrawals = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            conn.close()
            return withdrawals
            
        except Exception as e:
            logger.error(f"Error getting user withdrawals: {e}")
            return []
    
    def get_referrals_count(self, user_id: int) -> int:
        """Получение количества рефералов"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT COUNT(*) FROM referrals WHERE referrer_id = ?
            ''', (user_id,))
            
            count = cursor.fetchone()[0]
            conn.close()
            return count
            
        except Exception as e:
            logger.error(f"Error getting referrals count: {e}")
            return 0
    
    def get_referrals_earnings(self, user_id: int) -> int:
        """Получение заработка от рефералов"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Получаем всех рефералов пользователя
            cursor.execute('''
                SELECT referred_id FROM referrals WHERE referrer_id = ?
            ''', (user_id,))
            
            referred_ids = [row[0] for row in cursor.fetchall()]
            
            if not referred_ids:
                return 0
            
            # Получаем пополнения рефералов
            placeholders = ','.join(['?' for _ in referred_ids])
            cursor.execute(f'''
                SELECT COALESCE(SUM(amount), 0) FROM deposit_requests 
                WHERE user_id IN ({placeholders}) AND status = 'completed'
            ''', referred_ids)
            
            total_deposits = cursor.fetchone()[0]
            earnings = int(total_deposits * 0.05)  # 5% от суммы пополнений
            
            conn.close()
            return earnings
            
        except Exception as e:
            logger.error(f"Error getting referrals earnings: {e}")
            return 0
    
    def get_user_transactions(self, user_id: int, limit: int = 10) -> list:
        """Получение транзакций пользователя"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM transactions 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            ''', (user_id, limit))
            rows = cursor.fetchall()
            conn.close()
            
            transactions = []
            for row in rows:
                transactions.append({
                    'id': row[0],
                    'user_id': row[1],
                    'type': row[2],
                    'bookmaker': row[3],
                    'amount': row[4],
                    'status': row[5],
                    'data': json.loads(row[6]) if row[6] else {},
                    'created_at': row[7]
                })
            return transactions
        except Exception as e:
            logger.error(f"Error getting user transactions: {e}")
            return []


