#!/usr/bin/env python3
"""
Хендлеры для вывода средств — упрощённый процесс
"""

import logging
import random
from datetime import datetime
from pathlib import Path

from aiogram import types, Dispatcher, F
from aiogram.types import (
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    FSInputFile,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder

from translations import get_translation
from config import BOOKMAKERS, BOT_TOKEN

logger = logging.getLogger(__name__)


# ======================== Утилиты ========================

async def show_main_menu(message: types.Message, language: str):
    """Показать главное меню"""
    translations = get_translation(language)
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=translations['deposit']), KeyboardButton(text=translations['withdraw'])],
            [KeyboardButton(text=translations['referral'])],
            [KeyboardButton(text=translations['support']), KeyboardButton(text=translations['history'])],
            [KeyboardButton(text=translations['faq']), KeyboardButton(text=translations['language'])],
        ],
        resize_keyboard=True,
    )
    await message.answer(
        translations['welcome'].format(
            user_name=message.from_user.first_name or 'Пользователь',
            admin_username='@luxon_support',
        ),
        reply_markup=keyboard,
    )


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
        'channel': {'enabled': False, 'name': '@bingokg_news'},
    }


def get_bank_settings():
    """Простейшие настройки банков (локальный фолбэк)"""
    return {
        'demirbank': {'deposit_enabled': True, 'withdraw_enabled': True},
        'odengi': {'deposit_enabled': True, 'withdraw_enabled': True},
        'bakai': {'deposit_enabled': True, 'withdraw_enabled': True},
        'balance': {'deposit_enabled': True, 'withdraw_enabled': True},
        'megapay': {'deposit_enabled': True, 'withdraw_enabled': True},
        'mbank': {'deposit_enabled': True, 'withdraw_enabled': True},
    }


# ======================== Шаг 1. Запуск и выбор банка ========================

async def start_withdrawal(
    message: types.Message,
    state=None,
    bookmaker: str = None,
    language: str = None,
    db=None,
    bookmakers=None,
):
    """Начало процесса вывода — выбор банка"""
    if not all([bookmaker, language, db, bookmakers]):
        logger.error("Missing required parameters for start_withdrawal")
        return

    user_id = message.from_user.id
    logger.info(f"Starting withdrawal process for user {user_id}, bookmaker: {bookmaker}")

    # Сохраняем выбранного букмекера
    db.save_user_data(user_id, 'current_bookmaker', bookmaker)

    await show_bank_selection_for_withdrawal(message, db, bookmakers)


async def show_bank_selection_for_withdrawal(message: types.Message, db, bookmakers):
    """Показать выбор банка для вывода — одно сообщение с инлайн‑кнопками"""
    user_id = message.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)

    logger.info(f"Showing bank selection for withdrawal to user {user_id}")

    kb = InlineKeyboardBuilder()

    def _read_withdraw_settings():
        try:
            import sqlite3, json

            db_path = getattr(db, 'db_path', '') or ''
            if not db_path:
                db_path = str(Path(__file__).resolve().parents[1] / 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("SELECT value FROM bot_settings WHERE key='withdrawals_enabled'")
            row_en = cur.fetchone()
            cur.execute("SELECT value FROM bot_settings WHERE key='withdraw_banks'")
            row_banks = cur.fetchone()
            conn.close()

            enabled = True if not row_en else (str(row_en[0]).strip() in ('1', 'true', 'True'))
            banks = []
            try:
                banks = json.loads(row_banks[0]) if row_banks and row_banks[0] else []
            except Exception:
                banks = []

            valid = {'Компаньон', 'О! Деньги', 'Бакаи', 'Balance.kg', 'MegaPay', 'MBank'}
            banks = [b for b in banks if b in valid]
            return enabled, set(banks)
        except Exception:
            return True, set()

    w_enabled, allowed_banks = _read_withdraw_settings()
    if not w_enabled:
        await message.answer(get_translation(language, 'withdrawal_api_error'))
        await show_main_menu(message, language)
        return

    banks = [
        ("Компаньон", "kompanion"),
        ("О! Деньги", "odengi"),
        ("Бакаи", "bakai"),
        ("Balance.kg", "balance"),
        ("MegaPay", "megapay"),
        ("MBank", "mbank"),
    ]

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

    await message.answer(bank_selection_text, reply_markup=kb.as_markup(), parse_mode="HTML")

    db.save_user_data(user_id, 'current_state', 'waiting_for_bank_selection')
    logger.info(f"Bank selection shown, state set to waiting_for_bank_selection for user {user_id}")


async def handle_withdraw_bank_selection(user_id: int, bank_code: str, db, bookmakers, bot, callback_message: types.Message | None = None):
    """Обработка выбора банка — переход к шагу 2: запрос QR‑кода"""
    language = db.get_user_language(user_id)
    translations = get_translation(language)

    logger.info(f"Processing bank selection: {bank_code} for user {user_id}")

    db.save_user_data(user_id, 'selected_bank', bank_code)
    db.save_user_data(user_id, 'current_state', 'waiting_for_qr_photo')

    if callback_message:
        try:
            await callback_message.edit_text(
                (callback_message.text or '') + f"\n\n✅ <b>Выбран банк:</b> {bank_code.upper()}",
                parse_mode="HTML",
            )
        except Exception as e:
            logger.error(f"Error editing message: {e}")

    qr_instruction = f"""
{get_translation(language, 'qr_instruction')}

{get_translation(language, 'send_qr_wallet')}
    """

    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="🔙 Назад в меню")]],
        resize_keyboard=True,
    )

    logger.info(f"Sending QR instruction to user {user_id}")
    await bot.send_message(user_id, qr_instruction, reply_markup=keyboard, parse_mode="HTML")


# ======================== Шаг 3. Ввод телефона ========================

async def process_qr_photo(message: types.Message, db, bookmakers):
    """Обработка QR‑фото — переход к шагу 3: ввод номера телефона"""
    try:
        user_id = message.from_user.id
        language = db.get_user_language(user_id)
        translations = get_translation(language)

        logger.info(f"Processing QR photo for user {user_id}")

        qr_file_id = message.photo[-1].file_id
        db.save_user_data(user_id, 'qr_photo_id', qr_file_id)

        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_phone')

        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        saved_phone = db.get_user_data(user_id, 'phone', bookmaker)

        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=str(saved_phone))] if saved_phone else [],
                [KeyboardButton(text=translations.get('back_to_menu', '🔙 Назад'))],
            ],
            resize_keyboard=True,
        )

        await message.answer(translations['enter_withdraw_phone'], reply_markup=keyboard)

    except Exception as e:
        logger.error(f"Ошибка при обработке QR-фото: {e}")
        await message.answer(get_translation(language, 'withdrawal_api_error'))


async def handle_withdraw_phone_input(message: types.Message, db, bookmakers):
    """Обработка ввода номера телефона — переход к шагу 4: ввод ID"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)

        if text == translations.get('back_to_menu', '🔙 Назад'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return

        phone_clean = text.strip().replace('+', '').replace(' ', '').replace('-', '')
        if not phone_clean.isdigit() or len(phone_clean) != 12 or not phone_clean.startswith('996'):
            await message.answer(get_translation(language, 'enter_phone_format'))
            return

        db.save_user_data(user_id, 'withdraw_phone', phone_clean)
        bookmaker_for_save = db.get_user_data(user_id, 'current_bookmaker')
        if bookmaker_for_save:
            db.save_user_data(user_id, 'phone', phone_clean, bookmaker_for_save)

        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_id')
        logger.info(f"State set to waiting_for_withdraw_id for user {user_id}")

        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        saved_id = db.get_user_data(user_id, 'id', bookmaker)

        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=str(saved_id))] if saved_id else [],
                [KeyboardButton(text=translations.get('back_to_menu', '🔙 Назад'))],
            ],
            resize_keyboard=True,
        )

        # Формируем текст как в депозите, локализовано
        brand = (bookmakers.get(bookmaker, {}).get('name') if bookmakers and bookmaker in bookmakers else bookmaker or '').upper()
        if not brand:
            brand = '1XBET'
        text_msg = get_translation(language, 'deposit_instruction', bookmaker_name=brand)

        # Пытаемся найти фото-пример для выбранного букмекера по нескольким путям (абсолютные пути)
        base_images = Path(__file__).resolve().parents[2] / 'images'
        bm = (bookmaker or '').lower()
        candidates = [
            base_images / f"{bm}-id.jpg",
            base_images / f"{bm}_id.jpg",
            base_images / bm / "id.jpg",
            base_images / f"id-{bm}.jpg",
            base_images / "id-example.jpg",
        ]
        # Жёсткие фолбэки на известные картинки из репозитория
        candidates += [
            base_images / "1xbet-id.jpg",
            base_images / "1win-id.jpg",
            base_images / "melbet-id.jpg",
            base_images / "mostbet-id.jpg",
        ]
        photo_path = next((p for p in candidates if p.exists()), None)
        if photo_path:
            try:
                photo = FSInputFile(str(photo_path))
                await message.answer_photo(photo=photo, caption=text_msg, reply_markup=keyboard, parse_mode="HTML")
            except Exception as e:
                logger.warning(f"Не удалось отправить фото примера ID: {e}")
                await message.answer(text_msg, reply_markup=keyboard, parse_mode="HTML")
        else:
            await message.answer(text_msg, reply_markup=keyboard, parse_mode="HTML")

    except Exception as e:
        logger.error(f"Ошибка при обработке номера телефона для вывода: {e}")
        await message.answer("Произошла ошибка")


# ======================== Шаг 4. Ввод ID → ввод кода вывода ========================

async def handle_withdraw_id_input(message: types.Message, db, bookmakers):
    """Обработка ввода ID — переход к шагу 4: ввод кода"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)

        if text == translations.get('back_to_menu', '🔙 Назад'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return

        if not text.isdigit():
            await message.answer(translations['id_digits_only'])
            return

        db.save_user_data(user_id, 'withdraw_id', text)
        bookmaker_for_save = db.get_user_data(user_id, 'current_bookmaker')
        if bookmaker_for_save:
            db.save_user_data(user_id, 'id', text, bookmaker_for_save)

        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_code')

        bookmaker = db.get_user_data(user_id, 'current_bookmaker')

        keyboard = ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="🔙 Назад в меню")]],
            resize_keyboard=True,
        )

        photo_path = Path(f"images/{bookmaker}-code.jpg")
        if photo_path.exists():
            try:
                photo = FSInputFile(str(photo_path))
                await message.answer_photo(
                    photo=photo,
                    caption=translations['enter_withdraw_code_final'],
                    reply_markup=keyboard,
                )
            except Exception as e:
                logger.warning(f"Не удалось отправить фото примера кода: {e}")
                await message.answer(translations['enter_withdraw_code_final'], reply_markup=keyboard)
        else:
            await message.answer(translations['enter_withdraw_code_final'], reply_markup=keyboard)

    except Exception as e:
        logger.error(f"Ошибка при обработке ID для вывода: {e}")
        await message.answer("Произошла ошибка")


# ======================== Шаг 5. Ввод кода вывода — финал ========================

async def handle_withdraw_code_input(message: types.Message, db, bookmakers):
    """Финальная обработка: код вывода → создание заявки"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)

        if text == translations.get('back_to_menu', '🔙 Назад'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return

        db.save_user_data(user_id, 'withdraw_code', text)

        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        bank_code = db.get_user_data(user_id, 'selected_bank')
        withdraw_id = db.get_user_data(user_id, 'withdraw_id')
        withdraw_phone = db.get_user_data(user_id, 'withdraw_phone')
        qr_photo_id = db.get_user_data(user_id, 'qr_photo_id')

        # Попытка получить сумму через API букмекера
        amount = 0
        payout_result = None
        try:
            bookmaker_config = BOOKMAKERS.get(bookmaker, {})
            if bookmaker_config:
                if bookmaker == '1xbet':
                    from api_clients.onexbet_client import OneXBetAPIClient

                    api_client = OneXBetAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.payout(withdraw_id, text)
                elif bookmaker == '1win':
                    from api_clients.onewin_client import OneWinAPIClient

                    api_client = OneWinAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.withdrawal(int(withdraw_id), text)
                elif bookmaker == 'melbet':
                    from api_clients.melbet_client import MelbetAPIClient

                    api_client = MelbetAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.payout(withdraw_id, text)
                elif bookmaker == 'mostbet':
                    from api_clients.mostbet_client import MostbetAPI

                    api_client = MostbetAPI(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    try:
                        resp = await api_client.confirm_cashout(int(withdraw_id), text)
                    except Exception as e:
                        logger.error(f"Mostbet confirm_cashout call error: {e}")
                        resp = None
                    if resp and isinstance(resp, dict):
                        if resp.get('success') is True:
                            payout_result = {"success": True, "data": resp.get('data') or {}}
                        else:
                            payout_result = {
                                "success": False,
                                "error": (resp.get('error') or '').strip() or 'Mostbet error',
                                "status_code": resp.get('status_code'),
                            }
                    else:
                        payout_result = {"success": False, "error": "Mostbet no response"}
            else:
                logger.error(f"No config found for bookmaker: {bookmaker}")

            if payout_result and payout_result.get("success"):
                data_obj = payout_result.get("data", {}) or {}
                amount = data_obj.get("amount") or data_obj.get("summa") or data_obj.get("Sum") or 0
                try:
                    amount = float(amount)
                except Exception:
                    amount = float(amount or 0)
                logger.info(f"API payout successful: {amount} for ID: {withdraw_id}, code: {text}, bookmaker: {bookmaker}")
            else:
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

                # Попробуем вытащить сумму из текста ответа (например, "100.39" или "100,39")
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
                if any(x in error_message for x in ["успешн", "operation completed successfully", "successfully"]):
                    data_obj = (payout_result or {}).get("data", {}) or {}
                    amount = data_obj.get("amount") or data_obj.get("summa") or data_obj.get("Sum") or 0
                    try:
                        amount = float(amount)
                    except Exception:
                        amount = float(amount or 0)
                    logger.warning("Provider returned success-like message but success flag is false. Proceeding as success.")
                elif ("не найдена" in error_message or "not found" in error_message or "нет такой" in error_message or status_code == 404):
                    await message.answer(
                        translations.get(
                            'withdrawal_not_found',
                            "❌ Такой заявки у провайдера не найдено. Мы обработаем её вручную.",
                        )
                    )
                else:
                    logger.error(f"API payout failed: {raw_msg or (payout_result or {}).get('error', 'No response')}")
                    if raw_msg:
                        await message.answer(
                            get_translation(language, 'withdrawal_api_error') + (f"\n\n{raw_msg}" if raw_msg else "")
                        )
                    else:
                        await message.answer(get_translation(language, 'withdrawal_api_error'))

        except Exception as e:
            logger.error(f"Error calling API for payout: {e}")
        # Сохранение заявки в единую таблицу requests (для сайта)
        try:
            import sqlite3

            db_path = getattr(db, 'db_path', None)
            if not db_path:
                db_path = str(Path(__file__).resolve().parents[2] / 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute(
                '''
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
                    phone TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP,
                    processed_at TIMESTAMP
                )
                '''
            )
            try:
                cur.execute("ALTER TABLE requests ADD COLUMN phone TEXT")
            except Exception:
                pass

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

            cur.execute(
                '''
                INSERT INTO requests
                (user_id, username, first_name, bookmaker, account_id, amount, request_type, status,
                 withdrawal_code, photo_file_id, photo_file_url, bank, phone)
                VALUES (?, ?, ?, ?, ?, ?, 'withdraw', 'pending', ?, ?, ?, ?, ?)
                ''',
                (
                    user_id,
                    message.from_user.username or '',
                    message.from_user.first_name or '',
                    bookmaker,
                    withdraw_id or '',
                    float(amount or 0),
                    text,
                    qr_photo_id,
                    photo_file_url,
                    bank_code,
                    withdraw_phone or '',
                ),
            )
            conn.commit()
            conn.close()

            # Синхронизация с сайтом (Django)
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
                    withdraw_phone=withdraw_phone,
                    photo_file_id=qr_photo_id,
                    photo_file_url=photo_file_url,
                    status='pending',
                )
            except Exception as e:
                logger.error(f"Ошибка синхронизации вывода с Django: {e}")

            # Отправляем заявку в группу
            group_id = bookmakers[bookmaker]['withdraw_group_id']
            logger.info(f"Sending withdraw request to group {group_id} for bookmaker {bookmaker}")

            request_id = random.randint(1000, 9999)

            import handlers.api_handlers as api_handlers

            api_handlers.pending_requests[request_id] = {
                'user_id': user_id,
                'amount': amount,
                'xbet_id': withdraw_id,
                'bookmaker': bookmaker,
                'type': 'withdraw',
                'bank_code': bank_code,
                'withdraw_code': text,
            }

            application_text = f"""
💴 <b>Новая заявка на вывод</b>

👤 <b>Пользователь:</b> @{message.from_user.username or 'без username'}
🆔 <b>ID:</b> <code>{withdraw_id}</code>
📱 <b>Телефон:</b> +{withdraw_phone or 'не указан'}
🏧 <b>Букмекер:</b> {bookmakers[bookmaker]['name']}
🏦 <b>Банк:</b> {bank_code.title()}
💰 <b>Сумма:</b> {amount} сом
🔑 <b>Код вывода:</b> скрыт (только для API)
🆔 <b>ID заявки:</b> {request_id}
"""

            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"approve_withdraw_{request_id}"),
                        InlineKeyboardButton(text="✖️ Отклонить", callback_data=f"reject_withdraw_{request_id}"),
                    ]
                ]
            )

            await message.bot.send_photo(
                chat_id=group_id,
                photo=qr_photo_id,
                caption=application_text,
                reply_markup=keyboard,
                parse_mode="HTML",
            )

            # Уведомим пользователя
            keyboard = ReplyKeyboardMarkup(
                keyboard=[
                    [KeyboardButton(text=translations['deposit']), KeyboardButton(text=translations['withdraw'])],
                    [KeyboardButton(text=translations['referral'])],
                    [KeyboardButton(text=translations['support']), KeyboardButton(text=translations['history'])],
                    [KeyboardButton(text=translations['faq']), KeyboardButton(text=translations['language'])],
                ],
                resize_keyboard=True,
            )

            success_message = translations['withdrawal_request_sent_simple'].format(
                amount=float(amount or 0), xbet_id=withdraw_id
            )

            await message.answer(success_message, reply_markup=keyboard, parse_mode="HTML")

            # Дублируем в группу админа общую заявку
            await send_withdraw_request_to_group(
                bot=message.bot,
                user_id=user_id,
                amount=amount,
                bookmaker=bookmaker,
                bank_code=bank_code,
                withdraw_id=withdraw_id,
                code=text,
                photo_file_id=qr_photo_id,
            )

            db.save_user_data(user_id, 'current_state', '')

        except Exception as e:
            logger.error(f"Ошибка отправки заявки на вывод в группу: {e}")
            await message.answer(get_translation(language, 'withdrawal_api_error'))

    except Exception as e:
        logger.error(f"Ошибка при обработке кода вывода: {e}")
        await message.answer("Произошла ошибка")


async def send_withdraw_request_to_group(
    bot,
    user_id: int,
    amount: float,
    bookmaker: str,
    bank_code: str,
    withdraw_id: str,
    code: str,
    photo_file_id: str | None = None,
):
    """Отправляет заявку на вывод в группу админу"""
    try:
        user_info = await bot.get_chat(user_id)
        username = user_info.username or "Нет username"

        bookmaker_config = BOOKMAKERS.get(bookmaker, {})
        group_id = bookmaker_config.get('withdraw_group_id')
        if not group_id:
            logger.error(f"Не найден group_id для букмекера {bookmaker}")
            return False

        request_text = f"""
💴 <b>Новая заявка на вывод</b>

👤 <b>Пользователь:</b> @{username}
🆔 <b>ID:</b> {user_id}
🏧 <b>Букмекер:</b> {bookmaker_config.get('name', bookmaker.upper())}
💰 <b>Сумма:</b> {amount:.2f} сом
🏦 <b>Банк:</b> {bank_code.upper()}
🆔 <b>ID счёта:</b> {withdraw_id}
🔑 <b>Код вывода:</b> скрыт (только для API)

🕰️ <b>Время:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}
        """

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"confirm_withdraw_{user_id}_{amount}"),
                    InlineKeyboardButton(text="✖️ Отклонить", callback_data=f"reject_withdraw_{user_id}_{amount}"),
                ],
                [
                    InlineKeyboardButton(text="🔍 Проверить API", callback_data=f"check_withdraw_api_{user_id}_{amount}"),
                ],
            ]
        )

        if photo_file_id:
            await bot.send_photo(
                chat_id=group_id,
                photo=photo_file_id,
                caption=request_text,
                parse_mode="HTML",
                reply_markup=keyboard,
            )
        else:
            await bot.send_message(
                chat_id=group_id,
                text=request_text,
                parse_mode="HTML",
                reply_markup=keyboard,
            )

        logger.info(f"✅ Заявка на вывод отправлена в группу {group_id}")
        return True

    except Exception as e:
        logger.error(f"✖️ Ошибка отправки заявки в группу: {e}")
        return False


def sync_withdraw_to_django_admin(
    *,
    user_id,
    username,
    first_name,
    bookmaker,
    amount,
    withdraw_id,
    bank_code,
    withdraw_code,
    withdraw_phone,
    photo_file_id,
    photo_file_url,
    status,
):
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
            'phone': withdraw_phone or '',
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
            logger.error(f"✖️ Ошибка синхронизации вывода: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"✖️ Ошибка при отправке заявки на вывод в Django: {e}")


# ======================== Регистрация хендлеров ========================

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None):
    """Регистрация обработчиков"""

    # Глобальный обработчик: недоступные банки вывода
    @dp.callback_query(F.data.startswith('withdraw_bank_unavailable_'))
    async def handle_unavailable(cb: types.CallbackQuery):
        try:
            await cb.answer("На данный момент вывод на этот банк недоступен", show_alert=True)
        except Exception:
            try:
                await cb.answer("Недоступно", show_alert=True)
            except Exception:
                pass

    # Обработка выбора банка (доступные)
    @dp.callback_query(F.data.startswith("withdraw_bank_"))
    async def handle_withdraw_bank_callback(callback: types.CallbackQuery):
        data = callback.data or ''
        if data.startswith('withdraw_bank_unavailable_'):
            try:
                await callback.answer("Недоступно", show_alert=True)
            except Exception:
                pass
            return
        try:
            bank_code = data.split('_', 2)[-1]
        except Exception:
            bank_code = data.replace('withdraw_bank_', '')
        try:
            await handle_withdraw_bank_selection(
                user_id=callback.from_user.id,
                bank_code=bank_code,
                db=db,
                bookmakers=bookmakers,
                bot=callback.bot,
                callback_message=callback.message,
            )
            await callback.answer()
        except Exception as e:
            logger.error(f"withdraw bank callback error: {e}")
            try:
                await callback.answer("Ошибка обработки", show_alert=True)
            except Exception:
                pass

