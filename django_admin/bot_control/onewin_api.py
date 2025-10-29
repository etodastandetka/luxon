"""
1WIN API клиент
"""
import requests
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class OnewinAPI:
    """Клиент для работы с 1WIN API"""
    
    def __init__(self, api_key: str):
        """
        Инициализация API клиента
        
        Args:
            api_key: API ключ, полученный от менеджера
        """
        self.api_key = api_key
        self.base_url = "https://api.1win.win/v1/client"
    
    def _get_headers(self) -> Dict[str, str]:
        """Получить заголовки для запроса"""
        return {
            'X-API-KEY': self.api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    
    def deposit(self, user_id: int, amount: float) -> Dict[str, Any]:
        """
        Создание записи о внесении депозита
        
        Args:
            user_id: ID пользователя
            amount: Сумма депозита
            
        Returns:
            {'id': int, 'cashId': int, 'amount': float, 'userId': int}
        """
        try:
            url = f"{self.base_url}/deposit"
            
            payload = {
                'userId': int(user_id),
                'amount': float(amount)
            }
            
            headers = self._get_headers()
            
            logger.info(f"💸 Создание депозита {amount} для игрока {user_id} в 1WIN")
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Депозит создан: {data}")
                return data
            else:
                logger.error(f"❌ Ошибка создания депозита: {response.status_code} - {response.text}")
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                
                # Обработка различных ошибок
                error_messages = {
                    400: 'Ошибка валидации (сумма превышает лимиты, депозит уже создан, комиссия слишком большая)',
                    403: 'Не допускается',
                    404: 'Пользователь не найден'
                }
                
                return {
                    'error': True,
                    'status_code': response.status_code,
                    'message': error_data.get('message', error_messages.get(response.status_code, 'Неизвестная ошибка')),
                    'data': error_data
                }
                
        except Exception as e:
            logger.error(f"❌ Ошибка в deposit: {e}")
            return {
                'error': True,
                'message': str(e)
            }
    
    def withdrawal(self, user_id: int, code: int) -> Dict[str, Any]:
        """
        Проверка секретного кода и вывод средств пользователю
        
        Args:
            user_id: ID пользователя
            code: Код подтверждения, полученный от игрока
            
        Returns:
            {'id': int, 'cashId': int, 'amount': float, 'userId': int}
        """
        try:
            url = f"{self.base_url}/withdrawal"
            
            payload = {
                'userId': int(user_id),
                'code': int(code)
            }
            
            headers = self._get_headers()
            
            logger.info(f"💰 Вывод средств для игрока {user_id} с кодом {code} в 1WIN")
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Вывод подтвержден: {data}")
                return data
            else:
                logger.error(f"❌ Ошибка вывода: {response.status_code} - {response.text}")
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                
                # Обработка различных ошибок
                error_messages = {
                    400: 'Ошибка валидации (вывод в обработке, сумма превышает лимиты, неверный код, недостаточно баланса, неверный ID кассы)',
                    403: 'Не допускается',
                    404: 'Вывод не найден или пользователь не найден'
                }
                
                return {
                    'error': True,
                    'status_code': response.status_code,
                    'message': error_data.get('message', error_messages.get(response.status_code, 'Неизвестная ошибка')),
                    'data': error_data
                }
                
        except Exception as e:
            logger.error(f"❌ Ошибка в withdrawal: {e}")
            return {
                'error': True,
                'message': str(e)
            }
