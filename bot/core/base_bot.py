#!/usr/bin/env python3
"""
Base bot class for universal bookmaker bot
"""
import asyncio
import logging
from typing import Dict, Any, Optional
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton

from ..config import BOT_TOKEN, BOOKMAKERS, DATABASE_PATH
from ..database import Database
from ..translations import get_translation
from ..api_clients.manager import APIManager

logger = logging.getLogger(__name__)

class UniversalBot:
    """Universal bot for all bookmakers"""
    
    def __init__(self, token: str):
        self.bot = Bot(token=token)
        self.dp = Dispatcher(storage=MemoryStorage())
        self.db = Database(DATABASE_PATH)
        self.api_manager = APIManager(BOOKMAKERS)
        
        self.setup_handlers()
    
    def setup_handlers(self):
        """Setup all handlers"""
        from ..handlers import (
            start_handlers,
            bookmaker_handlers,
            deposit_handlers,
            withdraw_handlers,
            referral_handlers,
            support_handlers,
            language_handlers,
            faq_handlers
        )
        
        # Register handlers
        start_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        bookmaker_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        deposit_handlers.register_handlers(self.dp, self.db, BOOKMAKERS, self.api_manager)
        withdraw_handlers.register_handlers(self.dp, self.db, BOOKMAKERS, self.api_manager)
        referral_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        support_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        language_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        faq_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        
        # Text message handler
        self.dp.message.register(self._handle_text_message, lambda message: message.text is not None)
    
    async def _handle_text_message(self, message):
        """Handle text messages"""
        user_id = message.from_user.id
        text = message.text
        language = self.db.get_user_language(user_id)
        
        # Save user
        self.db.save_user(
            user_id=user_id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
            last_name=message.from_user.last_name
        )
        
        translations = get_translation(language)
        
        # Handle main menu buttons
        if text == translations['deposit']:
            await self._handle_deposit(message)
        elif text == translations['withdraw']:
            await self._handle_withdraw(message)
        elif text == translations['referral']:
            await self._handle_referral(message)
        elif text == translations['support']:
            await self._handle_support(message)
        elif text == translations['history']:
            await self._handle_history(message)
        elif text == translations['faq']:
            await self._handle_faq(message)
        elif text == translations['language']:
            await self._handle_language(message)
        elif text == translations['back_to_menu']:
            await self._show_main_menu(message, language)
        else:
            await self._show_main_menu(message, language)
    
    async def _handle_deposit(self, message):
        """Handle deposit button"""
        logger.info(f"Deposit button pressed by user {message.from_user.id}")
        await self._show_bookmaker_selection(message, 'deposit')
    
    async def _handle_withdraw(self, message):
        """Handle withdraw button"""
        logger.info(f"Withdraw button pressed by user {message.from_user.id}")
        await self._show_bookmaker_selection(message, 'withdraw')
    
    async def _handle_referral(self, message):
        """Handle referral button"""
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        from ..handlers.referral_handlers import handle_referral_start
        await handle_referral_start(message, language, self.db)
    
    async def _handle_support(self, message):
        """Handle support button"""
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        from ..handlers.support_handlers import handle_support
        await handle_support(message, language, self.db)
    
    async def _handle_history(self, message):
        """Handle history button"""
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        from ..handlers.support_handlers import handle_history
        await handle_history(message, language, self.db)
    
    async def _handle_faq(self, message):
        """Handle FAQ button"""
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        from ..handlers.faq_handlers import handle_faq_start
        await handle_faq_start(message, language, self.db)
    
    async def _handle_language(self, message):
        """Handle language button"""
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        from ..handlers.language_handlers import handle_language_selection
        await handle_language_selection(message, language, self.db)
    
    async def _show_bookmaker_selection(self, message, action):
        """Show bookmaker selection"""
        logger.info(f"Showing bookmaker selection for action {action}")
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        translations = get_translation(language)
        
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[])
        bookmakers_list = list(BOOKMAKERS.items())
        
        # Group by 2 bookmakers per row
        for i in range(0, len(bookmakers_list), 2):
            row = []
            for j in range(2):
                if i + j < len(bookmakers_list):
                    bookmaker_key, bookmaker_data = bookmakers_list[i + j]
                    row.append(InlineKeyboardButton(
                        text=f"{bookmaker_data['emoji']} {bookmaker_data['name']}",
                        callback_data=f"select_bookmaker:{bookmaker_key}:{action}"
                    ))
            keyboard.inline_keyboard.append(row)
        
        text = translations['select_bookmaker']
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
    
    async def _show_main_menu(self, message, language):
        """Show main menu"""
        translations = get_translation(language)
        
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=translations['deposit']), KeyboardButton(text=translations['withdraw'])],
                [KeyboardButton(text=translations['referral'])],
                [KeyboardButton(text=translations['support']), KeyboardButton(text=translations['history'])],
                [KeyboardButton(text=translations['faq']), KeyboardButton(text=translations['language'])]
            ],
            resize_keyboard=True
        )
        
        text = translations['welcome'].format(
            user_name=message.from_user.first_name or 'User',
            admin_username='@luxon_support'
        )
        
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
    
    async def start(self):
        """Start bot"""
        logger.info("Starting universal bot...")
        await self.dp.start_polling(self.bot)

async def main():
    """Main function"""
    try:
        bot = UniversalBot(BOT_TOKEN)
        logger.info("Starting universal bot...")
        await bot.start()
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot startup error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
