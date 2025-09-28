#!/usr/bin/env python3
"""
Обработчики FAQ
"""
import logging
from aiogram import Dispatcher, types
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton

from translations import get_translation

logger = logging.getLogger(__name__)

async def handle_faq_start(message: types.Message, language: str, db):
    """Начало FAQ"""
    translations = get_translation(language)
    
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=translations['faq_deposit_button'])],
            [KeyboardButton(text=translations['faq_withdraw_button'])],
            [KeyboardButton(text=translations['faq_time_button'])],
            [KeyboardButton(text=translations['faq_important_button'])],
            [KeyboardButton(text=translations['back_to_menu'])]
        ],
        resize_keyboard=True
    )
    
    text = translations['faq_title']
    
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None):
    """Регистрация обработчиков FAQ"""
    logger.info("Регистрируем FAQ обработчики")
    # Соберём возможные тексты кнопок FAQ на всех поддерживаемых языках
    supported_langs = ['ru', 'ky', "uz"]
    DEPOSIT_BUTTONS = set()
    WITHDRAW_BUTTONS = set()
    TIME_BUTTONS = set()
    IMPORTANT_BUTTONS = set()
    for lang in supported_langs:
        tr = get_translation(lang)
        DEPOSIT_BUTTONS.add(tr.get('faq_deposit_button'))
        WITHDRAW_BUTTONS.add(tr.get('faq_withdraw_button'))
        TIME_BUTTONS.add(tr.get('faq_time_button'))
        IMPORTANT_BUTTONS.add(tr.get('faq_important_button'))

    @dp.message(lambda message: message.text in DEPOSIT_BUTTONS)
    async def handle_faq_deposit(message: types.Message):
        """FAQ о пополнении"""
        user_id = message.from_user.id
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        logger.info(f"FAQ deposit button pressed by user {user_id}, language: {language}, text: '{message.text}'")
        
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=translations['faq_deposit_button'])],
                [KeyboardButton(text=translations['faq_withdraw_button'])],
                [KeyboardButton(text=translations['faq_time_button'])],
                [KeyboardButton(text=translations['faq_important_button'])],
                [KeyboardButton(text=translations['back_to_menu'])]
            ],
            resize_keyboard=True
        )
        
        text = translations['faq_deposit_steps']
        
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
    
    @dp.message(lambda message: message.text in WITHDRAW_BUTTONS)
    async def handle_faq_withdraw(message: types.Message):
        """FAQ о выводе"""
        user_id = message.from_user.id
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        logger.info(f"FAQ withdraw button pressed by user {user_id}, language: {language}, text: '{message.text}'")
        
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=translations['faq_deposit_button'])],
                [KeyboardButton(text=translations['faq_withdraw_button'])],
                [KeyboardButton(text=translations['faq_time_button'])],
                [KeyboardButton(text=translations['faq_important_button'])],
                [KeyboardButton(text=translations['back_to_menu'])]
            ],
            resize_keyboard=True
        )
        
        text = translations['faq_withdraw_steps']
        
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
    
    @dp.message(lambda message: message.text in TIME_BUTTONS)
    async def handle_faq_time(message: types.Message):
        """FAQ о времени"""
        user_id = message.from_user.id
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        logger.info(f"FAQ time button pressed by user {user_id}, language: {language}, text: '{message.text}'")
        
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=translations['faq_deposit_button'])],
                [KeyboardButton(text=translations['faq_withdraw_button'])],
                [KeyboardButton(text=translations['faq_time_button'])],
                [KeyboardButton(text=translations['faq_important_button'])],
                [KeyboardButton(text=translations['back_to_menu'])]
            ],
            resize_keyboard=True
        )
        
        text = translations['faq_time_content']
        
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
    
    @dp.message(lambda message: message.text in IMPORTANT_BUTTONS)
    async def handle_faq_security(message: types.Message):
        """FAQ о безопасности"""
        user_id = message.from_user.id
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        logger.info(f"FAQ security button pressed by user {user_id}, language: {language}, text: '{message.text}'")
        
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=translations['faq_deposit_button'])],
                [KeyboardButton(text=translations['faq_withdraw_button'])],
                [KeyboardButton(text=translations['faq_time_button'])],
                [KeyboardButton(text=translations['faq_important_button'])],
                [KeyboardButton(text=translations['back_to_menu'])]
            ],
            resize_keyboard=True
        )
        
        text = translations['faq_important_content']
        
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
