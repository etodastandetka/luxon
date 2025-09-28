#!/usr/bin/env python3
"""
Обработчики истории транзакций
"""

import logging
from datetime import datetime
from aiogram import types
from aiogram.utils.keyboard import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
from typing import Dict

from translations import get_translation
from handlers.utils import create_main_reply_keyboard

logger = logging.getLogger(__name__)

async def handle_history_command(message: types.Message, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Обработка просмотра истории транзакций"""
    if not message.from_user:
        return
    
    user_id = message.from_user.id
    
    # Добавляем пользователя в базу данных если его нет
    try:
        db_manager.add_user(
            user_id,
            message.from_user.username,
            message.from_user.first_name,
            message.from_user.last_name
        )
    except Exception as e:
        logger.info(f"Ошибка добавления пользователя: {e}")
    
    await show_user_history(message, 0, bot_name, user_languages, db_manager)

async def show_user_history(message: types.Message, page: int, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Показать историю транзакций пользователя"""
    user_id = message.from_user.id
    user_lang = user_languages.get(user_id, 'ru')
    
    # Получаем транзакции пользователя
    try:
        transactions = db_manager.get_user_transactions(user_id, limit=5, offset=page * 5)
        total_count = db_manager.get_user_transactions_count(user_id)
    except Exception as e:
        logger.error(f"Ошибка получения транзакций: {e}")
        await message.answer(get_translation(user_lang, 'history_error'))
        return
    
    if not transactions:
        # Нет транзакций
        text = get_translation(user_lang, 'no_transactions')
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text=get_translation(user_lang, 'back_to_menu'), callback_data="history_back_to_menu")]]
        )
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
        return
    
    # Формируем текст истории
    text = f"<b>{get_translation(user_lang, 'history_title')}</b>\n\n"
    
    for i, trans in enumerate(transactions, 1):
        # Определяем тип транзакции
        if trans['trans_type'] == 'deposit':
            trans_type = get_translation(user_lang, 'transaction_type_deposit')
        else:
            trans_type = get_translation(user_lang, 'transaction_type_withdraw')
        
        # Определяем статус
        if trans['status'] == 'pending':
            status = get_translation(user_lang, 'transaction_status_pending')
        elif trans['status'] == 'completed':
            status = get_translation(user_lang, 'transaction_status_completed')
        else:
            status = get_translation(user_lang, 'transaction_status_rejected')
        
        # Форматируем дату
        try:
            created_at = datetime.fromisoformat(trans['created_at'])
            date_str = created_at.strftime("%d.%m.%Y %H:%M")
        except:
            date_str = trans.get('created_at', 'Неизвестно')
        
        text += f"{i}. {trans_type}\n"
        text += f"   {get_translation(user_lang, 'transaction_amount')} {trans['amount']:,.0f} KGS\n"
        text += f"   {get_translation(user_lang, 'transaction_status')} {status}\n"
        text += f"   {get_translation(user_lang, 'transaction_date')} {date_str}\n"
        
        if trans.get('xbet_id'):
            text += f"   {get_translation(user_lang, 'transaction_id')} {trans['xbet_id']}\n"
        text += "\n"
    
    # Создаем клавиатуру с пагинацией
    keyboard_buttons = []
    
    # Кнопки навигации
    nav_buttons = []
    if page > 0:
        nav_buttons.append(InlineKeyboardButton(text=get_translation(user_lang, 'prev_page'), callback_data=f"history_page_{page-1}"))
    
    if (page + 1) * 5 < total_count:
        nav_buttons.append(InlineKeyboardButton(text=get_translation(user_lang, 'next_page'), callback_data=f"history_page_{page+1}"))
    
    if nav_buttons:
        keyboard_buttons.append(nav_buttons)
    
    # Информация о странице
    total_pages = (total_count + 4) // 5  # Округление вверх
    if total_pages > 1:
        page_info = get_translation(user_lang, 'page_info').format(current=page+1, total=total_pages)
        keyboard_buttons.append([InlineKeyboardButton(text=page_info, callback_data="history_page_info")])
    
    # Кнопка возврата
    keyboard_buttons.append([InlineKeyboardButton(text=get_translation(user_lang, 'back_to_menu'), callback_data="history_back_to_menu")])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")

async def handle_history_page_callback(callback: types.CallbackQuery, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Обработчик пагинации истории"""
    if not callback.from_user:
        return
    
    try:
        page = int(callback.data.split("_")[-1])
        await show_user_history_callback(callback, page, bot_name, user_languages, db_manager)
        await callback.answer()
    except (ValueError, IndexError):
        user_lang = user_languages.get(callback.from_user.id, 'ru')
        await callback.answer(get_translation(user_lang, 'pagination_error'))

async def show_user_history_callback(callback: types.CallbackQuery, page: int, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Показать историю транзакций пользователя (для callback)"""
    user_id = callback.from_user.id
    user_lang = user_languages.get(user_id, 'ru')
    
    # Получаем транзакции пользователя
    try:
        transactions = db_manager.get_user_transactions(user_id, limit=5, offset=page * 5)
        total_count = db_manager.get_user_transactions_count(user_id)
    except Exception as e:
        logger.error(f"Ошибка получения транзакций: {e}")
        await callback.message.edit_text(get_translation(user_lang, 'history_error'))
        return
    
    if not transactions:
        # Нет транзакций
        text = get_translation(user_lang, 'no_transactions')
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text=get_translation(user_lang, 'back_to_menu'), callback_data="history_back_to_menu")]]
        )
        await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
        return
    
    # Формируем текст истории
    text = f"<b>{get_translation(user_lang, 'history_title')}</b>\n\n"
    
    for i, trans in enumerate(transactions, 1):
        # Определяем тип транзакции
        if trans['trans_type'] == 'deposit':
            trans_type = get_translation(user_lang, 'transaction_type_deposit')
        else:
            trans_type = get_translation(user_lang, 'transaction_type_withdraw')
        
        # Определяем статус
        if trans['status'] == 'pending':
            status = get_translation(user_lang, 'transaction_status_pending')
        elif trans['status'] == 'completed':
            status = get_translation(user_lang, 'transaction_status_completed')
        else:
            status = get_translation(user_lang, 'transaction_status_rejected')
        
        # Форматируем дату
        try:
            created_at = datetime.fromisoformat(trans['created_at'])
            date_str = created_at.strftime("%d.%m.%Y %H:%M")
        except:
            date_str = trans.get('created_at', 'Неизвестно')
        
        text += f"{i}. {trans_type}\n"
        text += f"   {get_translation(user_lang, 'transaction_amount')} {trans['amount']:,.0f} KGS\n"
        text += f"   {get_translation(user_lang, 'transaction_status')} {status}\n"
        text += f"   {get_translation(user_lang, 'transaction_date')} {date_str}\n"
        
        if trans.get('xbet_id'):
            text += f"   {get_translation(user_lang, 'transaction_id')} {trans['xbet_id']}\n"
        text += "\n"
    
    # Создаем клавиатуру с пагинацией
    keyboard_buttons = []
    
    # Кнопки навигации
    nav_buttons = []
    if page > 0:
        nav_buttons.append(InlineKeyboardButton(text=get_translation(user_lang, 'prev_page'), callback_data=f"history_page_{page-1}"))
    
    if (page + 1) * 5 < total_count:
        nav_buttons.append(InlineKeyboardButton(text=get_translation(user_lang, 'next_page'), callback_data=f"history_page_{page+1}"))
    
    if nav_buttons:
        keyboard_buttons.append(nav_buttons)
    
    # Информация о странице
    total_pages = (total_count + 4) // 5  # Округление вверх
    if total_pages > 1:
        page_info = get_translation(user_lang, 'page_info').format(current=page+1, total=total_pages)
        keyboard_buttons.append([InlineKeyboardButton(text=page_info, callback_data="history_page_info")])
    
    # Кнопка возврата
    keyboard_buttons.append([InlineKeyboardButton(text=get_translation(user_lang, 'back_to_menu'), callback_data="history_back_to_menu")])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")

async def handle_history_back_to_menu(callback: types.CallbackQuery, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Возврат в главное меню из истории"""
    if not callback.from_user:
        return
    
    user_id = callback.from_user.id
    user_lang = user_languages.get(user_id, 'ru')
    
    keyboard = create_main_reply_keyboard(bot_name, user_id, user_languages, db_manager)
    
    await callback.message.edit_text(get_translation(user_lang, 'main_menu'), reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()

def register_handlers(dp, db_manager, bookmakers=None, api_manager=None):
    """Регистрация callback-хендлеров истории (пагинация и возврат в меню)."""
    from aiogram import F

    @dp.callback_query(F.data.startswith("history_page_"))
    async def _cb_history_page(callback: types.CallbackQuery):
        try:
            # bot_name в нашем универсальном боте не используется — передадим плейсхолдер
            user_id = callback.from_user.id
            user_languages = {user_id: db_manager.get_user_language(user_id)}
            await handle_history_page_callback(callback, bot_name='universal', user_languages=user_languages, db_manager=db_manager)
        except Exception as e:
            logger.error(f"history page cb error: {e}")
            try:
                await callback.answer("❌ Ошибка", show_alert=True)
            except Exception:
                pass

    @dp.callback_query(F.data == "history_back_to_menu")
    async def _cb_history_back(callback: types.CallbackQuery):
        try:
            user_id = callback.from_user.id
            user_languages = {user_id: db_manager.get_user_language(user_id)}
            await handle_history_back_to_menu(callback, bot_name='universal', user_languages=user_languages, db_manager=db_manager)
        except Exception as e:
            logger.error(f"history back cb error: {e}")
            try:
                await callback.answer("❌ Ошибка", show_alert=True)
            except Exception:
                pass
