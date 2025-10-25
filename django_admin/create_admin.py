#!/usr/bin/env python
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

from django.contrib.auth.models import User
from bot_control.models import UserProfile

def create_admin():
    """Создаем админа в базе данных"""
    print("=== Создание админа в базе данных ===")
    
    # Данные админа
    username = 'admin'
    email = 'admin@luxon.com'
    password = 'admin123'
    
    try:
        # Удаляем старого админа если есть
        if User.objects.filter(username=username).exists():
            User.objects.filter(username=username).delete()
            print(f"✅ Старый пользователь {username} удален")
        
        # Создаем нового суперпользователя
        admin_user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password
        )
        print(f"✅ Суперпользователь {username} создан")
        
        # Создаем профиль для админа
        profile, created = UserProfile.objects.get_or_create(
            user=admin_user,
            defaults={
                'is_2fa_enabled': False,
                'secret_key': ''
            }
        )
        
        if created:
            print(f"✅ Профиль для {username} создан")
        else:
            print(f"✅ Профиль для {username} уже существует")
        
        # Проверяем создание
        print(f"\n📋 Данные для входа:")
        print(f"Username: {username}")
        print(f"Email: {email}")
        print(f"Password: {password}")
        print(f"2FA: {'Включена' if profile.is_2fa_enabled else 'Отключена'}")
        
        print(f"\n✅ Админ успешно создан!")
        
    except Exception as e:
        print(f"❌ Ошибка создания админа: {e}")

if __name__ == "__main__":
    create_admin()
