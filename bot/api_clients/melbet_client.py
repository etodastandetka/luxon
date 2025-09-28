#!/usr/bin/env python3
"""
API клиент для MELBET
"""
import hashlib
import requests
import logging
import base64
from datetime import datetime, timezone
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class MelbetAPIClient:
    """API клиент для работы с MELBET"""
    
    def __init__(self, config: Dict):
        self.base_url = "https://partners.servcul.com/CashdeskBotAPI/"
        self.hash_key = config.get("hash")
        self.cashierpass = config.get("cashierpass") 
        self.login = config.get("login")
        self.cashdeskid = config.get("cashdeskid")
        
        if not all([self.hash_key, self.cashierpass, self.login, self.cashdeskid]):
            raise ValueError("Не все обязательные параметры API указаны")
        
        # Создаем заголовок авторизации
        auth_string = f"{self.login}:{self.cashierpass}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        self.auth_header = f"Basic {auth_b64}"
        
        # Также пробуем другой вариант авторизации
        self.api_key_header = f"Bearer {self.hash_key}"
    
    def _generate_confirm(self, user_id: str) -> str:
        """Генерация confirm строки: MD5(userId:hash)"""
        confirm_string = f"{user_id.lower()}:{self.hash_key}"
        return hashlib.md5(confirm_string.encode()).hexdigest()
    
    def _generate_sign_for_deposit(self, user_id: str, amount: float) -> str:
        """Генерация подписи для пополнения (как у 1XBET: userid в lower-case)"""
        # a) SHA256(hash={hash}&lng=ru&userid={user_id})
        step1_string = f"hash={self.hash_key}&lng=ru&userid={user_id.lower()}"
        step1_hash = hashlib.sha256(step1_string.encode()).hexdigest()
        
        # b) MD5(summa={amount}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
        step2_string = f"summa={amount}&cashierpass={self.cashierpass}&cashdeskid={self.cashdeskid}"
        step2_hash = hashlib.md5(step2_string.encode()).hexdigest()
        
        # c) SHA256(step1 + step2)
        combined = step1_hash + step2_hash
        final_sign = hashlib.sha256(combined.encode()).hexdigest()
        return final_sign

    def _generate_sign_for_payout(self, user_id: str, code: str) -> str:
        """Генерация подписи для выплаты (как у 1XBET: userid в lower-case)"""
        # a) SHA256(hash={hash}&lng=ru&userid={user_id})
        step1_string = f"hash={self.hash_key}&lng=ru&userid={user_id.lower()}"
        step1_hash = hashlib.sha256(step1_string.encode()).hexdigest()
        
        # b) MD5(code={code}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
        step2_string = f"code={code}&cashierpass={self.cashierpass}&cashdeskid={self.cashdeskid}"
        step2_hash = hashlib.md5(step2_string.encode()).hexdigest()
        
        # c) SHA256(step1 + step2)
        combined = step1_hash + step2_hash
        final_sign = hashlib.sha256(combined.encode()).hexdigest()
        return final_sign

    def get_balance(self) -> Dict:
        """Получение баланса кассы"""
        try:
            # Формируем дату в UTC
            dt = datetime.now(timezone.utc).strftime("%Y.%m.%d %H:%M:%S")
            
            # Генерируем confirm: MD5(cashdeskid:hash)
            confirm_string = f"{self.cashdeskid}:{self.hash_key}"
            confirm = hashlib.md5(confirm_string.encode()).hexdigest()
            
            # Генерируем подпись для баланса
            # a) SHA256(hash={hash}&cashierpass={cashierpass}&dt={dt})
            step1_string = f"hash={self.hash_key}&cashierpass={self.cashierpass}&dt={dt}"
            step1_hash = hashlib.sha256(step1_string.encode()).hexdigest()
            
            # b) MD5(dt={dt}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
            step2_string = f"dt={dt}&cashierpass={self.cashierpass}&cashdeskid={self.cashdeskid}"
            step2_hash = hashlib.md5(step2_string.encode()).hexdigest()
            
            # c) SHA256(step1 + step2)
            combined = step1_hash + step2_hash
            sign = hashlib.sha256(combined.encode()).hexdigest()
            
            # Формируем URL
            url = f"{self.base_url}Cashdesk/{self.cashdeskid}/Balance"
            params = {
                "confirm": confirm,
                "dt": dt
            }
            
            headers = {
                "Authorization": self.auth_header,
                "sign": sign
            }
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            return {
                "success": True,
                "data": response.json()
            }
            
        except Exception as e:
            logger.error(f"Ошибка получения баланса: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def find_user(self, user_id: str) -> Dict:
        """Поиск игрока"""
        try:
            # Генерируем confirm: MD5(userId:hash)
            confirm = self._generate_confirm(user_id)
            
            # Генерируем подпись для поиска пользователя
            # a) SHA256(hash={hash}&userid={userId}&cashdeskid={cashdeskid})
            step1_string = f"hash={self.hash_key}&userid={user_id}&cashdeskid={self.cashdeskid}"
            step1_hash = hashlib.sha256(step1_string.encode()).hexdigest()
            
            # b) MD5(userid={userId}&cashierpass={cashierpass}&hash={hash})
            step2_string = f"userid={user_id}&cashierpass={self.cashierpass}&hash={self.hash_key}"
            step2_hash = hashlib.md5(step2_string.encode()).hexdigest()
            
            # c) SHA256(step1 + step2)
            combined = step1_hash + step2_hash
            sign = hashlib.sha256(combined.encode()).hexdigest()
            
            # Формируем URL
            url = f"{self.base_url}Users/{user_id}"
            params = {
                "confirm": confirm,
                "cashdeskId": str(self.cashdeskid)
            }
            
            headers = {
                "Authorization": self.auth_header,
                "sign": sign
            }
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            return {
                "success": True,
                "data": response.json()
            }
            
        except Exception as e:
            logger.error(f"Ошибка поиска пользователя {user_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def deposit(self, user_id: str, amount: float) -> Dict:
        """Пополнение счета игрока"""
        try:
            # Генерируем confirm и подпись
            confirm = self._generate_confirm(user_id)
            sign = self._generate_sign_for_deposit(user_id, amount)
            
            # Формируем URL и тело запроса
            url = f"{self.base_url}Deposit/{user_id}/Add"
            
            data = {
                "cashdeskId": str(self.cashdeskid),
                "lng": "ru",
                "summa": amount,
                "confirm": confirm
            }
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": self.auth_header,
                "sign": sign
            }
            
            response = requests.post(url, json=data, headers=headers, timeout=10)
            try:
                response.raise_for_status()
            except Exception as e:
                logger.error(f"Melbet deposit HTTP error: {getattr(response, 'status_code', '?')} - {getattr(response, 'text', '')}")
                raise
            
            result = response.json()
            
            return {
                "success": result.get("success", False),
                "data": result,
                "message": result.get("message", "")
            }
            
        except Exception as e:
            logger.error(f"Ошибка пополнения для пользователя {user_id} на сумму {amount}: {e}")
            logger.error(f"URL: {url}")
            logger.error(f"Data: {data}")
            logger.error(f"Headers: {headers}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def payout(self, user_id: str, code: str) -> Dict:
        """Выплата со счета игрока"""
        try:
            # Генерируем confirm и подпись
            confirm = self._generate_confirm(user_id)
            sign = self._generate_sign_for_payout(user_id, code)
            
            # Формируем URL и тело запроса
            url = f"{self.base_url}Deposit/{user_id}/Payout"
            
            data = {
                "cashdeskId": str(self.cashdeskid),
                "lng": "ru",
                "code": code,
                "confirm": confirm
            }
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": self.auth_header,
                "sign": sign
            }
            
            response = requests.post(url, json=data, headers=headers, timeout=10)
            if response.status_code == 200:
                result = response.json()
                return {
                    "success": result.get("success", False),
                    "data": result,
                    "message": result.get("message", "")
                }
            else:
                try:
                    err_json = response.json()
                    err_msg = err_json.get('message') or err_json.get('Message') or str(err_json)
                except Exception:
                    err_msg = response.text
                logger.error(f"Melbet payout HTTP {response.status_code}: {err_msg}")
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "error": err_msg
                }
            
        except requests.exceptions.HTTPError as e:
            resp = getattr(e, 'response', None)
            status = resp.status_code if resp is not None else None
            err_text = ''
            try:
                err_text = resp.text if resp is not None else ''
            except Exception:
                err_text = str(e)
            logger.error(f"Ошибка выплаты (HTTP) для пользователя {user_id} с кодом {code}: {status} {err_text}")
            return {"success": False, "status_code": status, "error": err_text}
        except Exception as e:
            logger.error(f"Ошибка выплаты для пользователя {user_id} с кодом {code}: {e}")
            return {"success": False, "error": str(e)}
