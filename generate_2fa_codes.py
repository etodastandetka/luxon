#!/usr/bin/env python
"""
Скрипт для генерации 2FA кодов для тестирования
"""
import pyotp
import time
from datetime import datetime

def generate_test_codes():
    """Генерирует тестовые 2FA коды"""
    
    # Секретный ключ для тестирования (в реальном проекте должен быть уникальным)
    secret_key = "JBSWY3DPEHPK3PXP"
    
    # Создаем TOTP объект
    totp = pyotp.TOTP(secret_key)
    
    print("🔐 ТЕСТОВЫЕ 2FA КОДЫ")
    print("=" * 50)
    print(f"Секретный ключ: {secret_key}")
    print(f"Время: {datetime.now().strftime('%H:%M:%S')}")
    print("-" * 50)
    
    # Генерируем несколько кодов
    for i in range(5):
        current_time = int(time.time())
        code = totp.at(current_time)
        remaining_time = 30 - (current_time % 30)
        
        print(f"Код {i+1}: {code} (осталось {remaining_time} сек)")
        time.sleep(1)
    
    print("=" * 50)
    print("💡 Используйте любой из этих кодов для входа!")
    print("💡 Коды обновляются каждые 30 секунд")

if __name__ == "__main__":
    generate_test_codes()
