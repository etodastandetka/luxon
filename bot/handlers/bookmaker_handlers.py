#!/usr/bin/env python3
"""
Обработчики выбора букмекера
"""
import logging
from aiogram import Dispatcher, types
from aiogram.fsm.context import FSMContext
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton

from translations import get_translation

logger = logging.getLogger(__name__)

async def handle_bookmaker_selection(message: types.Message, bookmaker: str, action: str, db, bookmakers):
    """Handle bookmaker selection"""
    user_id = message.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    logger.info(f"Bookmaker {bookmaker} selected for {action}")
    
    if action == 'deposit':
        # Начинаем процесс пополнения через обработчик
        from handlers.deposit_handlers import start_deposit
        await start_deposit(message, None, bookmaker, language, db, bookmakers)
        
    elif action == 'withdraw':
        # Начинаем процесс вывода через обработчик
        from handlers.withdraw_handlers import start_withdrawal
        await start_withdrawal(message, None, bookmaker, language, db, bookmakers)

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None):
    """Регистрация обработчиков"""
    
    @dp.callback_query(lambda c: c.data and c.data.startswith('select_bookmaker:'))
    async def handle_bookmaker_selection(callback: types.CallbackQuery):
        """Обработка выбора букмекера"""
        try:
            # Парсим данные из callback
            parts = callback.data.split(':')
            if len(parts) >= 3:
                bookmaker_key = parts[1]
                action = parts[2]
                
                user_id = callback.from_user.id
                language = db.get_user_language(user_id)
                translations = get_translation(language)
                
                # Сохраняем выбранный букмекер
                db.save_user_bookmaker(user_id, bookmaker_key)
                
                bookmaker_data = bookmakers[bookmaker_key]
                
                text = f"{translations['bookmaker_selected']}: {bookmaker_data['emoji']} {bookmaker_data['name']}\n\n"
                
                if action == 'deposit':
                    # Начинаем процесс пополнения
                    from handlers.deposit_handlers import start_deposit
                    from aiogram.fsm.storage.base import StorageKey
                    storage = dp.storage
                    key = StorageKey(bot_id=callback.bot.id, chat_id=callback.message.chat.id, user_id=user_id)
                    fsm_context = FSMContext(storage=storage, key=key)
                    
                    await start_deposit(callback.message, fsm_context, bookmaker_key, language, db, bookmakers)
                    return
                    
                elif action == 'withdraw':
                    # Начинаем процесс вывода
                    from handlers.withdraw_handlers import start_withdrawal
                    from aiogram.fsm.storage.base import StorageKey
                    storage = dp.storage
                    key = StorageKey(bot_id=callback.bot.id, chat_id=callback.message.chat.id, user_id=user_id)
                    fsm_context = FSMContext(storage=storage, key=key)
                    
                    await start_withdrawal(callback.message, fsm_context, bookmaker_key, language, db, bookmakers)
                    return
                
                await callback.message.edit_text(text, parse_mode="HTML")
                await callback.answer()
                
        except Exception as e:
            logger.error(f"Ошибка при выборе букмекера: {e}")
            await callback.answer("Произошла ошибка при выборе букмекера")
    
    @dp.callback_query(lambda c: c.data and c.data == 'change_bookmaker')
    async def handle_change_bookmaker(callback: types.CallbackQuery):
        """Обработка смены букмекера"""
        try:
            user_id = callback.from_user.id
            language = db.get_user_language(user_id)
            translations = get_translation(language)
            
            # Показываем выбор букмекера
            keyboard = InlineKeyboardMarkup(inline_keyboard=[])
            for bookmaker_key, bookmaker_data in bookmakers.items():
                keyboard.inline_keyboard.append([
                    InlineKeyboardButton(
                        text=f"{bookmaker_data['emoji']} {bookmaker_data['name']}",
                        callback_data=f"select_bookmaker:{bookmaker_key}:change"
                    )
                ])
            
            text = translations['select_bookmaker']
            await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
            await callback.answer()
            
        except Exception as e:
            logger.error(f"Ошибка при смене букмекера: {e}")
            await callback.answer("Произошла ошибка при смене букмекера")
