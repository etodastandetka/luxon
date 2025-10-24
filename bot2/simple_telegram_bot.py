#!/usr/bin/env python3
"""
Простой Telegram-бот с кнопками для перехода на сайт
"""
import asyncio
import logging
from aiogram import Bot, Dispatcher, types
# Простой бот без кнопок
from aiogram.filters import CommandStart

# Настройки
BOT_TOKEN = "7796879640:AAFKi7SFuqNJKUv8hapAYFeeJsFN3OCJF0Y"
WEBSITE_URL = "https://localhost:3030"

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация бота
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(CommandStart())
async def start_command(message: types.Message):
    """Обработчик команды /start"""
    await message.answer(
        "🎯 **Добро пожаловать в LUXON!**\n\n"
        "🌐 **Перейдите на наш сайт:**\n"
        f"🔗 {WEBSITE_URL}\n\n"
        "**Доступные функции:**\n"
        "💰 Пополнение счета\n"
        "💸 Вывод средств\n"
        "📊 История операций\n"
        "👥 Реферальная система\n"
        "📖 Инструкции\n"
        "🎧 Поддержка\n\n"
        "Все функции доступны на сайте!",
        parse_mode="Markdown"
    )


async def main():
    """Основная функция запуска бота"""
    print("🤖 Запуск простого Telegram-бота...")
    print("=" * 50)
    print("📱 Функции бота:")
    print("💰 Пополнение - переход на сайт")
    print("💸 Вывод - переход на сайт") 
    print("📜 История - переход на сайт")
    print("👥 Рефералы - переход на сайт")
    print("🎧 Поддержка - контакты")
    print("=" * 50)
    
    try:
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"Ошибка запуска бота: {e}")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())
