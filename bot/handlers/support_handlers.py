#!/usr/bin/env python3
"""
Обработчики поддержки и канала
"""

import logging
from aiogram import types, Dispatcher
from typing import Dict

from translations import get_translation

logger = logging.getLogger(__name__)

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None):
    """Регистрация обработчиков поддержки"""
    
    @dp.message(lambda message: message.text and "поддержка" in message.text.lower())
    async def handle_support(message: types.Message):
        """Обработка кнопки поддержки"""
        try:
            user_id = message.from_user.id
            language = db.get_user_language(user_id)
            translations = get_translation(language)
            
            support_text = translations['support_text'].format(
                bot_name="LUXON",
                admin_username='@luxon_support'
            )
            
            await message.answer(support_text, parse_mode="HTML")
            
        except Exception as e:
            logger.error(f"Ошибка в handle_support: {e}")
            await message.answer("Произошла ошибка при показе поддержки")
    
    @dp.message(lambda message: message.text and "история" in message.text.lower())
    async def handle_history(message: types.Message):
        """Обработка кнопки истории"""
        try:
            user_id = message.from_user.id
            language = db.get_user_language(user_id)
            translations = get_translation(language)
            
            # Показываем заголовок истории
            history_text = translations['history_title']
            await message.answer(history_text, parse_mode="HTML")
            
        except Exception as e:
            logger.error(f"Ошибка в handle_history: {e}")
            await message.answer("Произошла ошибка при показе истории")

# Экспортируемые функции для явного вызова из main.py
async def handle_support(message: types.Message, language: str, db):
    """Показывает блок поддержки (вызов из main.py)"""
    try:
        translations = get_translation(language)
        support_text = translations['support_text'].format(
            bot_name="LUXON",
            admin_username='@luxon_support'
        )
        await message.answer(support_text, parse_mode="HTML")
    except Exception as e:
        logger.error(f"Ошибка в handle_support (explicit): {e}")
        await message.answer("Произошла ошибка при показе поддержки")

async def handle_history(message: types.Message, language: str, db):
    """Показывает заголовок истории (вызов из main.py)"""
    try:
        translations = get_translation(language)
        history_text = translations['history_title']
        await message.answer(history_text, parse_mode="HTML")
    except Exception as e:
        logger.error(f"Ошибка в handle_history (explicit): {e}")
        await message.answer("Произошла ошибка при показе истории")

async def handle_support_message(message: types.Message, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Обработка команды поддержки"""
    if not message.from_user:
        return
    
    user_id = message.from_user.id
    user_lang = user_languages.get(user_id, 'ru')
    
    # Маппинг названий ботов для человекочитаемых текстов
    bot_display_names = {
        "1xbet": "1XBET",
        "1win": "1WIN", 
        "melbet": "MELBET",
        "mostbet": "MOSTBET"
    }
    
    bot_display_name = bot_display_names.get(bot_name, bot_name.upper())
    
    # Используем систему переводов
    support_text = get_translation(user_lang, 'support_text').format(bot_name=bot_display_name)
    
    await message.answer(support_text, parse_mode="HTML")

async def handle_channel_command(message: types.Message, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Обработка команды канала"""
    if not message.from_user:
        return
    
    user_id = message.from_user.id
    user_lang = user_languages.get(user_id, 'ru')
    
    # Маппинг названий ботов для человекочитаемых текстов
    bot_display_names = {
        "1xbet": "1XBET",
        "1win": "1WIN", 
        "melbet": "MELBET",
        "mostbet": "MOSTBET"
    }
    
    bot_display_name = bot_display_names.get(bot_name, bot_name.upper())
    
    # Используем систему переводов
    channel_text = get_translation(user_lang, 'channel_text').format(bot_name=bot_display_name)
    
    await message.answer(channel_text, parse_mode="HTML")
