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
import qrcode
from io import StringIO

def create_2fa_for_dastan():
    """Создать 2FA для пользователя dastan"""
    print("=== Настройка 2FA для dastan ===")
    
    try:
        # Находим пользователя dastan
        user = User.objects.get(username='dastan')
        print(f"✅ Пользователь dastan найден (ID: {user.id})")
        
        # Получаем или создаем профиль
        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                'is_2fa_enabled': False,
                'secret_key': ''
            }
        )
        
        # Генерируем новый секретный ключ
        secret_key = pyotp.random_base32()
        profile.secret_key = secret_key
        profile.is_2fa_enabled = True
        profile.save()
        
        print(f"✅ 2FA включена для dastan")
        print(f"   Secret Key: {secret_key}")
        
        # Создаем TOTP URI
        totp_uri = pyotp.totp.TOTP(secret_key).provisioning_uri(
            name=user.username,
            issuer_name="LUXON Admin"
        )
        
        print(f"\n📱 TOTP URI:")
        print(f"{totp_uri}")
        
        # Создаем QR код
        qr = qrcode.QRCode(version=1, box_size=2, border=1)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        print(f"\n🔐 QR КОД (отсканируйте в приложении аутентификатора):")
        print("=" * 50)
        
        # Выводим QR код в терминал
        qr.print_ascii(invert=True)
        
        print("=" * 50)
        
        # Показываем инструкции
        print(f"\n📋 ИНСТРУКЦИИ:")
        print(f"1. Установите приложение аутентификатора (Google Authenticator, Authy, etc.)")
        print(f"2. Отсканируйте QR код выше")
        print(f"3. Или введите секретный ключ вручную: {secret_key}")
        print(f"4. Войдите в админку с логином: dastan")
        print(f"5. При входе введите 6-значный код из приложения")
        
        # Тестируем генерацию кода
        totp = pyotp.TOTP(secret_key)
        current_code = totp.now()
        print(f"\n🧪 ТЕСТОВЫЙ КОД (действителен 30 секунд): {current_code}")
        
        print(f"\n✅ 2FA успешно настроена для dastan!")
        
    except User.DoesNotExist:
        print(f"❌ Пользователь dastan не найден!")
        print(f"Сначала выполните: python cleanup_users.py")
    except Exception as e:
        print(f"❌ Ошибка настройки 2FA: {e}")

def test_2fa_code():
    """Тестировать 2FA код"""
    try:
        user = User.objects.get(username='dastan')
        profile = UserProfile.objects.get(user=user)
        
        if not profile.is_2fa_enabled or not profile.secret_key:
            print("❌ 2FA не настроена для dastan")
            return
        
        totp = pyotp.TOTP(profile.secret_key)
        current_code = totp.now()
        
        print(f"🔐 Текущий код для dastan: {current_code}")
        print(f"⏰ Код действителен 30 секунд")
        
    except Exception as e:
        print(f"❌ Ошибка получения кода: {e}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        test_2fa_code()
    else:
        create_2fa_for_dastan()
