#!/usr/bin/env python3
"""
API manager for all bookmakers
"""
import logging
from typing import Dict, Any, Optional
from api_clients.base_client import BaseBookmakerAPI
from api_clients.onexbet_client import OneXBetAPI
from api_clients.other_clients import OneWinAPI, MelbetAPI, MostbetAPI

logger = logging.getLogger(__name__)

class APIManager:
    """Manager for all bookmaker API clients"""
    
    def __init__(self, bookmakers_config: Dict[str, Any]):
        self.bookmakers_config = bookmakers_config
        self.clients: Dict[str, BaseBookmakerAPI] = {}
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize all API clients"""
        for bookmaker_key, config in self.bookmakers_config.items():
            try:
                if bookmaker_key == "1xbet":
                    client = OneXBetAPI(config)
                elif bookmaker_key == "1win":
                    client = OneWinAPI(config)
                elif bookmaker_key == "melbet":
                    client = MelbetAPI(config)
                elif bookmaker_key == "mostbet":
                    client = MostbetAPI(config)
                else:
                    logger.warning(f"Unknown bookmaker: {bookmaker_key}")
                    continue
                
                if client.validate_config():
                    self.clients[bookmaker_key] = client
                    logger.info(f"✅ Initialized API client for {bookmaker_key}")
                else:
                    logger.error(f"❌ Invalid config for {bookmaker_key}")
                    
            except Exception as e:
                logger.error(f"❌ Failed to initialize {bookmaker_key} API client: {e}")
    
    def get_client(self, bookmaker_key: str) -> Optional[BaseBookmakerAPI]:
        """Get API client for specific bookmaker"""
        return self.clients.get(bookmaker_key)
    
    def get_all_clients(self) -> Dict[str, BaseBookmakerAPI]:
        """Get all API clients"""
        return self.clients
    
    async def deposit_user(self, bookmaker_key: str, userid: str, amount: float, language: str = "ru") -> Optional[Dict[str, Any]]:
        """Deposit money using specific bookmaker API"""
        client = self.get_client(bookmaker_key)
        if not client:
            logger.error(f"❌ No API client found for {bookmaker_key}")
            return None
        
        try:
            result = await client.deposit_user(userid, amount, language)
            if result:
                logger.info(f"✅ Deposit successful via {bookmaker_key} API")
            return result
        except Exception as e:
            logger.error(f"❌ Deposit error via {bookmaker_key} API: {e}")
            return None
    
    async def withdraw_user(self, bookmaker_key: str, userid: str, amount: float, language: str = "ru") -> Optional[Dict[str, Any]]:
        """Withdraw money using specific bookmaker API"""
        client = self.get_client(bookmaker_key)
        if not client:
            logger.error(f"❌ No API client found for {bookmaker_key}")
            return None
        
        try:
            result = await client.withdraw_user(userid, amount, language)
            if result:
                logger.info(f"✅ Withdraw successful via {bookmaker_key} API")
            return result
        except Exception as e:
            logger.error(f"❌ Withdraw error via {bookmaker_key} API: {e}")
            return None
    
    async def check_balance(self, bookmaker_key: str, userid: str) -> Optional[Dict[str, Any]]:
        """Check balance using specific bookmaker API"""
        client = self.get_client(bookmaker_key)
        if not client:
            logger.error(f"❌ No API client found for {bookmaker_key}")
            return None
        
        try:
            result = await client.check_balance(userid)
            return result
        except Exception as e:
            logger.error(f"❌ Balance check error via {bookmaker_key} API: {e}")
            return None
    
    def is_bookmaker_supported(self, bookmaker_key: str) -> bool:
        """Check if bookmaker is supported"""
        return bookmaker_key in self.clients
    
    def get_supported_bookmakers(self) -> list:
        """Get list of supported bookmakers"""
        return list(self.clients.keys())
