
#!/usr/bin/env python3
"""
Расширенные хендлеры с функциями из оригинальных ботов
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from aiogram import types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder

from utils.translations import get_translation
from utils.bot_texts import get_bot_text

# Импортируем все хендлеры из отдельных файлов
from handlers.deposit_handlers import (
    handle_deposit_message, handle_id_input, handle_amount_input, handle_cancel_deposit
)
from handlers.withdraw_handlers import (
    handle_withdraw_message, handle_withdraw_id_input, 
    handle_withdraw_code_input, handle_withdraw_qr_photo, handle_cancel_withdraw
)
from handlers.faq_handlers import (
    handle_faq_command, handle_faq_deposit, handle_faq_withdraw, 
    handle_faq_technical, handle_faq_limits, handle_faq_time
)
from handlers.history_handlers import (
    handle_history_command, handle_history_page_callback, handle_history_back_to_menu
)
from handlers.qr_handlers import (
    handle_qr_generator_start, handle_qr_amount_input
)
from handlers.support_handlers import (
    handle_support_message, handle_channel_command
)

from handlers.states import ExtendedStates
from handlers.utils import get_user_language, get_text_for_user, create_main_reply_keyboard

logger = logging.getLogger(__name__)

def create_language_keyboard() -> InlineKeyboardMarkup:
    """Создает клавиатуру выбора языка"""
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🇷🇺 Русский", callback_data="switch_lang_ru")],
            [InlineKeyboardButton(text="🇰🇬 Кыргызча", callback_data="switch_lang_ky")],
            [InlineKeyboardButton(text="🇺🇿 O'zbekcha", callback_data="switch_lang_uz")]
        ]
    )
    return keyboard

async def handle_start_command_extended(message: types.Message, state: FSMContext, bot_name: str, 
                                       user_languages: Dict[int, str], db_manager, last_bot_message_id: Dict[int, int]):
    """Расширенный обработчик команды /start"""
    if not message.from_user:
        return
    
    user_id = message.from_user.id
    
    # Сбрасываем все состояния FSM
    await state.clear()
    
    # Проверяем реферальную ссылку
    start_param = message.text.split()[1] if len(message.text.split()) > 1 else ""
    if start_param.startswith("ref"):
        try:
            from handlers.referral_handlers import handle_referral_start_parameter
            await handle_referral_start_parameter(message, state, bot_name, user_languages, db_manager)
            return
        except Exception as e:
            logger.error(f"Ошибка обработки реферальной ссылки: {e}")
            # Продолжаем обычную работу бота
    
    # Удаляем предыдущие сообщения с кнопками оплаты
    if user_id in last_bot_message_id:
        try:
            # Здесь нужно получить bot из контекста
            # await bot.delete_message(chat_id=message.chat.id, message_id=last_bot_message_id[user_id])
            del last_bot_message_id[user_id]
        except Exception as e:
            logger.info(f"Не удалось удалить предыдущее сообщение при /start: {e}")
    
    # Проверяем, выбирал ли пользователь язык ранее
    user_data = db_manager.get_user(user_id)
    has_selected_language = user_data and user_data.get('language_selected', False)
    
    # Если пользователь еще не выбирал язык (первый запуск), предлагаем выбрать язык
    if not has_selected_language:
        # Создаем инлайн клавиатуру для выбора языка
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="🇷🇺 Русский", callback_data="switch_lang_ru")],
                [InlineKeyboardButton(text="🇰🇬 Кыргызча", callback_data="switch_lang_ky")],
                [InlineKeyboardButton(text="🇺🇿 O'zbekcha", callback_data="switch_lang_uz")]
            ]
        )
        
        welcome_text = (
            "🌐 Добро пожаловать! Выберите язык:\n\n"
            "🌐 Кош келиңиз! Тилди тандаңыз:\n\n"
            "🌐 Xush kelibsiz! Tilni tanlang:"
        )
        
        await message.answer(welcome_text, reply_markup=keyboard)
        return
    
    # Маппинг названий ботов для человекочитаемых текстов
    bot_display_names = {
        "1xbet": "1XBET",
        "1win": "1WIN", 
        "melbet": "MELBET",
        "mostbet": "MOSTBET"
    }
    
    bot_display_name = bot_display_names.get(bot_name, bot_name.upper())
    
    # Если пользователь уже выбирал язык ранее, показываем приветствие
    user_name = message.from_user.first_name or message.from_user.username or "Пользователь"
    
    # Получаем админа для приветствия
    admin_username = "@operator_luxkassa"  # Можно сделать динамическим
    
    # Получаем язык пользователя
    language = get_user_language(user_id, user_languages, db_manager)
    
    welcome_text = get_translation(language, 'welcome', user_name=user_name, admin_username=admin_username)
    keyboard = create_main_reply_keyboard(bot_name, user_id, user_languages, db_manager)
    
    await message.answer(welcome_text, reply_markup=keyboard)

async def handle_language_switch(callback: types.CallbackQuery, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Обработчик переключения языка"""
    user_id = callback.from_user.id
    language = callback.data.split('_')[-1]  # switch_lang_ru -> ru
    
    # Сохраняем пользователя и язык в БД
    db_manager.add_user(user_id, callback.from_user.username, callback.from_user.first_name, callback.from_user.last_name)
    db_manager.update_user_language(user_id, language)
    
    # Обновляем язык в кэше
    user_languages[user_id] = language
    
    # Маппинг названий ботов для человекочитаемых текстов
    bot_display_names = {
        "1xbet": "1XBET",
        "1win": "1WIN", 
        "melbet": "MELBET",
        "mostbet": "MOSTBET"
    }
    
    bot_display_name = bot_display_names.get(bot_name, bot_name.upper())
    
    # Отправляем приветствие на выбранном языке
    user_name = callback.from_user.first_name or callback.from_user.username or "Пользователь"
    admin_username = "@operator_luxkassa"
    
    # Используем get_translation напрямую для правильной передачи параметров
    welcome_text = get_translation(language, 'welcome', user_name=user_name, admin_username=admin_username)
    keyboard = create_main_reply_keyboard(bot_name, user_id, user_languages, db_manager)
    
    # Отправляем новое сообщение вместо редактирования
    await callback.message.answer(welcome_text, reply_markup=keyboard)
    await callback.answer(f"✅ Язык изменен для {bot_display_name}!")

async def handle_cancel_message(message: types.Message, state: FSMContext, bot_name: str, 
                               user_languages: Dict[int, str], db_manager):
    """Обработчик отмены"""
    user_id = message.from_user.id
    
    await state.clear()
    
    # Маппинг названий ботов для человекочитаемых текстов
    bot_display_names = {
        "1xbet": "1XBET",
        "1win": "1WIN", 
        "melbet": "MELBET",
        "mostbet": "MOSTBET"
    }
    
    bot_display_name = bot_display_names.get(bot_name, bot_name.upper())
    
    # Получаем язык пользователя и правильные параметры
    language = get_user_language(user_id, user_languages, db_manager)
    user_name = message.from_user.first_name or message.from_user.username or "Пользователь"
    admin_username = "@operator_luxkassa"
    
    welcome_text = get_translation(language, 'welcome', user_name=user_name, admin_username=admin_username)
    keyboard = create_main_reply_keyboard(bot_name, user_id, user_languages, db_manager)
    
    await message.answer(welcome_text, reply_markup=keyboard)

async def handle_help_command(message: types.Message, bot_name: str):
    """Обработчик команды /help"""
    user_id = message.from_user.id
    
    # Маппинг названий ботов для человекочитаемых текстов
    bot_display_names = {
        "1xbet": "1XBET",
        "1win": "1WIN", 
        "melbet": "MELBET",
        "mostbet": "MOSTBET"
    }
    
    bot_display_name = bot_display_names.get(bot_name, bot_name.upper())
    
    help_text = f"""
🤖 Помощь по боту {bot_display_name}

📋 Доступные команды:
/start - Главное меню
/help - Эта справка

📞 Поддержка: @operator_luxkassa
    """
    
    await message.answer(help_text)

async def handle_referral_message(message: types.Message, state: FSMContext, bot_name: str,
                                 user_languages: Dict[int, str], db_manager):
    """Обработчик кнопки 'Реферальная система'"""
    from handlers.referral_handlers import handle_referral_start
    
    await handle_referral_start(message, state, bot_name, user_languages, db_manager)
