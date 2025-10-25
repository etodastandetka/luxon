#!/usr/bin/env python
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

from django.contrib.auth.models import User
from bot_control.models import UserProfile

def cleanup_users():
    """Очистить всех пользователей и создать одного админа"""
    print("=== Очистка пользователей ===")
    
    # Удаляем всех пользователей кроме dastan
    users_to_delete = User.objects.exclude(username='dastan')
    deleted_count = users_to_delete.count()
    
    for user in users_to_delete:
        print(f"🗑️ Удаляем пользователя: {user.username}")
        user.delete()
    
    print(f"✅ Удалено пользователей: {deleted_count}")
    
    # Проверяем пользователя dastan
    try:
        dastan = User.objects.get(username='dastan')
        print(f"✅ Пользователь dastan найден (ID: {dastan.id})")
        
        # Обновляем данные dastan
        dastan.email = 'admin@luxon.com'
        dastan.is_superuser = True
        dastan.is_staff = True
        dastan.is_active = True
        dastan.set_password('dastan10dz')
        dastan.save()
        
        print(f"✅ Данные dastan обновлены")
        print(f"   Email: {dastan.email}")
        print(f"   Superuser: {'Да' if dastan.is_superuser else 'Нет'}")
        print(f"   Staff: {'Да' if dastan.is_staff else 'Нет'}")
        print(f"   Active: {'Да' if dastan.is_active else 'Нет'}")
        
        # Создаем или обновляем профиль
        profile, created = UserProfile.objects.get_or_create(
            user=dastan,
            defaults={
                'is_2fa_enabled': False,
                'secret_key': ''
            }
        )
        
        if created:
            print(f"✅ Профиль для dastan создан")
        else:
            print(f"✅ Профиль для dastan уже существует")
        
        print(f"\n📋 Данные для входа:")
        print(f"Username: dastan")
        print(f"Password: dastan10dz")
        print(f"Email: {dastan.email}")
        
    except User.DoesNotExist:
        print(f"❌ Пользователь dastan не найден, создаем...")
        
        # Создаем dastan
        dastan = User.objects.create_superuser(
            username='dastan',
            email='admin@luxon.com',
            password='dastan10dz'
        )
        
        # Создаем профиль
        UserProfile.objects.create(
            user=dastan,
            is_2fa_enabled=False,
            secret_key=''
        )
        
        print(f"✅ Пользователь dastan создан")
    
    print(f"\n=== Финальный список пользователей ===")
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

if __name__ == "__main__":
    cleanup_users()
