#!/usr/bin/env python3
"""
Простой Telegram бот для LUXON
Только команда /start с кнопками
"""

import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, InputFile
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import os
import aiohttp
import json

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

# URL Django API
DJANGO_API_URL = os.getenv('DJANGO_API_URL', 'http://127.0.0.1:8081')

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
        # Отправляем видео с текстом и кнопками в одном сообщении
        with open(video_path, 'rb') as video_file:
            await update.message.reply_video(
                video=InputFile(video_file),
                caption=welcome_text,
                reply_markup=reply_markup,
                parse_mode='HTML'
            )
    else:
        # Если видео нет, отправляем только текст с кнопками
        await update.message.reply_text(
            welcome_text,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )

async def save_message_to_db(message_data: dict) -> bool:
    """Сохранить сообщение в Django базу данных"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{DJANGO_API_URL}/bot/api/save-chat-message/',
                json=message_data,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status == 200:
                    logger.info(f"✅ Message from user {message_data['user_id']} saved to DB")
                    return True
                else:
                    text = await response.text()
                    logger.warning(f"⚠️ Failed to save message: {response.status} - {text}")
                    return False
    except Exception as e:
        logger.error(f"❌ Error saving message to DB: {e}")
        return False

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик всех входящих сообщений"""
    try:
        message = update.message
        user = message.from_user
        
        # Подготавливаем данные сообщения
        message_data = {
            'user_id': user.id,
            'message_text': message.text or message.caption or '',
            'message_type': 'text',
            'direction': 'in',  # входящее от пользователя
            'telegram_message_id': message.message_id
        }
        
        # Определяем тип сообщения
        if message.photo:
            message_data['message_type'] = 'photo'
            # Берем самое большое фото
            message_data['media_url'] = message.photo[-1].file_id
        elif message.video:
            message_data['message_type'] = 'video'
            message_data['media_url'] = message.video.file_id
        elif message.document:
            message_data['message_type'] = 'document'
            message_data['media_url'] = message.document.file_id
        elif message.voice:
            message_data['message_type'] = 'voice'
            message_data['media_url'] = message.voice.file_id
        elif message.audio:
            message_data['message_type'] = 'audio'
            message_data['media_url'] = message.audio.file_id
        elif message.sticker:
            message_data['message_type'] = 'sticker'
            message_data['media_url'] = message.sticker.file_id
        
        # Сохраняем в БД
        await save_message_to_db(message_data)
        
    except Exception as e:
        logger.error(f"❌ Error handling message: {e}")

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик ошибок"""
    logger.error(f"Ошибка: {context.error}")

def main() -> None:
    """Главная функция"""
    # Создаем приложение
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Добавляем обработчики команд
    application.add_handler(CommandHandler("start", start))
    
    # Добавляем обработчик всех текстовых и медиа сообщений (должен быть последним!)
    application.add_handler(MessageHandler(
        filters.ALL & ~filters.COMMAND,  # Все сообщения кроме команд
        handle_message
    ))
    
    # Добавляем обработчик ошибок
    application.add_error_handler(error_handler)
    
    # Запускаем бота
    print("🤖 Бот запущен!")
    logger.info("Bot started and ready to log messages to Django")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
