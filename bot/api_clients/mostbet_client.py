#!/usr/bin/env python3
"""
Mostbet API client implementation based on official documentation
https://mostbetshop.com/api-documentation.pdf
"""

import logging
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import aiohttp

logger = logging.getLogger(__name__)

class MostbetAPI:
    """Mostbet API client implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.api_key = config.get('api_key', '')
        self.secret = config.get('secret', '')
        self.cashpoint_id = config.get('cashpoint_id', '')
        
        # Base URL from documentation
        self.base_url = "https://apimb.com"
        
        # Extract API key without prefix if present
        if self.api_key.startswith('api-key:'):
            self.api_key = self.api_key
        else:
            self.api_key = f"api-key:{self.api_key}"
    
    def validate_config(self) -> bool:
        """Validate API configuration"""
        required_fields = ['api_key', 'secret', 'cashpoint_id']
        for field in required_fields:
            if not self.config.get(field):
                logger.error(f"Missing required config field: {field}")
                return False
        return True
    
    def _get_timestamp(self) -> str:
        """Get current timestamp in UTC format YYYY-MM-DD HH:MM:SS"""
        now = datetime.now(timezone.utc)
        return now.strftime("%Y-%m-%d %H:%M:%S")
    
    def _generate_signature(self, path: str, request_body: str = "", timestamp: str = None) -> str:
        """
        Generate HMAC SHA3-256 signature for Mostbet API
        Format: <API_KEY><PATH><REQUEST_BODY><TIMESTAMP>
        """
        if timestamp is None:
            timestamp = self._get_timestamp()
        
        # Concatenate components without separators
        signature_string = f"{self.api_key}{path}{request_body}{timestamp}"
        
        # Generate HMAC SHA3-256 signature
        signature = hmac.new(
            self.secret.encode('utf-8'),
            signature_string.encode('utf-8'),
            hashlib.sha3_256
        ).hexdigest()
        
        return signature
    
    def _get_headers(self, path: str, request_body: str = "", timestamp: str = None) -> Dict[str, str]:
        """Get required headers for Mostbet API requests"""
        if timestamp is None:
            timestamp = self._get_timestamp()
        
        signature = self._generate_signature(path, request_body, timestamp)
        
        headers = {
            'X-Api-Key': self.api_key,
            'X-Timestamp': timestamp,
            'X-Signature': signature,
            'Content-Type': 'application/json',
            'Accept': '*/*'
        }
        
        return headers
    
    async def check_balance(self) -> Optional[Dict[str, Any]]:
        """Check cashpoint balance"""
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/balance"
            headers = self._get_headers(path)
            
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"{self.base_url}{path}"
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"✅ Mostbet balance check successful: {data}")
                        return data
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Mostbet balance check error: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ Mostbet balance check error: {e}")
            return None
    
    async def deposit_user(self, player_id: str, amount: float, currency: str = "KGS") -> Optional[Dict[str, Any]]:
        """
        Deposit money to player account
        Based on: POST /cashpoint/{cashpointId}/player/deposit
        """
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/player/deposit"
            
            # Request body according to documentation
            request_body = json.dumps({
                "brandId": 1,  # Mostbet brand ID (required)
                "playerId": str(player_id),
                "amount": amount,
                "currency": currency
            }, separators=(',', ':'))  # No spaces or newlines
            
            headers = self._get_headers(path, request_body)
            headers['X-Project'] = 'MBC'  # Required for deposit operations
            
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"{self.base_url}{path}"
                async with session.post(url, headers=headers, data=request_body) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"✅ Mostbet deposit successful: {data}")
                        return data
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Mostbet deposit error: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ Mostbet deposit error: {e}")
            return None
    
    async def get_cashout_requests(self, page: int = 0, size: int = 10, search_string: str = None) -> Optional[Dict[str, Any]]:
        """
        Get list of cashout requests
        Based on: GET /cashpoint/{cashpointId}/player/cashout/list/page
        """
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/player/cashout/list/page"
            
            # Add query parameters
            params = f"page={page}&size={size}"
            if search_string:
                params += f"&searchString={search_string}"
            
            path_with_params = f"{path}?{params}"
            headers = self._get_headers(path_with_params)
            
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"{self.base_url}{path_with_params}"
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"✅ Mostbet cashout requests successful: {data}")
                        return data
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Mostbet cashout requests error: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ Mostbet cashout requests error: {e}")
            return None
    
    async def confirm_cashout(self, transaction_id: int, code: str) -> Optional[Dict[str, Any]]:
        """
        Confirm cashout transaction
        Based on: POST /cashpoint/{cashpointId}/player/cashout/confirmation
        """
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/player/cashout/confirmation"
            
            # Request body according to documentation
            request_body = json.dumps({
                "code": str(code),
                "transactionId": int(transaction_id)
            }, separators=(',', ':'))
            
            headers = self._get_headers(path, request_body)
            headers['X-Project'] = 'MBC'  # Required for cashout operations
            
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"{self.base_url}{path}"
                async with session.post(url, headers=headers, data=request_body) as response:
                    text = await response.text()
                    if response.status == 200:
                        try:
                            data = await response.json()
                        except Exception:
                            data = {}
                        logger.info(f"✅ Mostbet cashout confirmation successful: {data}")
                        return {"success": True, "data": data}
                    else:
                        logger.error(f"❌ Mostbet cashout confirmation error: {response.status} - {text}")
                        # Вернём структурированную ошибку для верхнего уровня
                        return {"success": False, "status_code": response.status, "error": text}
                        
        except Exception as e:
            logger.error(f"❌ Mostbet cashout confirmation error: {e}")
            return None
    
    async def get_transaction_history(self, date_start: str, date_end: str, 
                                    brand_id: int = None, player_id: str = None, 
                                    transaction_id: int = None) -> Optional[Dict[str, Any]]:
        """
        Get transaction history
        Based on: GET /cashpoint/{cashpointId}/transactions/list/all
        """
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/transactions/list/all"
            
            # Add query parameters
            params = f"dateStart={date_start}&dateEnd={date_end}"
            if brand_id:
                params += f"&brandId={brand_id}"
            if player_id:
                params += f"&playerId={player_id}"
            if transaction_id:
                params += f"&transactionId={transaction_id}"
            
            path_with_params = f"{path}?{params}"
            headers = self._get_headers(path_with_params)
            
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"{self.base_url}{path_with_params}"
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"✅ Mostbet transaction history successful: {data}")
                        return data
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Mostbet transaction history error: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ Mostbet transaction history error: {e}")
            return None
    
    def get_api_info(self) -> Dict[str, Any]:
        """Get API information for debugging"""
        return {
            "name": "Mostbet",
            "base_url": self.base_url,
            "cashpoint_id": self.cashpoint_id,
            "api_key": self.api_key[:20] + "..." if len(self.api_key) > 20 else self.api_key,
            "has_secret": bool(self.secret),
            "endpoints": {
                "balance": f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/balance",
                "deposit": f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/player/deposit",
                "cashout_list": f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/player/cashout/list/page",
                "cashout_confirm": f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/player/cashout/confirmation",
                "history": f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/transactions/list/all"
            }
        }