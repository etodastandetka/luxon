"""
Mostbet Cash API клиент
Документация: https://mostbetshop.com/api-documentation.pdf
"""
import hashlib
import json
import requests
from datetime import datetime
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class MostbetAPI:
    """Клиент для работы с Mostbet Cash API"""
    
    def __init__(self, api_key: str, secret: str, cashpoint_id: str):
        """
        Инициализация API клиента
        
        Args:
            api_key: API ключ в формате "api-key:uuid"
            secret: Секретный ключ для подписи
            cashpoint_id: ID кассы (cashpoint ID) - может быть строкой типа "F125160" или числом
        """
        self.api_key = api_key
        self.secret = secret
        self.cashpoint_id = str(cashpoint_id)  # Преобразуем в строку для использования в URL
        self.base_url = "https://apimb.com/mbc/gateway/v1/api"
    
    def _get_timestamp(self) -> str:
        """Получить текущую метку времени в формате UTC+0"""
        return datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    
    def _generate_signature(self, path: str, body: str = "", timestamp: str = None) -> str:
        """
        Генерация подписи HMAC SHA3-256
        
        Args:
            path: Путь запроса начиная с /mbc/...
            body: Тело запроса в JSON (без пробелов)
            timestamp: Метка времени (если не указана, генерируется)
        """
        if timestamp is None:
            timestamp = self._get_timestamp()
        
        # Конкатенируем: <API_KEY><PATH><REQUEST_BODY><TIMESTAMP>
        sign_string = f"{self.api_key}{path}{body}{timestamp}"
        
        # HMAC SHA3-256 с использованием secret
        import hmac
        
        try:
            # Попробуем использовать sha3_256 из hashlib (Python 3.6+)
            try:
                sha3_func = hashlib.sha3_256
            except AttributeError:
                # Если sha3_256 недоступен, используем библиотеку pysha3
                try:
                    import sha3
                    sha3_func = sha3.sha3_256
                except ImportError:
                    logger.warning("SHA3-256 not available, using SHA256 fallback. Install pysha3: pip install pysha3")
                    sha3_func = hashlib.sha256
            
            # Вычисляем HMAC SHA3-256
            signature = hmac.new(
                self.secret.encode(),
                sign_string.encode(),
                sha3_func
            ).hexdigest()
            
        except Exception as e:
            logger.error(f"Error generating HMAC SHA3-256 signature: {e}")
            # Fallback на SHA256 (временно, но работать не будет с реальным API)
            signature = hmac.new(
                self.secret.encode(),
                sign_string.encode(),
                hashlib.sha256
            ).hexdigest()
            logger.warning("Using SHA256 fallback - will not work with real API!")
        
        return signature
    
    def _get_headers(self, path: str, body: str = "", need_project: bool = False) -> Dict[str, str]:
        """Получить заголовки для запроса"""
        timestamp = self._get_timestamp()
        signature = self._generate_signature(path, body, timestamp)
        
        headers = {
            'X-Api-Key': self.api_key,
            'X-Timestamp': timestamp,
            'X-Signature': signature,
            'Content-Type': 'application/json',
            'Accept': '*/*'
        }
        
        if need_project:
            headers['X-Project'] = 'MBC'
        
        return headers
    
    def get_balance(self) -> Dict[str, Any]:
        """
        Получение баланса кассы
        
        Returns:
            {'balance': float, 'currency': str}
        """
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/balance"
            url = f"{self.base_url}/cashpoint/{self.cashpoint_id}/balance"
            
            headers = self._get_headers(path, need_project=False)
            
            logger.info(f"💰 Получение баланса Mostbet для кассы {self.cashpoint_id}")
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Баланс получен: {data}")
                return data
            else:
                logger.error(f"❌ Ошибка получения баланса: {response.status_code} - {response.text}")
                return {'balance': 0, 'currency': 'RUB'}
                
        except Exception as e:
            logger.error(f"❌ Ошибка в get_balance: {e}")
            return {'balance': 0, 'currency': 'RUB'}
    
    def deposit(self, player_id: str, amount: float, currency: str = 'RUB', brand_id: int = 1) -> Dict[str, Any]:
        """
        Пополнение счета игрока
        
        Args:
            player_id: ID игрока
            amount: Сумма пополнения
            currency: Валюта (по умолчанию RUB)
            brand_id: ID бренда (по умолчанию 1 для Mostbet)
            
        Returns:
            {'transactionId': int, 'status': str}
        """
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/player/deposit"
            url = f"{self.base_url}/cashpoint/{self.cashpoint_id}/player/deposit"
            
            payload = {
                'brandId': brand_id,
                'playerId': str(player_id),
                'amount': amount,
                'currency': currency
            }
            
            # Тело запроса без пробелов для подписи
            body = json.dumps(payload, separators=(',', ':'))
            
            headers = self._get_headers(path, body, need_project=True)
            
            logger.info(f"💸 Пополнение {amount} {currency} для игрока {player_id} в Mostbet")
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Пополнение выполнено: {data}")
                return data
            else:
                logger.error(f"❌ Ошибка пополнения: {response.status_code} - {response.text}")
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                return {
                    'transactionId': None,
                    'status': 'NEW_ERROR',
                    'error': error_data.get('message', 'Ошибка API'),
                    'code': error_data.get('code', response.status_code)
                }
                
        except Exception as e:
            logger.error(f"❌ Ошибка в deposit: {e}")
            return {
                'transactionId': None,
                'status': 'NEW_ERROR',
                'error': str(e)
            }
    
    def get_cashout_list(self, page: int = 0, size: int = 10, search_string: str = None) -> Dict[str, Any]:
        """
        Получение списка заявок на вывод
        
        Args:
            page: Номер страницы (начиная с 0)
            size: Размер страницы
            search_string: Строка поиска (опционально)
            
        Returns:
            {'items': list, 'totalCount': int}
        """
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/player/cashout/list/page"
            url = f"{self.base_url}/cashpoint/{self.cashpoint_id}/player/cashout/list/page"
            
            params = {'page': page, 'size': size}
            if search_string:
                params['searchString'] = search_string
            
            headers = self._get_headers(path, need_project=False)
            
            logger.info(f"📋 Получение списка заявок на вывод Mostbet (page={page}, size={size})")
            response = requests.get(url, headers=headers, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Получено заявок: {data.get('totalCount', 0)}")
                return data
            else:
                logger.error(f"❌ Ошибка получения списка: {response.status_code} - {response.text}")
                return {'items': [], 'totalCount': 0}
                
        except Exception as e:
            logger.error(f"❌ Ошибка в get_cashout_list: {e}")
            return {'items': [], 'totalCount': 0}
    
    def confirm_cashout(self, transaction_id: int, code: str) -> Dict[str, Any]:
        """
        Подтверждение (выполнение) вывода средств игрока
        
        Args:
            transaction_id: ID транзакции (заявки на вывод)
            code: Код подтверждения от игрока
            
        Returns:
            {'transactionId': int, 'status': str}
        """
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/player/cashout/confirmation"
            url = f"{self.base_url}/cashpoint/{self.cashpoint_id}/player/cashout/confirmation"
            
            payload = {
                'code': code,
                'transactionId': transaction_id
            }
            
            # Тело запроса без пробелов для подписи
            body = json.dumps(payload, separators=(',', ':'))
            
            headers = self._get_headers(path, body, need_project=True)
            
            logger.info(f"💰 Подтверждение вывода {transaction_id} с кодом {code} в Mostbet")
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Выплата подтверждена: {data}")
                return data
            else:
                logger.error(f"❌ Ошибка подтверждения: {response.status_code} - {response.text}")
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                return {
                    'transactionId': transaction_id,
                    'status': 'NEW_ERROR',
                    'error': error_data.get('message', 'Ошибка API'),
                    'code': error_data.get('code', response.status_code)
                }
                
        except Exception as e:
            logger.error(f"❌ Ошибка в confirm_cashout: {e}")
            return {
                'transactionId': transaction_id,
                'status': 'NEW_ERROR',
                'error': str(e)
            }
    
    def get_transactions(self, date_start: str, date_end: str, brand_id: int = None, 
                        player_id: str = None, transaction_id: int = None) -> Dict[str, Any]:
        """
        Получение истории транзакций
        
        Args:
            date_start: Начальная дата (YYYY-MM-DD)
            date_end: Конечная дата (YYYY-MM-DD)
            brand_id: ID бренда (опционально)
            player_id: ID игрока (опционально)
            transaction_id: ID транзакции (опционально)
            
        Returns:
            {'items': list}
        """
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/transactions/list/all"
            url = f"{self.base_url}/cashpoint/{self.cashpoint_id}/transactions/list/all"
            
            params = {
                'dateStart': date_start,
                'dateEnd': date_end
            }
            if brand_id:
                params['brandId'] = brand_id
            if player_id:
                params['playerId'] = player_id
            if transaction_id:
                params['transactionId'] = transaction_id
            
            headers = self._get_headers(path, need_project=False)
            
            logger.info(f"📜 Получение истории транзакций Mostbet ({date_start} - {date_end})")
            response = requests.get(url, headers=headers, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Получено транзакций: {len(data.get('items', []))}")
                return data
            else:
                logger.error(f"❌ Ошибка получения истории: {response.status_code} - {response.text}")
                return {'items': []}
                
        except Exception as e:
            logger.error(f"❌ Ошибка в get_transactions: {e}")
            return {'items': []}
