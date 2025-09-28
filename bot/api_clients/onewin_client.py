#!/usr/bin/env python3
"""
API клиент для 1WIN
"""
import requests
import logging
import json
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class OneWinAPIClient:
    """API клиент для работы с 1WIN"""
    
    def __init__(self, config: Dict):
        self.base_url = "https://api.1win.win"
        self.api_key = config.get("api_key")
        
        if not self.api_key:
            raise ValueError("API ключ не указан")
    
    def _get_headers(self) -> Dict[str, str]:
        """Получение заголовков для запроса"""
        return {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def deposit(self, user_id: int, amount: float) -> Dict:
        """Пополнение счета игрока"""
        try:
            url = f"{self.base_url}/v1/client/deposit"
            
            # Тело запроса
            request_data = {
                "userId": user_id,
                "amount": amount
            }
            
            headers = self._get_headers()
            
            response = requests.post(url, json=request_data, headers=headers, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            
            return {
                "success": True,
                "data": result
            }
            
        except Exception as e:
            logger.error(f"Ошибка пополнения для игрока {user_id} на сумму {amount}: {e}")
            logger.error(f"URL: {url}")
            logger.error(f"Data: {request_data}")
            logger.error(f"Headers: {headers}")
            
            # Пытаемся извлечь детали ошибки из ответа
            error_details = ""
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    error_details = f" - {error_data}"
                except:
                    error_details = f" - {e.response.text}"
            
            return {
                "success": False,
                "error": str(e) + error_details
            }
    
    def withdrawal(self, user_id: int, code: str) -> Dict:
        """Вывод средств игрока"""
        try:
            url = f"{self.base_url}/v1/client/withdrawal"
            
            # Тело запроса согласно документации
            request_data = {
                "userId": user_id,
                "code": int(code) if code.isdigit() else code
            }
            
            headers = self._get_headers()
            
            response = requests.post(url, json=request_data, headers=headers, timeout=30)
            if response.status_code == 200:
                result = response.json()
                return {"success": True, "data": result}
            else:
                # Вернем структурированную ошибку с кодом статуса и текстом
                try:
                    err_json = response.json()
                    err_msg = err_json.get('message') or err_json.get('Message') or str(err_json)
                except Exception:
                    err_msg = response.text
                logger.error(f"1WIN withdrawal HTTP {response.status_code}: {err_msg}")
                return {"success": False, "status_code": response.status_code, "error": err_msg}
            
        except Exception as e:
            logger.error(f"Ошибка вывода для игрока {user_id} с кодом {code}: {e}")
            logger.error(f"URL: {url}")
            logger.error(f"Data: {request_data}")
            logger.error(f"Headers: {headers}")
            return {"success": False, "error": str(e)}

