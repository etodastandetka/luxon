#!/usr/bin/env python
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

from django.contrib.auth.models import User
from bot_control.models import UserProfile

def list_users():
    """Показать всех пользователей"""
    print("=== Список пользователей ===")
    users = User.objects.all()
    
    for user in users:
        try:
            profile = UserProfile.objects.get(user=user)
            print(f"👤 {user.username} (ID: {user.id})")
            print(f"   Email: {user.email}")
            print(f"   Superuser: {'Да' if user.is_superuser else 'Нет'}")
            print(f"   Staff: {'Да' if user.is_staff else 'Нет'}")
            print(f"   2FA: {'Включена' if profile.is_2fa_enabled else 'Отключена'}")
            print(f"   Active: {'Да' if user.is_active else 'Нет'}")
            print()
        except UserProfile.DoesNotExist:
            print(f"👤 {user.username} (ID: {user.id}) - НЕТ ПРОФИЛЯ")
            print(f"   Email: {user.email}")
            print(f"   Superuser: {'Да' if user.is_superuser else 'Нет'}")
            print()

def reset_admin_password():
    """Сбросить пароль админа"""
    username = 'admin'
    new_password = 'admin123'
    
    try:
        user = User.objects.get(username=username)
        user.set_password(new_password)
        user.save()
        print(f"✅ Пароль для {username} сброшен на: {new_password}")
    except User.DoesNotExist:
        print(f"❌ Пользователь {username} не найден")

def create_test_user():
    """Создать тестового пользователя"""
    username = 'test'
    email = 'test@luxon.com'
    password = 'test123'
    
    try:
        if User.objects.filter(username=username).exists():
            print(f"✅ Пользователь {username} уже существует")
            return
            
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )
        
        # Создаем профиль
        UserProfile.objects.create(
            user=user,
            is_2fa_enabled=False,
            secret_key=''
        )
        
        print(f"✅ Тестовый пользователь создан:")
        print(f"   Username: {username}")
        print(f"   Password: {password}")
        
    except Exception as e:
        print(f"❌ Ошибка создания тестового пользователя: {e}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'list':
            list_users()
        elif command == 'reset':
            reset_admin_password()
        elif command == 'test':
            create_test_user()
        else:
            print("Доступные команды: list, reset, test")
    else:
        print("Использование: python manage_users.py [list|reset|test]")
