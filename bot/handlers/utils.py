
#!/usr/bin/env python3
"""
Общие утилиты для хендлеров
"""
import logging
from typing import Dict
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder

from translations import get_translation

logger = logging.getLogger(__name__)

def get_user_language(user_id: int, user_languages: Dict[int, str], db_manager) -> str:
    """Получает язык пользователя"""
    if user_id in user_languages:
        return user_languages[user_id]
    
    user_data = db_manager.get_user(user_id)
    if user_data and user_data.get('language'):
        language = user_data['language']
        user_languages[user_id] = language
        return language
    
    return 'ru'

def get_text_for_user(user_id: int, key: str, bot_name: str, user_languages: Dict[int, str], db_manager, **kwargs) -> str:
    """Получает текст для пользователя на его языке"""
    language = get_user_language(user_id, user_languages, db_manager)
    # Локальный фолбэк вместо utils.bot_texts.get_bot_text
    translations = get_translation(language)
    value = translations.get(key, key)
    try:
        if isinstance(value, str):
            return value.format(**kwargs)
        return str(value)
    except Exception:
        return str(value)

def create_main_reply_keyboard(bot_name: str, user_id: int, user_languages: Dict[int, str], db_manager) -> ReplyKeyboardMarkup:
    """Создает основную reply клавиатуру как в оригинальном 1xbet.py"""
    language = get_user_language(user_id, user_languages, db_manager)
    
    # Получаем тексты кнопок на нужном языке (без bot_name)
    deposit_text = "💳 Пополнить" if language == 'ru' else "💳 Толтуруу" if language == 'ky' else "💳 To'ldirish"
    withdraw_text = "💰 Вывести" if language == 'ru' else "💰 Чыгаруу" if language == 'ky' else "💰 Chiqarish"
    referral_text = "💎 Реферальная система" if language == 'ru' else "💎 Рефералдык система" if language == 'ky' else "💎 Referral tizimi"
    support_text = "👨‍💻 Поддержка" if language == 'ru' else "📞 Колдоо" if language == 'ky' else "📞 Qo'llab-quvvatlash"
    history_text = "📊 История" if language == 'ru' else "📋 Тарых" if language == 'ky' else "📋 Tarix"
    faq_text = "📖 FAQ" if language == 'ru' else "❓ Суроолор" if language == 'ky' else "❓ Savollar"
    language_text = "🌐 Язык" if language == 'ru' else "🌐 Тил" if language == 'ky' else "🌐 Til"
    
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=deposit_text), KeyboardButton(text=withdraw_text)],
            [KeyboardButton(text=referral_text)],
            [KeyboardButton(text=support_text), KeyboardButton(text=history_text)],
            [KeyboardButton(text=faq_text), KeyboardButton(text=language_text)]
        ],
        resize_keyboard=True
    )
    return keyboard
