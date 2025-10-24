#!/usr/bin/env python
"""
Скрипт для создания пользователей на сервере
Запускать от имени root или с sudo
"""
import os
import sys
import django

# Добавляем путь к Django проекту
sys.path.append('/var/www/luxon/django_admin')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

from django.contrib.auth.models import User

def create_users():
    """Создаем пользователей для админки"""
    
    print("🔧 Создание пользователей...")
    
    # Создаем суперпользователя
    if not User.objects.filter(username='admin').exists():
        admin_user = User.objects.create_superuser(
            username='admin',
            email='admin@luxon.com',
            password='admin123'
        )
        print("✅ Создан суперпользователь: admin / admin123")
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
        print("✅ Создан менеджер: manager / manager123")
    else:
        print("ℹ️ Пользователь manager уже существует")
    
    print("\n🎯 ГОТОВЫЕ ЛОГИНЫ И ПАРОЛИ:")
    print("=" * 40)
    print("👑 Админ:     admin / admin123")
    print("👤 Менеджер: manager / manager123")
    print("=" * 40)

if __name__ == "__main__":
    create_users()
