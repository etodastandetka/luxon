#!/usr/bin/env python3
"""
Сервис реферальной системы согласно ТЗ
- Персональные ссылки для каждого пользователя
- Автоматические выплаты 5% от пополнений рефералов
- Многоуровневая система (1-й, 2-й уровень)
- Кэшбек-система
"""
import sqlite3
import hashlib
import random
import string
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)

class ReferralService:
    """Сервис реферальной системы"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_tables()
    
    def _init_tables(self):
        """Инициализация таблиц реферальной системы"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Таблица рефералов
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS referrals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    referrer_id INTEGER,
                    referred_id INTEGER,
                    level INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (referrer_id) REFERENCES users (user_id),
                    FOREIGN KEY (referred_id) REFERENCES users (user_id)
                )
            """)
            
            # Таблица реферальных выплат
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS referral_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    referrer_id INTEGER,
                    referred_id INTEGER,
                    amount REAL,
                    percentage REAL,
                    level INTEGER,
                    deposit_id INTEGER,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    paid_at TIMESTAMP,
                    FOREIGN KEY (referrer_id) REFERENCES users (user_id),
                    FOREIGN KEY (referred_id) REFERENCES users (user_id),
                    FOREIGN KEY (deposit_id) REFERENCES deposit_requests (id)
                )
            """)
            
            # Таблица настроек реферальной системы
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS referral_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Вставляем настройки по умолчанию
            default_settings = [
                ('referral_enabled', '1'),
                ('referral_percentage_level1', '5.0'),
                ('referral_percentage_level2', '2.0'),
                ('referral_min_deposit', '500'),
                ('referral_payout_day', '1'),
                ('referral_max_levels', '2')
            ]
            
            for key, value in default_settings:
                cursor.execute("""
                    INSERT OR IGNORE INTO referral_settings (key, value)
                    VALUES (?, ?)
                """, (key, value))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Error initializing referral tables: {e}")
    
    def generate_referral_link(self, user_id: int) -> str:
        """Генерация персональной реферальной ссылки"""
        try:
            # Создаем уникальный код для пользователя
            user_code = self._generate_user_code(user_id)
            return f"https://t.me/luxon_bot?start=ref{user_code}"
        except Exception as e:
            logger.error(f"Error generating referral link: {e}")
            return ""
    
    def _generate_user_code(self, user_id: int) -> str:
        """Генерация уникального кода пользователя"""
        # Используем хэш от user_id + соль для уникальности
        salt = "luxon_referral_2024"
        data = f"{user_id}_{salt}"
        hash_obj = hashlib.sha256(data.encode())
        return hash_obj.hexdigest()[:8].upper()
    
    def process_referral(self, referrer_code: str, new_user_id: int) -> bool:
        """Обработка нового реферала"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Находим referrer_id по коду
            referrer_id = self._get_user_id_by_code(referrer_code)
            if not referrer_id:
                conn.close()
                return False
            
            # Проверяем, не является ли новый пользователь уже рефералом
            cursor.execute("""
                SELECT id FROM referrals WHERE referred_id = ?
            """, (new_user_id,))
            
            if cursor.fetchone():
                conn.close()
                return False  # Пользователь уже является рефералом
            
            # Создаем связь реферала
            cursor.execute("""
                INSERT INTO referrals (referrer_id, referred_id, level)
                VALUES (?, ?, 1)
            """, (referrer_id, new_user_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"New referral: {new_user_id} referred by {referrer_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing referral: {e}")
            return False
    
    def _get_user_id_by_code(self, code: str) -> Optional[int]:
        """Получение user_id по реферальному коду"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Ищем пользователя по сгенерированному коду
            cursor.execute("SELECT user_id FROM users")
            users = cursor.fetchall()
            
            for (user_id,) in users:
                if self._generate_user_code(user_id) == code:
                    conn.close()
                    return user_id
            
            conn.close()
            return None
            
        except Exception as e:
            logger.error(f"Error getting user ID by code: {e}")
            return None
    
    def get_referral_stats(self, user_id: int) -> Dict:
        """Получение статистики рефералов пользователя"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Количество рефералов по уровням
            cursor.execute("""
                SELECT level, COUNT(*) as count
                FROM referrals 
                WHERE referrer_id = ?
                GROUP BY level
            """, (user_id,))
            
            level_stats = {}
            for level, count in cursor.fetchall():
                level_stats[f'level_{level}'] = count
            
            # Общее количество рефералов
            cursor.execute("""
                SELECT COUNT(*) FROM referrals WHERE referrer_id = ?
            """, (user_id,))
            total_referrals = cursor.fetchone()[0]
            
            # Заработок от рефералов
            cursor.execute("""
                SELECT COALESCE(SUM(amount), 0) FROM referral_payments 
                WHERE referrer_id = ? AND status = 'paid'
            """, (user_id,))
            total_earnings = cursor.fetchone()[0]
            
            # Ожидающие выплаты
            cursor.execute("""
                SELECT COALESCE(SUM(amount), 0) FROM referral_payments 
                WHERE referrer_id = ? AND status = 'pending'
            """, (user_id,))
            pending_earnings = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                'total_referrals': total_referrals,
                'total_earnings': total_earnings,
                'pending_earnings': pending_earnings,
                'level_stats': level_stats
            }
            
        except Exception as e:
            logger.error(f"Error getting referral stats: {e}")
            return {
                'total_referrals': 0,
                'total_earnings': 0,
                'pending_earnings': 0,
                'level_stats': {}
            }
    
    def process_deposit_referral(self, deposit_id: int, user_id: int, amount: float) -> bool:
        """Обработка реферальных выплат при пополнении"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Получаем настройки реферальной системы
            settings = self._get_referral_settings(cursor)
            
            if not settings.get('referral_enabled') == '1':
                conn.close()
                return False
            
            # Находим всех рефереров пользователя (многоуровневая система)
            referrers = self._get_referral_chain(user_id, cursor)
            
            for level, referrer_id in referrers.items():
                if level > int(settings.get('referral_max_levels', '2')):
                    break
                
                # Получаем процент для уровня
                percentage_key = f'referral_percentage_level{level}'
                percentage = float(settings.get(percentage_key, '0'))
                
                if percentage <= 0:
                    continue
                
                # Рассчитываем сумму выплаты
                referral_amount = amount * (percentage / 100)
                
                # Создаем запись о выплате
                cursor.execute("""
                    INSERT INTO referral_payments 
                    (referrer_id, referred_id, amount, percentage, level, deposit_id, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending')
                """, (referrer_id, user_id, referral_amount, percentage, level, deposit_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Processed referral payments for deposit {deposit_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing deposit referral: {e}")
            return False
    
    def _get_referral_chain(self, user_id: int, cursor) -> Dict[int, int]:
        """Получение цепочки рефереров (многоуровневая система)"""
        referrers = {}
        current_user = user_id
        level = 1
        
        while level <= 2:  # Максимум 2 уровня
            cursor.execute("""
                SELECT referrer_id FROM referrals 
                WHERE referred_id = ? AND level = 1
            """, (current_user,))
            
            row = cursor.fetchone()
            if not row:
                break
            
            referrer_id = row[0]
            referrers[level] = referrer_id
            current_user = referrer_id
            level += 1
        
        return referrers
    
    def _get_referral_settings(self, cursor) -> Dict[str, str]:
        """Получение настроек реферальной системы"""
        cursor.execute("SELECT key, value FROM referral_settings")
        return dict(cursor.fetchall())
    
    def get_pending_payments(self, user_id: int) -> List[Dict]:
        """Получение ожидающих выплат пользователя"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, amount, level, created_at
                FROM referral_payments 
                WHERE referrer_id = ? AND status = 'pending'
                ORDER BY created_at DESC
            """, (user_id,))
            
            columns = [description[0] for description in cursor.description]
            payments = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            conn.close()
            return payments
            
        except Exception as e:
            logger.error(f"Error getting pending payments: {e}")
            return []
    
    def process_monthly_payouts(self) -> Dict:
        """Обработка месячных выплат рефералов"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Получаем всех пользователей с ожидающими выплатами
            cursor.execute("""
                SELECT referrer_id, SUM(amount) as total_amount
                FROM referral_payments 
                WHERE status = 'pending'
                GROUP BY referrer_id
                HAVING total_amount >= 100  -- Минимальная сумма для выплаты
            """)
            
            payouts = []
            for referrer_id, total_amount in cursor.fetchall():
                # Обновляем статус выплат
                cursor.execute("""
                    UPDATE referral_payments 
                    SET status = 'paid', paid_at = CURRENT_TIMESTAMP
                    WHERE referrer_id = ? AND status = 'pending'
                """, (referrer_id,))
                
                payouts.append({
                    'user_id': referrer_id,
                    'amount': total_amount
                })
            
            conn.commit()
            conn.close()
            
            logger.info(f"Processed {len(payouts)} monthly referral payouts")
            return {
                'success': True,
                'payouts_count': len(payouts),
                'payouts': payouts
            }
            
        except Exception as e:
            logger.error(f"Error processing monthly payouts: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_referral_leaderboard(self, limit: int = 10) -> List[Dict]:
        """Получение таблицы лидеров рефералов"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    r.referrer_id,
                    u.first_name,
                    u.last_name,
                    u.username,
                    COUNT(r.referred_id) as referrals_count,
                    COALESCE(SUM(rp.amount), 0) as total_earnings
                FROM referrals r
                LEFT JOIN users u ON r.referrer_id = u.user_id
                LEFT JOIN referral_payments rp ON r.referrer_id = rp.referrer_id AND rp.status = 'paid'
                GROUP BY r.referrer_id, u.first_name, u.last_name, u.username
                ORDER BY referrals_count DESC, total_earnings DESC
                LIMIT ?
            """, (limit,))
            
            columns = [description[0] for description in cursor.description]
            leaderboard = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            conn.close()
            return leaderboard
            
        except Exception as e:
            logger.error(f"Error getting referral leaderboard: {e}")
            return []


# Глобальный экземпляр сервиса
_referral_service = None

def get_referral_service(db_path: str) -> ReferralService:
    """Получение экземпляра сервиса рефералов"""
    global _referral_service
    if _referral_service is None:
        _referral_service = ReferralService(db_path)
    return _referral_service

def generate_referral_link(user_id: int, db_path: str) -> str:
    """Удобная функция для генерации реферальной ссылки"""
    service = get_referral_service(db_path)
    return service.generate_referral_link(user_id)

def process_referral(referrer_code: str, new_user_id: int, db_path: str) -> bool:
    """Удобная функция для обработки реферала"""
    service = get_referral_service(db_path)
    return service.process_referral(referrer_code, new_user_id)

def process_deposit_referral(deposit_id: int, user_id: int, amount: float, db_path: str) -> bool:
    """Удобная функция для обработки реферальных выплат"""
    service = get_referral_service(db_path)
    return service.process_deposit_referral(deposit_id, user_id, amount)

