#!/usr/bin/env python3
"""
Обработчики языка
"""
import logging
from aiogram import Dispatcher, types
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton

from translations import get_translation

logger = logging.getLogger(__name__)

async def handle_language_selection(message: types.Message, language: str, db):
    """Обработка выбора языка"""
    try:
        translations = get_translation(language)
        logger.info(f"Показываем выбор языка для пользователя {message.from_user.id}, текущий язык: {language}")
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🇷🇺 Русский", callback_data="lang_ru")],
            [InlineKeyboardButton(text="🇰🇬 Кыргызча", callback_data="lang_ky")],
            [InlineKeyboardButton(text="🇺🇿 O'zbekcha", callback_data="lang_uz")]
        ])
        
        text = translations.get('select_language', '🌐 Выберите язык:')
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
        
    except Exception as e:
        logger.error(f"Ошибка при показе выбора языка: {e}")
        await message.answer("🌐 Выберите язык:")

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None):
    """Регистрация обработчиков"""
    
    @dp.callback_query(lambda c: c.data and c.data.startswith('lang_'))
    async def handle_language_callback(callback: types.CallbackQuery):
        """Обработка выбора языка"""
        try:
            lang_code = callback.data.split('_')[1]
            user_id = callback.from_user.id
            
            logger.info(f"Пользователь {user_id} выбирает язык: {lang_code}")
            
            # Сохраняем выбранный язык
            db.save_user_language(user_id, lang_code)
            
            # Получаем переводы для нового языка
            translations = get_translation(lang_code)
            
            logger.info(f"Получены переводы для языка {lang_code}: {list(translations.keys())}")
            
            # Проверяем наличие всех необходимых ключей
            required_keys = ['deposit', 'withdraw', 'referral', 'support', 'history', 'faq', 'language', 'welcome']
            missing_keys = [key for key in required_keys if key not in translations]
            
            if missing_keys:
                logger.error(f"Отсутствуют ключи для языка {lang_code}: {missing_keys}")
                await callback.answer(f"❌ Ошибка: отсутствуют переводы для языка {lang_code}")
                return
            
            # Просто показываем главное меню с новым языком
            keyboard = ReplyKeyboardMarkup(
                keyboard=[
                    [KeyboardButton(text=translations['deposit']), KeyboardButton(text=translations['withdraw'])],
                    [KeyboardButton(text=translations['referral'])],
                    [KeyboardButton(text=translations['support']), KeyboardButton(text=translations['history'])],
                    [KeyboardButton(text=translations['faq']), KeyboardButton(text=translations['language'])]
                ],
                resize_keyboard=True
            )
            
            text = f"{translations['welcome'].format(user_name=callback.from_user.first_name or 'Пользователь', admin_username='@luxon_support')}"
            
            await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
            await callback.answer("Язык изменен!")
            
            logger.info(f"Язык успешно изменен на {lang_code} для пользователя {user_id}")
            
        except Exception as e:
            logger.error(f"Ошибка при смене языка: {e}")
            await callback.answer("Произошла ошибка при смене языка")
    

