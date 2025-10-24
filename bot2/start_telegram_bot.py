#!/usr/bin/env python3
"""
Запуск Telegram-бота согласно ТЗ
"""
import asyncio
import logging
import sys
import os

# Добавляем путь к модулям
sys.path.append(os.path.dirname(__file__))

from bot_v2.telegram_bot import main

if __name__ == "__main__":
    print("🤖 Запуск Telegram-бота...")
    print("=" * 50)
    print("📱 Функции бота:")
    print("💰 Пополнение - выбор казино, ID, сумма, QR-ссылки")
    print("💸 Вывод - заявки на вывод с подтверждением")
    print("📜 История - операции пользователя")
    print("👥 Рефералы - персональные ссылки и статистика")
    print("🧾 Инструкция - пошаговая инструкция")
    print("🎧 Поддержка - контакты поддержки")
    print("=" * 50)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Бот остановлен")
    except Exception as e:
        print(f"❌ Ошибка запуска бота: {e}")
        sys.exit(1)

