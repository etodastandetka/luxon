#!/usr/bin/env python3
"""
API clients for other bookmakers using GenericBookmakerAPI
"""
import logging
from typing import Dict, Any, Optional
from .generic_client import GenericBookmakerAPI

logger = logging.getLogger(__name__)

class OneWinAPI(GenericBookmakerAPI):
    """1win API client implementation using generic base"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config, "1win")
        # 1win specific configuration
        self.api_config.update({
            "base_url": "https://api.1win.win",
            "deposit_endpoint": "/v1/client/deposit",
            "withdraw_endpoint": "/v1/client/withdrawal",
            "balance_endpoint": "/v1/client/balance"
        })

class MelbetAPI(GenericBookmakerAPI):
    """Melbet API client implementation using generic base"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config, "melbet")
        # Melbet specific configuration
        self.api_config.update({
            "base_url": "https://api.melbet.com",
            "deposit_endpoint": "/api/deposit",
            "withdraw_endpoint": "/api/withdraw",
            "balance_endpoint": "/api/balance"
        })

class MostbetAPI(GenericBookmakerAPI):
    """Mostbet API client implementation using generic base"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config, "mostbet")
        # Mostbet specific configuration
        self.api_config.update({
            "base_url": "https://api.mostbet.com",
            "deposit_endpoint": "/v2/deposit",
            "withdraw_endpoint": "/v2/withdraw",
            "balance_endpoint": "/v2/balance"
        })
