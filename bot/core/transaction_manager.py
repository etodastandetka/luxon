#!/usr/bin/env python3
"""
Transaction manager for unified deposit/withdraw processing
"""
import logging
import asyncio
import sqlite3
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
from api_clients.manager import APIManager
from database import Database
from referral.manager import ReferralManager
from texts.templates import MessageTemplates

logger = logging.getLogger(__name__)

class TransactionManager:
    """Unified transaction processing for all bookmakers"""
    
    def __init__(self, api_manager: APIManager, db: Database, referral_manager: ReferralManager):
        self.api_manager = api_manager
        self.db = db
        self.referral_manager = referral_manager
        
        # Transaction limits
        self.min_deposit = 100
        self.max_deposit = 100000
        self.min_withdraw = 100
        self.max_withdraw = 100000
        
        # Processing timeouts
        self.api_timeout = 30  # seconds
        self.max_retries = 3
    
    async def process_deposit(self, user_id: int, amount: float, bookmaker_key: str, 
                            language: str = "ru", user_account_id: str = None) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Process deposit transaction
        
        Returns:
            Tuple[success: bool, message: str, data: Dict]
        """
        try:
            # Validate input
            validation_result = self._validate_deposit_input(amount, bookmaker_key)
            if not validation_result['valid']:
                return False, validation_result['message'], {}
            
            # Check if bookmaker is supported
            if not self.api_manager.is_bookmaker_supported(bookmaker_key):
                return False, f"Bookmaker {bookmaker_key} is not supported", {}
            
            # Save user account ID if provided
            if user_account_id:
                self.db.save_user_data(user_id, 'id', user_account_id)
            
            # Process deposit via API
            api_result = await self._process_deposit_api(bookmaker_key, user_account_id or str(user_id), amount, language)
            if not api_result['success']:
                return False, api_result['message'], {}
            
            # Save transaction to database
            transaction_id = self._save_deposit_transaction(user_id, bookmaker_key, amount, api_result['data'])
            
            # Process referral commission
            await self._process_referral_commission(user_id, amount, bookmaker_key)
            
            # Prepare success response
            success_data = {
                'transaction_id': transaction_id,
                'amount': amount,
                'bookmaker': bookmaker_key,
                'api_response': api_result['data'],
                'timestamp': datetime.now().isoformat()
            }
            
            success_message = MessageTemplates.request_sent(
                self.api_manager.get_client(bookmaker_key).get_name()
            )
            
            logger.info(f"✅ Deposit successful: user {user_id}, amount {amount}, bookmaker {bookmaker_key}")
            return True, success_message, success_data
            
        except Exception as e:
            error_msg = f"Error processing deposit: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return False, error_msg, {}
    
    async def process_withdraw(self, user_id: int, amount: float, bookmaker_key: str,
                             language: str = "ru", user_account_id: str = None,
                             withdraw_code: str = None, qr_code: str = None) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Process withdraw transaction
        
        Returns:
            Tuple[success: bool, message: str, data: Dict]
        """
        try:
            # Validate input
            validation_result = self._validate_withdraw_input(amount, bookmaker_key, withdraw_code, qr_code)
            if not validation_result['valid']:
                return False, validation_result['message'], {}
            
            # Check if bookmaker is supported
            if not self.api_manager.is_bookmaker_supported(bookmaker_key):
                return False, f"Bookmaker {bookmaker_key} is not supported", {}
            
            # Save user account ID if provided
            if user_account_id:
                self.db.save_user_data(user_id, 'id', user_account_id)
            
            # Process withdraw via API
            api_result = await self._process_withdraw_api(bookmaker_key, user_account_id or str(user_id), amount, language)
            if not api_result['success']:
                return False, api_result['message'], {}
            
            # Save transaction to database
            transaction_id = self._save_withdraw_transaction(user_id, bookmaker_key, amount, api_result['data'])
            
            # Prepare success response
            success_data = {
                'transaction_id': transaction_id,
                'amount': amount,
                'bookmaker': bookmaker_key,
                'api_response': api_result['data'],
                'timestamp': datetime.now().isoformat()
            }
            
            success_message = "✅ Заявка на вывод создана! Обработка займет до 30 минут."
            
            logger.info(f"✅ Withdraw successful: user {user_id}, amount {amount}, bookmaker {bookmaker_key}")
            return True, success_message, success_data
            
        except Exception as e:
            error_msg = f"Error processing withdraw: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return False, error_msg, {}
    
    def _validate_deposit_input(self, amount: float, bookmaker_key: str) -> Dict[str, Any]:
        """Validate deposit input parameters"""
        if not isinstance(amount, (int, float)) or amount <= 0:
            return {'valid': False, 'message': 'Invalid amount'}
        
        if amount < self.min_deposit:
            return {'valid': False, 'message': f'Minimum deposit amount is {self.min_deposit} KGS'}
        
        if amount > self.max_deposit:
            return {'valid': False, 'message': f'Maximum deposit amount is {self.max_deposit} KGS'}
        
        if not bookmaker_key or not isinstance(bookmaker_key, str):
            return {'valid': False, 'message': 'Invalid bookmaker'}
        
        return {'valid': True, 'message': 'OK'}
    
    def _validate_withdraw_input(self, amount: float, bookmaker_key: str, 
                                withdraw_code: str = None, qr_code: str = None) -> Dict[str, Any]:
        """Validate withdraw input parameters"""
        if not isinstance(amount, (int, float)) or amount <= 0:
            return {'valid': False, 'message': 'Invalid amount'}
        
        if amount < self.min_withdraw:
            return {'valid': False, 'message': f'Minimum withdraw amount is {self.min_withdraw} KGS'}
        
        if amount > self.max_withdraw:
            return {'valid': False, 'message': f'Maximum withdraw amount is {self.max_withdraw} KGS'}
        
        if not bookmaker_key or not isinstance(bookmaker_key, str):
            return {'valid': False, 'message': 'Invalid bookmaker'}
        
        # Validate withdraw code if required
        if withdraw_code and len(withdraw_code) < 4:
            return {'valid': False, 'message': 'Invalid withdraw code'}
        
        return {'valid': True, 'message': 'OK'}
    
    async def _process_deposit_api(self, bookmaker_key: str, user_account_id: str, 
                                  amount: float, language: str) -> Dict[str, Any]:
        """Process deposit via API with retry logic"""
        for attempt in range(self.max_retries):
            try:
                # Set timeout for API call
                result = await asyncio.wait_for(
                    self.api_manager.deposit_user(bookmaker_key, user_account_id, amount, language),
                    timeout=self.api_timeout
                )
                
                if result:
                    return {'success': True, 'data': result, 'message': 'Deposit successful'}
                else:
                    return {'success': False, 'data': None, 'message': 'API returned no result'}
                    
            except asyncio.TimeoutError:
                logger.warning(f"API timeout on attempt {attempt + 1} for {bookmaker_key}")
                if attempt == self.max_retries - 1:
                    return {'success': False, 'data': None, 'message': 'API timeout'}
                await asyncio.sleep(1)  # Wait before retry
                
            except Exception as e:
                logger.error(f"API error on attempt {attempt + 1}: {e}")
                if attempt == self.max_retries - 1:
                    return {'success': False, 'data': None, 'message': f'API error: {str(e)}'}
                await asyncio.sleep(1)  # Wait before retry
        
        return {'success': False, 'data': None, 'message': 'Max retries exceeded'}
    
    async def _process_withdraw_api(self, bookmaker_key: str, user_account_id: str,
                                   amount: float, language: str) -> Dict[str, Any]:
        """Process withdraw via API with retry logic"""
        for attempt in range(self.max_retries):
            try:
                # Set timeout for API call
                result = await asyncio.wait_for(
                    self.api_manager.withdraw_user(bookmaker_key, user_account_id, amount, language),
                    timeout=self.api_timeout
                )
                
                if result:
                    return {'success': True, 'data': result, 'message': 'Withdraw successful'}
                else:
                    return {'success': False, 'data': None, 'message': 'API returned no result'}
                    
            except asyncio.TimeoutError:
                logger.warning(f"API timeout on attempt {attempt + 1} for {bookmaker_key}")
                if attempt == self.max_retries - 1:
                    return {'success': False, 'data': None, 'message': 'API timeout'}
                await asyncio.sleep(1)  # Wait before retry
                
            except Exception as e:
                logger.error(f"API error on attempt {attempt + 1}: {e}")
                if attempt == self.max_retries - 1:
                    return {'success': False, 'data': None, 'message': f'API error: {str(e)}'}
                await asyncio.sleep(1)  # Wait before retry
        
        return {'success': False, 'data': None, 'message': 'Max retries exceeded'}
    
    def _save_deposit_transaction(self, user_id: int, bookmaker_key: str, 
                                 amount: float, api_data: Dict[str, Any]) -> int:
        """Save deposit transaction to database"""
        try:
            # Save to transactions table
            conn = sqlite3.connect(self.db.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO transactions (user_id, bookmaker, trans_type, amount, status)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, bookmaker_key, 'deposit', amount, 'completed'))
            
            transaction_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            logger.info(f"✅ Deposit transaction saved: ID {transaction_id}")
            return transaction_id
            
        except Exception as e:
            logger.error(f"❌ Error saving deposit transaction: {e}")
            return 0
    
    def _save_withdraw_transaction(self, user_id: int, bookmaker_key: str,
                                  amount: float, api_data: Dict[str, Any]) -> int:
        """Save withdraw transaction to database"""
        try:
            # Save to transactions table
            conn = sqlite3.connect(self.db.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO transactions (user_id, bookmaker, trans_type, amount, status)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, bookmaker_key, 'withdraw', amount, 'pending'))
            
            transaction_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            logger.info(f"✅ Withdraw transaction saved: ID {transaction_id}")
            return transaction_id
            
        except Exception as e:
            logger.error(f"❌ Error saving withdraw transaction: {e}")
            return 0
    
    async def _process_referral_commission(self, user_id: int, amount: float, bookmaker_key: str):
        """Process referral commission for deposit"""
        try:
            await self.referral_manager.process_deposit_commission(user_id, amount, bookmaker_key)
        except Exception as e:
            logger.error(f"❌ Error processing referral commission: {e}")
    
    def get_transaction_status(self, transaction_id: int) -> Optional[Dict[str, Any]]:
        """Get transaction status by ID"""
        try:
            conn = sqlite3.connect(self.db.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM transactions WHERE id = ?
            ''', (transaction_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                columns = ['id', 'user_id', 'bookmaker', 'trans_type', 'amount', 'status', 'created_at']
                return dict(zip(columns, result))
            return None
            
        except Exception as e:
            logger.error(f"❌ Error getting transaction status: {e}")
            return None
    
    def get_user_transactions(self, user_id: int, limit: int = 10) -> list:
        """Get user transaction history"""
        try:
            conn = sqlite3.connect(self.db.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM transactions 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            ''', (user_id, limit))
            
            results = cursor.fetchall()
            conn.close()
            
            if results:
                columns = ['id', 'user_id', 'bookmaker', 'trans_type', 'amount', 'status', 'created_at']
                return [dict(zip(columns, row)) for row in results]
            return []
            
        except Exception as e:
            logger.error(f"❌ Error getting user transactions: {e}")
            return []
