#!/usr/bin/env python3
"""
Запуск всех сервисов согласно ТЗ
- Django админ-панель (порт 8081)
- Next.js веб-сайт (порт 3030)
- Telegram-бот
"""
import subprocess
import sys
import os
import time
import threading
import signal

def start_django_admin():
    """Запуск Django админ-панели"""
    print("🔐 Запуск Django админ-панели...")
    try:
        # Переходим в директорию Django
        django_dir = os.path.join(os.path.dirname(__file__), '..', 'django_admin')
        if os.path.exists(django_dir):
            subprocess.run([sys.executable, 'start_admin.py'], cwd=django_dir, check=True)
        else:
            print("❌ Django админ-панель не найдена")
    except Exception as e:
        print(f"❌ Ошибка запуска Django: {e}")

def start_website():
    """Запуск Next.js веб-сайта"""
    print("🌐 Запуск веб-сайта...")
    try:
        website_dir = os.path.join(os.path.dirname(__file__), 'mini_app_site')
        if os.path.exists(website_dir):
            # Устанавливаем зависимости если нужно
            if not os.path.exists(os.path.join(website_dir, 'node_modules')):
                print("📦 Установка зависимостей Next.js...")
                subprocess.run(['npm', 'install'], cwd=website_dir, check=True)
            
            subprocess.run(['npm', 'run', 'dev'], cwd=website_dir, check=True)
        else:
            print("❌ Веб-сайт не найден")
    except Exception as e:
        print(f"❌ Ошибка запуска веб-сайта: {e}")

def start_telegram_bot():
    """Запуск Telegram-бота"""
    print("🤖 Запуск Telegram-бота...")
    try:
        subprocess.run([sys.executable, 'start_telegram_bot.py'], check=True)
    except Exception as e:
        print(f"❌ Ошибка запуска бота: {e}")

def main():
    """Главная функция запуска всех сервисов"""
    print("🚀 Запуск всех сервисов RouteMaster KG")
    print("=" * 60)
    print("📱 Сервисы:")
    print("🔐 Django админ-панель - http://localhost:8081")
    print("🌐 Веб-сайт для пользователей - http://localhost:3030")
    print("🤖 Telegram-бот - работает в фоне")
    print("=" * 60)
    print("Нажмите Ctrl+C для остановки всех сервисов...")
    
    # Создаем потоки для каждого сервиса
    django_thread = threading.Thread(target=start_django_admin, daemon=True)
    website_thread = threading.Thread(target=start_website, daemon=True)
    bot_thread = threading.Thread(target=start_telegram_bot, daemon=True)
    
    try:
        # Запускаем все сервисы
        django_thread.start()
        time.sleep(2)  # Небольшая задержка между запусками
        
        website_thread.start()
        time.sleep(2)
        
        bot_thread.start()
        
        # Ждем завершения всех потоков
        django_thread.join()
        website_thread.join()
        bot_thread.join()
        
    except KeyboardInterrupt:
        print("\n🛑 Остановка всех сервисов...")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Неожиданная ошибка: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

