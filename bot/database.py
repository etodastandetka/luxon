#!/usr/bin/env python3
"""
База данных для универсального бота
"""
import sqlite3
import logging
import os
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_path: str = None):
        # Use single root DB by default to unify all modules
        if not db_path:
            # 1) ENV override (recommended for prod)
            db_path = os.getenv('BOT_DATABASE_PATH')
            if not db_path:
                # 2) Project-relative default: <project_root>/universal_bot.db
                # bot/database.py -> project_root = parents[1]
                project_root = Path(__file__).resolve().parents[1]
                db_path = str(project_root / 'universal_bot.db')
        self.db_path = db_path
        self.init_db()
        self.migrate_db()
    
    def init_db(self):
        """Инициализация базы данных"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Включаем foreign key constraints
        cursor.execute("PRAGMA foreign_keys = ON")
        
        # Создаем таблицу пользователей
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            language TEXT DEFAULT 'ru',
            selected_bookmaker TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Проверяем, существует ли колонка selected_bookmaker
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'selected_bookmaker' not in columns:
            # Добавляем колонку, если её нет
            cursor.execute('ALTER TABLE users ADD COLUMN selected_bookmaker TEXT DEFAULT NULL')
            logger.info("Added selected_bookmaker column to users table")
        
        # Создаем таблицу пользовательских данных
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            data_type TEXT,
            data_value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
            UNIQUE(user_id, data_type)
        )
        ''')
        
        # Проверяем структуру таблицы user_data
        cursor.execute("PRAGMA table_info(user_data)")
        user_data_columns = [column[1] for column in cursor.fetchall()]
        
        # Если старая схема без колонки id — пересоздаем таблицу с id PRIMARY KEY AUTOINCREMENT
        if 'id' not in user_data_columns:
            try:
                logger.info("Rebuilding user_data table to add id column")
                cursor.execute("PRAGMA foreign_keys = OFF")
                conn.commit()
                # Создаем новую таблицу с нужной схемой
                cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_data_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    data_type TEXT,
                    data_value TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
                    UNIQUE(user_id, data_type)
                )
                ''')
                # Переносим данные, устраняя дубликаты по (user_id, data_type)
                cursor.execute('''
                INSERT INTO user_data_new (user_id, data_type, data_value, created_at)
                SELECT user_id, data_type, MAX(COALESCE(data_value, '')) as data_value,
                       COALESCE(MIN(created_at), CURRENT_TIMESTAMP) as created_at
                FROM user_data
                GROUP BY user_id, data_type
                ''')
                conn.commit()
                # Заменяем таблицы
                cursor.execute('ALTER TABLE user_data RENAME TO user_data_backup')
                cursor.execute('ALTER TABLE user_data_new RENAME TO user_data')
                conn.commit()
                # Чистка
                cursor.execute('DROP TABLE IF EXISTS user_data_backup')
                cursor.execute("PRAGMA foreign_keys = ON")
                conn.commit()
                # Обновляем список колонок
                cursor.execute("PRAGMA table_info(user_data)")
                user_data_columns = [column[1] for column in cursor.fetchall()]
                logger.info("user_data table rebuilt successfully")
            except Exception as e:
                logger.warning(f"Failed to rebuild user_data table: {e}")
                cursor.execute("PRAGMA foreign_keys = ON")
                conn.commit()
        
        # Добавляем недостающие колонки в user_data
        if 'data_value' not in user_data_columns:
            cursor.execute('ALTER TABLE user_data ADD COLUMN data_value TEXT')
            logger.info("Added data_value column to user_data table")
        
        if 'created_at' not in user_data_columns:
            cursor.execute('ALTER TABLE user_data ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
            logger.info("Added created_at column to user_data table")
        
        # Создаем таблицу рефералов
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_id INTEGER,
            referred_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (referrer_id) REFERENCES users (user_id) ON DELETE CASCADE,
            FOREIGN KEY (referred_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        ''')
        
        # Создаем таблицу реферальных заработков
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS referral_earnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_id INTEGER,
            referred_id INTEGER,
            amount REAL,
            commission_amount REAL,
            bookmaker TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (referrer_id) REFERENCES users (user_id) ON DELETE CASCADE,
            FOREIGN KEY (referred_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        ''')
        
        # Создаем таблицу транзакций
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            bookmaker TEXT,
            trans_type TEXT,
            amount REAL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        ''')
        
        # Создаем таблицу заявок (requests) для пополнений/выводов, если её нет
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT,
            first_name TEXT,
            bookmaker TEXT,
            account_id TEXT,
            amount REAL,
            request_type TEXT, -- 'deposit' | 'withdraw'
            status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'processing' | 'completed'
            auto_completed INTEGER DEFAULT 0,
            photo_file_id TEXT,
            photo_file_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
        ''')
        
        # Индексы для ускорения поиска заявок
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(request_type)")
        except Exception as e:
            logger.warning(f"Could not create indexes on requests: {e}")
        
        # Создаем таблицу топ рефералов
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS referral_top (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            total_earnings REAL DEFAULT 0,
            total_referrals INTEGER DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        ''')
        
        # Создаем таблицу выплат топ рефералам
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS top_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            position INTEGER,
            amount REAL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        ''')
        
        # Создаем таблицу выводов средств
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            bookmaker TEXT,
            amount REAL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP NULL,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        ''')
        
        # Создаем таблицу ежемесячных выплат
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS monthly_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            position INTEGER,
            amount REAL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
        ''')
        
        # Создаем таблицу настроек бота
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS bot_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Вставляем настройки по умолчанию
        cursor.execute('''
        INSERT OR IGNORE INTO bot_settings (key, value) VALUES 
        ('is_active', '1'),
        ('maintenance_message', '🔧 Технические работы\nБот временно недоступен. Попробуйте позже.')
        ''')
        
        conn.commit()
        conn.close()

    # ===== История транзакций пользователя (для кнопки "История") =====
    def get_user_transactions(self, user_id: int, limit: int = 5, offset: int = 0) -> List[Dict[str, Any]]:
        """Вернуть список транзакций пользователя из таблицы transactions"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                '''
                SELECT id, user_id, bookmaker, trans_type, amount, status, created_at, NULL as xbet_id
                FROM transactions
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                ''', (user_id, limit, offset)
            )
            rows = cursor.fetchall()
            conn.close()
            cols = ['id', 'user_id', 'bookmaker', 'trans_type', 'amount', 'status', 'created_at', 'xbet_id']
            return [dict(zip(cols, r)) for r in rows]
        except Exception as e:
            logger.error(f"Error get_user_transactions: {e}")
            return []

    def get_user_transactions_count(self, user_id: int) -> int:
        """Вернуть количество транзакций пользователя"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM transactions WHERE user_id = ?', (user_id,))
            n = cursor.fetchone()
            conn.close()
            return int(n[0]) if n else 0
        except Exception as e:
            logger.error(f"Error get_user_transactions_count: {e}")
            return 0
    
    def save_user(self, user_id: int, username: Optional[str] = None, 
                  first_name: Optional[str] = None, last_name: Optional[str] = None):
        """Сохранение пользователя"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Проверяем, существует ли пользователь
        cursor.execute('SELECT user_id FROM users WHERE user_id = ?', (user_id,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            # Обновляем существующего пользователя
            cursor.execute('''
            UPDATE users SET username = ?, first_name = ?, last_name = ?
            WHERE user_id = ?
            ''', (username, first_name, last_name, user_id))
        else:
            # Создаем нового пользователя
            cursor.execute('''
            INSERT INTO users (user_id, username, first_name, last_name, language, created_at)
            VALUES (?, ?, ?, ?, 'ru', CURRENT_TIMESTAMP)
            ''', (user_id, username, first_name, last_name))
        
        conn.commit()
        conn.close()
    
    def get_user_language(self, user_id: int) -> str:
        """Получение языка пользователя"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT language FROM users WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        
        conn.close()
        
        if result:
            return result[0]
        return 'ru'
    
    def save_user_data(self, user_id: int, data_type: str, data_value: str, bookmaker: str = None):
        """Сохранение пользовательских данных"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if bookmaker:
            # Для ID сохраняем с указанием букмекера
            data_key = f"{data_type}_{bookmaker}"
        else:
            data_key = data_type
        
        # Используем INSERT OR REPLACE для обновления существующей записи
        cursor.execute('''
        INSERT OR REPLACE INTO user_data (user_id, data_type, data_value)
        VALUES (?, ?, ?)
        ''', (user_id, data_key, data_value))
        
        conn.commit()
        conn.close()
    
    def get_user_data(self, user_id: int, data_type: str, bookmaker: str = None) -> Optional[str]:
        """Получение пользовательских данных"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if bookmaker:
            # Для ID получаем с указанием букмекера
            data_key = f"{data_type}_{bookmaker}"
        else:
            data_key = data_type
        
        cursor.execute('SELECT data_value FROM user_data WHERE user_id = ? AND data_type = ?', (user_id, data_key))
        result = cursor.fetchone()
        
        conn.close()
        
        if result:
            return result[0]
        return None
    
    def save_referral(self, referrer_id: int, referred_id: int):
        """Сохранение реферала"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        INSERT OR REPLACE INTO referrals (referrer_id, referred_id)
        VALUES (?, ?)
        ''', (referrer_id, referred_id))
        
        conn.commit()
        conn.close()
    
    def save_transaction(self, user_id: int, bookmaker: str, trans_type: str, amount: float):
        """Сохранение транзакции"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        INSERT INTO transactions (user_id, bookmaker, trans_type, amount)
        VALUES (?, ?, ?, ?)
        ''', (user_id, bookmaker, trans_type, amount))
        
        transaction_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return transaction_id
    
    def save_user_language(self, user_id: int, language: str):
        """Сохранение языка пользователя"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Проверяем, существует ли пользователь
        cursor.execute('SELECT user_id FROM users WHERE user_id = ?', (user_id,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            # Обновляем существующего пользователя
            cursor.execute('UPDATE users SET language = ? WHERE user_id = ?', (language, user_id))
        else:
            # Создаем нового пользователя
            cursor.execute('''
            INSERT INTO users (user_id, language, created_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', (user_id, language))
        
        conn.commit()
        conn.close()
    
    def migrate_db(self):
        """Миграция базы данных для добавления недостающих колонок"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Проверяем структуру таблицы users
            cursor.execute("PRAGMA table_info(users)")
            columns = [column[1] for column in cursor.fetchall()]
            
            # Добавляем недостающие колонки
            if 'selected_bookmaker' not in columns:
                cursor.execute('ALTER TABLE users ADD COLUMN selected_bookmaker TEXT DEFAULT NULL')
                logger.info("Added selected_bookmaker column to users table")
            
            if 'language' not in columns:
                cursor.execute('ALTER TABLE users ADD COLUMN language TEXT DEFAULT "ru"')
                logger.info("Added language column to users table")
            
            if 'created_at' not in columns:
                cursor.execute('ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
                logger.info("Added created_at column to users table")
            
            # Проверяем структуру таблицы user_data
            cursor.execute("PRAGMA table_info(user_data)")
            user_data_columns = [column[1] for column in cursor.fetchall()]
            
            # Добавляем недостающие колонки в user_data
            if 'data_value' not in user_data_columns:
                cursor.execute('ALTER TABLE user_data ADD COLUMN data_value TEXT')
                logger.info("Added data_value column to user_data table")
            
            if 'created_at' not in user_data_columns:
                cursor.execute('ALTER TABLE user_data ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
                logger.info("Added created_at column to user_data table")
            
            # Очищаем дублирующиеся записи в user_data
            try:
                cursor.execute('''
                DELETE FROM user_data 
                WHERE id NOT IN (
                    SELECT MIN(id) 
                    FROM user_data 
                    GROUP BY user_id, data_type
                )
                ''')
                deleted_count = cursor.rowcount
                if deleted_count > 0:
                    logger.info(f"Cleaned up {deleted_count} duplicate records in user_data table")
            except Exception as e:
                logger.warning(f"Could not clean up duplicate records: {e}")
            
            # Добавляем уникальный индекс для предотвращения дублирования записей
            try:
                cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_data_unique ON user_data(user_id, data_type)')
                logger.info("Added unique index to user_data table")
            except Exception as e:
                logger.warning(f"Could not add unique index to user_data table: {e}")
            
            # Миграция таблицы withdrawals: если это VIEW (после нашей унификации) — пропускаем
            try:
                cursor.execute("SELECT type FROM sqlite_master WHERE name='withdrawals'")
                row = cursor.fetchone()
                is_view = (row and (row[0] == 'view'))
            except Exception:
                is_view = False
            if not is_view:
                cursor.execute("PRAGMA table_info(withdrawals)")
                withdrawals_cols = [column[1] for column in cursor.fetchall()]
                if 'bank_code' not in withdrawals_cols:
                    try:
                        cursor.execute('ALTER TABLE withdrawals ADD COLUMN bank_code TEXT')
                        logger.info("Added bank_code column to withdrawals table")
                    except Exception as e:
                        logger.warning(f"Cannot add bank_code to withdrawals: {e}")
                if 'withdraw_code' not in withdrawals_cols:
                    try:
                        cursor.execute('ALTER TABLE withdrawals ADD COLUMN withdraw_code TEXT')
                        logger.info("Added withdraw_code column to withdrawals table")
                    except Exception as e:
                        logger.warning(f"Cannot add withdraw_code to withdrawals: {e}")
                if 'photo_file_id' not in withdrawals_cols:
                    try:
                        cursor.execute('ALTER TABLE withdrawals ADD COLUMN photo_file_id TEXT')
                        logger.info("Added photo_file_id column to withdrawals table")
                    except Exception as e:
                        logger.warning(f"Cannot add photo_file_id to withdrawals: {e}")

            conn.commit()
            
            # Миграция таблицы requests: добавляем admin_chat_id, admin_message_id при необходимости
            try:
                cursor.execute("PRAGMA table_info(requests)")
                req_cols = [column[1] for column in cursor.fetchall()]
                if 'admin_chat_id' not in req_cols:
                    cursor.execute('ALTER TABLE requests ADD COLUMN admin_chat_id INTEGER')
                    logger.info("Added admin_chat_id column to requests table")
                if 'admin_message_id' not in req_cols:
                    cursor.execute('ALTER TABLE requests ADD COLUMN admin_message_id INTEGER')
                    logger.info("Added admin_message_id column to requests table")
                if 'processed_at' not in req_cols:
                    # На случай старой схемы без processed_at
                    try:
                        cursor.execute('ALTER TABLE requests ADD COLUMN processed_at TIMESTAMP')
                        logger.info("Added processed_at column to requests table")
                    except Exception:
                        pass
                conn.commit()
            except Exception as e:
                logger.warning(f"Requests table migration skipped or failed: {e}")
            conn.close()
            logger.info("Database migration completed successfully")
            
        except Exception as e:
            logger.error(f"Error during database migration: {e}")
    
    def save_user_bookmaker(self, user_id: int, bookmaker: str):
        """Сохранение выбранного букмекера"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Сначала проверяем, существует ли пользователь
        cursor.execute('SELECT user_id FROM users WHERE user_id = ?', (user_id,))
        if not cursor.fetchone():
            # Если пользователя нет, создаем его
            cursor.execute('''
            INSERT INTO users (user_id, selected_bookmaker)
            VALUES (?, ?)
            ''', (user_id, bookmaker))
        else:
            # Если пользователь есть, обновляем букмекера
            cursor.execute('''
            UPDATE users SET selected_bookmaker = ? WHERE user_id = ?
            ''', (bookmaker, user_id))
        
        conn.commit()
        conn.close()
    
    def get_user_bookmaker(self, user_id: int) -> Optional[str]:
        """Получение выбранного букмекера пользователя"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT selected_bookmaker FROM users WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        
        if result and result[0]:
            return result[0]
        return None
    

    

    
    # Referral system methods
    def create_referral(self, referrer_id: int, referred_id: int) -> bool:
        """Create referral relationship"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            INSERT INTO referrals (referrer_id, referred_id)
            VALUES (?, ?)
            ''', (referrer_id, referred_id))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error creating referral: {e}")
            return False
    
    def get_referral_by_referred_id(self, referred_id: int) -> Optional[Dict[str, Any]]:
        """Get referral by referred user ID"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT * FROM referrals WHERE referred_id = ?
            ''', (referred_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                columns = ['id', 'referrer_id', 'referred_id', 'created_at']
                return dict(zip(columns, result))
            return None
        except Exception as e:
            logger.error(f"Error getting referral: {e}")
            return None
    
    def get_referrer_id(self, user_id: int) -> Optional[int]:
        """Get referrer ID for user"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT referrer_id FROM referrals WHERE referred_id = ?
            ''', (user_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return result[0]
            return None
        except Exception as e:
            logger.error(f"Error getting referrer ID: {e}")
            return None
    
    def get_referral_list(self, user_id: int) -> List[Dict[str, Any]]:
        """Get list of referrals for user"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT r.referred_id, re.amount, re.commission_amount
            FROM referrals r
            LEFT JOIN referral_earnings re ON r.referred_id = re.referred_id
            WHERE r.referrer_id = ?
            ''', (user_id,))
            
            results = cursor.fetchall()
            conn.close()
            
            referrals = []
            for row in results:
                referrals.append({
                    'user_id': row[0],
                    'amount': row[1] or 0,
                    'commission_amount': row[2] or 0
                })
            
            return referrals
        except Exception as e:
            logger.error(f"Error getting referral list: {e}")
            return []
    
    def get_referral_count(self, user_id: int) -> int:
        """Get referral count for user"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT COUNT(*) FROM referrals WHERE referrer_id = ?
            ''', (user_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            return result[0] if result else 0
        except Exception as e:
            logger.error(f"Error getting referral count: {e}")
            return 0
    
    def get_referral_earnings(self, user_id: int) -> float:
        """Get total referral earnings for user"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT COALESCE(SUM(commission_amount), 0) FROM referral_earnings 
            WHERE referrer_id = ? AND status = 'completed'
            ''', (user_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            return result[0] if result else 0.0
        except Exception as e:
            logger.error(f"Error getting referral earnings: {e}")
            return 0.0
    
    def get_pending_referral_earnings(self, user_id: int) -> float:
        """Get pending referral earnings for user"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT COALESCE(SUM(commission_amount), 0) FROM referral_earnings 
            WHERE referrer_id = ? AND status = 'pending'
            ''', (user_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            return result[0] if result else 0.0
        except Exception as e:
            logger.error(f"Error getting pending earnings: {e}")
            return 0.0
    
    def save_referral_commission(self, referrer_id: int, referred_id: int, 
                                amount: float, commission_amount: float, bookmaker: str) -> bool:
        """Save referral commission"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            INSERT INTO referral_earnings (referrer_id, referred_id, amount, commission_amount, bookmaker)
            VALUES (?, ?, ?, ?, ?)
            ''', (referrer_id, referred_id, amount, commission_amount, bookmaker))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error saving referral commission: {e}")
            return False
    
    def get_referral_top(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get referral top by earnings"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT 
                r.referrer_id,
                u.username,
                u.first_name,
                u.last_name,
                COUNT(r.referred_id) as referrals_count,
                COALESCE(SUM(re.commission_amount), 0) as total_earnings
            FROM referrals r
            LEFT JOIN users u ON r.referrer_id = u.user_id
            LEFT JOIN referral_earnings re ON r.referred_id = re.referred_id
            GROUP BY r.referrer_id, u.username, u.first_name, u.last_name
            ORDER BY total_earnings DESC
            LIMIT ?
            ''', (limit,))
            
            results = cursor.fetchall()
            conn.close()
            
            top = []
            for row in results:
                top.append({
                    'referrer_id': row[0],
                    'username': row[1],
                    'first_name': row[2],
                    'last_name': row[3],
                    'referrals_count': row[4],
                    'total_earnings': row[5]
                })
            
            return top
        except Exception as e:
            logger.error(f"Error getting referral top: {e}")
            return []
    
    def get_referral_top_by_period(self, start_date: datetime, end_date: datetime, 
                                  limit: int = 10) -> List[Dict[str, Any]]:
        """Get referral top by period"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT 
                r.referrer_id,
                u.username,
                u.first_name,
                u.last_name,
                COUNT(r.referred_id) as referrals_count,
                COALESCE(SUM(re.commission_amount), 0) as total_earnings
            FROM referrals r
            LEFT JOIN users u ON r.referrer_id = u.user_id
            LEFT JOIN referral_earnings re ON r.referred_id = re.referred_id
            WHERE re.created_at BETWEEN ? AND ?
            GROUP BY r.referrer_id, u.username, u.first_name, u.last_name
            ORDER BY total_earnings DESC
            LIMIT ?
            ''', (start_date, end_date, limit))
            
            results = cursor.fetchall()
            conn.close()
            
            top = []
            for row in results:
                top.append({
                    'referrer_id': row[0],
                    'username': row[1],
                    'first_name': row[2],
                    'last_name': row[3],
                    'referrals_count': row[4],
                    'total_earnings': row[5]
                })
            
            return top
        except Exception as e:
            logger.error(f"Error getting referral top by period: {e}")
            return []
    
    def save_referral(self, referrer_id: int, referred_id: int):
        """Сохранение реферала"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        INSERT OR IGNORE INTO referrals (referrer_id, referred_id)
        VALUES (?, ?)
        ''', (referrer_id, referred_id))
        
        conn.commit()
        conn.close()
    
    def get_referral_count(self, user_id: int) -> int:
        """Получение количества рефералов"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM referrals WHERE referrer_id = ?', (user_id,))
        result = cursor.fetchone()
        
        conn.close()
        
        return result[0] if result else 0
    
    def get_referral_earnings(self, user_id: int) -> float:
        """Получение заработка с рефералов"""
        # Пока возвращаем 0, так как логика расчета не реализована
        return 0.0
    
    def get_pending_referral_earnings(self, user_id: int) -> float:
        """Получение ожидающих выплат с рефералов"""
        # Пока возвращаем 0
        return 0.0
    
    def get_referral_list(self, user_id: int) -> List[Dict[str, Any]]:
        """Получение списка рефералов"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT r.referred_id, u.username, u.first_name
        FROM referrals r
        LEFT JOIN users u ON r.referred_id = u.user_id
        WHERE r.referrer_id = ?
        ORDER BY r.created_at DESC
        ''', (user_id,))
        
        results = cursor.fetchall()
        conn.close()
        
        referrals = []
        for row in results:
            referrals.append({
                'user_id': row[0],
                'username': row[1],
                'first_name': row[2],
                'amount': 0  # Пока 0, так как нет связи с транзакциями
            })
        
        return referrals
    
    def get_monthly_referral_top(self, year: int, month: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Получение топа рефероводов за месяц"""
        # Пока возвращаем пустой список
        return []
    
    def add_referral_earning(self, referrer_id: int, referred_id: int, amount: float, 
                           commission_amount: float, bookmaker: str):
        """Добавление реферального заработка"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            INSERT INTO referral_earnings (referrer_id, referred_id, amount, commission_amount, bookmaker)
            VALUES (?, ?, ?, ?, ?)
            ''', (referrer_id, referred_id, amount, commission_amount, bookmaker))
            
            # Обновляем топ рефералов
            self.update_referral_top(referrer_id, commission_amount)
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error adding referral earning: {e}")
            return False
    
    def update_referral_top(self, user_id: int, earnings: float):
        """Обновление топа рефералов"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Проверяем, есть ли запись в топе
            cursor.execute('SELECT id, total_earnings FROM referral_top WHERE user_id = ?', (user_id,))
            existing = cursor.fetchone()
            
            if existing:
                # Обновляем существующую запись
                new_total = existing[1] + earnings
                cursor.execute('''
                UPDATE referral_top 
                SET total_earnings = ?, last_updated = CURRENT_TIMESTAMP
                WHERE user_id = ?
                ''', (new_total, user_id))
            else:
                # Создаем новую запись
                cursor.execute('''
                INSERT INTO referral_top (user_id, total_earnings, last_updated)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ''', (user_id, earnings))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error updating referral top: {e}")
            return False
    
    def get_referral_top(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Получение топа рефералов"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT 
                rt.user_id,
                u.username,
                u.first_name,
                u.last_name,
                rt.total_earnings,
                rt.total_referrals,
                rt.last_updated
            FROM referral_top rt
            LEFT JOIN users u ON rt.user_id = u.user_id
            ORDER BY rt.total_earnings DESC
            LIMIT ?
            ''', (limit,))
            
            results = cursor.fetchall()
            conn.close()
            
            top = []
            for i, row in enumerate(results):
                top.append({
                    'position': i + 1,
                    'user_id': row[0],
                    'username': row[1] or 'Без username',
                    'first_name': row[2] or '',
                    'last_name': row[3] or '',
                    'total_earnings': row[4] or 0,
                    'total_referrals': row[5] or 0,
                    'last_updated': row[6]
                })
            
            return top
        except Exception as e:
            logger.error(f"Error getting referral top: {e}")
            return []
    
    def get_user_referral_stats(self, user_id: int) -> Dict[str, Any]:
        """Получение статистики рефералов пользователя"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Общее количество рефералов
            cursor.execute('SELECT COUNT(*) FROM referrals WHERE referrer_id = ?', (user_id,))
            total_referrals = cursor.fetchone()[0]
            
            # Общий заработок
            cursor.execute('SELECT COALESCE(SUM(commission_amount), 0) FROM referral_earnings WHERE referrer_id = ?', (user_id,))
            total_earnings = cursor.fetchone()[0]
            
            # Позиция в топе
            cursor.execute('''
            SELECT COUNT(*) + 1 FROM referral_top 
            WHERE total_earnings > (
                SELECT COALESCE(total_earnings, 0) FROM referral_top WHERE user_id = ?
            )
            ''', (user_id,))
            position = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                'total_referrals': total_referrals,
                'total_earnings': total_earnings,
                'position': position
            }
        except Exception as e:
            logger.error(f"Error getting user referral stats: {e}")
            return {'total_referrals': 0, 'total_earnings': 0, 'position': 0}
    
    def process_top_payments(self):
        """Обработка выплат топ-3 рефералам"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Получаем топ-3
            top_3 = self.get_referral_top(3)
            
            # Суммы выплат
            payment_amounts = [10000, 5000, 2500]
            
            for i, user in enumerate(top_3):
                if i < 3:  # Только топ-3
                    user_id = user['user_id']
                    amount = payment_amounts[i]
                    position = i + 1
                    
                    # Проверяем, не была ли уже выплата
                    cursor.execute('''
                    SELECT id FROM top_payments 
                    WHERE user_id = ? AND position = ? AND status = 'completed'
                    ''', (user_id, position))
                    
                    if not cursor.fetchone():
                        # Создаем запись о выплате
                        cursor.execute('''
                        INSERT INTO top_payments (user_id, position, amount, status)
                        VALUES (?, ?, ?, 'pending')
                        ''', (user_id, position, amount))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error processing top payments: {e}")
            return False
    
    def get_user_avatar_url(self, user_id: int, bot_token: str) -> Optional[str]:
        """Получение URL аватарки пользователя через Telegram Bot API"""
        try:
            import requests
            
            # Получаем информацию о фотографиях профиля пользователя
            url = f"https://api.telegram.org/bot{bot_token}/getUserProfilePhotos"
            params = {
                'user_id': user_id,
                'limit': 1
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data['ok'] and data['result']['total_count'] > 0:
                    file_id = data['result']['photos'][0][0]['file_id']
                    
                    # Получаем путь к файлу
                    file_url = f"https://api.telegram.org/bot{bot_token}/getFile"
                    file_params = {'file_id': file_id}
                    
                    file_response = requests.get(file_url, params=file_params, timeout=10)
                    if file_response.status_code == 200:
                        file_data = file_response.json()
                        if file_data['ok']:
                            file_path = file_data['result']['file_path']
                            return f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
            
            return None
        except Exception as e:
            logger.error(f"Error getting user avatar: {e}")
            return None
