#!/usr/bin/env python3
"""
Запуск веб-сайта для пользователей согласно ТЗ
"""
import subprocess
import sys
import os
import time

def start_website():
    """Запуск Next.js веб-сайта"""
    print("🌐 Запуск веб-сайта для пользователей...")
    print("=" * 50)
    print("📱 Функции сайта:")
    print("💳 Пополнить - выбор казино, ID, сумма, QR-ссылки")
    print("💰 Вывести - заявки на вывод с подтверждением")
    print("📜 История - операции пользователя")
    print("👥 Рефералы - персональные ссылки и статистика")
    print("🧾 Инструкция - пошаговая инструкция")
    print("🎧 Поддержка - контакты и FAQ")
    print("=" * 50)
    
    # Переходим в директорию с сайтом
    website_dir = os.path.join(os.path.dirname(__file__), 'mini_app_site')
    
    if not os.path.exists(website_dir):
        print(f"❌ Директория {website_dir} не найдена")
        return
    
    try:
        # Проверяем, установлены ли зависимости
        if not os.path.exists(os.path.join(website_dir, 'node_modules')):
            print("📦 Установка зависимостей...")
            subprocess.run(['npm', 'install'], cwd=website_dir, check=True)
        
        print("🚀 Запуск веб-сайта на http://localhost:3030")
        print("Нажмите Ctrl+C для остановки...")
        
        # Запускаем Next.js
        subprocess.run(['npm', 'run', 'dev'], cwd=website_dir, check=True)
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка запуска: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 Веб-сайт остановлен")
    except Exception as e:
        print(f"❌ Неожиданная ошибка: {e}")
        sys.exit(1)

if __name__ == "__main__":
    start_website()

