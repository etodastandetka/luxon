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
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder

from utils.translations import get_translation
from utils.bot_texts import get_bot_text

logger = logging.getLogger(__name__)

class ExtendedStates(StatesGroup):
    """Расширенные состояния для всех ботов"""
    waiting_for_amount = State()
    waiting_for_withdraw_amount = State()
    waiting_for_bank = State()
    waiting_for_phone = State()
    waiting_for_name = State()
    waiting_for_id = State()
    waiting_for_qr_amount = State()
    waiting_for_receipt = State()
    waiting_for_withdraw_phone = State()
    waiting_for_withdraw_name = State()
    waiting_for_withdraw_code = State()
    waiting_for_withdraw_qr = State()
    waiting_for_withdraw_bank = State()
    waiting_for_withdraw_phone_new = State()
    waiting_for_withdraw_qr_photo = State()
    waiting_for_withdraw_id_photo = State()

def get_user_language(user_id: int, user_languages: Dict[int, str], db_manager) -> str:
    """Получает язык пользователя"""
    if user_id in user_languages:
        return user_languages[user_id]
    
    # Получаем из БД
    user_data = db_manager.get_user(user_id)
    if user_data and user_data.get('language'):
        language = user_data['language']
        user_languages[user_id] = language
        return language
    
    return 'ru'  # По умолчанию русский

def get_text_for_user(user_id: int, key: str, bot_name: str, user_languages: Dict[int, str], db_manager, **kwargs) -> str:
    """Получает текст для пользователя на его языке"""
    language = get_user_language(user_id, user_languages, db_manager)
    return get_bot_text(bot_name, key, language, **kwargs)

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

def create_main_reply_keyboard(bot_name: str, user_id: int, user_languages: Dict[int, str], db_manager) -> ReplyKeyboardMarkup:
    """Создает основную reply клавиатуру"""
    texts = {
        'deposit': get_text_for_user(user_id, 'deposit', bot_name, user_languages, db_manager),
        'withdraw': get_text_for_user(user_id, 'withdraw', bot_name, user_languages, db_manager),
        'support': get_text_for_user(user_id, 'support', bot_name, user_languages, db_manager),
        'history': get_translation(get_user_language(user_id, user_languages, db_manager), 'history'),
        'faq': get_translation(get_user_language(user_id, user_languages, db_manager), 'faq'),
        'language': get_translation(get_user_language(user_id, user_languages, db_manager), 'language')
    }
    
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=texts['deposit']), KeyboardButton(text=texts['withdraw'])],
            [KeyboardButton(text=texts['support']), KeyboardButton(text=texts['history'])],
            [KeyboardButton(text=texts['faq']), KeyboardButton(text=texts['language'])]
        ],
        resize_keyboard=True
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
        keyboard = create_language_keyboard()
        
        welcome_text = (
            "🌐 Добро пожаловать! Выберите язык:\n\n"
            "🌐 Кош келиңиз! Тилди тандаңыз:\n\n"
            "🌐 Xush kelibsiz! Tilni tanlang:"
        )
        
        await message.answer(welcome_text, reply_markup=keyboard)
        return
    
    # Если пользователь уже выбирал язык ранее, показываем приветствие
    user_name = message.from_user.first_name or message.from_user.username or "Пользователь"
    
    welcome_text = get_text_for_user(user_id, 'welcome', bot_name, user_languages, db_manager, user_name=user_name)
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
    
    # Отправляем приветствие на выбранном языке
    user_name = callback.from_user.first_name or callback.from_user.username or "Пользователь"
    welcome_text = get_text_for_user(user_id, 'welcome', bot_name, user_languages, db_manager, user_name=user_name)
    keyboard = create_main_reply_keyboard(bot_name, user_id, user_languages, db_manager)
    
    await callback.message.edit_text(welcome_text, reply_markup=keyboard)
    await callback.answer()

async def handle_deposit_message(message: types.Message, state: FSMContext, bot_name: str, 
                                user_languages: Dict[int, str], db_manager):
    """Обработчик сообщения о пополнении"""
    user_id = message.from_user.id
    
    # Проверяем, заблокированы ли пополнения
    # Здесь можно добавить логику проверки блокировки
    
    text = get_text_for_user(user_id, 'enter_amount', bot_name, user_languages, db_manager)
    
    # Создаем клавиатуру с кнопкой отмены
    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=get_translation(get_user_language(user_id, user_languages, db_manager), 'cancel_button'))]],
        resize_keyboard=True
    )
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(ExtendedStates.waiting_for_amount)

async def handle_withdraw_message(message: types.Message, state: FSMContext, bot_name: str, 
                                 user_languages: Dict[int, str], db_manager):
    """Обработчик сообщения о выводе"""
    user_id = message.from_user.id
    
    text = get_text_for_user(user_id, 'enter_withdraw_amount', bot_name, user_languages, db_manager)
    
    # Создаем клавиатуру с кнопкой отмены
    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=get_translation(get_user_language(user_id, user_languages, db_manager), 'cancel_button'))]],
        resize_keyboard=True
    )
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(ExtendedStates.waiting_for_withdraw_amount)

async def handle_amount_input(message: types.Message, state: FSMContext, bot_name: str, 
                             user_languages: Dict[int, str], db_manager, banks: Dict[str, str]):
    """Обработчик ввода суммы"""
    user_id = message.from_user.id
    
    # Проверяем, что введено число
    try:
        amount = float(message.text.replace(',', '.'))
        if amount <= 0:
            raise ValueError("Amount must be positive")
    except ValueError:
        error_text = get_text_for_user(user_id, 'invalid_amount', bot_name, user_languages, db_manager)
        await message.answer(error_text)
        return
    
    # Сохраняем сумму в состоянии
    await state.update_data(amount=amount)
    
    # Показываем выбор банка
    text = get_text_for_user(user_id, 'select_bank', bot_name, user_languages, db_manager)
    keyboard = create_bank_keyboard(banks, bot_name, user_id, user_languages, db_manager)
    
    await message.answer(text, reply_markup=keyboard)
    await state.set_state(ExtendedStates.waiting_for_bank)

def create_bank_keyboard(banks: Dict[str, str], bot_name: str, user_id: int, 
                        user_languages: Dict[int, str], db_manager) -> InlineKeyboardMarkup:
    """Создает клавиатуру с банками"""
    builder = InlineKeyboardBuilder()
    
    for bank_code, bank_name in banks.items():
        builder.add(InlineKeyboardButton(
            text=bank_name,
            callback_data=f'bank_{bot_name}_{bank_code}'
        ))
    
    # Кнопка отмены
    cancel_text = get_translation(get_user_language(user_id, user_languages, db_manager), 'cancel_button')
    builder.add(InlineKeyboardButton(
        text=cancel_text,
        callback_data=f'cancel_{bot_name}'
    ))
    
    builder.adjust(2)
    return builder.as_markup()

async def handle_bank_selection(callback: types.CallbackQuery, state: FSMContext, bot_name: str, 
                               user_languages: Dict[int, str], db_manager):
    """Обработчик выбора банка"""
    user_id = callback.from_user.id
    bank_code = callback.data.split('_')[-1]
    
    # Получаем данные из состояния
    data = await state.get_data()
    amount = data.get('amount', 0)
    
    # Здесь можно добавить логику обработки заявки
    # Например, отправка в группу админов
    
    success_text = get_text_for_user(user_id, 'request_sent', bot_name, user_languages, db_manager)
    
    # Возвращаемся в главное меню
    keyboard = create_main_reply_keyboard(bot_name, user_id, user_languages, db_manager)
    
    await callback.message.edit_text(success_text, reply_markup=keyboard)
    await state.clear()
    await callback.answer()

async def handle_support_message(message: types.Message, bot_name: str, 
                                user_languages: Dict[int, str], db_manager):
    """Обработчик сообщения о поддержке"""
    user_id = message.from_user.id
    
    admin_contact = get_text_for_user(user_id, 'admin_contact', bot_name, user_languages, db_manager)
    text = get_text_for_user(user_id, 'support_text', bot_name, user_languages, db_manager, admin_contact=admin_contact)
    
    await message.answer(text)

async def handle_cancel_message(message: types.Message, state: FSMContext, bot_name: str, 
                               user_languages: Dict[int, str], db_manager):
    """Обработчик отмены"""
    user_id = message.from_user.id
    
    await state.clear()
    
    welcome_text = get_text_for_user(user_id, 'welcome', bot_name, user_languages, db_manager)
    keyboard = create_main_reply_keyboard(bot_name, user_id, user_languages, db_manager)
    
    await message.answer(welcome_text, reply_markup=keyboard)

# FAQ функции
async def handle_faq_command(message: types.Message, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Обработчик команды FAQ"""
    if not message.from_user:
        return
    
    user_id = message.from_user.id
    
    # Добавляем пользователя в базу данных если его нет
    db_manager.add_user(
        user_id,
        message.from_user.username,
        message.from_user.first_name,
        message.from_user.last_name
    )
    
    # Получаем язык пользователя
    language = get_user_language(user_id, user_languages, db_manager)
    
    # Используем систему переводов
    faq_text = get_translation(language, 'faq_title')
    
    # Создаем клавиатуру с переводами
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=get_translation(language, 'faq_deposit_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_withdraw_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_technical_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_limits_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_time_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_back_to_main'))]
        ],
        resize_keyboard=True
    )
    
    await message.answer(faq_text, reply_markup=keyboard, parse_mode="HTML")

async def handle_faq_deposit(message: types.Message, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Обработка вопроса о пополнении счета"""
    if not message.from_user:
        return
    
    user_id = message.from_user.id
    language = get_user_language(user_id, user_languages, db_manager)
    
    # Используем систему переводов
    text = (
        f"{get_translation(language, 'faq_deposit_title')}\n\n"
        f"{get_translation(language, 'faq_deposit_steps')}\n\n"
        f"{get_translation(language, 'faq_deposit_id_how')}\n\n"
        f"{get_translation(language, 'faq_deposit_time')}"
    )
    
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=get_translation(language, 'faq_deposit_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_withdraw_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_important_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_technical_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_limits_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_time_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_back_to_main'))]
        ],
        resize_keyboard=True
    )
    
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")

async def handle_faq_withdraw(message: types.Message, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Обработка вопроса о выводе средств"""
    if not message.from_user:
        return
    
    user_id = message.from_user.id
    language = get_user_language(user_id, user_languages, db_manager)
    
    # Используем систему переводов
    text = (
        f"{get_translation(language, 'faq_withdraw_title')}\n\n"
        f"{get_translation(language, 'faq_withdraw_steps')}\n\n"
        f"{get_translation(language, 'faq_withdraw_code_how')}\n\n"
        f"{get_translation(language, 'faq_withdraw_time')}"
    )
    
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=get_translation(language, 'faq_deposit_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_withdraw_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_important_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_technical_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_limits_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_time_button'))],
            [KeyboardButton(text=get_translation(language, 'faq_back_to_main'))]
        ],
        resize_keyboard=True
    )
    
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")

# История функций
async def handle_history_command(message: types.Message, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Обработка просмотра истории транзакций"""
    if not message.from_user:
        return
    
    user_id = message.from_user.id
    
    # Добавляем пользователя в базу данных если его нет
    db_manager.add_user(
        user_id,
        message.from_user.username,
        message.from_user.first_name,
        message.from_user.last_name
    )
    
    await show_user_history(message, 0, bot_name, user_languages, db_manager)

async def show_user_history(message: types.Message, page: int, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Показать историю транзакций пользователя"""
    user_id = message.from_user.id
    language = get_user_language(user_id, user_languages, db_manager)
    
    # Получаем транзакции пользователя
    transactions = db_manager.get_user_transactions(user_id, limit=5, offset=page * 5)
    
    if not transactions:
        # Нет транзакций
        text = get_translation(language, 'no_transactions')
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text=get_translation(language, 'back_to_menu'), callback_data="history_back_to_menu")]]
        )
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
        return
    
    # Формируем текст истории
    text = f"<b>{get_translation(language, 'history_title')}</b>\n\n"
    
    for i, trans in enumerate(transactions, 1):
        # Определяем тип транзакции
        if trans.get('transaction_type') == 'deposit':
            trans_type = get_translation(language, 'transaction_type_deposit')
        else:
            trans_type = get_translation(language, 'transaction_type_withdraw')
        
        # Определяем статус
        status = trans.get('status', 'pending')
        if status == 'pending':
            status_text = get_translation(language, 'transaction_status_pending')
        elif status == 'completed':
            status_text = get_translation(language, 'transaction_status_completed')
        else:
            status_text = get_translation(language, 'transaction_status_rejected')
        
        # Форматируем дату
        created_at = datetime.fromisoformat(trans['created_at'])
        date_str = created_at.strftime("%d.%m.%Y %H:%M")
        
        text += f"{i}. {trans_type}\n"
        text += f"   {get_translation(language, 'transaction_amount')} {trans['amount']:,.0f} KGS\n"
        text += f"   {get_translation(language, 'transaction_status')} {status_text}\n"
        text += f"   {get_translation(language, 'transaction_date')} {date_str}\n"
        
        if trans.get('xbet_id'):
            text += f"   {get_translation(language, 'transaction_id')} {trans['xbet_id']}\n"
        text += "\n"
    
    # Создаем клавиатуру с пагинацией
    keyboard_buttons = []
    
    # Кнопки навигации
    nav_buttons = []
    if page > 0:
        nav_buttons.append(InlineKeyboardButton(text=get_translation(language, 'prev_page'), callback_data=f"history_page_{page-1}"))
    
    # Здесь можно добавить проверку общего количества транзакций
    # if (page + 1) * 5 < total_count:
    #     nav_buttons.append(InlineKeyboardButton(text=get_translation(language, 'next_page'), callback_data=f"history_page_{page+1}"))
    
    if nav_buttons:
        keyboard_buttons.append(nav_buttons)
    
    # Кнопка возврата
    keyboard_buttons.append([InlineKeyboardButton(text=get_translation(language, 'back_to_menu'), callback_data="history_back_to_menu")])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")

async def handle_history_page_callback(callback: types.CallbackQuery, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Обработчик пагинации истории"""
    if not callback.from_user:
        return
    
    page = int(callback.data.split('_')[-1])
    await show_user_history_callback(callback, page, bot_name, user_languages, db_manager)

async def show_user_history_callback(callback: types.CallbackQuery, page: int, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Показать историю транзакций через callback"""
    user_id = callback.from_user.id
    language = get_user_language(user_id, user_languages, db_manager)
    
    # Получаем транзакции пользователя
    transactions = db_manager.get_user_transactions(user_id, limit=5, offset=page * 5)
    
    if not transactions:
        # Нет транзакций
        text = get_translation(language, 'no_transactions')
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text=get_translation(language, 'back_to_menu'), callback_data="history_back_to_menu")]]
        )
        await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
        return
    
    # Формируем текст истории
    text = f"<b>{get_translation(language, 'history_title')}</b>\n\n"
    
    for i, trans in enumerate(transactions, 1):
        # Определяем тип транзакции
        if trans.get('transaction_type') == 'deposit':
            trans_type = get_translation(language, 'transaction_type_deposit')
        else:
            trans_type = get_translation(language, 'transaction_type_withdraw')
        
        # Определяем статус
        status = trans.get('status', 'pending')
        if status == 'pending':
            status_text = get_translation(language, 'transaction_status_pending')
        elif status == 'completed':
            status_text = get_translation(language, 'transaction_status_completed')
        else:
            status_text = get_translation(language, 'transaction_status_rejected')
        
        # Форматируем дату
        created_at = datetime.fromisoformat(trans['created_at'])
        date_str = created_at.strftime("%d.%m.%Y %H:%M")
        
        text += f"{i}. {trans_type}\n"
        text += f"   {get_translation(language, 'transaction_amount')} {trans['amount']:,.0f} KGS\n"
        text += f"   {get_translation(language, 'transaction_status')} {status_text}\n"
        text += f"   {get_translation(language, 'transaction_date')} {date_str}\n"
        
        if trans.get('xbet_id'):
            text += f"   {get_translation(language, 'transaction_id')} {trans['xbet_id']}\n"
        text += "\n"
    
    # Создаем клавиатуру с пагинацией
    keyboard_buttons = []
    
    # Кнопки навигации
    nav_buttons = []
    if page > 0:
        nav_buttons.append(InlineKeyboardButton(text=get_translation(language, 'prev_page'), callback_data=f"history_page_{page-1}"))
    
    if nav_buttons:
        keyboard_buttons.append(nav_buttons)
    
    # Кнопка возврата
    keyboard_buttons.append([InlineKeyboardButton(text=get_translation(language, 'back_to_menu'), callback_data="history_back_to_menu")])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()

async def handle_history_back_to_menu(callback: types.CallbackQuery, bot_name: str, user_languages: Dict[int, str], db_manager):
    """Возврат в главное меню из истории"""
    user_id = callback.from_user.id
    language = get_user_language(user_id, user_languages, db_manager)
    
    welcome_text = get_text_for_user(user_id, 'welcome', bot_name, user_languages, db_manager)
    keyboard = create_main_reply_keyboard(bot_name, user_id, user_languages, db_manager)
    
    await callback.message.edit_text(welcome_text, reply_markup=keyboard)
    await callback.answer()
async def handle_channel_command(message: types.Message, bot_name: str, user_languages: Dict[int, str], db_manager):
    \
\\1@01>BG8:
:><0=4K
:0=0;0\\\
    if not message.from_user:
        return
    user_id = message.from_user.id
    language = get_user_language(user_id, user_languages, db_manager)
    text = get_translation(language, 'channel_description')
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=get_translation(language, 'go_to_channel_button'), url=get_translation(language, 'channel_link'))]])
    await message.answer(text, reply_markup=keyboard)
