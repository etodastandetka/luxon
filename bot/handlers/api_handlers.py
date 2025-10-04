def _get_site_base() -> str:
    """Базовый URL сайта (Django), куда бот отправляет callback-уведомления.
    Источники, по приоритету:
    - DJANGO_BASE
    - SITE_BASE
    - Fallback: http://127.0.0.1:8000
    Примеры значений: https://xendro.pro, https://api.xendro.pro
    """
    base = os.getenv('DJANGO_BASE') or os.getenv('SITE_BASE') or 'http://127.0.0.1:8000'
    return base.rstrip('/')

"""
Обработчики API операций для бота
"""
import logging
import os
from typing import Dict
from aiogram import types, Dispatcher, F
import requests

from api_clients.onexbet_client import OneXBetAPIClient
from api_clients.melbet_client import MelbetAPIClient
from api_clients.onewin_client import OneWinAPIClient
from api_clients.mostbet_client import MostbetAPI
from config import BOOKMAKERS

logger = logging.getLogger(__name__)

# Глобальный словарь для хранения заявок
pending_requests = {}

def is_admin(user_id: int) -> bool:
    """Проверка, является ли пользователь админом"""
    # Здесь должна быть логика проверки админов
    # Пока возвращаем True для всех (для тестирования)
    return True

async def process_deposit_via_api(bookmaker: str, user_id: str, amount: float) -> Dict:
    """Пополнение через API для конкретного букмекера"""
    try:
        config = BOOKMAKERS.get(bookmaker, {}).get('api_config', {})
        if not config:
            return {"success": False, "error": f"Нет конфигурации для {bookmaker}"}
        
        # Создаем клиент в зависимости от букмекера
        if bookmaker == '1xbet':
            client = OneXBetAPIClient(config)
        elif bookmaker == 'melbet':
            client = MelbetAPIClient(config)
        elif bookmaker == '1win':
            client = OneWinAPIClient(config)
        elif bookmaker == 'mostbet':
            client = MostbetAPI(config)
        else:
            return {"success": False, "error": f"Неподдерживаемый букмекер: {bookmaker}"}
        
        # Выполняем пополнение
        if bookmaker == 'mostbet':
            result = await client.deposit_user(user_id, amount)
        else:
            result = client.deposit(user_id, amount)
        
        logger.info(f"API {bookmaker} результат: {result}")
        
        # Проверяем успешность операции
        is_success = (result.get('success') == True or 
                     result.get('data', {}).get('Success') == True)
        
        # Возвращаем результат с правильным флагом success
        if is_success:
            result['success'] = True
        else:
            result['success'] = False
            
        return result
        
    except Exception as e:
        logger.error(f"Ошибка API {bookmaker}: {e}")
        return {"success": False, "error": str(e)}

def _get_request_status(db_path: str, request_id: int) -> str:
    """Возвращает текущий статус заявки из БД. Если нет строки — пусто."""
    try:
        import sqlite3
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT status FROM requests WHERE id=?", (int(request_id),))
        row = cur.fetchone()
        conn.close()
        return (row[0] if row else '') or ''
    except Exception as e:
        logger.warning(f"_get_request_status error: {e}")
        return ''

def _set_request_status(db_path: str, request_id: int, status: str) -> None:
    """Проставляет статус в requests с отметкой времени."""
    try:
        import sqlite3
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute(
            "UPDATE requests SET status=?, updated_at=CURRENT_TIMESTAMP, processed_at=(CASE WHEN ? IN ('completed','rejected','auto_completed') THEN CURRENT_TIMESTAMP ELSE processed_at END) WHERE id=?",
            (status, status, int(request_id))
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"_set_request_status error: {e}")

def _notify_site_update_status(request_id: int, status: str, request_type: str = 'deposit') -> None:
    """Шлёт обновление статуса на сайт, чтобы UI мгновенно синхронизировался."""
    try:
        payload = {
            'request_type': request_type,
            'request_id': int(request_id),
            'status': status,
            'source': 'bot'
        }
        # URL сайта берём из окружения, fallback на локальный
        url = f"{_get_site_base()}/bot/api/bot/update-status/"
        r = requests.post(url, json=payload, timeout=5)
        logger.info(f"update-status -> {r.status_code} {r.text[:200]}")
    except Exception as e:
        logger.warning(f"Failed to notify site update-status: {e}")

def create_request_keyboard(request_id: int, request_type: str, bookmaker: str = "1xbet") -> types.InlineKeyboardMarkup:
    """Создает клавиатуру для заявки"""
    keyboard = types.InlineKeyboardMarkup(inline_keyboard=[
        [
            types.InlineKeyboardButton(text="✅ Одобрить", callback_data=f"approve_{request_type}_{request_id}"),
            types.InlineKeyboardButton(text="❌ Отклонить", callback_data=f"reject_{request_type}_{request_id}")
        ],
        [
            types.InlineKeyboardButton(text="🔗 Обработать API", callback_data=f"process_api_{request_type}_{request_id}")
        ]
    ])
    return keyboard

def create_api_processing_keyboard(request_id: int, bookmaker: str = "1xbet") -> types.InlineKeyboardMarkup:
    """Создает клавиатуру для обработки через API"""
    bookmaker_names = {
        '1xbet': '1XBET',
        'melbet': 'MELBET', 
        '1win': '1WIN',
        'mostbet': 'MOSTBET'
    }
    bookmaker_name = bookmaker_names.get(bookmaker, bookmaker.upper())
    
    keyboard = types.InlineKeyboardMarkup(inline_keyboard=[
        [
            types.InlineKeyboardButton(text=f"✅ API {bookmaker_name}", callback_data=f"api_confirm_{request_id}"),
            types.InlineKeyboardButton(text="❌ Отменить", callback_data=f"api_cancel_{request_id}")
        ]
    ])
    return keyboard

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None):
    """Регистрация обработчиков API"""
    logger.info("Регистрируем API обработчики")
    
    @dp.callback_query(F.data == "back_to_menu")
    async def handle_back_to_menu(callback: types.CallbackQuery):
        """Возврат в главное меню и очистка состояний по коллбэку back_to_menu."""
        try:
            user_id = callback.from_user.id
            # Очистка состояний пользователя в БД
            try:
                db.save_user_data(user_id, 'current_state', '')
                db.save_user_data(user_id, 'current_action', '')
                db.save_user_data(user_id, 'current_bookmaker', '')
                db.save_user_data(user_id, 'current_amount', '')
                db.save_user_data(user_id, 'current_qr_hash', '')
                db.save_user_data(user_id, 'qr_photo_id', '')
                db.save_user_data(user_id, 'withdraw_id', '')
                db.save_user_data(user_id, 'withdraw_code', '')
                db.save_user_data(user_id, 'selected_bank', '')
            except Exception:
                pass

            # Локализованный главный экран
            from translations import get_translation
            from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
            language = db.get_user_language(user_id)
            tr = get_translation(language)
            keyboard = ReplyKeyboardMarkup(
                keyboard=[
                    [KeyboardButton(text=tr['deposit']), KeyboardButton(text=tr['withdraw'])],
                    [KeyboardButton(text=tr['referral'])],
                    [KeyboardButton(text=tr['support']), KeyboardButton(text=tr['history'])],
                    [KeyboardButton(text=tr['faq']), KeyboardButton(text=tr['language'])]
                ],
                resize_keyboard=True
            )
            welcome_text = tr['welcome'].format(
                user_name=(callback.from_user.first_name or 'Пользователь'),
                admin_username='@luxon_support'
            )
            try:
                await callback.message.edit_reply_markup(reply_markup=None)
            except Exception:
                pass
            await callback.message.answer(welcome_text, reply_markup=keyboard, parse_mode='HTML')
            await callback.answer()
        except Exception as e:
            logger.error(f"Ошибка обработки back_to_menu: {e}")
            await callback.answer("❌ Ошибка", show_alert=True)
    
    @dp.callback_query(F.data.startswith("process_api_"))
    async def handle_process_api(callback: types.CallbackQuery):
        """Обработка кнопки 'Обработать API' для заявки"""
        if not is_admin(callback.from_user.id):
            await callback.answer("❌ Нет доступа")
            return
        
        try:
            parts = callback.data.split("_")
            request_type = parts[2]
            request_id = int(parts[3])
            
            if request_id not in pending_requests:
                # Пытаемся восстановить из БД (бот мог перезапуститься)
                try:
                    import sqlite3
                    conn = sqlite3.connect(db.db_path)
                    cur = conn.cursor()
                    cur.execute('''
                        SELECT user_id, amount, bookmaker, account_id
                        FROM requests
                        WHERE id = ? AND request_type = 'deposit'
                    ''', (request_id,))
                    row = cur.fetchone()
                    conn.close()
                    if row:
                        pending_requests[request_id] = {
                            'user_id': row[0],
                            'amount': row[1],
                            'bookmaker': (row[2] or '1xbet'),
                            'xbet_id': row[3] or row[0],
                        }
                    else:
                        await callback.answer("❌ Заявка не найдена в системе", show_alert=True)
                        return
                except Exception as e:
                    await callback.answer(f"❌ Ошибка восстановления заявки: {e}", show_alert=True)
                    return
            
            request_data = pending_requests[request_id]
            bookmaker = request_data.get('bookmaker', '1xbet')
            user_id_api = request_data.get('user_id')
            xbet_id = request_data.get('xbet_id', user_id_api)
            amount = request_data.get('amount')

            if request_type == "deposit":
                # Показать админам, что уйдет в API
                info_block = f"\n\n🧾 Проверка API\nБК: {bookmaker.upper()}\nAccount ID: {xbet_id}\nСумма: {amount}"
                try:
                    await callback.message.edit_caption(
                        caption=(callback.message.caption or '') + info_block,
                        reply_markup=create_api_processing_keyboard(request_id, bookmaker)
                    )
                except Exception:
                    await callback.message.edit_text(
                        (callback.message.text or '') + info_block,
                        reply_markup=create_api_processing_keyboard(request_id, bookmaker)
                    )
                await callback.answer("🔗 Проверьте данные и подтвердите API")
            else:
                await callback.answer("❌ API обработка доступна только для депозитов")
        
        except Exception as e:
            logger.error(f"Ошибка обработки API: {e}")
            await callback.answer("❌ Ошибка")

    @dp.callback_query(F.data.startswith("check_api_"))
    async def handle_check_api_legacy(callback: types.CallbackQuery):
        """Совместимость со старой кнопкой: check_api_<user_id>_<amount>
        Находим последнюю pending-заявку в таблице requests и продолжаем как process_api_.
        """
        try:
            parts = callback.data.split("_")
            # check_api_{user_id}_{amount}
            legacy_user_id = int(parts[2])
            try:
                legacy_amount = float(parts[3])
            except Exception:
                legacy_amount = None

            import sqlite3, time
            try:
                conn = sqlite3.connect(db.db_path)
                cur = conn.cursor()
                # Берём последнюю pending-заявку по пользователю (без жёсткой привязки к сумме)
                cur.execute('''
                    SELECT id, user_id, amount, bookmaker, account_id
                    FROM requests
                    WHERE request_type='deposit' AND status='pending' AND user_id=?
                    ORDER BY created_at DESC LIMIT 1
                ''', (legacy_user_id,))
                row = cur.fetchone()
                conn.close()

                if not row:
                    # Нет строки — создаём синтетическую pending-заявку в памяти
                    req_id = int(time.time())
                    bookmaker = '1xbet'
                    pending_requests[req_id] = {
                        'user_id': legacy_user_id,
                        'amount': legacy_amount or 0.0,
                        'bookmaker': bookmaker,
                        'xbet_id': legacy_user_id,
                    }
                    api_keyboard = create_api_processing_keyboard(req_id, bookmaker)
                    await callback.message.edit_reply_markup(reply_markup=api_keyboard)
                    await callback.answer("ℹ️ Заявка не найдена в БД. Используем быстрый режим. Нажмите 'API подтвердить'", show_alert=True)
                else:
                    req_id, u_id, amount, bookmaker, account_id = row
                    pending_requests[req_id] = {
                        'user_id': u_id,
                        'amount': amount,
                        'bookmaker': (bookmaker or '1xbet'),
                        'xbet_id': account_id or u_id,
                    }
                    api_keyboard = create_api_processing_keyboard(req_id, (bookmaker or '1xbet'))
                    await callback.message.edit_reply_markup(reply_markup=api_keyboard)
                    await callback.answer("🔗 Готово. Нажмите 'API подтвердить'", show_alert=False)
            except sqlite3.OperationalError as e:
                # Если таблицы нет — создаём синтетическую заявку, чтобы не блокировать процесс
                if 'no such table' in str(e).lower():
                    req_id = int(time.time())
                    bookmaker = '1xbet'
                    pending_requests[req_id] = {
                        'user_id': legacy_user_id,
                        'amount': legacy_amount or 0.0,
                        'bookmaker': bookmaker,
                        'xbet_id': legacy_user_id,
                    }
                    api_keyboard = create_api_processing_keyboard(req_id, bookmaker)
                    await callback.message.edit_reply_markup(reply_markup=api_keyboard)
                    await callback.answer("ℹ️ Таблица requests отсутствует. Используем быстрый режим. Нажмите 'API подтвердить'", show_alert=True)
                else:
                    raise
        except Exception as e:
            logger.error(f"Ошибка legacy check_api_: {e}")
            await callback.answer("❌ Ошибка обработки legacy-кнопки", show_alert=True)

    @dp.callback_query(F.data.startswith("confirm_deposit_"))
    async def handle_confirm_deposit_legacy(callback: types.CallbackQuery):
        """Совместимость со старой кнопкой: confirm_deposit_<user_id>_<amount>
        Сразу выполняет API-подтверждение депозита, используя последнюю pending-заявку,
        или синтетические данные при отсутствии таблицы requests.
        """
        try:
            parts = callback.data.split("_")
            legacy_user_id = int(parts[2])
            try:
                legacy_amount = float(parts[3])
            except Exception:
                legacy_amount = 0.0

            # Пытаемся найти реальную заявку
            import sqlite3
            bookmaker = '1xbet'
            xbet_id = legacy_user_id
            try:
                conn = sqlite3.connect(db.db_path)
                cur = conn.cursor()
                cur.execute('''
                    SELECT id, user_id, amount, bookmaker, account_id
                    FROM requests
                    WHERE request_type='deposit' AND status='pending' AND user_id=?
                    ORDER BY created_at DESC LIMIT 1
                ''', (legacy_user_id,))
                row = cur.fetchone()
                conn.close()
                if row:
                    _, u_id, amount, bookmaker_db, account_id = row
                    legacy_amount = amount or legacy_amount
                    bookmaker = bookmaker_db or bookmaker
                    xbet_id = account_id or u_id
                    # Если account_id пуст или равен TG ID — берём из user_data
                    if (not account_id) or (str(account_id) == str(u_id)):
                        try:
                            from database import Database
                            db_local = Database(db.db_path)
                            acc_from_user_data = db_local.get_user_data(u_id, 'id', bookmaker)
                            if acc_from_user_data:
                                xbet_id = acc_from_user_data
                        except Exception:
                            pass
            except sqlite3.OperationalError:
                # нет таблицы — работаем с тем, что пришло
                pass

            # Выполняем API вызов
            # Валидация: не отправляем Telegram user_id как account_id в API
            if not xbet_id or str(xbet_id) == str(legacy_user_id):
                await callback.answer("❌ Account ID букмекера отсутствует. Укажите реальный ID аккаунта и отправьте заново.", show_alert=True)
                return

            result = await process_deposit_via_api(bookmaker, str(xbet_id), legacy_amount)
            is_success = (result.get('success') == True or result.get('data', {}).get('Success') == True)

            if is_success:
                # Уведомляем пользователя (без request_id, чтобы не показывать неверную длительность)
                await send_deposit_processed(callback.bot, legacy_user_id, legacy_amount, str(xbet_id), request_id=None)
                # Синхронизация с сайтом и БД: отметим как completed
                try:
                    # 1) Обновим unified requests: если id найден — используем его, иначе попробуем найти последнюю pending-заявку ещё раз
                    try:
                        real_req_id = None
                        if isinstance(req_id, int):
                            real_req_id = req_id
                        else:
                            # попытка донайти по пользователю
                            conn2 = sqlite3.connect(db.db_path)
                            cur2 = conn2.cursor()
                            cur2.execute('''
                                SELECT id FROM requests 
                                WHERE request_type='deposit' AND status='pending' AND user_id=?
                                ORDER BY created_at DESC LIMIT 1
                            ''', (legacy_user_id,))
                            row2 = cur2.fetchone()
                            conn2.close()
                            if row2:
                                real_req_id = int(row2[0])
                        if real_req_id:
                            _set_request_status(db.db_path, real_req_id, 'completed')
                            _notify_site_update_status(real_req_id, 'completed', 'deposit')
                    except Exception as _e:
                        logger.warning(f"Could not set status in unified requests: {_e}")
                    # 2) Для обратной совместимости — дергаем старую синхронизацию (создание/обновление записи на сайте)
                    try:
                        from handlers.deposit_handlers import sync_to_django_admin
                        sync_to_django_admin(
                            user_id=legacy_user_id,
                            username='',
                            first_name='',
                            bookmaker=bookmaker,
                            amount=legacy_amount,
                            account_id=str(xbet_id),
                            photo_file_id='',
                            status='completed',
                            photo_file_url=None,
                            request_type='deposit'
                        )
                    except Exception:
                        pass
                except Exception as e:
                    logger.warning(f"Sync to Django after legacy confirm failed: {e}")
                # Обновляем сообщение админа
                try:
                    await callback.message.edit_caption(
                        caption=(callback.message.caption or '') + f"\n\n🌐 API подтверждено ({bookmaker.upper()})\n💰 Сумма: {legacy_amount} сом",
                        reply_markup=None
                    )
                except Exception:
                    await callback.message.edit_text(
                        (callback.message.text or '') + f"\n\n🌐 API подтверждено ({bookmaker.upper()})\n💰 Сумма: {legacy_amount} сом",
                        reply_markup=None
                    )
                await callback.answer("✅ Депозит подтвержден")
            else:
                err = (
                    result.get('error')
                    or result.get('message')
                    or (result.get('data') or {}).get('Message')
                    or 'Неизвестная ошибка'
                )
                await callback.answer(f"❌ Ошибка API: {err}", show_alert=True)
        except Exception as e:
            logger.error(f"Ошибка legacy confirm_deposit_: {e}")
            await callback.answer("❌ Ошибка обработки confirm_deposit", show_alert=True)

    @dp.callback_query(F.data.startswith("api_confirm_"))
    async def handle_api_confirm(callback: types.CallbackQuery):
        """Обработка кнопки 'Подтвердить API' для пополнения"""
        if not is_admin(callback.from_user.id):
            await callback.answer("❌ Нет доступа")
            return
        
        try:
            parts = callback.data.split("_")
            request_id = int(parts[2])

            if request_id not in pending_requests:
                # Fallback восстановление из БД
                try:
                    import sqlite3
                    conn = sqlite3.connect(db.db_path)
                    cur = conn.cursor()
                    cur.execute('''
                        SELECT user_id, amount, bookmaker, account_id
                        FROM requests
                        WHERE id = ? AND request_type = 'deposit'
                    ''', (request_id,))
                    row = cur.fetchone()
                    conn.close()
                    if row:
                        pending_requests[request_id] = {
                            'user_id': row[0],
                            'amount': row[1],
                            'bookmaker': (row[2] or '1xbet'),
                            'xbet_id': row[3] or row[0],
                        }
                    else:
                        await callback.answer("❌ Заявка не найдена", show_alert=True)
                        return
                except Exception as e:
                    await callback.answer(f"❌ Ошибка восстановления заявки: {e}", show_alert=True)
                    return

            # Идемпотентность
            status_now = _get_request_status(db.db_path, request_id)
            if status_now and status_now != 'pending':
                await callback.answer(f"Заявка уже в статусе: {status_now}")
                try:
                    await callback.message.edit_reply_markup(reply_markup=None)
                except Exception:
                    pass
                return

            request_data = pending_requests.get(request_id) or {}
            user_id = request_data.get('user_id')
            amount = request_data.get('amount')
            bookmaker = request_data.get('bookmaker', '1xbet')
            xbet_id = request_data.get('xbet_id', user_id)
            # Если xbet_id выглядит как TG ID — пробуем дочитать из user_data
            if str(xbet_id) == str(user_id):
                try:
                    from database import Database
                    db_local = Database(db.db_path)
                    acc_from_user_data = db_local.get_user_data(user_id, 'id', bookmaker)
                    if acc_from_user_data:
                        xbet_id = acc_from_user_data
                except Exception:
                    pass
            
            logger.info(f"Обработка API пополнения: {bookmaker}, ID: {xbet_id}, сумма: {amount}")

            # Идемпотентность: если заявка уже не pending — блокируем
            try:
                status_now = _get_request_status(db.db_path, request_id)
                if status_now and status_now != 'pending':
                    await callback.answer(f"Заявка уже в статусе: {status_now}", show_alert=True)
                    try:
                        await callback.message.edit_reply_markup(reply_markup=None)
                    except Exception:
                        pass
                    return
            except Exception:
                pass
            
            # Пополняем баланс через API
            # Валидация: не отправляем Telegram user_id как account_id в API
            if not xbet_id or str(xbet_id) == str(user_id):
                await callback.answer("❌ Account ID букмекера отсутствует. Откройте заявку и убедитесь, что в ней указан реальный ID аккаунта.", show_alert=True)
                return


            result = await process_deposit_via_api(bookmaker, xbet_id, amount)
            
            # Проверяем успешность операции
            is_success = (result.get('success') == True or 
                         result.get('data', {}).get('Success') == True)
            
            if is_success:
                # Уведомляем пользователя с привязкой к заявке (корректное время)
                await send_deposit_processed(callback.bot, user_id, amount, xbet_id, request_id=request_id)
                # Проставим статус в БД и сообщим сайту
                _set_request_status(db.db_path, request_id, 'completed')
                _notify_site_update_status(request_id, 'completed', 'deposit')
                
                # Обновляем сообщение админа
                try:
                    await callback.message.edit_caption(
                        caption=(callback.message.caption or '') + f"\n\n{result.get('data', {}).get('Message') or ''}",
                        reply_markup=None
                    )
                except Exception:
                    # Если сообщение не медиа — редактируем текст
                    await callback.message.edit_text(
                        (callback.message.text or '') + f"\n\n🌐 Пополнение подтверждено через API {bookmaker.upper()}\n💰 Сумма: {amount} сом",
                        reply_markup=None
                    )
                
                # Удаляем заявку из словаря
                del pending_requests[request_id]
                
                await callback.answer(f"✅ Депозит подтвержден через API {bookmaker.upper()}")
            else:
                error_msg = (
                    result.get('error')
                    or result.get('message')
                    or (result.get('data') or {}).get('Message')
                    or 'Неизвестная ошибка'
                )
                await callback.answer(f"❌ Ошибка API: {error_msg}", show_alert=True)
                logger.error(f"Ошибка API пополнения: {error_msg}")
        
        except Exception as e:
            logger.error(f"Ошибка подтверждения API: {e}")
            await callback.answer("❌ Ошибка обработки", show_alert=True)

    @dp.callback_query(F.data.startswith("api_cancel_"))
    async def handle_api_cancel(callback: types.CallbackQuery):
        """Отмена API-подтверждения"""
        try:
            await callback.message.edit_reply_markup(reply_markup=None)
            await callback.answer("Отменено")
        except Exception as e:
            logger.error(f"Ошибка отмены API: {e}")
            await callback.answer("❌ Ошибка", show_alert=True)

    # Последний страхующий обработчик: логируем любые непойманные callback'и
    @dp.callback_query(lambda c: (c.data or '') and not (c.data.startswith('withdraw_bank_')
                                                        or c.data.startswith('approve_')
                                                        or c.data.startswith('reject_')
                                                        or c.data.startswith('process_api_')
                                                        or c.data.startswith('api_confirm_')
                                                        or c.data.startswith('api_cancel_')
                                                        or c.data.startswith('history_page_')
                                                        or c.data == 'history_back_to_menu'
                                                        or c.data == 'back_to_menu'))
    async def handle_unknown_callback(callback: types.CallbackQuery):
        data = callback.data or '<empty>'
        logger.warning(f"[API handlers] Unhandled callback: {data}")
        # По умолчанию просто отвечаем без алерта
        await callback.answer()
    @dp.callback_query(lambda c: c.data.startswith("approve_"))
    async def handle_approve(callback: types.CallbackQuery):
        """Обработка кнопки 'Одобрить'"""
        if not is_admin(callback.from_user.id):
            await callback.answer("❌ Нет доступа")
            return
        
        try:
            parts = callback.data.split("_")
            request_type = parts[1]
            request_id = int(parts[2])
            
            if request_id not in pending_requests:
                # Восстанавливаем заявку из БД (поддерживает deposit/withdraw)
                try:
                    import sqlite3
                    conn = sqlite3.connect(db.db_path)
                    cur = conn.cursor()
                    cur.execute('''
                        SELECT user_id, amount, bookmaker, account_id, COALESCE(request_type,'deposit')
                        FROM requests
                        WHERE id = ?
                    ''', (request_id,))
                    row = cur.fetchone()
                    conn.close()
                    if row:
                        pending_requests[request_id] = {
                            'user_id': row[0],
                            'amount': row[1],
                            'bookmaker': (row[2] or '1xbet'),
                            'xbet_id': row[3] or row[0],
                            'type': row[4]
                        }
                        # Переприсвоим тип из БД, если отличается
                        request_type = row[4]
                    else:
                        await callback.answer("❌ Заявка не найдена")
                        return
                except Exception as e:
                    await callback.answer(f"❌ Ошибка восстановления заявки: {e}", show_alert=True)
                    return
            
            # Идемпотентность
            status_now = _get_request_status(db.db_path, request_id)
            if status_now and status_now != 'pending':
                await callback.answer(f"Заявка уже в статусе: {status_now}")
                try:
                    await callback.message.edit_reply_markup(reply_markup=None)
                except Exception:
                    pass
                return

            request_data = pending_requests.get(request_id) or {}
            user_id = request_data.get('user_id')
            amount = request_data.get('amount')
            xbet_id = request_data.get('xbet_id', user_id)
            
            # Отправляем уведомление пользователю
            if request_type == "deposit":
                await send_deposit_processed(callback.bot, user_id, amount, xbet_id, request_id=request_id)
            else:
                await send_withdrawal_processed(callback.bot, user_id, amount, xbet_id)
            
            # Проставим статус в БД и сообщим сайту
            _set_request_status(db.db_path, request_id, 'completed')
            _notify_site_update_status(request_id, 'completed', request_type)

            # Обновляем сообщение админа
            try:
                await callback.message.edit_caption(
                    caption=(callback.message.caption or '') + "\n\n✅ Заявка одобрена",
                    reply_markup=None
                )
            except Exception:
                try:
                    await callback.message.edit_text(
                        (callback.message.text or '') + "\n\n✅ Заявка одобрена",
                        reply_markup=None
                    )
                except Exception:
                    pass
            
            # Удаляем заявку из словаря
            del pending_requests[request_id]
            
            await callback.answer("✅ Заявка одобрена")
            
        except Exception as e:
            logger.error(f"Ошибка одобрения: {e}")
            await callback.answer("❌ Ошибка")

    @dp.callback_query(lambda c: c.data.startswith("reject_"))
    async def handle_reject(callback: types.CallbackQuery):
        """Обработка кнопки 'Отклонить'"""
        if not is_admin(callback.from_user.id):
            await callback.answer("❌ Нет доступа")
            return
        
        try:
            parts = callback.data.split("_")
            request_type = parts[1]
            request_id = int(parts[2])
            
            # Восстанавливаем данные заявки, если их нет в памяти
            if request_id not in pending_requests:
                try:
                    import sqlite3
                    conn = sqlite3.connect(db.db_path)
                    cur = conn.cursor()
                    cur.execute('''
                        SELECT user_id, amount, bookmaker, account_id, COALESCE(request_type,'deposit')
                        FROM requests
                        WHERE id = ?
                    ''', (request_id,))
                    row = cur.fetchone()
                    conn.close()
                    if row:
                        pending_requests[request_id] = {
                            'user_id': row[0],
                            'amount': row[1],
                            'bookmaker': (row[2] or '1xbet'),
                            'xbet_id': row[3] or row[0],
                            'type': row[4]
                        }
                        # Переприсвоим тип из БД, если отличается
                        request_type = row[4]
                    else:
                        await callback.answer("❌ Заявка не найдена", show_alert=True)
                        return
                except Exception as e:
                    await callback.answer(f"❌ Ошибка восстановления заявки: {e}", show_alert=True)
                    return

            request_data = pending_requests.get(request_id) or {}
            user_id = request_data.get('user_id')
            amount = request_data.get('amount')
            xbet_id = request_data.get('xbet_id', user_id)

            # Уведомление пользователя об отклонении (единый читаемый формат)
            await send_deposit_rejected(callback.bot, user_id, amount, xbet_id, request_id=request_id)

            # Проставим статус в БД и сообщим сайту
            _set_request_status(db.db_path, request_id, 'rejected')
            _notify_site_update_status(request_id, 'rejected', request_type)

            # Обновляем сообщение админа
            try:
                await callback.message.edit_caption(
                    caption=(callback.message.caption or '') + "\n\n❌ Заявка отклонена",
                    reply_markup=None
                )
            except Exception:
                try:
                    await callback.message.edit_text(
                        (callback.message.text or '') + "\n\n❌ Заявка отклонена",
                        reply_markup=None
                    )
                except Exception:
                    pass
            
            # Удаляем заявку из словаря
            try:
                del pending_requests[request_id]
            except Exception:
                pass
            
            await callback.answer("❌ Заявка отклонена")
            
        except Exception as e:
            logger.error(f"Ошибка отклонения: {e}")
            await callback.answer("❌ Ошибка")

async def send_withdrawal_processed(bot, user_id: int, amount: float, xbet_id: str):
    """Отправляет уведомление о успешном выводе"""
    try:
        # Используем переводы, если доступны
        from translations import get_translation
        # Для этого вызова у нас нет языка напрямую, попытаемся отправить на русском формате
        try:
            # Пытаемся получить язык через ленивый импорт базы, если доступно
            from database import Database
            db = Database()
            language = db.get_user_language(user_id)
            tr = get_translation(language)
        except Exception:
            tr = get_translation('ru')

        text = tr.get('withdrawal_processed_message', "✅ Вывод средств выполнен!\n💰 Сумма: {amount} сом\n🆔 ID: {xbet_id}").format(
            amount=amount,
            xbet_id=xbet_id
        )
        await bot.send_message(chat_id=user_id, text=text)
    except Exception as e:
        logger.error(f"Ошибка отправки уведомления о выводе: {e}")

async def send_deposit_processed(bot, user_id: int, amount: float, xbet_id: str, request_id: int = None, duration_seconds: int = None):
    """Отправляет уведомление о успешном пополнении.
    Приоритет источника длительности:
    1) duration_seconds (явно передан из кода)
    2) По request_id: now - created_at
    3) Иначе — без строки времени
    Формат времени: "🕰️  15s"; если вычисленное значение > 600с, показываем "🕰️  10m+".
    """
    try:
        # Определяем duration_line
        duration_line = ""
        try:
            if duration_seconds is not None:
                secs = max(0, int(duration_seconds))
            elif request_id is not None:
                # Надёжно считаем разницу в секундах прямо в SQLite, чтобы избежать проблем с форматами дат
                from database import Database
                import sqlite3
                db = Database()
                conn = sqlite3.connect(db.db_path)
                cur = conn.cursor()
                try:
                    cur.execute("SELECT CAST(strftime('%s','now') - strftime('%s', created_at) AS INTEGER) FROM requests WHERE id=?", (int(request_id),))
                    row = cur.fetchone()
                    secs = int(row[0]) if row and row[0] is not None else None
                    if secs is not None and secs < 0:
                        secs = 0
                finally:
                    conn.close()
            else:
                secs = None

            if secs is not None:
                # Минимум 1s при почти мгновенной обработке
                secs_display = max(1, int(secs))
                # Нормализуем отображение: если слишком большое, показываем 10m+
                if secs_display > 600:
                    duration_line = "🕰️  10m+\n"
                else:
                    duration_line = f"🕰️  {secs_display}s\n"
        except Exception:
            duration_line = ""

        # Формат суммы: без копеек, если целое
        try:
            amt = float(amount or 0)
            amount_str = f"{amt:.0f} KGS" if abs(amt - round(amt)) < 1e-6 else f"{amt:.2f} KGS"
        except Exception:
            amount_str = f"{amount} KGS"

        text = (
            "✅ Зачисление выполнено\n\n"
            f"{duration_line}"
            f"🆔  {xbet_id}\n"
            f"💵  {amount_str}\n\n"
            "Спасибо, что выбираете наш сервис."
        )
        await bot.send_message(chat_id=user_id, text=text)
    except Exception as e:
        logger.error(f"Ошибка отправки уведомления о пополнении: {e}")

async def send_deposit_rejected(bot, user_id: int, amount: float, xbet_id: str, request_id: int = None, reason: str = None):
    """Отправляет уведомление об отклонении пополнения в едином формате."""
    try:
        # Формат суммы
        try:
            amt = float(amount or 0)
            amount_str = f"{amt:.0f} KGS" if abs(amt - round(amt)) < 1e-6 else f"{amt:.2f} KGS"
        except Exception:
            amount_str = f"{amount} KGS"

        reason_line = f"\n📝 Причина: {reason}" if (reason and str(reason).strip()) else ""
        text = (
            "❌ Пополнение отклонено\n\n"
            f"🆔  {xbet_id}\n"
            f"💵  {amount_str}{reason_line}\n\n"
            "Если это ошибка — свяжитесь с оператором: @operator_luxon"
        )
        await bot.send_message(chat_id=user_id, text=text)
    except Exception as e:
        logger.error(f"Ошибка отправки уведомления об отклонении: {e}")
