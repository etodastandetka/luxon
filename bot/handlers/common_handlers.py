#!/usr/bin/env python3
"""
Общие хендлеры для всех ботов
"""
import logging
from typing import Dict, Any, List
from aiogram import types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder

# Удаляем импорт bot_texts

logger = logging.getLogger(__name__)

class CommonStates(StatesGroup):
    """Общие состояния для всех ботов"""
    waiting_for_amount = State()
    waiting_for_withdraw_amount = State()
    waiting_for_bank = State()
    waiting_for_phone = State()
    waiting_for_name = State()
    waiting_for_id = State()
    waiting_for_qr_amount = State()

def create_main_keyboard(bot_name: str) -> InlineKeyboardMarkup:
    """Создает главную клавиатуру для бота"""
    texts = {
        'deposit': get_bot_text(bot_name, 'deposit'),
        'withdraw': get_bot_text(bot_name, 'withdraw'),
        'qr_generator': get_bot_text(bot_name, 'qr_generator'),
        'support': get_bot_text(bot_name, 'support'),
        'channel': get_bot_text(bot_name, 'channel')
    }
    
    buttons = [
        {'text': texts['deposit'], 'callback_data': f'deposit_{bot_name}'},
        {'text': texts['withdraw'], 'callback_data': f'withdraw_{bot_name}'},
        {'text': texts['qr_generator'], 'callback_data': f'qr_generator_{bot_name}'},
        {'text': texts['support'], 'callback_data': f'support_{bot_name}'},
        {'text': texts['channel'], 'callback_data': f'channel_{bot_name}'}
    ]
    
    builder = InlineKeyboardBuilder()
    for button in buttons:
        builder.add(InlineKeyboardButton(
            text=button['text'],
            callback_data=button['callback_data']
        ))
    builder.adjust(2)
    return builder.as_markup()

def create_bank_keyboard(banks: Dict[str, str], bot_name: str) -> InlineKeyboardMarkup:
    """Создает клавиатуру с банками"""
    builder = InlineKeyboardBuilder()
    
    for bank_code, bank_name in banks.items():
        builder.add(InlineKeyboardButton(
            text=bank_name,
            callback_data=f'bank_{bot_name}_{bank_code}'
        ))
    
    # Кнопка отмены
    builder.add(InlineKeyboardButton(
        text="❌ Отмена",
        callback_data=f'cancel_{bot_name}'
    ))
    
    builder.adjust(2)
    return builder.as_markup()

def create_cancel_keyboard(bot_name: str) -> InlineKeyboardMarkup:
    """Создает клавиатуру с кнопкой отмены"""
    builder = InlineKeyboardBuilder()
    builder.add(InlineKeyboardButton(
        text="❌ Отмена",
        callback_data=f'cancel_{bot_name}'
    ))
    return builder.as_markup()

async def handle_start_command(message: types.Message, bot_name: str):
    """Обработчик команды /start"""
    welcome_text = get_bot_text(bot_name, 'welcome')
    keyboard = create_main_keyboard(bot_name)
    
    await message.answer(welcome_text, reply_markup=keyboard)

async def handle_help_command(message: types.Message, bot_name: str):
    """Обработчик команды /help"""
    help_text = f"""
🤖 Помощь по боту {bot_name.upper()}

📋 Доступные команды:
/start - Главное меню
/help - Эта справка
/deposit - Пополнение
/withdraw - Вывод средств
/qr - QR-генератор

📞 Поддержка: @operator_luxkassa
    """
    
    keyboard = create_main_keyboard(bot_name)
    await message.answer(help_text, reply_markup=keyboard)

async def handle_deposit_callback(callback: types.CallbackQuery, bot_name: str):
    """Обработчик кнопки пополнения"""
    text = get_bot_text(bot_name, 'enter_amount')
    keyboard = create_cancel_keyboard(bot_name)
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()

async def handle_withdraw_callback(callback: types.CallbackQuery, bot_name: str):
    """Обработчик кнопки вывода"""
    text = get_bot_text(bot_name, 'enter_withdraw_amount')
    keyboard = create_cancel_keyboard(bot_name)
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()

async def handle_qr_generator_callback(callback: types.CallbackQuery, bot_name: str):
    """Обработчик кнопки QR-генератора"""
    text = "💳 Введите сумму для генерации QR-кода:"
    keyboard = create_cancel_keyboard(bot_name)
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()

async def handle_support_callback(callback: types.CallbackQuery, bot_name: str):
    """Обработчик кнопки поддержки"""
    admin_contact = get_bot_text(bot_name, 'admin_contact')
    text = f"📞 Служба поддержки {bot_name.upper()}\n\n{admin_contact}"
    
    keyboard = InlineKeyboardBuilder()
    keyboard.add(InlineKeyboardButton(
        text="🔙 Назад",
        callback_data=f'back_to_main_{bot_name}'
    ))
    
    await callback.message.edit_text(text, reply_markup=keyboard.as_markup())
    await callback.answer()

async def handle_channel_callback(callback: types.CallbackQuery, bot_name: str):
    """Обработчик кнопки канала"""
    text = f"📢 Подпишитесь на наш канал {bot_name.upper()}:\n\nhttps://t.me/luxkassa"
    
    keyboard = InlineKeyboardBuilder()
    keyboard.add(InlineKeyboardButton(
        text="🔗 Перейти в канал",
        url="https://t.me/luxkassa"
    ))
    keyboard.add(InlineKeyboardButton(
        text="🔙 Назад",
        callback_data=f'back_to_main_{bot_name}'
    ))
    keyboard.adjust(1)
    
    await callback.message.edit_text(text, reply_markup=keyboard.as_markup())
    await callback.answer()

async def handle_back_to_main_callback(callback: types.CallbackQuery, bot_name: str):
    """Обработчик кнопки возврата в главное меню"""
    welcome_text = get_bot_text(bot_name, 'welcome')
    keyboard = create_main_keyboard(bot_name)
    
    await callback.message.edit_text(welcome_text, reply_markup=keyboard)
    await callback.answer()

async def handle_cancel_callback(callback: types.CallbackQuery, bot_name: str):
    """Обработчик кнопки отмены"""
    welcome_text = get_bot_text(bot_name, 'welcome')
    keyboard = create_main_keyboard(bot_name)
    
    await callback.message.edit_text(welcome_text, reply_markup=keyboard)
    await callback.answer()

def validate_amount(amount_str: str) -> float:
    """Валидация суммы"""
    try:
        amount = float(amount_str.replace(',', '.'))
        if amount <= 0:
            return None
        return amount
    except ValueError:
        return None

def format_amount(amount: float) -> str:
    """Форматирование суммы"""
    return f"{amount:,.2f}".replace(',', ' ')
