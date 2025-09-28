#!/usr/bin/env python3
"""
Generic API client for bookmakers with similar structure
"""
import logging
from typing import Dict, Any, Optional
from .base_client import BaseBookmakerAPI

logger = logging.getLogger(__name__)

class GenericBookmakerAPI(BaseBookmakerAPI):
    """Generic API client for bookmakers with similar API structure"""
    
    def __init__(self, config: Dict[str, Any], bookmaker_type: str):
        # Передаем полную конфигурацию в базовый класс
        full_config = {
            'name': bookmaker_type.upper(),
            'emoji': '🎰',
            'api_config': config
        }
        super().__init__(full_config)
        self.bookmaker_type = bookmaker_type
        self.api_config = config
        
        # Common fields for most bookmakers
        self.hash_key = self.api_config.get('hash_key')
        self.cashierpass = self.api_config.get('cashierpass')
        self.login = self.api_config.get('login')
        self.cashdeskid = self.api_config.get('cashdeskid')
        
        # API endpoints (can be overridden)
        self.base_url = self.api_config.get('base_url', 'https://api.bookmaker.com')
        self.deposit_endpoint = self.api_config.get('deposit_endpoint', '/deposit')
        self.withdraw_endpoint = self.api_config.get('withdraw_endpoint', '/withdraw')
        self.balance_endpoint = self.api_config.get('balance_endpoint', '/balance')
    
    def get_required_config_fields(self) -> list:
        """Get required configuration fields for generic bookmakers"""
        return ['hash_key', 'cashierpass', 'login', 'cashdeskid']
    
    def _generate_signature(self, userid: str, amount: float, timestamp: str) -> str:
        """Generate signature for API requests"""
        import hashlib
        
        # Common signature generation pattern
        payload = f"{userid}:{amount}:{timestamp}:{self.hash_key}"
        return hashlib.sha256(payload.encode()).hexdigest()
    
    def _get_headers(self, signature: str) -> Dict[str, str]:
        """Get common headers for API requests"""
        return {
            "Authorization": f"Bearer {signature}",
            "Content-Type": "application/json",
            "User-Agent": f"UniversalBot/{self.bookmaker_type}/1.0"
        }
    
    async def deposit_user(self, userid: str, amount: float, language: str = "ru") -> Optional[Dict[str, Any]]:
        """Generic deposit implementation"""
        try:
            import time
            timestamp = str(int(time.time()))
            signature = self._generate_signature(userid, amount, timestamp)
            
            payload = {
                "user_id": userid,
                "amount": amount,
                "language": language,
                "timestamp": timestamp,
                "cashdesk_id": self.cashdeskid,
                "login": self.login
            }
            
            headers = self._get_headers(signature)
            
            # Use aiohttp for async requests
            import aiohttp
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"{self.base_url}{self.deposit_endpoint}"
                async with session.post(url, headers=headers, json=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"✅ {self.name} deposit successful: {data}")
                        return data
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ {self.name} deposit error: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ {self.name} deposit error: {e}")
            return None
    
    async def withdraw_user(self, userid: str, code: str, language: str = "ru") -> Optional[Dict[str, Any]]:
        """Generic withdraw implementation"""
        try:
            # Для 1WIN используем специальную структуру
            if self.name == "1win":
                payload = {
                    "userId": int(userid),
                    "code": int(code) if code.isdigit() else code
                }
                headers = {
                    "X-API-KEY": self.api_key,
                    "Content-Type": "application/json"
                }
            else:
                # Для других букмекеров используем стандартную структуру
                import time
                timestamp = str(int(time.time()))
                signature = self._generate_signature(userid, 0, timestamp)
                
                payload = {
                    "user_id": userid,
                    "amount": 0,
                    "language": language,
                    "timestamp": timestamp,
                    "cashdesk_id": self.cashdeskid,
                    "login": self.login
                }
                headers = self._get_headers(signature)
            
            import aiohttp
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"{self.base_url}{self.withdraw_endpoint}"
                async with session.post(url, headers=headers, json=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"✅ {self.name} withdraw successful: {data}")
                        return data
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ {self.name} withdraw error: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ {self.name} withdraw error: {e}")
            return None
    
    async def check_balance(self, userid: str) -> Optional[Dict[str, Any]]:
        """Generic balance check implementation"""
        try:
            import time
            timestamp = str(int(time.time()))
            signature = self._generate_signature(userid, 0, timestamp)
            
            payload = {
                "user_id": userid,
                "timestamp": timestamp,
                "cashdesk_id": self.cashdeskid,
                "login": self.login
            }
            
            headers = self._get_headers(signature)
            
            import aiohttp
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"{self.base_url}{self.balance_endpoint}"
                async with session.post(url, headers=headers, json=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"✅ {self.name} balance check successful: {data}")
                        return data
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ {self.name} balance check error: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ {self.name} balance check error: {e}")
            return None
    
    def get_api_info(self) -> Dict[str, Any]:
        """Get API information for debugging"""
        return {
            "bookmaker_type": self.bookmaker_type,
            "name": self.name,
            "base_url": self.base_url,
            "endpoints": {
                "deposit": self.deposit_endpoint,
                "withdraw": self.withdraw_endpoint,
                "balance": self.balance_endpoint
            },
            "config_fields": {
                "hash_key": bool(self.hash_key),
                "cashierpass": bool(self.cashierpass),
                "login": bool(self.login),
                "cashdeskid": bool(self.cashdeskid)
            }
        }

