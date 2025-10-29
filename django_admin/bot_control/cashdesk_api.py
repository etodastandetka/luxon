"""
Cashdesk API клиент для Melbet и 1xbet
"""
import hashlib
import json
import requests
from datetime import datetime
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class CashdeskAPI:
    """Клиент для работы с Cashdesk API (Melbet/1xbet)"""
    
    def __init__(self, casino: str, hash_key: str, cashierpass: str, login: str, cashdeskid: int):
        """
        Инициализация API клиента
        
        Args:
            casino: 'melbet' или '1xbet'
            hash_key: Уникальный ключ для подписи
            cashierpass: Пароль кассира
            login: Логин кассира
            cashdeskid: Номер кассы (КРМ)
        """
        self.casino = casino
        self.hash_key = hash_key
        self.cashierpass = cashierpass
        self.login = login
        self.cashdeskid = cashdeskid
        self.base_url = "https://partners.servcul.com/CashdeskBotAPI"
    
    def _calculate_confirm(self, user_id: str) -> str:
        """Формирование подтверждающей строки confirm = MD5(userId:hash)"""
        confirm_str = f"{user_id}:{self.hash_key}"
        return hashlib.md5(confirm_str.encode()).hexdigest()
    
    def _generate_sign_balance(self, dt: str) -> str:
        """Генерация подписи для получения баланса"""
        # a. SHA256(hash={0}&cashierpass={1}&dt={2})
        step1 = f"hash={self.hash_key}&cashierpass={self.cashierpass}&dt={dt}"
        sha1 = hashlib.sha256(step1.encode()).hexdigest()
        
        # b. MD5(dt={0}&cashierpass={1}&cashdeskid={2})
        step2 = f"dt={dt}&cashierpass={self.cashierpass}&cashdeskid={self.cashdeskid}"
        md5_hash = hashlib.md5(step2.encode()).hexdigest()
        
        # c. SHA256(результаты a и b объединены)
        combined = sha1 + md5_hash
        sign = hashlib.sha256(combined.encode()).hexdigest()
        
        return sign
    
    def _generate_sign_player_search(self, user_id: str) -> str:
        """Генерация подписи для поиска игрока"""
        # a. SHA256(hash={0}&userid={1}&cashdeskid={2})
        step1 = f"hash={self.hash_key}&userid={user_id}&cashdeskid={self.cashdeskid}"
        sha1 = hashlib.sha256(step1.encode()).hexdigest()
        
        # b. MD5(userid={0}&cashierpass={1}&hash={2})
        step2 = f"userid={user_id}&cashierpass={self.cashierpass}&hash={self.hash_key}"
        md5_hash = hashlib.md5(step2.encode()).hexdigest()
        
        # c. SHA256(результаты a и b объединены)
        combined = sha1 + md5_hash
        sign = hashlib.sha256(combined.encode()).hexdigest()
        
        return sign
    
    def _generate_sign_deposit(self, lng: str, user_id: str, summa: float) -> str:
        """Генерация подписи для пополнения"""
        # a. SHA256(hash={0}&lng={1}&UserId={2})
        step1 = f"hash={self.hash_key}&lng={lng}&UserId={user_id}"
        sha1 = hashlib.sha256(step1.encode()).hexdigest()
        
        # b. MD5(summa={0}&cashierpass={1}&cashdeskid={2})
        step2 = f"summa={summa}&cashierpass={self.cashierpass}&cashdeskid={self.cashdeskid}"
        md5_hash = hashlib.md5(step2.encode()).hexdigest()
        
        # c. SHA256(результаты a и b объединены)
        combined = sha1 + md5_hash
        sign = hashlib.sha256(combined.encode()).hexdigest()
        
        return sign
    
    def _generate_sign_payout(self, lng: str, user_id: str, code: str) -> str:
        """Генерация подписи для выплаты"""
        # a. SHA256(hash={0}&lng={1}&UserId={2})
        step1 = f"hash={self.hash_key}&lng={lng}&UserId={user_id}"
        sha1 = hashlib.sha256(step1.encode()).hexdigest()
        
        # b. MD5(code={0}&cashierpass={1}&cashdeskid={2})
        step2 = f"code={code}&cashierpass={self.cashierpass}&cashdeskid={self.cashdeskid}"
        md5_hash = hashlib.md5(step2.encode()).hexdigest()
        
        # c. SHA256(результаты a и b объединены)
        combined = sha1 + md5_hash
        sign = hashlib.sha256(combined.encode()).hexdigest()
        
        return sign
    
    def get_balance(self) -> Dict[str, Any]:
        """
        1. Получение баланса кассы
        
        Returns:
            {'Balance': float, 'Limit': float}
        """
        try:
            dt = datetime.now().strftime('%Y.%m.%d %H:%M:%S')
            confirm = self._calculate_confirm(self.cashdeskid)
            sign = self._generate_sign_balance(dt)
            
            url = f"{self.base_url}/Cashdesk/{self.cashdeskid}/Balance?confirm={confirm}&dt={dt}"
            headers = {'sign': sign}
            
            logger.info(f"💰 Получение баланса для {self.casino}")
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Баланс получен: {data}")
                return data
            else:
                logger.error(f"❌ Ошибка получения баланса: {response.status_code} - {response.text}")
                return {'Balance': 0, 'Limit': 0}
                
        except Exception as e:
            logger.error(f"❌ Ошибка в get_balance: {e}")
            return {'Balance': 0, 'Limit': 0}
    
    def search_player(self, user_id: str) -> Dict[str, Any]:
        """
        2. Поиск игрока
        
        Args:
            user_id: ID игрока
            
        Returns:
            {'currencyId': int, 'userId': int, 'name': str}
        """
        try:
            confirm = self._calculate_confirm(user_id)
            sign = self._generate_sign_player_search(user_id)
            
            url = f"{self.base_url}/Users/{user_id}?confirm={confirm}&cashdeskId={self.cashdeskid}"
            headers = {'sign': sign}
            
            logger.info(f"🔍 Поиск игрока {user_id} для {self.casino}")
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Игрок найден: {data}")
                return data
            else:
                logger.error(f"❌ Игрок не найден: {response.status_code} - {response.text}")
                return {}
                
        except Exception as e:
            logger.error(f"❌ Ошибка в search_player: {e}")
            return {}
    
    def deposit(self, user_id: str, summa: float, lng: str = 'ru') -> Dict[str, Any]:
        """
        3. Пополнение счета игрока
        
        Args:
            user_id: ID игрока
            summa: Сумма пополнения
            lng: Язык
            
        Returns:
            {'summa': float, 'success': bool, 'messageId': int, 'message': str}
        """
        try:
            confirm = self._calculate_confirm(user_id)
            sign = self._generate_sign_deposit(lng, user_id, summa)
            
            url = f"{self.base_url}/Deposit/{user_id}/Add"
            headers = {'sign': sign, 'Content-Type': 'application/json'}
            
            payload = {
                'cashdeskId': self.cashdeskid,
                'lng': lng,
                'summa': summa,
                'confirm': confirm
            }
            
            logger.info(f"💸 Пополнение {summa} для игрока {user_id} в {self.casino}")
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Пополнение выполнено: {data}")
                return data
            else:
                logger.error(f"❌ Ошибка пополнения: {response.status_code} - {response.text}")
                return {'success': False, 'message': 'Ошибка API', 'messageId': -1}
                
        except Exception as e:
            logger.error(f"❌ Ошибка в deposit: {e}")
            return {'success': False, 'message': str(e), 'messageId': -1}
    
    def payout(self, user_id: str, code: str, lng: str = 'ru') -> Dict[str, Any]:
        """
        4. Выплата со счета игрока
        
        Args:
            user_id: ID игрока
            code: Код подтверждения
            lng: Язык
            
        Returns:
            {'summa': float, 'success': bool, 'messageId': int, 'message': str}
        """
        try:
            confirm = self._calculate_confirm(user_id)
            sign = self._generate_sign_payout(lng, user_id, code)
            
            url = f"{self.base_url}/Deposit/{user_id}/Payout"
            headers = {'sign': sign, 'Content-Type': 'application/json'}
            
            payload = {
                'cashdeskId': self.cashdeskid,
                'lng': lng,
                'code': code,
                'confirm': confirm
            }
            
            logger.info(f"💰 Выплата {code} для игрока {user_id} в {self.casino}")
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Выплата выполнена: {data}")
                return data
            else:
                logger.error(f"❌ Ошибка выплаты: {response.status_code} - {response.text}")
                return {'success': False, 'message': 'Ошибка API', 'messageId': -1}
                
        except Exception as e:
            logger.error(f"❌ Ошибка в payout: {e}")
            return {'success': False, 'message': str(e), 'messageId': -1}
