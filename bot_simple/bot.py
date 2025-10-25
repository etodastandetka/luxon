#!/usr/bin/env python3
"""
Простой Telegram бот для LUXON
Только команда /start с кнопками
"""

import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, InputFile
from telegram.ext import Application, CommandHandler, ContextTypes
import os

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Токен бота
BOT_TOKEN = "8372920134:AAG9VbvRvu-7Ikug_fwMtc-5OzxmevKTfSw"

# URL сайта
WEBSITE_URL = "https://luxservice.online"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start"""
    user = update.effective_user
    
    # Создаем кнопки как полноэкранные мини-приложения
    keyboard = [
        [
            InlineKeyboardButton("💰 Пополнить", web_app=WebAppInfo(url=f"{WEBSITE_URL}/deposit")),
            InlineKeyboardButton("💸 Вывести", web_app=WebAppInfo(url=f"{WEBSITE_URL}/withdraw"))
        ],
        [
            InlineKeyboardButton("📊 История", web_app=WebAppInfo(url=f"{WEBSITE_URL}/history")),
            InlineKeyboardButton("👥 Рефералы", web_app=WebAppInfo(url=f"{WEBSITE_URL}/referral"))
        ],
        [
            InlineKeyboardButton("ℹ️ Инструкция", web_app=WebAppInfo(url=f"{WEBSITE_URL}/instruction")),
            InlineKeyboardButton("🆘 Поддержка", web_app=WebAppInfo(url=f"{WEBSITE_URL}/support"))
        ],
        [
            InlineKeyboardButton("🚀 Открыть приложение", web_app=WebAppInfo(url=WEBSITE_URL))
        ]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    welcome_text = f"""
Привет, {user.first_name}!

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: @luxon_support
💬 Чат для всех: @luxkassa_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности

Выберите действие:
    """
    
    # Проверяем наличие видео файла
    video_path = "luxon.mp4"
    if os.path.exists(video_path):
        # Отправляем видео с текстом и кнопками
        with open(video_path, 'rb') as video_file:
            await update.message.reply_video(
                video=InputFile(video_file),
                caption=welcome_text,
                reply_markup=reply_markup,
                parse_mode='HTML'
            )
    else:
        # Если видео нет, отправляем только текст
        await update.message.reply_text(
            welcome_text,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик ошибок"""
    logger.error(f"Ошибка: {context.error}")

def main() -> None:
    """Главная функция"""
    # Создаем приложение
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Добавляем обработчики
    application.add_handler(CommandHandler("start", start))
    
    # Добавляем обработчик ошибок
    application.add_error_handler(error_handler)
    
    # Запускаем бота
    print("🤖 Бот запущен!")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
