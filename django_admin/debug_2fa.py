#!/usr/bin/env python
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

from django.contrib.auth.models import User
from bot_control.models import UserProfile
import pyotp

def debug_2fa():
    """Отладка 2FA для пользователя dastan"""
    print("=== Отладка 2FA ===")
    
    try:
        user = User.objects.get(username='dastan')
        print(f"✅ Пользователь найден: {user.username} (ID: {user.id})")
        
        try:
            profile = UserProfile.objects.get(user=user)
            print(f"✅ Профиль найден")
            print(f"   is_2fa_enabled: {profile.is_2fa_enabled}")
            print(f"   secret_key: {profile.secret_key[:10]}..." if profile.secret_key else "НЕТ")
            
            if profile.is_2fa_enabled and profile.secret_key:
                totp = pyotp.TOTP(profile.secret_key)
                current_code = totp.now()
                print(f"✅ Текущий код: {current_code}")
                
                # Тестируем код
                test_code = input("Введите код для тестирования (или Enter для пропуска): ")
                if test_code:
                    is_valid = totp.verify(test_code, valid_window=1)
                    print(f"✅ Код {'валидный' if is_valid else 'НЕ валидный'}")
                    
                    # Проверяем с окном
                    is_valid_window = totp.verify(test_code, valid_window=2)
                    print(f"✅ Код с окном 2: {'валидный' if is_valid_window else 'НЕ валидный'}")
            else:
                print("❌ 2FA не настроена или нет секретного ключа")
                
        except UserProfile.DoesNotExist:
            print("❌ Профиль не найден")
            
    except User.DoesNotExist:
        print("❌ Пользователь dastan не найден")
    
    print("\n=== Проверка сессии ===")
    print("Если вы на странице 2FA, проверьте:")
    print("1. Есть ли temp_user_id в сессии")
    print("2. Правильный ли код вводите")
    print("3. Не истекла ли сессия")

if __name__ == "__main__":
    debug_2fa()
