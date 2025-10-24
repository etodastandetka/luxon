#!/usr/bin/env python3
"""
Сервис валидации данных для API
"""
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime

class ValidationService:
    """Сервис валидации данных"""
    
    @staticmethod
    def validate_user_id(user_id: any) -> Tuple[bool, str]:
        """Валидация ID пользователя"""
        try:
            user_id = int(user_id)
            if user_id <= 0:
                return False, "User ID must be positive integer"
            if user_id > 999999999:  # Telegram user ID limit
                return False, "User ID too large"
            return True, ""
        except (ValueError, TypeError):
            return False, "User ID must be integer"
    
    @staticmethod
    def validate_amount(amount: any) -> Tuple[bool, str]:
        """Валидация суммы"""
        try:
            amount = float(amount)
            if amount <= 0:
                return False, "Amount must be positive"
            if amount > 1000000:  # Максимум 1 млн сом
                return False, "Amount too large (max 1,000,000)"
            if amount < 10:  # Минимум 10 сом
                return False, "Amount too small (min 10)"
            return True, ""
        except (ValueError, TypeError):
            return False, "Amount must be number"
    
    @staticmethod
    def validate_bookmaker(bookmaker: str) -> Tuple[bool, str]:
        """Валидация букмекера"""
        if not isinstance(bookmaker, str):
            return False, "Bookmaker must be string"
        
        allowed_bookmakers = [
            '1win', '1xbet', 'melbet', 'mostbet', 'parimatch', 
            'fonbet', 'leon', 'betboom', 'olimp', 'winline'
        ]
        
        if bookmaker.lower() not in allowed_bookmakers:
            return False, f"Invalid bookmaker. Allowed: {', '.join(allowed_bookmakers)}"
        
        return True, ""
    
    @staticmethod
    def validate_bank(bank: str) -> Tuple[bool, str]:
        """Валидация банка"""
        if not isinstance(bank, str):
            return False, "Bank must be string"
        
        allowed_banks = [
            'demirbank', 'mbank', 'balance', 'bakai', 'megapay', 'optima'
        ]
        
        if bank.lower() not in allowed_banks:
            return False, f"Invalid bank. Allowed: {', '.join(allowed_banks)}"
        
        return True, ""
    
    @staticmethod
    def validate_player_id(player_id: str) -> Tuple[bool, str]:
        """Валидация ID игрока"""
        if not isinstance(player_id, str):
            return False, "Player ID must be string"
        
        if len(player_id) < 3:
            return False, "Player ID too short (min 3 characters)"
        
        if len(player_id) > 50:
            return False, "Player ID too long (max 50 characters)"
        
        # Проверяем, что содержит только буквы, цифры и некоторые символы
        if not re.match(r'^[a-zA-Z0-9_-]+$', player_id):
            return False, "Player ID contains invalid characters"
        
        return True, ""
    
    @staticmethod
    def validate_phone(phone: str) -> Tuple[bool, str]:
        """Валидация номера телефона"""
        if not isinstance(phone, str):
            return False, "Phone must be string"
        
        # Убираем все кроме цифр
        digits = re.sub(r'\D', '', phone)
        
        if len(digits) < 10:
            return False, "Phone number too short"
        
        if len(digits) > 15:
            return False, "Phone number too long"
        
        return True, ""
    
    @staticmethod
    def validate_site_code(site_code: str) -> Tuple[bool, str]:
        """Валидация кода с сайта"""
        if not isinstance(site_code, str):
            return False, "Site code must be string"
        
        if len(site_code) < 3:
            return False, "Site code too short (min 3 characters)"
        
        if len(site_code) > 20:
            return False, "Site code too long (max 20 characters)"
        
        return True, ""
    
    @staticmethod
    def validate_qr_code(qr_code: str) -> Tuple[bool, str]:
        """Валидация QR кода"""
        if not isinstance(qr_code, str):
            return False, "QR code must be string"
        
        if len(qr_code) < 10:
            return False, "QR code too short"
        
        if len(qr_code) > 1000:
            return False, "QR code too long"
        
        return True, ""
    
    @staticmethod
    def validate_comment(comment: str) -> Tuple[bool, str]:
        """Валидация комментария"""
        if not isinstance(comment, str):
            return False, "Comment must be string"
        
        if len(comment) > 500:
            return False, "Comment too long (max 500 characters)"
        
        return True, ""
    
    @staticmethod
    def validate_email(email: str) -> Tuple[bool, str]:
        """Валидация email"""
        if not isinstance(email, str):
            return False, "Email must be string"
        
        if len(email) > 255:
            return False, "Email too long (max 255 characters)"
        
        # Простая проверка email
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return False, "Invalid email format"
        
        return True, ""
    
    @staticmethod
    def validate_password(password: str) -> Tuple[bool, str]:
        """Валидация пароля"""
        if not isinstance(password, str):
            return False, "Password must be string"
        
        if len(password) < 6:
            return False, "Password too short (min 6 characters)"
        
        if len(password) > 255:
            return False, "Password too long (max 255 characters)"
        
        return True, ""
    
    @staticmethod
    def validate_percentage(percentage: any) -> Tuple[bool, str]:
        """Валидация процента"""
        try:
            percentage = float(percentage)
            if percentage < 0:
                return False, "Percentage must be non-negative"
            if percentage > 100:
                return False, "Percentage must not exceed 100"
            return True, ""
        except (ValueError, TypeError):
            return False, "Percentage must be number"
    
    @staticmethod
    def validate_interval(interval: any) -> Tuple[bool, str]:
        """Валидация интервала в секундах"""
        try:
            interval = int(interval)
            if interval < 10:
                return False, "Interval too short (min 10 seconds)"
            if interval > 3600:
                return False, "Interval too long (max 3600 seconds)"
            return True, ""
        except (ValueError, TypeError):
            return False, "Interval must be integer"
    
    @staticmethod
    def validate_deposit_request(data: Dict) -> Tuple[bool, List[str]]:
        """Валидация заявки на пополнение"""
        errors = []
        
        # Проверяем обязательные поля
        required_fields = ['user_id', 'bookmaker', 'player_id', 'amount', 'bank']
        for field in required_fields:
            if field not in data:
                errors.append(f"Missing required field: {field}")
        
        if errors:
            return False, errors
        
        # Валидация каждого поля
        valid, msg = ValidationService.validate_user_id(data['user_id'])
        if not valid:
            errors.append(f"user_id: {msg}")
        
        valid, msg = ValidationService.validate_bookmaker(data['bookmaker'])
        if not valid:
            errors.append(f"bookmaker: {msg}")
        
        valid, msg = ValidationService.validate_player_id(data['player_id'])
        if not valid:
            errors.append(f"player_id: {msg}")
        
        valid, msg = ValidationService.validate_amount(data['amount'])
        if not valid:
            errors.append(f"amount: {msg}")
        
        valid, msg = ValidationService.validate_bank(data['bank'])
        if not valid:
            errors.append(f"bank: {msg}")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_withdraw_request(data: Dict) -> Tuple[bool, List[str]]:
        """Валидация заявки на вывод"""
        errors = []
        
        # Проверяем обязательные поля
        required_fields = ['user_id', 'bookmaker', 'player_id', 'amount', 'phone', 'site_code']
        for field in required_fields:
            if field not in data:
                errors.append(f"Missing required field: {field}")
        
        if errors:
            return False, errors
        
        # Валидация каждого поля
        valid, msg = ValidationService.validate_user_id(data['user_id'])
        if not valid:
            errors.append(f"user_id: {msg}")
        
        valid, msg = ValidationService.validate_bookmaker(data['bookmaker'])
        if not valid:
            errors.append(f"bookmaker: {msg}")
        
        valid, msg = ValidationService.validate_player_id(data['player_id'])
        if not valid:
            errors.append(f"player_id: {msg}")
        
        valid, msg = ValidationService.validate_amount(data['amount'])
        if not valid:
            errors.append(f"amount: {msg}")
        
        valid, msg = ValidationService.validate_phone(data['phone'])
        if not valid:
            errors.append(f"phone: {msg}")
        
        valid, msg = ValidationService.validate_site_code(data['site_code'])
        if not valid:
            errors.append(f"site_code: {msg}")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_referral_code(code: str) -> Tuple[bool, str]:
        """Валидация реферального кода"""
        if not isinstance(code, str):
            return False, "Referral code must be string"
        
        if len(code) != 8:  # Наши коды всегда 8 символов
            return False, "Invalid referral code length"
        
        if not re.match(r'^[A-F0-9]+$', code):
            return False, "Invalid referral code format"
        
        return True, ""


# Глобальный экземпляр сервиса
_validation_service = None

def get_validation_service() -> ValidationService:
    """Получение экземпляра сервиса валидации"""
    global _validation_service
    if _validation_service is None:
        _validation_service = ValidationService()
    return _validation_service

