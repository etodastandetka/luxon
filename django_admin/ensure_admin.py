#!/usr/bin/env python
"""
Скрипт для обеспечения наличия админского пользователя
Запускать после каждого перезапуска сервера
"""
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

from django.contrib.auth.models import User
from bot_control.models import UserProfile

def ensure_admin():
    """Обеспечиваем наличие админского пользователя"""
    username = 'dastan'
    password = 'dastan10dz'
    email = 'admin@luxon.com'
    
    try:
        # Проверяем, существует ли пользователь
        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            print(f"✅ Пользователь {username} существует")
            
            # Обновляем пароль и права
            user.set_password(password)
            user.email = email
            user.is_superuser = True
            user.is_staff = True
            user.is_active = True
            user.save()
            
            print(f"✅ Данные пользователя {username} обновлены")
            
        else:
            print(f"❌ Пользователь {username} не найден, создаем...")
            
            # Создаем нового пользователя
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password
            )
            print(f"✅ Пользователь {username} создан")
        
        # Создаем или обновляем профиль
        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                'is_2fa_enabled': False,
                'secret_key': ''
            }
        )
        
        if not created:
            # Обновляем профиль
            profile.is_2fa_enabled = False
            profile.secret_key = ''
            profile.save()
            print(f"✅ Профиль для {username} обновлен")
        else:
            print(f"✅ Профиль для {username} создан")
        
        # Проверяем аутентификацию
        from django.contrib.auth import authenticate
        auth_user = authenticate(username=username, password=password)
        
        if auth_user:
            print(f"✅ Аутентификация работает")
            return True
        else:
            print(f"❌ Аутентификация НЕ работает")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

if __name__ == "__main__":
    print("🔧 Обеспечение наличия админского пользователя...")
    
    if ensure_admin():
        print("🎉 Админский пользователь готов!")
        print("📋 Данные для входа:")
        print("   Username: dastan")
        print("   Password: dastan10dz")
    else:
        print("💥 Ошибка! Не удалось создать/обновить админского пользователя.")
