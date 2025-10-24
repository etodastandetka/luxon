import asyncio
import os
import logging
import hashlib
import random
import string
from datetime import datetime, timedelta
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, ReplyKeyboardMarkup, KeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

# Импорты с обработкой ошибок
try:
    from database import Database
    from translations import get_translation
    from config import BOT_TOKEN, MINI_APP_URL
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure you're running from the bot2 directory")
    exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация базы данных
db = Database()

# Состояния для FSM
class DepositStates(StatesGroup):
    waiting_for_bookmaker = State()
    waiting_for_player_id = State()
    waiting_for_amount = State()
    waiting_for_bank = State()
    confirming_deposit = State()

class WithdrawStates(StatesGroup):
    waiting_for_bookmaker = State()
    waiting_for_player_id = State()
    waiting_for_amount = State()
    waiting_for_bank = State()
    waiting_for_phone = State()
    waiting_for_site_code = State()
    confirming_withdraw = State()

# Инициализация бота и диспетчера
bot = Bot(token=config.BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

def build_menu_kb(language: str = 'ru') -> InlineKeyboardMarkup:
    base = MINI_APP_URL.rstrip("/")
    translations = get_translation(language)
    
    buttons = [
        [InlineKeyboardButton(text="🧩 Открыть мини‑приложение", web_app=WebAppInfo(url=base))],
        [InlineKeyboardButton(text=translations['deposit'], web_app=WebAppInfo(url=f"{base}/deposit")), 
         InlineKeyboardButton(text=translations['withdraw'], web_app=WebAppInfo(url=f"{base}/withdraw"))],
        [InlineKeyboardButton(text=translations['referral'], web_app=WebAppInfo(url=f"{base}/referral"))],
        [InlineKeyboardButton(text=translations['support'], web_app=WebAppInfo(url=f"{base}/support")), 
         InlineKeyboardButton(text=translations['history'], web_app=WebAppInfo(url=f"{base}/history"))],
        [InlineKeyboardButton(text=translations['faq'], web_app=WebAppInfo(url=f"{base}/faq")), 
         InlineKeyboardButton(text=translations['language'], web_app=WebAppInfo(url=f"{base}/language"))],
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)

@dp.message(CommandStart())
async def on_start(message: types.Message):
    user_id = message.from_user.id
    user_name = message.from_user.first_name or message.from_user.username or "Пользователь"
    
    # Сохраняем пользователя в базу данных
    db.save_user(
        user_id=user_id,
        username=message.from_user.username,
        first_name=message.from_user.first_name,
        last_name=message.from_user.last_name
    )
    
    # Получаем язык пользователя
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    # Очищаем состояния пользователя
    db.save_user_data(user_id, 'current_state', '')
    db.save_user_data(user_id, 'current_action', '')
    db.save_user_data(user_id, 'current_bookmaker', '')
    
    kb = build_menu_kb(language)
    welcome_text = f"""Привет, {user_name}

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: @luxon_support
💬 Чат для всех: @luxkassa_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности"""
    
    await message.answer(
        welcome_text,
        reply_markup=kb,
        parse_mode="HTML"
    )

async def main():
    if not BOT_TOKEN:
        raise RuntimeError("Не задан BOT_TOKEN в конфигурации")
    bot = Bot(BOT_TOKEN)
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Bot v2 остановлен")