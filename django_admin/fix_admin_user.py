#!/usr/bin/env python
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

from django.contrib.auth.models import User
from bot_control.models import UserProfile

def fix_admin_user():
    """Исправляем админского пользователя"""
    print("=== Исправление админского пользователя ===")
    
    username = 'dastan'
    password = 'dastan10dz'
    email = 'admin@luxon.com'
    
    try:
        # Проверяем, существует ли пользователь
        if User.objects.filter(username=username).exists():
            print(f"✅ Пользователь {username} существует")
            user = User.objects.get(username=username)
            
            # Обновляем пароль
            user.set_password(password)
            user.email = email
            user.is_superuser = True
            user.is_staff = True
            user.is_active = True
            user.save()
            
            print(f"✅ Пароль и данные обновлены для {username}")
            
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
        
        if created:
            print(f"✅ Профиль для {username} создан")
        else:
            print(f"✅ Профиль для {username} уже существует")
            # Обновляем профиль
            profile.is_2fa_enabled = False
            profile.secret_key = ''
            profile.save()
            print(f"✅ Профиль для {username} обновлен")
        
        # Проверяем аутентификацию
        from django.contrib.auth import authenticate
        auth_user = authenticate(username=username, password=password)
        
        if auth_user:
            print(f"✅ Аутентификация работает для {username}")
        else:
            print(f"❌ Аутентификация НЕ работает для {username}")
        
        print(f"\n📋 Данные для входа:")
        print(f"Username: {username}")
        print(f"Password: {password}")
        print(f"Email: {email}")
        print(f"Superuser: {'Да' if user.is_superuser else 'Нет'}")
        print(f"Staff: {'Да' if user.is_staff else 'Нет'}")
        print(f"Active: {'Да' if user.is_active else 'Нет'}")
        print(f"2FA: {'Включена' if profile.is_2fa_enabled else 'Отключена'}")
        
        return True
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def check_all_users():
    """Проверяем всех пользователей в системе"""
    print("\n=== Все пользователи в системе ===")
    
    users = User.objects.all()
    if not users:
        print("❌ Пользователей нет!")
        return
    
    for user in users:
        print(f"\n👤 {user.username} (ID: {user.id})")
        print(f"   Email: {user.email}")
        print(f"   Superuser: {'Да' if user.is_superuser else 'Нет'}")
        print(f"   Staff: {'Да' if user.is_staff else 'Нет'}")
        print(f"   Active: {'Да' if user.is_active else 'Нет'}")
        
        try:
            profile = UserProfile.objects.get(user=user)
            print(f"   2FA: {'Включена' if profile.is_2fa_enabled else 'Отключена'}")
        except UserProfile.DoesNotExist:
            print(f"   Профиль: НЕТ")

if __name__ == "__main__":
    print("🔧 Исправление админского пользователя...")
    
    # Проверяем всех пользователей
    check_all_users()
    
    # Исправляем админа
    if fix_admin_user():
        print("\n🎉 Админский пользователь исправлен!")
        
        # Проверяем еще раз
        print("\n=== Финальная проверка ===")
        check_all_users()
    else:
        print("\n💥 Ошибка! Не удалось исправить админского пользователя.")
