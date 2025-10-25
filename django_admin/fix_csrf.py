#!/usr/bin/env python
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_panel.settings')
django.setup()

from django.conf import settings
from django.core.management import execute_from_command_line

def fix_csrf_settings():
    """Исправить настройки CSRF"""
    print("=== Исправление настроек CSRF ===")
    
    # Проверяем текущие настройки
    print(f"DEBUG: {settings.DEBUG}")
    print(f"ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")
    print(f"CSRF_TRUSTED_ORIGINS: {getattr(settings, 'CSRF_TRUSTED_ORIGINS', 'НЕ НАСТРОЕНО')}")
    
    # Создаем файл с исправленными настройками
    settings_content = '''
# Добавляем CSRF настройки
CSRF_TRUSTED_ORIGINS = [
    'https://xendro.pro',
    'https://www.xendro.pro',
    'http://xendro.pro',
    'http://www.xendro.pro',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
]

# Отключаем CORS для админки (может конфликтовать с CSRF)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = False

# Настройки сессий для CSRF
SESSION_COOKIE_SECURE = False  # Для HTTP
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_AGE = 86400  # 24 часа

# CSRF настройки
CSRF_COOKIE_SECURE = False  # Для HTTP
CSRF_COOKIE_HTTPONLY = True
CSRF_USE_SESSIONS = True
'''
    
    # Записываем в файл
    with open('/var/www/luxon/django_admin/csrf_fix.py', 'w') as f:
        f.write(settings_content)
    
    print("✅ Файл csrf_fix.py создан")
    print("📋 Добавьте эти настройки в settings.py:")
    print(settings_content)
    
    print("\n🔧 КОМАНДЫ ДЛЯ ИСПРАВЛЕНИЯ:")
    print("1. Добавьте настройки CSRF в settings.py")
    print("2. Перезапустите Django")
    print("3. Очистите кэш браузера")

if __name__ == "__main__":
    fix_csrf_settings()
