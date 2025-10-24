#!/usr/bin/env python3
"""
Telegram-бот согласно ТЗ
Полный функционал: пополнение, вывод, история, рефералы, поддержка
"""
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
    from config import BOT_TOKEN, MINI_APP_URL, BOOKMAKERS, BANKS, LIMITS, REFERRAL_SETTINGS
    from qr_service import generate_payment_url
    from autodeposit import start_autodeposit, stop_autodeposit
    from referral_service import get_referral_service, process_referral, process_deposit_referral
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
bot = Bot(token=BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

def build_main_menu(language: str = 'ru') -> InlineKeyboardMarkup:
    """Главное меню бота согласно ТЗ"""
    translations = get_translation(language)
    
    buttons = [
        [InlineKeyboardButton(text="💰 Пополнить", callback_data="deposit")],
        [InlineKeyboardButton(text="💸 Вывести", callback_data="withdraw")],
        [InlineKeyboardButton(text="📜 История", callback_data="history")],
        [InlineKeyboardButton(text="👥 Рефералы", callback_data="referrals")],
        [InlineKeyboardButton(text="🧾 Инструкция", callback_data="instruction")],
        [InlineKeyboardButton(text="🎧 Поддержка", callback_data="support")]
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def build_bookmaker_menu() -> InlineKeyboardMarkup:
    """Меню выбора букмекера"""
    buttons = []
    for key, bookmaker in BOOKMAKERS.items():
        if bookmaker['enabled']:
            buttons.append([InlineKeyboardButton(
                text=f"{bookmaker['emoji']} {bookmaker['name']}", 
                callback_data=f"bookmaker_{key}"
            )])
    buttons.append([InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def build_bank_menu() -> InlineKeyboardMarkup:
    """Меню выбора банка"""
    buttons = []
    for key, bank in BANKS.items():
        if bank['enabled']:
            buttons.append([InlineKeyboardButton(
                text=f"{bank['emoji']} {bank['name']}", 
                callback_data=f"bank_{key}"
            )])
    buttons.append([InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def generate_payment_hash(amount: int, player_id: str) -> str:
    """Генерация хэша для платежа"""
    data = f"{amount}_{player_id}_{datetime.now().strftime('%Y%m%d')}"
    return hashlib.sha256(data.encode()).hexdigest()[-4:]

def generate_payment_url_legacy(bank_key: str, amount: int, player_id: str) -> str:
    """Генерация URL для оплаты (legacy)"""
    bank = BANKS[bank_key]
    qr_hash = generate_payment_hash(amount, player_id)
    return bank['url_template'].format(qr_hash=qr_hash)

def generate_payment_url_new(bank_key: str, amount: float, player_id: str) -> str:
    """Генерация URL для оплаты через QR Service"""
    try:
        result = generate_payment_url(bank_key, amount, player_id)
        return result['url']
    except Exception as e:
        logger.error(f"Error generating payment URL: {e}")
        # Fallback to legacy method
        return generate_payment_url_legacy(bank_key, int(amount), player_id)

@dp.message(CommandStart())
async def on_start(message: types.Message):
    """Команда /start согласно ТЗ"""
    user_id = message.from_user.id
    user_name = message.from_user.first_name or message.from_user.username or "Пользователь"
    
    # Обработка реферальной ссылки
    referral_code = None
    if len(message.text.split()) > 1:
        referral_code = message.text.split()[1]
        if referral_code.startswith('ref'):
            referral_code = referral_code[3:]  # Убираем префикс 'ref'
    
    # Сохраняем пользователя в базу данных
    db.save_user(
        user_id=user_id,
        username=message.from_user.username,
        first_name=message.from_user.first_name,
        last_name=message.from_user.last_name
    )
    
    # Обработка реферала
    if referral_code:
        try:
            # Используем новый сервис рефералов
            if process_referral(referral_code, user_id, db.db_path):
                await message.answer("🎉 Вы зарегистрированы по реферальной ссылке!")
            else:
                logger.warning(f"Failed to process referral for user {user_id} with code {referral_code}")
        except Exception as e:
            logger.error(f"Error processing referral: {e}")
    
    # Приветственное сообщение
    welcome_text = f"""
🎉 Добро пожаловать, {user_name}!

Это бот для пополнения и вывода средств в казино.

Выберите действие:
"""
    
    await message.answer(welcome_text, reply_markup=build_main_menu())

@dp.callback_query(F.data == "deposit")
async def start_deposit(callback: types.CallbackQuery, state: FSMContext):
    """Начало процесса пополнения"""
    await callback.message.edit_text(
        "🎯 Выберите букмекера для пополнения:",
        reply_markup=build_bookmaker_menu()
    )
    await state.set_state(DepositStates.waiting_for_bookmaker)

@dp.callback_query(F.data.startswith("bookmaker_"))
async def select_bookmaker_deposit(callback: types.CallbackQuery, state: FSMContext):
    """Выбор букмекера для пополнения"""
    bookmaker_key = callback.data.split("_")[1]
    bookmaker = BOOKMAKERS[bookmaker_key]
    
    await state.update_data(bookmaker=bookmaker_key)
    await callback.message.edit_text(
        f"📝 Введите ваш ID игрока в {bookmaker['name']}:\n\n"
        f"Пример: 12345678"
    )
    await state.set_state(DepositStates.waiting_for_player_id)

@dp.message(DepositStates.waiting_for_player_id)
async def get_player_id_deposit(message: types.Message, state: FSMContext):
    """Получение ID игрока"""
    player_id = message.text.strip()
    
    # Валидация ID игрока
    if not player_id.isdigit() or len(player_id) < 4:
        await message.answer("❌ ID игрока должен содержать только цифры (минимум 4 символа)")
        return
    
    await state.update_data(player_id=player_id)
    await message.answer(
        f"💰 Введите сумму пополнения (от {LIMITS['min_amount']} до {LIMITS['max_amount']} сом):\n\n"
        f"Пример: 1000"
    )
    await state.set_state(DepositStates.waiting_for_amount)

@dp.message(DepositStates.waiting_for_amount)
async def get_amount_deposit(message: types.Message, state: FSMContext):
    """Получение суммы пополнения"""
    try:
        amount = int(message.text.strip())
        
        if amount < LIMITS['min_amount'] or amount > LIMITS['max_amount']:
            await message.answer(
                f"❌ Сумма должна быть от {LIMITS['min_amount']} до {LIMITS['max_amount']} сом"
            )
            return
        
        await state.update_data(amount=amount)
        await message.answer(
            "🏦 Выберите банк для оплаты:",
            reply_markup=build_bank_menu()
        )
        await state.set_state(DepositStates.waiting_for_bank)
        
    except ValueError:
        await message.answer("❌ Введите корректную сумму (только цифры)")

@dp.callback_query(F.data.startswith("bank_"))
async def select_bank_deposit(callback: types.CallbackQuery, state: FSMContext):
    """Выбор банка для пополнения"""
    bank_key = callback.data.split("_")[1]
    bank = BANKS[bank_key]
    
    data = await state.get_data()
    bookmaker = BOOKMAKERS[data['bookmaker']]
    player_id = data['player_id']
    amount = data['amount']
    
    # Генерация ссылки для оплаты
    payment_url = generate_payment_url_new(bank_key, amount, player_id)
    
    # Сохранение заявки в базу данных
    request_id = db.create_deposit_request(
        user_id=callback.from_user.id,
        bookmaker=data['bookmaker'],
        player_id=player_id,
        amount=amount,
        bank=bank_key,
        payment_url=payment_url
    )
    
    # Обработка реферальных выплат (создаем записи, но не выплачиваем до подтверждения)
    try:
        process_deposit_referral(request_id, callback.from_user.id, amount, db.db_path)
    except Exception as e:
        logger.error(f"Error processing referral for deposit: {e}")
    
    confirmation_text = f"""
✅ Заявка на пополнение создана!

📋 Детали:
🎯 Букмекер: {bookmaker['name']}
🆔 ID игрока: {player_id}
💰 Сумма: {amount} сом
🏦 Банк: {bank['name']}

🔗 Ссылка для оплаты:
{payment_url}

⚠️ ВАЖНО:
1. Перейдите по ссылке выше
2. Оплатите указанную сумму
3. После оплаты ваш баланс будет пополнен автоматически
4. Обычно это занимает 1-5 минут

📞 Если у вас возникли проблемы, обратитесь в поддержку.
"""
    
    await callback.message.edit_text(confirmation_text)
    await state.clear()

@dp.callback_query(F.data == "withdraw")
async def start_withdraw(callback: types.CallbackQuery, state: FSMContext):
    """Начало процесса вывода"""
    await callback.message.edit_text(
        "🎯 Выберите букмекера для вывода:",
        reply_markup=build_bookmaker_menu()
    )
    await state.set_state(WithdrawStates.waiting_for_bookmaker)

@dp.callback_query(F.data.startswith("bookmaker_"))
async def select_bookmaker_withdraw(callback: types.CallbackQuery, state: FSMContext):
    """Выбор букмекера для вывода"""
    bookmaker_key = callback.data.split("_")[1]
    bookmaker = BOOKMAKERS[bookmaker_key]
    
    await state.update_data(bookmaker=bookmaker_key)
    await callback.message.edit_text(
        f"📝 Введите ваш ID игрока в {bookmaker['name']}:\n\n"
        f"Пример: 12345678"
    )
    await state.set_state(WithdrawStates.waiting_for_player_id)

@dp.message(WithdrawStates.waiting_for_player_id)
async def get_player_id_withdraw(message: types.Message, state: FSMContext):
    """Получение ID игрока для вывода"""
    player_id = message.text.strip()
    
    if not player_id.isdigit() or len(player_id) < 4:
        await message.answer("❌ ID игрока должен содержать только цифры (минимум 4 символа)")
        return
    
    await state.update_data(player_id=player_id)
    await message.answer(
        f"💰 Введите сумму вывода (от {LIMITS['min_withdraw']} до {LIMITS['max_withdraw']} сом):\n\n"
        f"Пример: 1000"
    )
    await state.set_state(WithdrawStates.waiting_for_amount)

@dp.message(WithdrawStates.waiting_for_amount)
async def get_amount_withdraw(message: types.Message, state: FSMContext):
    """Получение суммы вывода"""
    try:
        amount = int(message.text.strip())
        
        if amount < LIMITS['min_withdraw'] or amount > LIMITS['max_withdraw']:
            await message.answer(
                f"❌ Сумма должна быть от {LIMITS['min_withdraw']} до {LIMITS['max_withdraw']} сом"
            )
            return
        
        await state.update_data(amount=amount)
        await message.answer(
            "🏦 Выберите банк для получения средств:",
            reply_markup=build_bank_menu()
        )
        await state.set_state(WithdrawStates.waiting_for_bank)
        
    except ValueError:
        await message.answer("❌ Введите корректную сумму (только цифры)")

@dp.callback_query(F.data.startswith("bank_"))
async def select_bank_withdraw(callback: types.CallbackQuery, state: FSMContext):
    """Выбор банка для вывода"""
    bank_key = callback.data.split("_")[1]
    bank = BANKS[bank_key]
    
    await state.update_data(bank=bank_key)
    await callback.message.edit_text(
        f"📱 Введите номер телефона для получения средств:\n\n"
        f"Пример: +996700123456"
    )
    await state.set_state(WithdrawStates.waiting_for_phone)

@dp.message(WithdrawStates.waiting_for_phone)
async def get_phone_withdraw(message: types.Message, state: FSMContext):
    """Получение номера телефона"""
    phone = message.text.strip()
    
    if not phone.startswith('+996') or len(phone) != 13:
        await message.answer("❌ Введите корректный номер телефона в формате +996700123456")
        return
    
    await state.update_data(phone=phone)
    await message.answer(
        "🔐 Введите код подтверждения с сайта букмекера:\n\n"
        "Этот код нужен для подтверждения вашей личности."
    )
    await state.set_state(WithdrawStates.waiting_for_site_code)

@dp.message(WithdrawStates.waiting_for_site_code)
async def get_site_code_withdraw(message: types.Message, state: FSMContext):
    """Получение кода с сайта"""
    site_code = message.text.strip()
    
    if len(site_code) < 4:
        await message.answer("❌ Код должен содержать минимум 4 символа")
        return
    
    data = await state.get_data()
    bookmaker = BOOKMAKERS[data['bookmaker']]
    bank = BANKS[data['bank']]
    
    # Создание заявки на вывод
    request_id = db.create_withdraw_request(
        user_id=message.from_user.id,
        bookmaker=data['bookmaker'],
        player_id=data['player_id'],
        amount=data['amount'],
        bank=data['bank'],
        phone=data['phone'],
        site_code=site_code
    )
    
    confirmation_text = f"""
✅ Заявка на вывод отправлена администратору!

📋 Детали:
🎯 Букмекер: {bookmaker['name']}
🆔 ID игрока: {data['player_id']}
💰 Сумма: {data['amount']} сом
🏦 Банк: {bank['name']}
📱 Телефон: {data['phone']}
🔐 Код: {site_code}

⏳ Ожидайте подтверждения администратора.
Обычно это занимает 5-30 минут.

📞 Если у вас возникли вопросы, обратитесь в поддержку.
"""
    
    await message.answer(confirmation_text)
    await state.clear()

@dp.callback_query(F.data == "history")
async def show_history(callback: types.CallbackQuery):
    """Показ истории операций"""
    user_id = callback.from_user.id
    
    # Получение истории из базы данных
    deposits = db.get_user_deposits(user_id, limit=10)
    withdrawals = db.get_user_withdrawals(user_id, limit=10)
    
    history_text = "📜 История операций:\n\n"
    
    if not deposits and not withdrawals:
        history_text += "У вас пока нет операций."
    else:
        # Показываем последние операции
        all_operations = []
        for deposit in deposits:
            all_operations.append({
                'type': 'deposit',
                'amount': deposit['amount'],
                'status': deposit['status'],
                'created_at': deposit['created_at'],
                'bookmaker': deposit['bookmaker']
            })
        
        for withdrawal in withdrawals:
            all_operations.append({
                'type': 'withdraw',
                'amount': withdrawal['amount'],
                'status': withdrawal['status'],
                'created_at': withdrawal['created_at'],
                'bookmaker': withdrawal['bookmaker']
            })
        
        # Сортируем по дате
        all_operations.sort(key=lambda x: x['created_at'], reverse=True)
        
        for op in all_operations[:10]:  # Показываем последние 10
            status_emoji = "✅" if op['status'] == 'completed' else "⏳" if op['status'] == 'pending' else "❌"
            type_emoji = "💰" if op['type'] == 'deposit' else "💸"
            bookmaker = BOOKMAKERS[op['bookmaker']]['name']
            
            history_text += f"{status_emoji} {type_emoji} {op['amount']} сом - {bookmaker}\n"
    
    await callback.message.edit_text(history_text, reply_markup=InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")]
    ]))

@dp.callback_query(F.data == "referrals")
async def show_referrals(callback: types.CallbackQuery):
    """Показ реферальной системы"""
    user_id = callback.from_user.id
    
    try:
        # Получение реферальной ссылки через сервис
        referral_service = get_referral_service(db.db_path)
        referral_link = referral_service.generate_referral_link(user_id)
        
        # Получение статистики рефералов
        stats = referral_service.get_referral_stats(user_id)
        
        # Получение ожидающих выплат
        pending_payments = referral_service.get_pending_payments(user_id)
        pending_total = sum(payment['amount'] for payment in pending_payments)
        
        referrals_text = f"""
🤝 Реферальная программа

🔗 Ваша ссылка:
{referral_link}

📊 Статистика:
👥 Приглашено: {stats['total_referrals']} человек
💰 Заработано: {stats['total_earnings']:.2f} сом
⏳ Ожидает выплаты: {pending_total:.2f} сом

💡 Как это работает:
• Поделитесь ссылкой с друзьями
• За каждое пополнение реферала вы получаете 5% (1-й уровень) и 2% (2-й уровень)
• Выплаты происходят автоматически в конце месяца
• Минимальная сумма для выплаты: 100 сом

📈 Пригласите друзей и зарабатывайте вместе!
"""
        
        # Кнопки для рефералов
        buttons = [
            [InlineKeyboardButton(text="📤 Поделиться ссылкой", url=f"https://t.me/share/url?url={referral_link}")],
            [InlineKeyboardButton(text="📊 Таблица лидеров", callback_data="referral_leaderboard")],
            [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")]
        ]
        
        await callback.message.edit_text(referrals_text, reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons))
        
    except Exception as e:
        logger.error(f"Error showing referrals: {e}")
        await callback.message.edit_text("❌ Ошибка загрузки реферальной системы")

@dp.callback_query(F.data == "instruction")
async def show_instruction(callback: types.CallbackQuery):
    """Показ инструкции"""
    instruction_text = """
🧾 Инструкция по использованию

💰 ПОПОЛНЕНИЕ:
1. Выберите букмекера
2. Введите ваш ID игрока
3. Укажите сумму пополнения
4. Выберите банк для оплаты
5. Перейдите по ссылке и оплатите
6. Дождитесь автоматического пополнения

💸 ВЫВОД:
1. Выберите букмекера
2. Введите ваш ID игрока
3. Укажите сумму вывода
4. Выберите банк для получения
5. Введите номер телефона
6. Введите код подтверждения с сайта
7. Ожидайте подтверждения администратора

⚠️ ВАЖНО:
• Все операции проходят через администратора
• Время обработки: 5-30 минут
• При проблемах обращайтесь в поддержку
"""
    
    await callback.message.edit_text(instruction_text, reply_markup=InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")]
    ]))

@dp.callback_query(F.data == "support")
async def show_support(callback: types.CallbackQuery):
    """Показ поддержки"""
    support_text = """
🎧 Поддержка

💬 Напишите вашу проблему, и администратор свяжется с вами в ближайшее время.

📞 Контакты:
• Telegram: @luxon_support
• Время ответа: 5-30 минут

🆘 Частые вопросы:
• Пополнение не пришло? Проверьте статус в истории
• Вывод не обработан? Обратитесь в поддержку
• Проблемы с рефералами? Проверьте правильность ссылки
"""
    
    await callback.message.edit_text(support_text, reply_markup=InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💬 Написать в поддержку", url="https://t.me/luxon_support")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")]
    ]))

@dp.callback_query(F.data == "referral_leaderboard")
async def show_referral_leaderboard(callback: types.CallbackQuery):
    """Показ таблицы лидеров рефералов"""
    try:
        referral_service = get_referral_service(db.db_path)
        leaderboard = referral_service.get_referral_leaderboard(10)
        
        if not leaderboard:
            leaderboard_text = "📊 Таблица лидеров пуста"
        else:
            leaderboard_text = "🏆 Таблица лидеров рефералов\n\n"
            
            for i, user in enumerate(leaderboard, 1):
                name = user.get('first_name', '') or user.get('username', 'Пользователь')
                referrals_count = user.get('referrals_count', 0)
                total_earnings = user.get('total_earnings', 0)
                
                medal = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else f"{i}."
                
                leaderboard_text += f"{medal} {name}\n"
                leaderboard_text += f"   👥 Рефералов: {referrals_count}\n"
                leaderboard_text += f"   💰 Заработано: {total_earnings:.2f} сом\n\n"
        
        await callback.message.edit_text(
            leaderboard_text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="🔙 Назад к рефералам", callback_data="referrals")]
            ])
        )
        
    except Exception as e:
        logger.error(f"Error showing leaderboard: {e}")
        await callback.message.edit_text("❌ Ошибка загрузки таблицы лидеров")

@dp.callback_query(F.data == "back_to_menu")
async def back_to_menu(callback: types.CallbackQuery):
    """Возврат в главное меню"""
    await callback.message.edit_text(
        "🎉 Главное меню\n\nВыберите действие:",
        reply_markup=build_main_menu()
    )

@dp.callback_query(F.data == "cancel")
async def cancel_operation(callback: types.CallbackQuery, state: FSMContext):
    """Отмена операции"""
    await state.clear()
    await callback.message.edit_text(
        "❌ Операция отменена\n\nВыберите действие:",
        reply_markup=build_main_menu()
    )

async def main():
    """Запуск бота"""
    logger.info("Starting Telegram bot...")
    
    # Запускаем автопополнение
    try:
        await start_autodeposit(db.db_path, bot)
        logger.info("Auto-deposit watcher started")
    except Exception as e:
        logger.error(f"Failed to start auto-deposit: {e}")
    
    try:
        await dp.start_polling(bot)
    finally:
        # Останавливаем автопополнение при завершении
        try:
            await stop_autodeposit()
            logger.info("Auto-deposit watcher stopped")
        except Exception as e:
            logger.error(f"Error stopping auto-deposit: {e}")

if __name__ == "__main__":
    asyncio.run(main())
