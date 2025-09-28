#!/usr/bin/env python3
"""
Хендлеры для пополнения счета - упрощенный процесс
"""
import logging
import random
import asyncio
from datetime import datetime
from aiogram import types, Dispatcher, F
from aiogram.fsm.context import FSMContext
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, FSInputFile
from aiogram.utils.keyboard import InlineKeyboardBuilder
from translations import get_translation
from config import BOOKMAKERS, BOT_TOKEN

logger = logging.getLogger(__name__)

async def update_payment_timer(message, user_id: int, amount: float, translations, db):
    """Обновляет таймер платежа каждую секунду"""
    try:
        timer_minutes = 5
        timer_seconds = 0
        total_seconds = timer_minutes * 60 + timer_seconds
        
        # Избегаем первой правки с тем же содержимым (5:00 уже показано в исходном сообщении)
        for remaining_seconds in range(total_seconds - 1, -1, -1):
            # Проверяем, не изменилось ли состояние пользователя
            current_state = db.get_user_data(user_id, 'current_state')
            if current_state != 'waiting_for_receipt':
                logger.info(f"Timer stopped for user {user_id}, state changed to: {current_state}")
                break
                
            # Вычисляем минуты и секунды
            mins = remaining_seconds // 60
            secs = remaining_seconds % 60
            
            # Обновляем подпись/текст таймера (сообщение может быть как текст, так и фото+caption)
            try:
                message_text = (
                    f"<b>💰 Сумма к оплате: {amount:.2f} сом</b>\n\n"
                    f"⏳ Время на оплату: <b>{mins}:{secs:02d}</b>\n\n"
                    f"<b>⚠️ Оплатите точно до копеек!</b>\n"
                    f"📸 Ждём фото чека после оплаты."
                )
                # Сначала пробуем редактировать caption (актуально для фото)
                try:
                    await message.edit_caption(
                        caption=message_text,
                        reply_markup=message.reply_markup,
                        parse_mode="HTML"
                    )
                except Exception as e_inner:
                    # Если это не медиа — редактируем текст
                    await message.edit_text(
                        message_text,
                        reply_markup=message.reply_markup,
                        parse_mode="HTML"
                    )
            except Exception as e:
                # Игнорируем "message is not modified"
                if "message is not modified" in str(e).lower():
                    await asyncio.sleep(1)
                    continue
                # Игнорируем ошибку "there is no text in the message to edit" если ранее был успешный edit_caption
                if "there is no text in the message to edit" in str(e).lower():
                    await asyncio.sleep(1)
                    continue
                logger.error(f"Error updating timer message: {e}")
                break
                
            # Ждем 1 секунду
            await asyncio.sleep(1)
            
        # Если таймер истек — проверяем, не получен ли чек и не нужно ли продлить ожидание ещё на 5 минут
        if remaining_seconds == 0:
            try:
                import sqlite3
                # Выясняем путь БД так же, как во всех остальных местах
                try:
                    db_path = getattr(db, 'db_path') or ''
                except Exception:
                    db_path = ''
                if not db_path:
                    from pathlib import Path
                    bot_dir = Path(__file__).resolve().parent.parent
                    db_path = str(bot_dir / 'universal_bot.db')

                conn = sqlite3.connect(db_path)
                cur = conn.cursor()
                req_id = db.get_user_data(user_id, 'current_request_id')

                extended_wait = False
                seconds_left = 0
                if req_id:
                    # Обеспечим наличие совместимых колонок
                    try:
                        cur.execute("ALTER TABLE requests ADD COLUMN receipt_received INTEGER DEFAULT 0")
                    except Exception:
                        pass
                    try:
                        cur.execute("ALTER TABLE requests ADD COLUMN receipt_received_at TIMESTAMP")
                    except Exception:
                        pass
                    try:
                        cur.execute("ALTER TABLE requests ADD COLUMN pending_deadline TIMESTAMP")
                    except Exception:
                        pass
                    conn.commit()

                    # Проверим, есть ли продлённый дедлайн ожидания
                    cur.execute("SELECT COALESCE(receipt_received,0), pending_deadline FROM requests WHERE id=?", (int(req_id),))
                    row = cur.fetchone()
                    if row:
                        receipt_received, pending_deadline = row
                        if receipt_received and pending_deadline:
                            try:
                                cur.execute("SELECT CAST((strftime('%s', ?) - strftime('%s','now')) AS INTEGER)", (pending_deadline,))
                                seconds_left = cur.fetchone()[0] or 0
                                if seconds_left > 0:
                                    extended_wait = True
                            except Exception:
                                pass

                if extended_wait and seconds_left > 0:
                    # Продлеваем ожидание (без обратного отсчёта, чтобы не усложнять): ждём до pending_deadline
                    try:
                        await message.edit_text(
                            f"{message.text}\n\n⏳ Чек получен. Ждём подтверждение от банка...",
                            reply_markup=message.reply_markup
                        )
                    except Exception:
                        pass
                    # Ждём с проверкой состояния раз в 5 секунд
                    while seconds_left > 0:
                        current_state = db.get_user_data(user_id, 'current_state')
                        if current_state != 'waiting_for_receipt':
                            logger.info(f"Extended wait stopped for user {user_id}, state changed to: {current_state}")
                            break
                        await asyncio.sleep(min(5, seconds_left))
                        seconds_left -= 5

                # По итогам — переводим в ручную обработку, если ещё в pending
                try:
                    if req_id:
                        cur.execute(
                            "UPDATE requests SET status='awaiting_manual', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",
                            (int(req_id),)
                        )
                        conn.commit()
                except Exception as e:
                    logger.warning(f"Не удалось перевести заявку в awaiting_manual: {e}")
                finally:
                    conn.close()

                # Сообщаем пользователю об отмене и возвращаем в меню
                cancel_text = (
                    "⏳ Пополнение отменено, время оплаты прошло\n\n"
                    "❌Не переводите по старым реквизитам начинайте заного нажав на пополнить "
                )
                try:
                    await message.edit_text(
                        cancel_text,
                        reply_markup=None
                    )
                except Exception:
                    # если не удалось отредактировать, отправим новым сообщением
                    try:
                        await message.answer(cancel_text)
                    except Exception:
                        pass
                # Завершаем таймер и возвращаем главное меню
                db.save_user_data(user_id, 'current_state', '')
                try:
                    language2 = db.get_user_language(user_id)
                    from handlers.deposit_handlers import show_main_menu as _show_main_menu
                    await _show_main_menu(message, language2)
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"Error sending timer expired message: {e}")
            
    except Exception as e:
        logger.error(f"Error in payment timer: {e}")

async def send_deposit_request_to_group(bot, user_id: int, amount: float, bookmaker: str, id_value: str, photo_file_id: str = None, db=None):
    """Отправляет заявку на пополнение в группу админу
    db нужен для доступа к user_data (current_request_id), если доступен.
    """
    try:
        # Получаем информацию о пользователе
        user_info = await bot.get_chat(user_id)
        username = user_info.username or "Нет username"
        first_name = user_info.first_name or "Нет имени"
        
        # Получаем настройки букмекера
        bookmaker_config = BOOKMAKERS.get(bookmaker, {})
        group_id = bookmaker_config.get('deposit_group_id')
        
        if not group_id:
            logger.error(f"Не найден group_id для букмекера {bookmaker}")
            return False
            
        # Создаем текст заявки
        request_text = f"""
🔔 <b>Новая заявка на пополнение</b>

👤 <b>Пользователь:</b> @{username}
🆔 <b>ID:</b> {user_id}
🏢 <b>Букмекер:</b> {bookmaker_config.get('name', bookmaker.upper())}
💰 <b>Сумма:</b> {amount:.2f} сом
🆔 <b>ID счета:</b> {id_value}

⏰ <b>Время:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}
        """
        
        # Временная клавиатура (request_id подставим после сохранения в БД)
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="⏳ Сохраняем...", callback_data="noop")
            ]
        ])
        
        # Отправляем заявку в группу и сохраняем ссылку на сообщение
        if photo_file_id:
            sent_msg = await bot.send_photo(
                chat_id=group_id,
                photo=photo_file_id,
                caption=request_text,
                parse_mode="HTML",
                reply_markup=keyboard
            )
        else:
            sent_msg = await bot.send_message(
                chat_id=group_id,
                text=request_text,
                parse_mode="HTML",
                reply_markup=keyboard
            )
            
        # Сохраняем заявку в базу данных (если ранняя запись уже создана, то обновляем её, иначе создаём новую)
        try:
            import sqlite3
            import os
            from pathlib import Path
            # Используем тот же путь БД, что и объект db, чтобы не было рассинхрона с вотчером
            try:
                db_path = getattr(db, 'db_path') or ''
            except Exception:
                db_path = ''
            if not db_path:
                bot_dir = Path(__file__).resolve().parent.parent  # .../bot
                db_path = str(bot_dir / 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Создаем единую таблицу requests, если её нет
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    bookmaker TEXT,
                    account_id TEXT,
                    amount REAL NOT NULL DEFAULT 0,
                    request_type TEXT NOT NULL,            -- deposit | withdraw
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
            
            # Получим прямой URL к файлу от Telegram API (если есть), чтобы сохранить и в БД, и отправить на сайт
            photo_file_url = None
            if photo_file_id:
                try:
                    file_info = await bot.get_file(photo_file_id)
                    file_path = getattr(file_info, 'file_path', None)
                    if file_path:
                        photo_file_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"
                except Exception as e:
                    logger.warning(f"Не удалось получить file_path для чека: {e}")

            # Попробуем обновить уже созданную раннюю запись
            current_request_id = None
            try:
                if db is not None:
                    current_request_id = db.get_user_data(user_id, 'current_request_id')
            except Exception:
                current_request_id = None
            request_id = None
            if current_request_id:
                try:
                    cursor.execute('''
                        UPDATE requests
                        SET username=?, first_name=?, bookmaker=?, account_id=?, amount=?, photo_file_id=?, photo_file_url=?, updated_at=CURRENT_TIMESTAMP
                        WHERE id=?
                    ''', (username, first_name, bookmaker, id_value, amount, photo_file_id, photo_file_url, int(current_request_id)))
                    if cursor.rowcount > 0:
                        request_id = int(current_request_id)
                except Exception:
                    pass

            # Если обновить не удалось (например, не было ранней записи) — создаём новую
            if not request_id:
                cursor.execute('''
                    INSERT INTO requests
                    (user_id, username, first_name, bookmaker, account_id, amount, request_type, status, photo_file_id, photo_file_url)
                    VALUES (?, ?, ?, ?, ?, ?, 'deposit', 'pending', ?, ?)
                ''', (user_id, username, first_name, bookmaker, id_value, amount, photo_file_id, photo_file_url))
                request_id = cursor.lastrowid
                # сохраним в user_data для консистентности
                if request_id and db is not None:
                    try:
                        db.save_user_data(user_id, 'current_request_id', str(request_id))
                    except Exception:
                        pass
            # Если уже есть фото чека — отметим и продлим дедлайн ожидания ещё на 5 минут
            try:
                if photo_file_id:
                    cursor.execute(
                        "UPDATE requests SET receipt_received=1, receipt_received_at=CURRENT_TIMESTAMP, pending_deadline=datetime('now','+5 minutes') WHERE id=?",
                        (request_id,)
                    )
            except Exception:
                pass
            # Сохраняем связь с админ-сообщением
            try:
                cursor.execute(
                    'UPDATE requests SET admin_chat_id=?, admin_message_id=? WHERE id=?',
                    (group_id, getattr(sent_msg, 'message_id', None), request_id)
                )
            except Exception:
                pass
            conn.commit()
            conn.close()
            logger.info(f"✅ Заявка на пополнение сохранена в базу данных (id={request_id})")

            # Если банк уже подтвердил поступление (email получен ранее), завершим сразу после получения чека
            try:
                # Повторно открываем соединение только для чтения флага
                import sqlite3 as _sqlite3
                conn2 = _sqlite3.connect(db_path)
                cur2 = conn2.cursor()
                cur2.execute("SELECT COALESCE(bank_received,0) FROM requests WHERE id=?", (request_id,))
                row2 = cur2.fetchone()
                conn2.close()
                if row2 and int(row2[0]) == 1:
                    # Выполняем финальное пополнение через API и закрываем заявку
                    from handlers.api_handlers import process_deposit_via_api, send_deposit_processed
                    result = await process_deposit_via_api(bookmaker, str(id_value), float(amount))
                    is_success = (result.get('success') == True or (result.get('data') or {}).get('Success') == True)
                    if is_success:
                        conn3 = _sqlite3.connect(db_path)
                        cur3 = conn3.cursor()
                        # Обеспечим наличие столбца auto_completed
                        try:
                            cur3.execute("ALTER TABLE requests ADD COLUMN auto_completed INTEGER DEFAULT 0")
                        except Exception:
                            pass
                        cur3.execute(
                            "UPDATE requests SET status='completed', auto_completed=1, updated_at=CURRENT_TIMESTAMP, processed_at=CURRENT_TIMESTAMP WHERE id=?",
                            (request_id,)
                        )
                        conn3.commit()
                        # Снимем кнопки в админ-сообщении
                        try:
                            if group_id and getattr(sent_msg, 'message_id', None):
                                try:
                                    await bot.edit_message_caption(chat_id=group_id, message_id=sent_msg.message_id, caption="✅ Пополнено по чеку", reply_markup=None)
                                except Exception:
                                    await bot.edit_message_text(chat_id=group_id, message_id=sent_msg.message_id, text="✅ Пополнено по чеку", reply_markup=None)
                        except Exception:
                            pass
                        conn3.close()
                        # Синхронизируем на сайт: сразу completed
                        try:
                            sync_to_django_admin(
                                user_id=user_id,
                                username=message.from_user.username or '',
                                first_name=message.from_user.first_name or '',
                                bookmaker=bookmaker,
                                amount=float(amount),
                                account_id=str(id_value),
                                photo_file_id=photo_file_id or '',
                                status='completed',
                                photo_file_url=photo_file_url or None,
                                request_type='deposit'
                            )
                        except Exception as _e:
                            logger.warning(f"Auto-completed sync_to_django_admin failed: {_e}")
                        # Уведомим пользователя (привязываем к текущей заявке для корректного времени)
                        await send_deposit_processed(bot, user_id, float(amount), str(id_value), request_id=request_id)
            except Exception as e:
                logger.warning(f"Не удалось завершить по чеку при уже полученном письме: {e}")

            # Обновляем клавиатуру у отправленного сообщения: используем request_id
            try:
                new_keyboard = InlineKeyboardMarkup(inline_keyboard=[
                    [
                        InlineKeyboardButton(text="🔗 Обработать API", callback_data=f"process_api_deposit_{request_id}")
                    ],
                    [
                        InlineKeyboardButton(text="✅ Одобрить", callback_data=f"approve_deposit_{request_id}"),
                        InlineKeyboardButton(text="❌ Отклонить", callback_data=f"reject_deposit_{request_id}")
                    ]
                ])
                # В зависимости от типа сообщения редактируем markup
                if photo_file_id:
                    await bot.edit_message_reply_markup(chat_id=group_id, message_id=sent_msg.message_id, reply_markup=new_keyboard)
                else:
                    await bot.edit_message_reply_markup(chat_id=group_id, message_id=sent_msg.message_id, reply_markup=new_keyboard)
            except Exception as e:
                logger.warning(f"Не удалось обновить клавиатуру для заявки {request_id}: {e}")

            # Прокидываем данные заявки в память для API-обработчиков (чтобы там был правильный account_id)
            try:
                import handlers.api_handlers as api_handlers
                api_handlers.pending_requests[request_id] = {
                    'user_id': user_id,
                    'amount': amount,
                    'bookmaker': bookmaker,
                    'xbet_id': id_value,
                }
            except Exception as e:
                logger.warning(f"Не удалось записать pending_requests для {request_id}: {e}")
            
            # Автоматическая синхронизация с Django админкой
            try:
                sync_to_django_admin(user_id, username, first_name, bookmaker, amount, id_value, photo_file_id, 'pending', photo_file_url, request_type='deposit')
            except Exception as e:
                logger.error(f"❌ Ошибка синхронизации с Django админкой: {e}")
                
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения заявки в базу данных: {e}")
        
        logger.info(f"✅ Заявка на пополнение отправлена в группу {group_id}")
        return True
                
    except Exception as e:
        logger.error(f"❌ Ошибка отправки заявки в группу: {e}")
        return False

def sync_to_django_admin(user_id, username, first_name, bookmaker, amount, account_id, photo_file_id, status, photo_file_url=None, request_type: str = 'deposit', auto_completed: int = 0):
    """Автоматическая синхронизация заявки с Django админкой"""
    try:
        import requests
        import json
        import os
        
        # Данные для отправки
        data = {
            'user_id': user_id,
            'username': username or '',
            'first_name': first_name or '',
            'bookmaker': bookmaker,
            'amount': amount,
            'account_id': account_id,
            'receipt_photo': photo_file_id or '',
            'receipt_photo_url': photo_file_url or '',
            'status': status,
            'request_type': request_type,
            # Дополнительные подсказки для сайта, чтобы явно классифицировать как пополнение
            'type': 'deposit',
            'direction': 'in',
            'is_deposit': True
        }
        
        # URL админ-панели можно переопределить через переменную окружения DJANGO_ADMIN_URL
        # По умолчанию используем локальный сервер на http://localhost:8081 (как у тебя)
        base_url = os.getenv('DJANGO_ADMIN_URL', 'http://localhost:8081')
        endpoint = f"{base_url.rstrip('/')}/bot/api/bot/deposit-request/"

        # Отправляем POST запрос в Django API
        response = requests.post(endpoint, json=data, timeout=8)
        
        if response.status_code in (200, 201):
            logger.info(f"✅ Заявка синхронизирована с Django админкой")
        else:
            logger.error(f"❌ Ошибка синхронизации: {response.status_code} - {response.text}")
            
    except Exception as e:
        logger.error(f"❌ Ошибка синхронизации с Django: {e}")

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

async def start_deposit(message: types.Message, state: FSMContext = None, bookmaker: str = None, language: str = None, db = None, bookmakers = None):
    """Начало процесса пополнения - Шаг 1: Ввод ID"""
    if not all([bookmaker, language, db, bookmakers]):
        logger.error("Missing required parameters for start_deposit")
        return
        
    user_id = message.from_user.id
    translations = get_translation(language)
    
    # Сохраняем выбранный букмекер в базе данных
    db.save_user_data(user_id, 'current_bookmaker', bookmaker)
    
    # Получаем сохраненный ID пользователя для выбранного букмекера
    saved_id = db.get_user_data(user_id, 'id', bookmaker)
    
    # Создаем клавиатуру с сохраненным ID (если есть)
    rows = []
    if saved_id:
        rows.append([KeyboardButton(text=str(saved_id))])
    rows.append([KeyboardButton(text=translations.get('back_to_menu', '🔙 Назад'))])
    keyboard = ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)
    
    # Отправляем сообщение с предупреждением и клавиатурой
    # Подставляем выбранного букмекера (красивое имя из BOOKMAKERS)
    bookmaker_display = BOOKMAKERS.get(bookmaker, {}).get('name', (bookmaker or '').upper())
    text_template = translations.get(
        'deposit_instruction',
        '📱 Введите ваш ID {bookmaker_name}\n\n⚠️ Проверьте внимательно!\n\n❌ Ошибки не исправляются.'
    )
    text = text_template.format(bookmaker_name=bookmaker_display)
    
    # Отправляем фотку с примером ID (если файл существует)
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
            # Если возникла ошибка при загрузке, отправляем только текст
            await message.answer(text, reply_markup=keyboard)
    else:
        # Файл отсутствует — отправляем только текст без ошибки в логах
        await message.answer(text, reply_markup=keyboard)
    
    # Устанавливаем состояние
    db.save_user_data(user_id, 'current_state', 'waiting_for_id')

async def handle_id_input(message: types.Message, state: FSMContext, db, bookmakers):
    """Обработка ввода ID - переход к Шагу 2: Ввод суммы"""
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
        
        # Сохраняем ID для выбранного букмекера
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        db.save_user_data(user_id, 'id', text, bookmaker)
        
        # Переходим к вводу суммы
        keyboard = ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="🔙 Назад в меню")]],
            resize_keyboard=True
        )
        
        # Показываем текст с лимитами, подставляя введенный ID
        await message.answer(
            translations['enter_amount_with_limits'].format(account_id=text),
            reply_markup=keyboard
        )
        db.save_user_data(user_id, 'current_state', 'waiting_for_amount')
        
    except Exception as e:
        logger.error(f"Ошибка при обработке ID для пополнения: {e}")
        await message.answer("Произошла ошибка")
    
async def handle_amount_input(message: types.Message, state: FSMContext, db, bookmakers):
    """Обработка ввода суммы - переход к Шагу 3: Выбор банка"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        # Проверяем, не нажал ли пользователь "Назад"
        if text == "🔙 Назад в меню":
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return
        
        try:
            amount = float(text)
            if amount < 35 or amount > 100000:
                await message.answer("❌ Сумма должна быть от 35 до 100,000 KGS")
                return
        except ValueError:
            await message.answer("❌ Введите корректную сумму")
            return
        
        # Сохраняем сумму
        db.save_user_data(user_id, 'current_amount', str(amount))
        
        # Показываем банки для оплаты
        await show_bank_selection(message, amount, db, bookmakers)
        
    except Exception as e:
        logger.error(f"Ошибка при обработке суммы: {e}")
        await message.answer("Произошла ошибка")

async def show_bank_selection(message: types.Message, amount: float, db, bookmakers):
    """Показать выбор банка для оплаты - Шаг 3"""
    user_id = message.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    # Создаем сообщение с информацией о платеже с таймером
    import time
    import asyncio
    timer_minutes = 5
    timer_seconds = 0
    
    message_text = (
        f"<b>💰 Сумма к оплате: {amount:.2f} сом</b>\n\n"
        f"⏳ Время на оплату: <b>{timer_minutes}:{timer_seconds:02d}</b>\n\n"
        f"<b>⚠️ Оплатите точно до копеек!</b>\n"
        f"📸 Ждём фото чека после оплаты."
    )
    
    # Создаем инлайн клавиатуру с кнопками банков
    kb = InlineKeyboardBuilder()

    # Импортируем функции для работы с QR по фиксированному шаблону
    from qr_utils import (
        build_demirbank_qr_by_template,
        get_active_requisite_from_db,
        get_bank_links_by_type,
        enforce_amount_with_kopecks,
    )

    # Берем активный реквизит из БД
    active_req = get_active_requisite_from_db()
    if not active_req:
        await message.answer("❌ Не настроен активный реквизит для платежей. Обратитесь к администратору.")
        logger.error("Active requisite not found in DB")
        return

    # Гарантируем наличие копеек для уникальности суммы (улучшает авто-матчинг)
    try:
        amount = enforce_amount_with_kopecks(float(amount))
    except Exception:
        pass

    # Собираем QR строго по шаблону: меняем только реквизит и сумму
    try:
        fixed_qr_hash = build_demirbank_qr_by_template(requisite=active_req, amount=amount, static_qr=True)
    except Exception as e:
        logger.error(f"Failed to build QR by template: {e}")
        await message.answer("❌ Ошибка генерации QR. Попробуйте позже.")
        return

    # Генерируем ссылки для банков. Оставляем все КРОМЕ "Компаньон". Кнопку "Назад в меню" не добавляем.
    logger.info(f"[DEPOSIT] QR by template built: {fixed_qr_hash[:80]}...")
    bank_links = get_bank_links_by_type(fixed_qr_hash, 'DEMIRBANK')
    for service_name, link in bank_links.items():
        if service_name == "Компаньон":
            continue
        kb.button(text=service_name, url=link)
    kb.adjust(2)
    
    # Отправляем QR как фото + подпись с таймером и кнопками банков
    try:
        # Строим URL для генерации QR без локальных зависимостей (fallback, если нет локальной библиотеки qrcode)
        from urllib.parse import quote
        # По просьбе: кодируем в QR ссылку формата O! bank с нашим hash
        qr_payload = f"https://api.dengi.o.kg/ru/qr/#{fixed_qr_hash}"
        qr_url = f"https://quickchart.io/qr?text={quote(qr_payload)}&size=512&margin=2"
        sent_message = await message.answer_photo(
            qr_url,
            caption=message_text,
            reply_markup=kb.as_markup(),
            parse_mode="HTML"
        )
    except Exception:
        # Фолбэк: текстом, как раньше
        sent_message = await message.answer(
            message_text,
            reply_markup=kb.as_markup(),
            parse_mode="HTML"
        )
    
    # Сохраняем данные для последующего использования (с уже добавленными копейками)
    db.save_user_data(user_id, 'current_amount', str(amount))
    db.save_user_data(user_id, 'current_qr_hash', fixed_qr_hash)
    db.save_user_data(user_id, 'current_state', 'waiting_for_receipt')
    
    # РАНЕЕ создаем pending-заявку в единой таблице requests, чтобы авто-депозит смог сразу найти совпадение
    try:
        import sqlite3
        from pathlib import Path
        bookmaker = db.get_user_data(user_id, 'current_bookmaker') or '1xbet'
        account_id = db.get_user_data(user_id, 'id', bookmaker) or user_id
        # Используем тот же путь БД, что и объект db, чтобы не было рассинхрона с вотчером
        try:
            db_path = getattr(db, 'db_path') or ''
        except Exception:
            db_path = ''
        if not db_path:
            # Фолбэк: Абсолютный путь к БД рядом с папкой bot
            bot_dir = Path(__file__).resolve().parent.parent
            db_path = str(bot_dir / 'universal_bot.db')
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        # ensure table
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
                admin_chat_id INTEGER,
                admin_message_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                processed_at TIMESTAMP
            )
        ''')
        # username/first_name можно получить из бота при отправке в группу, здесь заполним по минимуму
        cur.execute('''
            INSERT INTO requests (user_id, bookmaker, account_id, amount, request_type, status)
            VALUES (?, ?, ?, ?, 'deposit', 'pending')
        ''', (user_id, bookmaker, str(account_id), float(amount)))
        request_id = cur.lastrowid
        conn.commit()
        conn.close()
        # сохраним request_id в user_data, чтобы потом обновить эту же запись и перевести в awaiting_manual при тайм-ауте
        if request_id:
            db.save_user_data(user_id, 'current_request_id', str(request_id))
        logger.info(f"[DEPOSIT] Pending request created early for auto-deposit matching (id={request_id}, amount={amount:.2f})")
    except Exception as e:
        logger.warning(f"Не удалось создать раннюю pending-заявку: {e}")
    
    # Запускаем таймер
    asyncio.create_task(update_payment_timer(sent_message, user_id, amount, translations, db))

async def process_receipt_photo(message: types.Message, db, bookmakers):
    """Обработка фото чека - финальный шаг"""
    try:
        user_id = message.from_user.id
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        # Получаем данные заявки
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        amount = float(db.get_user_data(user_id, 'current_amount'))
        id_value = db.get_user_data(user_id, 'id', bookmaker)
        
        try:
            # Получаем group_id из переданного словаря bookmakers
            group_id = bookmakers[bookmaker]['deposit_group_id']
            logger.info(f"Sending deposit request to group {group_id} for bookmaker {bookmaker}")
            
            # Генерируем уникальный ID заявки
            request_id = random.randint(1000, 9999)
            
            # Сохраняем данные заявки в словарь для API обработчиков
            import handlers.api_handlers as api_handlers
            api_handlers.pending_requests[request_id] = {
                'user_id': user_id,
                'amount': amount,
                'xbet_id': id_value,
                'bookmaker': bookmaker,
                'type': 'deposit'
            }
            
            # Проверяем, есть ли реферер у пользователя
            try:
                conn = db.db_path
                import sqlite3
                conn = sqlite3.connect(conn)
                cursor = conn.cursor()
                
                # Ищем реферера
                cursor.execute('SELECT referrer_id FROM referrals WHERE referred_id = ?', (user_id,))
                referrer_result = cursor.fetchone()
                
                if referrer_result:
                    referrer_id = referrer_result[0]
                    # Начисляем реферальную комиссию
                    from handlers.referral_handlers import add_referral_commission
                    add_referral_commission(db, referrer_id, user_id, amount, bookmaker)
                    logger.info(f"Added referral commission for {referrer_id} from {user_id} deposit {amount}")
                
                conn.close()
            except Exception as e:
                logger.error(f"Error processing referral commission: {e}")
            
            # Создаем текст заявки
            application_text = f"""
🔔 <b>Новая заявка на пополнение</b>

👤 <b>Пользователь:</b> @{message.from_user.username or 'без username'}
🆔 <b>ID:</b> <code>{id_value}</code>
🏢 <b>Букмекер:</b> {bookmakers[bookmaker]['name']}
💰 <b>Сумма:</b> {amount} сом
🆔 <b>ID заявки:</b> {request_id}
"""
                
            # Создаем клавиатуру с кнопками
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [
                    InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"approve_deposit_{request_id}"),
                    InlineKeyboardButton(text="❌ Отклонить", callback_data=f"reject_deposit_{request_id}")
                ],
                [
                    InlineKeyboardButton(text="🔗 Обработать API", callback_data=f"process_api_deposit_{request_id}")
                ]
            ])
            # Убираем прямую отправку в группу здесь, чтобы не было дублей.
            # Отправка заявки в группу выполняется ниже через send_deposit_request_to_group().
            
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
            
            success_message = translations['deposit_request_sent'].format(
                request_id=request_id,
                amount=amount,
                xbet_id=id_value
            )
            
            await message.answer(success_message, reply_markup=keyboard, parse_mode="HTML")
            # С этого момента должен стартовать секундомер для пользователя —
            # считаем длительность от времени отправки этого уведомления.
            try:
                import sqlite3 as _sqlite3
                db_path = getattr(db, 'db_path', '') or ''
                if db_path:
                    conn_upd = _sqlite3.connect(db_path)
                    cur_upd = conn_upd.cursor()
                    # Если ранее создавали раннюю pending-заявку, она сохранена в current_request_id
                    try:
                        early_req_id = db.get_user_data(user_id, 'current_request_id')
                    except Exception:
                        early_req_id = None
                    if early_req_id:
                        try:
                            cur_upd.execute(
                                "UPDATE requests SET created_at=CURRENT_TIMESTAMP WHERE id=?",
                                (int(early_req_id),)
                            )
                            conn_upd.commit()
                        except Exception:
                            pass
                    conn_upd.close()
            except Exception:
                pass
            
            # Отправляем заявку в группу админу (едиственная точка отправки)
            await send_deposit_request_to_group(
                bot=message.bot,
                user_id=user_id,
                amount=amount,
                bookmaker=bookmaker,
                id_value=id_value,
                photo_file_id=message.photo[-1].file_id if message.photo else None,
                db=db
            )
            
            # Очищаем состояние
            db.save_user_data(user_id, 'current_state', '')
            
        except Exception as e:
            logger.error(f"Ошибка отправки заявки на пополнение в группу: {e}")
            await message.answer("❌ Ошибка при отправке заявки. Попробуйте позже.")
        
    except Exception as e:
        logger.error(f"Ошибка при обработке фото чека: {e}")
        await message.answer("Произошла ошибка")

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None):
    """Регистрация обработчиков"""
    
    @dp.message(lambda message: message.text and db.get_user_data(message.from_user.id, 'current_state') == 'waiting_for_id')
    async def handle_id_input_handler(message: types.Message):
        """Обработка ввода ID для пополнения"""
        await handle_id_input(message, None, db, bookmakers)
    
    @dp.message(lambda message: message.text and db.get_user_data(message.from_user.id, 'current_state') == 'waiting_for_amount')
    async def handle_amount_input_handler(message: types.Message):
        """Обработка ввода суммы для пополнения"""
        await handle_amount_input(message, None, db, bookmakers)
    
    @dp.message(lambda message: message.photo and db.get_user_data(message.from_user.id, 'current_state') == 'waiting_for_receipt')
    async def handle_receipt_photo_handler(message: types.Message):
        """Обработка фото чека для пополнения"""
        await process_receipt_photo(message, db, bookmakers)