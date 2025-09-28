#!/usr/bin/env python3
"""
Base API client for all bookmakers
"""
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class BaseBookmakerAPI(ABC):
    """Base class for all bookmaker API clients"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = config.get('name', 'Unknown')
        self.emoji = config.get('emoji', '🎰')
    
    @abstractmethod
    async def deposit_user(self, userid: str, amount: float, language: str = "ru") -> Optional[Dict[str, Any]]:
        """Deposit money to user account"""
        pass
    
    @abstractmethod
    async def withdraw_user(self, userid: str, amount: float, language: str = "ru") -> Optional[Dict[str, Any]]:
        """Withdraw money from user account"""
        pass
    
    @abstractmethod
    async def check_balance(self, userid: str) -> Optional[Dict[str, Any]]:
        """Check user balance"""
        pass
    
    def get_name(self) -> str:
        """Get bookmaker name"""
        return self.name
    
    def get_emoji(self) -> str:
        """Get bookmaker emoji"""
        return self.emoji
    
    def validate_config(self) -> bool:
        """Validate API configuration"""
        required_fields = self.get_required_config_fields()
        for field in required_fields:
            if field not in self.config.get('api_config', {}):
                logger.error(f"Missing required config field: {field} for {self.name}")
                return False
        return True
    
    @abstractmethod
    def get_required_config_fields(self) -> list:
        """Get list of required configuration fields"""
        pass

