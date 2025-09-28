#!/usr/bin/env python3
"""
Простой скрипт для запуска Django админ панели
"""
import subprocess
import sys
import os

def main():
    print("🔐 Запуск Django Админ Панели RouteMaster KG")
    print("=" * 50)
    
    # Переходим в папку Django проекта
    os.chdir('django_admin')
    
    try:
        # Запускаем Django сервер
        print("🚀 Запуск Django сервера на порту 8081...")
        print("📱 Админ панель будет доступна по адресу: http://localhost:8081")
        print("🔐 Django Admin: http://localhost:8081/admin")
        print("⚙️ Настройки бота: http://localhost:8081/bot/settings/")
        print("📢 Рассылка: http://localhost:8081/bot/broadcast/")
        print("\nНажмите Ctrl+C для остановки...")
        
        subprocess.run([sys.executable, "manage.py", "runserver", "0.0.0.0:8081"])
        
    except KeyboardInterrupt:
        print("\n🛑 Django админ панель остановлена")
    except Exception as e:
        print(f"❌ Ошибка запуска: {e}")

if __name__ == "__main__":
    main()

