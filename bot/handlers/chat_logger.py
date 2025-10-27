"""
Обработчик для логирования всех входящих сообщений в чат
"""
import logging
import requests
from aiogram import Router, F
from aiogram.types import Message
from typing import Optional

logger = logging.getLogger(__name__)

router = Router()

def get_django_api_url():
    """Получить URL Django API"""
    import os
    return os.getenv('DJANGO_API_URL', 'http://127.0.0.1:8081')


async def save_message_to_db(message: Message):
    """
    Сохранить входящее сообщение в Django базу данных
    """
    try:
        api_url = get_django_api_url()
        
        # Подготавливаем данные сообщения
        data = {
            'user_id': message.from_user.id,
            'message_text': message.text or message.caption or '',
            'message_type': 'text',
            'direction': 'in',  # входящее от пользователя
            'telegram_message_id': message.message_id
        }
        
        # Определяем тип сообщения
        if message.photo:
            data['message_type'] = 'photo'
            # Берем самое большое фото
            data['media_url'] = message.photo[-1].file_id
        elif message.video:
            data['message_type'] = 'video'
            data['media_url'] = message.video.file_id
        elif message.document:
            data['message_type'] = 'document'
            data['media_url'] = message.document.file_id
        elif message.voice:
            data['message_type'] = 'voice'
            data['media_url'] = message.voice.file_id
        elif message.audio:
            data['message_type'] = 'audio'
            data['media_url'] = message.audio.file_id
        elif message.sticker:
            data['message_type'] = 'sticker'
            data['media_url'] = message.sticker.file_id
        
        # Отправляем в Django API
        response = requests.post(
            f'{api_url}/bot/api/save-chat-message/',
            json=data,
            timeout=5
        )
        
        if response.ok:
            logger.info(f"Message from user {message.from_user.id} saved to DB")
        else:
            logger.warning(f"Failed to save message: {response.status_code}")
            
    except Exception as e:
        logger.error(f"Error saving message to DB: {e}", exc_info=True)


@router.message()
async def log_all_messages(message: Message):
    """
    Логировать все входящие сообщения
    Этот обработчик должен быть зарегистрирован последним
    """
    # Сохраняем сообщение в БД асинхронно (не блокируя обработку)
    try:
        await save_message_to_db(message)
    except Exception as e:
        logger.error(f"Failed to log message: {e}")
    
    # Не останавливаем обработку, пропускаем дальше


def register_handlers(dp, db, bookmakers, api_manager=None, bot=None):
    """Регистрация обработчиков логирования чата"""
    # Регистрируем router последним, чтобы логировать все сообщения
    dp.include_router(router)
    logger.info("Chat logger handlers registered")

