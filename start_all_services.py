#!/usr/bin/env python3
"""
Запуск всех сервисов LUXON
"""

import subprocess
import time
import sys
import os
from threading import Thread

class ServiceManager:
    def __init__(self):
        self.processes = []
        
    def start_django_admin(self):
        """Запуск Django админ-панели"""
        print("🚀 Запуск Django админ-панели...")
        try:
            os.chdir('django_admin')
            process = subprocess.Popen([
                sys.executable, 'manage.py', 'runserver', '8081'
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.processes.append(('Django Admin', process))
            print("✅ Django админ-панель запущена на порту 8081")
        except Exception as e:
            print(f"❌ Ошибка запуска Django: {e}")
        finally:
            os.chdir('..')
    
    def start_nextjs_app(self):
        """Запуск Next.js мини-приложения"""
        print("🚀 Запуск Next.js мини-приложения...")
        try:
            os.chdir('bot2/mini_app_site')
            process = subprocess.Popen([
                'npm', 'run', 'dev'
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.processes.append(('Next.js App', process))
            print("✅ Next.js приложение запущено на порту 3000")
        except Exception as e:
            print(f"❌ Ошибка запуска Next.js: {e}")
        finally:
            os.chdir('../..')
    
    def start_telegram_bot(self):
        """Запуск Telegram бота"""
        print("🚀 Запуск Telegram бота...")
        try:
            os.chdir('bot')
            process = subprocess.Popen([
                sys.executable, 'main.py'
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.processes.append(('Telegram Bot', process))
            print("✅ Telegram бот запущен")
        except Exception as e:
            print(f"❌ Ошибка запуска бота: {e}")
        finally:
            os.chdir('..')
    
    def start_all(self):
        """Запуск всех сервисов"""
        print("🎯 ЗАПУСК ВСЕХ СЕРВИСОВ LUXON")
        print("=" * 50)
        
        # Запускаем сервисы в отдельных потоках
        threads = [
            Thread(target=self.start_django_admin),
            Thread(target=self.start_nextjs_app),
            Thread(target=self.start_telegram_bot)
        ]
        
        for thread in threads:
            thread.start()
            time.sleep(2)  # Небольшая задержка между запусками
        
        print("\n⏳ Ожидание запуска сервисов...")
        time.sleep(10)
        
        print("\n📊 СТАТУС СЕРВИСОВ:")
        for name, process in self.processes:
            if process.poll() is None:
                print(f"✅ {name}: Запущен (PID: {process.pid})")
            else:
                print(f"❌ {name}: Остановлен")
        
        print("\n🌐 ДОСТУПНЫЕ СЕРВИСЫ:")
        print("   🔧 Django Admin: http://localhost:8081")
        print("   📱 Mini App: http://localhost:3000")
        print("   🤖 Telegram Bot: Активен")
        
        print("\n💡 Нажмите Ctrl+C для остановки всех сервисов")
        
        try:
            # Ждем завершения
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Остановка всех сервисов...")
            for name, process in self.processes:
                if process.poll() is None:
                    process.terminate()
                    print(f"✅ {name}: Остановлен")
            print("👋 Все сервисы остановлены!")

def main():
    manager = ServiceManager()
    manager.start_all()

if __name__ == "__main__":
    main()

