#!/usr/bin/env python
"""
Скрипт для создания пользователей админки
"""
import os
import sys
import django

# Добавляем путь к Django проекту
sys.path.append('django_admin')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

from django.contrib.auth.models import User
from bot_control.models import UserProfile

def create_users():
    """Создаем пользователей для админки"""
    
    # Создаем суперпользователя
    if not User.objects.filter(username='admin').exists():
        admin_user = User.objects.create_superuser(
            username='admin',
            email='admin@luxon.com',
            password='admin123'
        )
        print(f"✅ Создан суперпользователь: admin / admin123")
    else:
        print("ℹ️ Суперпользователь admin уже существует")
    
    # Создаем обычного пользователя
    if not User.objects.filter(username='manager').exists():
        manager_user = User.objects.create_user(
            username='manager',
            email='manager@luxon.com',
            password='manager123',
            is_staff=True,
            is_superuser=False
        )
        print(f"✅ Создан менеджер: manager / manager123")
    else:
        print("ℹ️ Пользователь manager уже существует")
    
    # Создаем тестового пользователя
    if not User.objects.filter(username='test').exists():
        test_user = User.objects.create_user(
            username='test',
            email='test@luxon.com',
            password='test123',
            is_staff=True,
            is_superuser=False
        )
        print(f"✅ Создан тестовый пользователь: test / test123")
    else:
        print("ℹ️ Пользователь test уже существует")
    
    print("\n🎯 ГОТОВЫЕ ЛОГИНЫ И ПАРОЛИ:")
    print("=" * 40)
    print("👑 Админ:     admin / admin123")
    print("👤 Менеджер: manager / manager123") 
    print("🧪 Тест:     test / test123")
    print("=" * 40)

if __name__ == "__main__":
    create_users()
