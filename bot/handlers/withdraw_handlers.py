#!/usr/bin/env python3
"""
Хендлеры для вывода средств - упрощенный процесс
"""
import logging
import random
from datetime import datetime
from aiogram import types, Dispatcher, F
from aiogram.fsm.context import FSMContext
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, FSInputFile
from aiogram.utils.keyboard import InlineKeyboardBuilder
from translations import get_translation
from config import BOOKMAKERS, BOT_TOKEN

logger = logging.getLogger(__name__)

async def send_withdraw_request_to_group(bot, user_id: int, amount: float, bookmaker: str, bank_code: str, withdraw_id: str, code: str, photo_file_id: str = None):
    """Отправляет заявку на вывод в группу админу"""
    try:
        # Получаем информацию о пользователе
        user_info = await bot.get_chat(user_id)
        username = user_info.username or "Нет username"
        first_name = user_info.first_name or "Нет имени"
        
        # Получаем настройки букмекера
        bookmaker_config = BOOKMAKERS.get(bookmaker, {})
        group_id = bookmaker_config.get('withdraw_group_id')
        
        if not group_id:
            logger.error(f"Не найден group_id для букмекера {bookmaker}")
            return False
            
        # Создаем текст заявки
        request_text = f"""
🔔 <b>Новая заявка на вывод</b>

👤 <b>Пользователь:</b> @{username}
🆔 <b>ID:</b> {user_id}
🏢 <b>Букмекер:</b> {bookmaker_config.get('name', bookmaker.upper())}
💰 <b>Сумма:</b> {amount:.2f} сом
🏦 <b>Банк:</b> {bank_code.upper()}
🆔 <b>ID счета:</b> {withdraw_id}
🔐 <b>Код вывода:</b> скрыт (только для API)

⏰ <b>Время:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}
        """
        
        # Создаем клавиатуру для обработки заявки
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"confirm_withdraw_{user_id}_{amount}"),
                InlineKeyboardButton(text="❌ Отклонить", callback_data=f"reject_withdraw_{user_id}_{amount}")
            ],
            [
                InlineKeyboardButton(text="🔍 Проверить API", callback_data=f"check_withdraw_api_{user_id}_{amount}")
            ]
        ])
        
        # Отправляем заявку в группу
        if photo_file_id:
            await bot.send_photo(
                chat_id=group_id,
                photo=photo_file_id,
                caption=request_text,
                parse_mode="HTML",
                reply_markup=keyboard
            )
        else:
            await bot.send_message(
                chat_id=group_id,
                text=request_text,
                parse_mode="HTML",
                reply_markup=keyboard
            )
            
        logger.info(f"✅ Заявка на вывод отправлена в группу {group_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка отправки заявки в группу: {e}")
        return False

def get_bot_settings():
    """Получает настройки бота из Django админки"""
    try:
        import requests
        response = requests.get('http://localhost:8081/bot/api/bot-settings/', timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error(f"Ошибка получения настроек бота: {e}")
    return {
        'pause': False,
        'deposits': {'enabled': True, 'banks': []},
        'withdrawals': {'enabled': True, 'banks': []},
        'channel': {'enabled': False, 'name': '@bingokg_news'}
    }

def get_bank_settings():
    """Получает настройки банков"""
    return {
        'demirbank': {'deposit_enabled': True, 'withdraw_enabled': True},
        'odengi': {'deposit_enabled': True, 'withdraw_enabled': True},
        'bakai': {'deposit_enabled': True, 'withdraw_enabled': True},
        'balance': {'deposit_enabled': True, 'withdraw_enabled': True},
        'megapay': {'deposit_enabled': True, 'withdraw_enabled': True},
        'mbank': {'deposit_enabled': True, 'withdraw_enabled': True},
    }

async def show_main_menu(message: types.Message, language: str):
    """Показать главное меню"""
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
    await message.answer(translations['welcome'].format(user_name=message.from_user.first_name or 'Пользователь', admin_username='@luxon_support'), reply_markup=keyboard)

async def start_withdrawal(message: types.Message, state: FSMContext = None, bookmaker: str = None, language: str = None, db = None, bookmakers = None):
    """Начало процесса вывода - Шаг 1: Выбор банка"""
    if not all([bookmaker, language, db, bookmakers]):
        logger.error("Missing required parameters for start_withdrawal")
        return
        
    user_id = message.from_user.id
    translations = get_translation(language)
    
    logger.info(f"Starting withdrawal process for user {user_id}, bookmaker: {bookmaker}")
    
    # Сохраняем выбранный букмекер в базе данных
    db.save_user_data(user_id, 'current_bookmaker', bookmaker)
    
    # Показываем выбор банка для вывода
    await show_bank_selection_for_withdrawal(message, db, bookmakers)

async def show_bank_selection_for_withdrawal(message: types.Message, db, bookmakers):
    """Показать выбор банка для вывода - Шаг 1 (одно сообщение с инлайн-кнопками)"""
    user_id = message.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    logger.info(f"Showing bank selection for withdrawal to user {user_id}")
    
    # Создаем инлайн клавиатуру с банками для вывода
    kb = InlineKeyboardBuilder()

    # Прочитаем глобальную настройку вывода и разрешённые банки из bot_settings
    def _read_withdraw_settings():
        try:
            import sqlite3, json
            db_path = getattr(db, 'db_path', '') or ''
            if not db_path:
                from pathlib import Path
                db_path = str(Path(__file__).resolve().parents[1] / 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("SELECT value FROM bot_settings WHERE key='withdrawals_enabled'")
            row_en = cur.fetchone()
            cur.execute("SELECT value FROM bot_settings WHERE key='withdraw_banks'")
            row_banks = cur.fetchone()
            conn.close()
            enabled = True if not row_en else (str(row_en[0]).strip() in ('1','true','True'))
            banks = []
            try:
                banks = json.loads(row_banks[0]) if row_banks and row_banks[0] else []
            except Exception:
                banks = []
            valid = {'Компаньон','О! Деньги','Бакай','Balance.kg','MegaPay','MBank'}
            banks = [b for b in banks if b in valid]
            return enabled, set(banks)
        except Exception:
            return True, set()

    w_enabled, allowed_banks = _read_withdraw_settings()
    if not w_enabled:
        await message.answer("⛔ Выводы временно не работают. Попробуйте позже.")
        # Возвращаем главное меню
        await show_main_menu(message, language)
        return
    
    # Список банков для вывода
    banks = [
        ("Компаньон", "kompanion"),
        ("О! Деньги", "odengi"),
        ("Бакай", "bakai"),
        ("Balance.kg", "balance"),
        ("MegaPay", "megapay"),
        ("MBank", "mbank")
    ]

    # Рендерим: разрешённые банки — обычные кнопки, запрещённые — alert
    for bank_name, bank_code in banks:
        if not allowed_banks or bank_name in allowed_banks:
            kb.button(text=bank_name, callback_data=f"withdraw_bank_{bank_code}")
        else:
            kb.button(text=f"{bank_name} (недоступно)", callback_data=f"withdraw_bank_unavailable_{bank_code}")
    
    kb.button(text="🔙 Назад в меню", callback_data="back_to_menu")
    kb.adjust(2)
    
    bank_selection_text = f"""
{translations['withdraw_instruction']}

{translations['select_bank_for_withdraw']}
    """

    # Отправляем ОДНО сообщение с текстом и инлайн-кнопками банков
    await message.answer(bank_selection_text, reply_markup=kb.as_markup(), parse_mode="HTML")
    
    # Сохраняем состояние
    db.save_user_data(user_id, 'current_state', 'waiting_for_bank_selection')
    logger.info(f"Bank selection shown, state set to waiting_for_bank_selection for user {user_id}")

    # Обработчик для недоступных банков
    @message.bot.callback_query(F.data.startswith('withdraw_bank_unavailable_'))
    async def handle_unavailable(cb: types.CallbackQuery):
        try:
            await cb.answer("На данный момент вывод на этот банк недоступен", show_alert=True)
        except Exception:
            try:
                await cb.answer("Недоступно", show_alert=True)
            except Exception:
                pass

async def handle_withdraw_bank_selection(user_id: int, bank_code: str, db, bookmakers, bot, callback_message=None):
    """Обработка выбора банка - переход к Шагу 2: Запрос QR-кода"""
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    logger.info(f"Processing bank selection: {bank_code} for user {user_id}")
    
    # Сохраняем выбранный банк
    db.save_user_data(user_id, 'selected_bank', bank_code)
    
    # Переходим к запросу QR-кода
    db.save_user_data(user_id, 'current_state', 'waiting_for_qr_photo')
    logger.info(f"State set to waiting_for_qr_photo for user {user_id}")
    
    # Если есть сообщение с кнопками, редактируем его, убирая кнопки
    if callback_message:
        try:
            # Убираем инлайн-кнопки и дописываем выбранный банк
            await callback_message.edit_text(
                (callback_message.text or "") + f"\n\n✅ <b>Выбран банк:</b> {bank_code.upper()}",
                parse_mode="HTML"
            )
        except Exception as e:
            logger.error(f"Error editing message: {e}")
    
    # Отправляем инструкцию по получению QR-кода
    qr_instruction = f"""
{translations['qr_instruction']}

{translations['send_qr_wallet']}
    """
    
    # Убираем клавиатуру
    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="🔙 Назад в меню")]],
        resize_keyboard=True
    )
    
    logger.info(f"Sending QR instruction to user {user_id}")
    await bot.send_message(user_id, qr_instruction, reply_markup=keyboard, parse_mode="HTML")

async def handle_withdraw_id_input(message: types.Message, db, bookmakers):
    """Обработка ввода ID - переход к Шагу 4: Ввод кода"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)
            
        # Проверяем, не нажал ли пользователь "Назад"
        if text == translations.get('back_to_menu', '🔙 Назад'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return
        
        # Проверяем, что ID состоит только из цифр
        if not text.isdigit():
            await message.answer(translations['id_digits_only'])
            return
            
        # Сохраняем ID как текущий и как общий сохранённый для выбранного букмекера
        db.save_user_data(user_id, 'withdraw_id', text)
        bookmaker_for_save = db.get_user_data(user_id, 'current_bookmaker')
        if bookmaker_for_save:
            db.save_user_data(user_id, 'id', text, bookmaker_for_save)
        
        # Переходим к вводу кода вывода
        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_code')
        
        # Получаем букмекера для отправки фотки
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        
        # Убираем кнопки и оставляем только "Назад в меню"
        keyboard = ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="🔙 Назад в меню")]],
            resize_keyboard=True
        )
        
        # Отправляем фотку с примером кода вывода
        from pathlib import Path
        photo_path = Path(f"images/{bookmaker}-code.jpg")
        if photo_path.exists():
            try:
                photo = FSInputFile(str(photo_path))
                await message.answer_photo(
                    photo=photo,
                    caption=translations['enter_withdraw_code_final'],
                    reply_markup=keyboard
                )
            except Exception as e:
                logger.warning(f"Не удалось отправить фото примера кода: {e}")
                await message.answer(translations['enter_withdraw_code_final'], reply_markup=keyboard)
        else:
            await message.answer(translations['enter_withdraw_code_final'], reply_markup=keyboard)
            
    except Exception as e:
        logger.error(f"Ошибка при обработке ID для вывода: {e}")
        await message.answer("Произошла ошибка")
    
async def process_qr_photo(message: types.Message, db, bookmakers):
    """Обработка QR-фото - переход к Шагу 3: Ввод ID"""
    try:
        user_id = message.from_user.id
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        logger.info(f"Processing QR photo for user {user_id}")
        
        # Сохраняем фото QR-кода
        qr_file_id = message.photo[-1].file_id
        db.save_user_data(user_id, 'qr_photo_id', qr_file_id)
        logger.info(f"QR photo saved for user {user_id}")
        
        # Переходим к вводу ID
        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_id')
        logger.info(f"State set to waiting_for_withdraw_id for user {user_id}")
        
        # Получаем букмекера и сохраненный ID
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        saved_id = db.get_user_data(user_id, 'id', bookmaker)
        
        # Создаем клавиатуру с сохраненным ID
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=str(saved_id))] if saved_id else [],
                [KeyboardButton(text=translations.get('back_to_menu', '🔙 Назад'))]
            ],
            resize_keyboard=True
        )
                
        # Отправляем сообщение с инструкцией
        text = f"""
{translations['enter_withdraw_id']}
        """
        
        # Отправляем фотку с примером ID
        from pathlib import Path
        photo_path = Path(f"images/{bookmaker}-id.jpg")
        if photo_path.exists():
            try:
                photo = FSInputFile(str(photo_path))
                await message.answer_photo(
                    photo=photo,
                    caption=text,
                    reply_markup=keyboard
                )
            except Exception as e:
                logger.warning(f"Не удалось отправить фото примера ID: {e}")
                await message.answer(text, reply_markup=keyboard)
        else:
            await message.answer(text, reply_markup=keyboard)
            
    except Exception as e:
        logger.error(f"Ошибка при обработке QR-фото: {e}")
        await message.answer("Произошла ошибка")
    
async def handle_withdraw_code_input(message: types.Message, db, bookmakers):
    """Обработка ввода кода вывода - финальный шаг"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)
            
        # Проверяем, не нажал ли пользователь "Назад"
        if text == translations.get('back_to_menu', '🔙 Назад'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return
            
        # Сохраняем код вывода
        db.save_user_data(user_id, 'withdraw_code', text)
        
        # Получаем данные заявки
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        bank_code = db.get_user_data(user_id, 'selected_bank')
        withdraw_id = db.get_user_data(user_id, 'withdraw_id')
        qr_photo_id = db.get_user_data(user_id, 'qr_photo_id')
        
        # Получаем сумму через API для конкретного букмекера
        try:
            # Получаем конфигурацию для букмекера из BOOKMAKERS (избегаем импорта BOOKMAKER_CONFIGS)
            bookmaker_config = BOOKMAKERS.get(bookmaker, {})
            if not bookmaker_config:
                logger.error(f"No config found for bookmaker: {bookmaker}")
                amount = 0
            else:
                # Выбираем правильный API клиент для букмекера
                if bookmaker == "1xbet":
                    from api_clients.onexbet_client import OneXBetAPIClient
                    # В 1XBET конфиг лежит в секции api_config (как и для депозитов)
                    api_client = OneXBetAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.payout(withdraw_id, text)
                elif bookmaker == "1win":
                    # Используем официальный клиент 1WIN, чтобы получать структурированные ошибки
                    from api_clients.onewin_client import OneWinAPIClient
                    api_client = OneWinAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.withdrawal(int(withdraw_id), text)
                elif bookmaker == "melbet":
                    # Используем специализированный клиент с корректным base_url
                    from api_clients.melbet_client import MelbetAPIClient
                    api_client = MelbetAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.payout(withdraw_id, text)
                elif bookmaker == "mostbet":
                    # Используем официальный клиент Mostbet и подтверждение вывода по transactionId+code
                    from api_clients.mostbet_client import MostbetAPI
                    api_client = MostbetAPI(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    try:
                        resp = await api_client.confirm_cashout(int(withdraw_id), text)
                    except Exception as e:
                        logger.error(f"Mostbet confirm_cashout call error: {e}")
                        resp = None
                    # Приводим к унифицированному виду
                    if resp and isinstance(resp, dict):
                        if resp.get('success') is True:
                            payout_result = {"success": True, "data": resp.get('data') or {}}
                        else:
                            payout_result = {
                                "success": False,
                                "error": (resp.get('error') or '').strip() or 'Mostbet error',
                                "status_code": resp.get('status_code')
                            }
                    else:
                        payout_result = {"success": False, "error": "Mostbet no response"}
                else:
                    logger.error(f"Unknown bookmaker: {bookmaker}")
                    amount = 0
                    payout_result = None
                
                if payout_result and payout_result.get("success"):
                    # Получаем сумму из ответа API (учитываем разные ключи: amount/summa)
                    data_obj = payout_result.get("data", {}) or {}
                    amount = (
                        data_obj.get("amount")
                        or data_obj.get("summa")
                        or data_obj.get("Sum")
                        or 0
                    )
                    try:
                        amount = float(amount)
                    except Exception:
                        amount = float(amount or 0)
                    logger.info(f"API payout successful: {amount} for ID: {withdraw_id}, code: {text}, bookmaker: {bookmaker}")
                else:
                    # Проверяем, есть ли заявка на вывод
                    raw_msg = ""
                    if payout_result:
                        raw_msg = (
                            payout_result.get("message")
                            or (payout_result.get("data") or {}).get("message")
                            or (payout_result.get("data") or {}).get("Message")
                            or payout_result.get("error")
                            or ""
                        )
                    error_message = (raw_msg or "").lower()
                    # Fallback: пробуем вытащить сумму из текста ответа (например, "100.39" или "100,39")
                    if not (payout_result and payout_result.get("success")):
                        try:
                            import re
                            m = re.search(r"(\d+[\.,]\d{2})", raw_msg or "")
                            if m:
                                amt_str = m.group(1).replace(',', '.')
                                amount = float(amt_str)
                        except Exception:
                            pass
                    status_code = (payout_result or {}).get('status_code')
                    # Некоторые провайдеры присылают текст "операция выполнена успешно" даже если success=false — считаем это успехом
                    if any(x in error_message for x in ["успешн", "operation completed successfully", "successfully"]):
                        data_obj = (payout_result or {}).get("data", {}) or {}
                        amount = (
                            data_obj.get("amount")
                            or data_obj.get("summa")
                            or data_obj.get("Sum")
                            or 0
                        )
                        try:
                            amount = float(amount)
                        except Exception:
                            amount = float(amount or 0)
                        logger.warning("Provider returned success-like message but success flag is false. Proceeding as success.")
                        # Не возвращаемся — продолжаем как обычный успех (сохранение заявки/уведомления ниже)
                    elif (
                        "не найдена" in error_message or "not found" in error_message or "нет такой" in error_message
                        or status_code == 404
                    ):
                        # Заявка на вывод не найдена у провайдера — продолжаем как ручную (оставим pending на сайте)
                        await message.answer(translations.get('withdrawal_not_found', "❌ Такой заявки у провайдера не найдено. Мы обработаем её вручную."))
                        # продолжим вниз: сохраним как pending
                    else:
                        logger.error(f"API payout failed: {raw_msg or (payout_result or {}).get('error', 'No response')}")
                        # Покажем пользователю текст ошибки от провайдера, если он есть
                        if raw_msg:
                            await message.answer(f"❌ Ошибка вывода: {raw_msg}. Заявка отправлена на ручную обработку.")
                        else:
                            await message.answer(translations['withdrawal_api_error'])
                        # не выходим — сохраним как pending
            
        except Exception as e:
            logger.error(f"Error calling API for payout: {e}")
            amount = 0  # Если API не работает, используем 0
        
        try:
            # Сохраняем заявку в единую таблицу requests (для сайта)
            import sqlite3
            from pathlib import Path
            # ВАЖНО: использовать тот же путь, что и у Django (settings.BOT_DATABASE_PATH)
            # Сначала пробуем взять путь из переданного объекта db
            db_path = getattr(db, 'db_path', None)
            if not db_path:
                # Fallback: корень репо (bets/universal_bot.db), а не bot/universal_bot.db
                db_path = str(Path(__file__).resolve().parents[2] / 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            # Гарантируем наличие таблицы requests с нужными колонками
            cur.execute('''
                CREATE TABLE IF NOT EXISTS requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    bookmaker TEXT,
                    account_id TEXT,
                    amount REAL NOT NULL DEFAULT 0,
                    request_type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    withdrawal_code TEXT,
                    photo_file_id TEXT,
                    photo_file_url TEXT,
                    bank TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP,
                    processed_at TIMESTAMP
                )
            ''')

            # Получим прямой URL к файлу от Telegram API (если есть)
            photo_file_url = None
            if qr_photo_id:
                try:
                    file_info = await message.bot.get_file(qr_photo_id)
                    fpath = getattr(file_info, 'file_path', None)
                    if fpath:
                        photo_file_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{fpath}"
                except Exception as e:
                    logger.warning(f"Не удалось получить прямой URL фото вывода: {e}")

            # Сохраняем заявку в requests
            cur.execute('''
                INSERT INTO requests
                (user_id, username, first_name, bookmaker, account_id, amount, request_type, status,
                 withdrawal_code, photo_file_id, photo_file_url, bank)
                VALUES (?, ?, ?, ?, ?, ?, 'withdraw', 'pending', ?, ?, ?, ?)
            ''', (
                user_id,
                message.from_user.username or '',
                message.from_user.first_name or '',
                bookmaker,
                withdraw_id or '',
                float(amount or 0),
                text,
                qr_photo_id,
                photo_file_url,
                bank_code
            ))
            conn.commit()
            conn.close()

            # Синхронизация с сайтом (Django): отправим и file_id, и прямой URL к фото
            try:
                sync_withdraw_to_django_admin(
                    user_id=user_id,
                    username=message.from_user.username or '',
                    first_name=message.from_user.first_name or '',
                    bookmaker=bookmaker,
                    amount=amount,
                    withdraw_id=withdraw_id,
                    bank_code=bank_code,
                    withdraw_code=text,
                    photo_file_id=qr_photo_id,
                    photo_file_url=photo_file_url,
                    status='pending'
                )
            except Exception as e:
                logger.error(f"Ошибка синхронизации заявки на вывод с Django: {e}")

            # Отправляем заявку в группу
            group_id = bookmakers[bookmaker]['withdraw_group_id']
            logger.info(f"Sending withdraw request to group {group_id} for bookmaker {bookmaker}")
            
            # Генерируем уникальный ID заявки
            request_id = random.randint(1000, 9999)
            
            # Сохраняем данные заявки в словарь для API обработчиков
            import handlers.api_handlers as api_handlers
            api_handlers.pending_requests[request_id] = {
                'user_id': user_id,
                'amount': amount,  # Сумма полученная через API
                'xbet_id': withdraw_id,
                'bookmaker': bookmaker,
                'type': 'withdraw',
                'bank_code': bank_code,
                'withdraw_code': text
            }
            
            application_text = f"""
🔔 <b>Новая заявка на вывод</b>

👤 <b>Пользователь:</b> @{message.from_user.username or 'без username'}
🆔 <b>ID:</b> <code>{withdraw_id}</code>
🏢 <b>Букмекер:</b> {bookmakers[bookmaker]['name']}
🏦 <b>Банк:</b> {bank_code.title()}
💰 <b>Сумма:</b> {amount} сом
🔐 <b>Код вывода:</b> скрыт (только для API)
🆔 <b>ID заявки:</b> {request_id}
"""
            
            # Создаем клавиатуру с кнопками
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [
                    InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"approve_withdraw_{request_id}"),
                    InlineKeyboardButton(text="❌ Отклонить", callback_data=f"reject_withdraw_{request_id}")
                ]
            ])
            
            # Отправляем заявку в группу с QR-фото
            await message.bot.send_photo(
                chat_id=group_id,
                photo=qr_photo_id,
                caption=application_text,
                reply_markup=keyboard,
                parse_mode="HTML"
            )
            
            # Уведомляем пользователя
            keyboard = ReplyKeyboardMarkup(
                keyboard=[
                    [KeyboardButton(text=translations['deposit']), KeyboardButton(text=translations['withdraw'])],
                    [KeyboardButton(text=translations['referral'])],
                    [KeyboardButton(text=translations['support']), KeyboardButton(text=translations['history'])],
                    [KeyboardButton(text=translations['faq']), KeyboardButton(text=translations['language'])]
                ],
                resize_keyboard=True
            )
            
            success_message = translations['withdrawal_request_sent_simple'].format(
                amount=float(amount or 0),
                xbet_id=withdraw_id
            )
            
            await message.answer(success_message, reply_markup=keyboard, parse_mode="HTML")
            
            # Отправляем заявку в группу админу
            await send_withdraw_request_to_group(
                bot=message.bot,
                user_id=user_id,
                amount=amount,
                bookmaker=bookmaker,
                bank_code=bank_code,
                withdraw_id=withdraw_id,
                code=text,
                photo_file_id=qr_photo_id
            )
            
            # Очищаем состояние
            db.save_user_data(user_id, 'current_state', '')
            
        except Exception as e:
            logger.error(f"Ошибка отправки заявки на вывод в группу: {e}")
            await message.answer("❌ Ошибка при отправке заявки. Попробуйте позже.")
            
    except Exception as e:
        logger.error(f"Ошибка при обработке кода вывода: {e}")
        await message.answer("Произошла ошибка")

def sync_withdraw_to_django_admin(*, user_id, username, first_name, bookmaker, amount, withdraw_id, bank_code, withdraw_code, photo_file_id, photo_file_url, status):
    """Отправка заявки на вывод на сайт (Django) с URL чека."""
    try:
        import requests
        import os
        data = {
            'user_id': user_id,
            'username': username or '',
            'first_name': first_name or '',
            'bookmaker': bookmaker,
            'amount': amount,
            'withdraw_id': withdraw_id,
            'account_id': withdraw_id,
            'bank': bank_code,
            'withdrawal_code': withdraw_code,
            'receipt_photo': photo_file_id or '',
            'receipt_photo_url': photo_file_url or '',
            'status': status,
        }
        base_url = os.getenv('DJANGO_ADMIN_URL', 'http://localhost:8081')
        endpoint = f"{base_url.rstrip('/')}/bot/api/bot/withdraw-request/"
        resp = requests.post(endpoint, json=data, timeout=8)
        if resp.status_code in (200, 201):
            logger.info("✅ Заявка на вывод синхронизирована с Django админкой")
        else:
            logger.error(f"❌ Ошибка синхронизации вывода: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке заявки на вывод в Django: {e}")

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None):
    """Регистрация обработчиков"""
    
    # Обработчики текстовых сообщений для состояний вывода
    @dp.message(lambda message: message.text and db.get_user_data(message.from_user.id, 'current_state') == 'waiting_for_withdraw_id')
    async def handle_withdraw_id_input_handler(message: types.Message):
        """Обработка ввода ID для вывода"""
        await handle_withdraw_id_input(message, db, bookmakers)
    
    
    @dp.message(lambda message: message.text and db.get_user_data(message.from_user.id, 'current_state') == 'waiting_for_withdraw_code')
    async def handle_withdraw_code_input_handler(message: types.Message):
        """Обработка ввода кода вывода"""
        await handle_withdraw_code_input(message, db, bookmakers)

    # Обработка нажатия на инлайн-кнопку выбора банка для вывода
    @dp.callback_query(F.data.startswith("withdraw_bank_"))
    async def handle_withdraw_bank_callback(callback: types.CallbackQuery):
        user_id = callback.from_user.id
        bank_code = callback.data.split("_")[-1]
        try:
            await handle_withdraw_bank_selection(
                user_id=user_id,
                bank_code=bank_code,
                db=db,
                bookmakers=bookmakers,
                bot=callback.bot,
                callback_message=callback.message
            )
            await callback.answer("Банк выбран")
        except Exception as e:
            logger.error(f"withdraw bank callback error: {e}")
            await callback.answer("Ошибка обработки", show_alert=True)