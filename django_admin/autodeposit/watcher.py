#!/usr/bin/env python3
"""
Auto-deposit watcher: monitors a mailbox via IMAP for bank payment notifications
and auto-confirms matching deposit requests.

Configuration (bot_settings table or environment variables):
- autodeposit_enabled: '1' or '0'
- autodeposit_imap: IMAP hostname (e.g., 'imap.timeweb.ru' or 'mail.timeweb.ru')
- autodeposit_email: mailbox login
- autodeposit_password: mailbox password
- autodeposit_folder: mailbox folder to check (default: 'INBOX')
- autodeposit_bank: 'DEMIRBANK' (supported now)
- autodeposit_interval_sec: polling seconds (default: 60)
"""
import asyncio
import imaplib
import email
import os
import sqlite3
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

# Импорт парсера с резервом на разные пути импорта
try:
    # Явный путь в рамках проекта
    from django_admin.autodeposit.parsers import parse_demirbank_email
except Exception:
    try:
        # Пакетный относительный импорт, если модуль загружен как autodeposit.watcher
        from .parsers import parse_demirbank_email
    except Exception:
        try:
            # Абсолютный короткий импорт
            from autodeposit.parsers import parse_demirbank_email
        except Exception:
            import importlib
            parse_demirbank_email = importlib.import_module('django_admin.autodeposit.parsers').parse_demirbank_email

logger = logging.getLogger(__name__)

# Defaults for IMAP (Timeweb)
DEFAULT_IMAP_HOST = 'imap.timeweb.ru'
DEFAULT_IMAP_FOLDER = 'INBOX'
DEFAULT_IMAP_BANK = 'DEMIRBANK'
DEFAULT_INTERVAL_SEC = 60

# Глобальный экземпляр watcher для внешнего использования
_global_watcher_instance = None

def set_watcher_instance(watcher):
    """Устанавливает глобальный экземпляр watcher для внешнего использования"""
    global _global_watcher_instance
    _global_watcher_instance = watcher

def get_watcher_instance():
    """Получает глобальный экземпляр watcher"""
    return _global_watcher_instance

def trigger_immediate_check():
    """Внешняя функция для немедленной проверки почты (используется из Django)"""
    watcher = get_watcher_instance()
    if watcher:
        try:
            watcher.check_mailbox_now()
        except Exception as e:
            logger.error(f"Error triggering immediate check: {e}")
    else:
        logger.debug("Watcher instance not available, skipping immediate check")


class AutoDepositWatcher:
    def __init__(self, db_path: str, bot, loop=None):
        self.db_path = db_path
        self.bot = bot
        self.loop = loop
        self._task = None
        self._stop_event = asyncio.Event()
        # Устанавливаем глобальный экземпляр при создании
        set_watcher_instance(self)

    async def start(self):
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop())
        logger.info("AutoDepositWatcher started")

    async def stop(self):
        if self._task:
            self._stop_event.set()
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except asyncio.TimeoutError:
                logger.warning("AutoDepositWatcher stop timeout")

    def _get_setting(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """ENV first, then SQLite; if unavailable, return default without noise."""
        env_key = key.upper()
        if env_key in os.environ:
            return os.environ.get(env_key)
        try:
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute("SELECT value FROM bot_settings WHERE key=?", (key,))
            row = cur.fetchone()
            conn.close()
            if row and row[0] is not None:
                return str(row[0])
        except Exception as e:
            if 'no such table' not in str(e).lower():
                logger.debug(f"AutoDepositWatcher: settings fallback for {key}: {e}")
        return default

    def _get_requisite_credentials(self) -> Tuple[Optional[str], Optional[str]]:
        """Возвращает (email, password) из активного реквизита из PostgreSQL через Django ORM."""
        try:
            # Импортируем только внутри функции, чтобы не было проблем при старте
            from django.apps import apps
            if not apps.ready:
                return None, None
            
            from bot_control.models import BotRequisite
            active_requisite = BotRequisite.objects.filter(is_active=True).first()
            if active_requisite:
                email = (active_requisite.email or '').strip() or None
                password = (active_requisite.password or '').strip() or None
                return email, password
        except Exception as e:
            logger.warning(f"AutoDepositWatcher: cannot get requisite credentials: {e}")
        return None, None

    async def _run_loop(self):
        while not self._stop_event.is_set():
            try:
                enabled = self._get_setting('autodeposit_enabled', '1')
                if str(enabled) != '1':
                    await asyncio.sleep(30)
                    continue

                host = self._get_setting('autodeposit_imap') or DEFAULT_IMAP_HOST
                # email/password только из активного реквизита
                user, password = self._get_requisite_credentials()
                # Infer host for common providers if missing
                if not host and user:
                    try:
                        domain = user.split('@', 1)[1].lower()
                        if domain == 'gmail.com':
                            host = 'imap.gmail.com'
                        elif domain in ('mail.ru', 'inbox.ru', 'bk.ru', 'list.ru'):
                            host = 'imap.mail.ru'
                        elif domain in ('yandex.ru', 'ya.ru', 'yandex.com'):
                            host = 'imap.yandex.com'
                    except Exception:
                        pass

                folder = self._get_setting('autodeposit_folder', DEFAULT_IMAP_FOLDER)
                bank = DEFAULT_IMAP_BANK
                interval = int(self._get_setting('autodeposit_interval_sec', str(DEFAULT_INTERVAL_SEC)) or str(DEFAULT_INTERVAL_SEC))
                use_idle = str(self._get_setting('autodeposit_idle', '1')) == '1'
                keepalive_sec = int(self._get_setting('autodeposit_keepalive_sec', '60') or '60')

                if not (host and user and password):
                    logger.warning("AutoDepositWatcher: IMAP credentials are not set; sleeping")
                    await asyncio.sleep(30)
                    continue

                if use_idle:
                    try:
                        # run IDLE with configurable keepalive
                        await asyncio.to_thread(self._idle_loop, host, user, password, folder, bank, keepalive_sec)
                    except Exception as e:
                        logger.error(f"AutoDepositWatcher IDLE error, falling back to polling: {e}")
                        # immediate fallback poll
                        await asyncio.to_thread(self._check_mailbox_once, host, user, password, folder, bank)
                    # minimal pause to yield control
                    await asyncio.sleep(0.2)
                else:
                    # Run blocking IMAP in a thread to not block event loop
                    await asyncio.to_thread(self._check_mailbox_once, host, user, password, folder, bank)
                    await asyncio.sleep(max(0.2, min(interval, 1)))
            except Exception as e:
                logger.error(f"AutoDepositWatcher loop error: {e}")
                await asyncio.sleep(10)

    def _idle_loop(self, host: str, user: str, password: str, folder: str, bank: str, keepalive_sec: int = 600):
        """IMAP IDLE loop: keep a connection open and react to new messages instantly.
        keepalive_sec: how long to keep IDLE before restarting to avoid timeouts.
        """
        mail = None
        try:
            mail = imaplib.IMAP4_SSL(host)
            mail.login(user, password)
            mail.select(folder)

            import time
            start = time.time()
            while not self._stop_event.is_set():
                # Enter IDLE
                tag = mail._new_tag()
                mail.send(f"{tag} IDLE\r\n".encode())
                # Wait for server continuation
                mail._get_line()

                # Wait for responses or timeout
                mail.sock.settimeout(keepalive_sec)
                got_exists = False
                try:
                    # Read one server response line (e.g., * n EXISTS)
                    resp = mail._get_line()
                    if b'EXISTS' in resp or b'RECENT' in resp:
                        got_exists = True
                except Exception:
                    # timeout or disconnect; we will restart IDLE
                    pass

                # Exit IDLE
                mail.send(b'DONE\r\n')
                # Drain tagged completion
                try:
                    mail._get_line()
                except Exception:
                    pass

                if got_exists:
                    # Process unseen
                    self._check_mailbox_once(host, user, password, folder, bank)
                    # update health: last_idle_at
                    try:
                        self._update_health('last_idle_at')
                    except Exception:
                        pass

                # Periodically renew connection to avoid server timeouts
                if time.time() - start > keepalive_sec:
                    start = time.time()
        except Exception as e:
            logger.error(f"AutoDepositWatcher IDLE loop error: {e}")
        finally:
            try:
                if mail:
                    mail.logout()
            except Exception:
                pass

    # ========= Logging and Health =========
    def _ensure_log_tables(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute('''
                CREATE TABLE IF NOT EXISTS autodeposit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bank TEXT,
                    amount REAL,
                    matched INTEGER DEFAULT 0, -- 1 matched, 0 miss
                    note TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            cur.execute('''
                CREATE TABLE IF NOT EXISTS autodeposit_health (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # Indexes
            cur.execute('CREATE INDEX IF NOT EXISTS idx_autodeposit_log_bank ON autodeposit_log(bank)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_autodeposit_log_created ON autodeposit_log(created_at)')
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Ensure log tables failed: {e}")

    def _log_event(self, *, bank: str, amount: Optional[float], matched: int, note: str = ''):
        self._ensure_log_tables()
        try:
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute(
                'INSERT INTO autodeposit_log (bank, amount, matched, note) VALUES (?,?,?,?)',
                (bank, amount, matched, note)
            )
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Log insert failed: {e}")

    def _update_health(self, key: str):
        self._ensure_log_tables()
        try:
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute(
                "INSERT OR REPLACE INTO autodeposit_health (key, value, updated_at) VALUES (?, datetime('now'), CURRENT_TIMESTAMP)",
                (key,)
            )
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Health update failed: {e}")

    def check_mailbox_now(self):
        """Публичный метод для немедленной проверки почты (используется при создании заявки)"""
        enabled = self._get_setting('autodeposit_enabled', '1')
        if str(enabled) != '1':
            logger.debug("AutoDepositWatcher: disabled, skipping immediate check")
            return

        host = self._get_setting('autodeposit_imap') or DEFAULT_IMAP_HOST
        user = self._get_setting('autodeposit_email')
        password = self._get_setting('autodeposit_password')
        # Fallback to active requisite credentials if not provided in settings
        if not user or not password:
            rq_email, rq_password = self._get_requisite_credentials()
            user = user or rq_email
            password = password or rq_password
        
        # Infer host for common providers if missing
        if not host and user:
            try:
                domain = user.split('@', 1)[1].lower()
                if domain == 'gmail.com':
                    host = 'imap.gmail.com'
                elif domain in ('mail.ru', 'inbox.ru', 'bk.ru', 'list.ru'):
                    host = 'imap.mail.ru'
                elif domain in ('yandex.ru', 'ya.ru', 'yandex.com'):
                    host = 'imap.yandex.com'
            except Exception:
                pass

        folder = self._get_setting('autodeposit_folder', DEFAULT_IMAP_FOLDER)
        bank = DEFAULT_IMAP_BANK

        if not (host and user and password):
            logger.warning("AutoDepositWatcher: IMAP credentials are not set for immediate check")
            return

        # Запускаем проверку в отдельном потоке, чтобы не блокировать
        try:
            import threading
            thread = threading.Thread(
                target=self._check_mailbox_once,
                args=(host, user, password, folder, bank),
                daemon=True
            )
            thread.start()
            logger.info("AutoDepositWatcher: immediate check triggered")
        except Exception as e:
            logger.error(f"AutoDepositWatcher: error starting immediate check: {e}")

    def _check_mailbox_once(self, host: str, user: str, password: str, folder: str, bank: str):
        mail = None
        try:
            mail = imaplib.IMAP4_SSL(host)
            mail.login(user, password)
            mail.select(folder)

            # Search recent unseen messages
            status, data = mail.search(None, '(UNSEEN)')
            if status != 'OK':
                return

            for num in data[0].split():
                try:
                    status, msg_data = mail.fetch(num, '(RFC822)')
                    if status != 'OK':
                        continue
                    raw_email = msg_data[0][1]
                    msg = email.message_from_bytes(raw_email)
                    body = self._get_email_body(msg)

                    parsed = parse_demirbank_email(body)

                    if not parsed:
                        continue

                    amount, iso_dt = parsed
                    logger.info(f"AutoDepositWatcher parsed email: bank=DEMIRBANK amount={amount} dt={iso_dt}")
                    
                    # Сохраняем все поступления в Django БД (IncomingPayment)
                    try:
                        from django.apps import apps
                        from django.utils import timezone
                        from datetime import datetime
                        
                        # Пробуем импортировать модель
                        try:
                            IncomingPayment = apps.get_model('bot_control', 'IncomingPayment')
                            
                            # Парсим дату из ISO формата
                            payment_date = timezone.now()
                            if iso_dt:
                                try:
                                    payment_date = datetime.fromisoformat(iso_dt.replace('Z', '+00:00'))
                                    if timezone.is_naive(payment_date):
                                        payment_date = timezone.make_aware(payment_date)
                                except Exception:
                                    payment_date = timezone.now()
                            
                            # Создаем запись о поступлении
                            IncomingPayment.objects.create(
                                amount=amount,
                                bank='demirbank',
                                payment_date=payment_date,
                                notification_text=body[:500],  # Первые 500 символов
                                is_processed=False
                            )
                            logger.info(f"✅ Сохранено поступление в БД: {amount} сом от {iso_dt}")
                        except Exception as e:
                            logger.warning(f"⚠️ Не удалось сохранить поступление в Django БД: {e}")
                    except Exception as e:
                        logger.warning(f"⚠️ Ошибка при сохранении поступления: {e}")
                    
                    # Небольшая задержка, чтобы дать времени хендлерам записать заявку в БД
                    try:
                        import time
                        time.sleep(2)
                    except Exception:
                        pass

                    # Try match to pending request in DB
                    matched = self._match_and_confirm(amount)
                    if matched:
                        # Mark as seen (already default) and add a flag
                        mail.store(num, '+FLAGS', '\\Seen')
                        # Log success
                        self._log_event(bank='DEMIRBANK', amount=amount, matched=1, note='matched')
                    else:
                        # leave unseen for manual check
                        # Log miss
                        self._log_event(bank='DEMIRBANK', amount=amount, matched=0, note='no_match')
                except Exception as e:
                    logger.error(f"AutoDepositWatcher message error: {e}")
                    try:
                        self._log_event(bank=bank, amount=None, matched=0, note=f'error:{e}')
                    except Exception:
                        pass
        except Exception as e:
            logger.error(f"AutoDepositWatcher IMAP error: {e}")
        finally:
            try:
                if mail:
                    mail.logout()
            except Exception:
                pass

    def _get_email_body(self, msg: email.message.EmailMessage) -> str:
        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                cdisp = str(part.get('Content-Disposition'))
                if ctype == 'text/plain' and 'attachment' not in cdisp:
                    charset = part.get_content_charset() or 'utf-8'
                    return part.get_payload(decode=True).decode(charset, errors='ignore')
            # fallback to first text/html
            for part in msg.walk():
                if part.get_content_type() == 'text/html':
                    charset = part.get_content_charset() or 'utf-8'
                    return part.get_payload(decode=True).decode(charset, errors='ignore')
            return ''
        else:
            charset = msg.get_content_charset() or 'utf-8'
            return msg.get_payload(decode=True).decode(charset, errors='ignore')

    def _match_and_confirm(self, amount: float) -> bool:
        """Find a single pending request with matching amount and confirm via API."""
        try:
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            # Ищем заявки за последние 5 минут (вместо 24 часов)
            cur.execute(
                '''SELECT id, user_id, bookmaker, account_id, amount FROM requests
                   WHERE request_type='deposit' AND status='pending' AND created_at >= datetime('now', '-5 minutes')
                   ORDER BY created_at DESC'''
            )
            rows = cur.fetchall()
            conn.close()

            # Match by exact amount (rounded to 2 decimals), no tolerance as requested
            candidates = []
            src_amt = round(float(amount), 2)
            for r in rows:
                rid, uid, bookmaker, account_id, amt = r
                if amt is None:
                    continue
                if round(float(amt), 2) == src_amt:
                    candidates.append((rid, uid, bookmaker, account_id, amt))

            if not candidates:
                logger.info(f"AutoDepositWatcher: no exact match for amount {amount}; skipping")
                return False

            # If multiple exact matches, take the most recent (rows are ordered by created_at DESC)
            rid, uid, bookmaker, account_id, amt = candidates[0]
            if not account_id or str(account_id) == str(uid):
                # fallback from user_data
                try:
                    from database import Database
                    db = Database(self.db_path)
                    acc = db.get_user_data(uid, 'id', bookmaker)
                    if acc:
                        account_id = acc
                except Exception:
                    pass

            if not account_id or str(account_id) == str(uid):
                logger.warning(f"AutoDepositWatcher: request {rid} has invalid account_id; skip")
                return False

            # Confirm via shared API function
            try:
                # Фиксируем поступление денег от банка. Ждём чек от пользователя для окончательного пополнения.
                conn = sqlite3.connect(self.db_path)
                cur = conn.cursor()
                # Совместимость: добавим недостающие колонки при необходимости
                try:
                    cur.execute("ALTER TABLE requests ADD COLUMN bank_received INTEGER DEFAULT 0")
                except Exception:
                    pass
                try:
                    cur.execute("ALTER TABLE requests ADD COLUMN bank_received_at TIMESTAMP")
                except Exception:
                    pass
                try:
                    cur.execute("ALTER TABLE requests ADD COLUMN auto_completed INTEGER DEFAULT 0")
                except Exception:
                    pass
                conn.commit()

                # Отмечаем поступление
                cur.execute(
                    "UPDATE requests SET bank_received=1, bank_received_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    (rid,)
                )
                conn.commit()

                # Если чек уже получен, завершаем сразу
                cur.execute("SELECT COALESCE(receipt_received,0), admin_chat_id, admin_message_id FROM requests WHERE id=?", (rid,))
                r2 = cur.fetchone()
                receipt_received = (r2[0] == 1) if r2 else False
                admin_chat_id = r2[1] if r2 else None
                admin_message_id = r2[2] if r2 else None
                conn.close()

                if receipt_received:
                    from handlers.api_handlers import process_deposit_via_api, send_deposit_processed
                    loop = self.loop or asyncio.get_event_loop()
                    fut1 = asyncio.run_coroutine_threadsafe(
                        process_deposit_via_api(bookmaker, str(account_id), float(amt)),
                        loop
                    )
                    result = fut1.result(timeout=30)
                    is_success = (result.get('success') == True or (result.get('data') or {}).get('Success') == True)
                    
                    conn = sqlite3.connect(self.db_path)
                    cur = conn.cursor()
                    
                    if not is_success:
                        # Ошибка API казино - ставим profile-5
                        logger.error(f"AutoDepositWatcher: API deposit failed for request {rid}")
                        cur.execute(
                            "UPDATE requests SET status='profile-5', updated_at=CURRENT_TIMESTAMP, processed_at=CURRENT_TIMESTAMP WHERE id=?",
                            (rid,)
                        )
                        conn.commit()
                        conn.close()
                        
                        # Синхронизируем статус profile-5 в Django
                        try:
                            from handlers.deposit_handlers import sync_to_django_admin
                            def _sync_error():
                                try:
                                    sync_to_django_admin(
                                        user_id=uid,
                                        username='',
                                        first_name='',
                                        bookmaker=bookmaker,
                                        amount=float(amt),
                                        account_id=str(account_id),
                                        photo_file_id='',
                                        status='profile-5',
                                        photo_file_url=None,
                                        request_type='deposit',
                                        auto_completed=0,
                                        status_detail='api_error'
                                    )
                                except Exception as _e:
                                    logger.warning(f"Watcher sync_to_django_admin (error) failed: {_e}")
                            fut_sync_err = asyncio.run_coroutine_threadsafe(asyncio.to_thread(_sync_error), loop)
                            fut_sync_err.result(timeout=10)
                        except Exception as e:
                            logger.warning(f"AutoDepositWatcher: site sync (error) failed: {e}")
                        
                        return False

                    # Успешное автопополнение - ставим autodeposit_success
                    cur.execute(
                        "UPDATE requests SET status='autodeposit_success', auto_completed=1, updated_at=CURRENT_TIMESTAMP, processed_at=CURRENT_TIMESTAMP WHERE id=?",
                        (rid,)
                    )
                    conn.commit()
                    conn.close()

                    # Уведомляем пользователя (передаём request_id для корректного времени обработки)
                    fut2 = asyncio.run_coroutine_threadsafe(
                        send_deposit_processed(self.bot, uid, float(amt), str(account_id), request_id=rid),
                        loop
                    )
                    fut2.result(timeout=30)

                    # Синхронизируем на сайт: отметим autodeposit_success
                    try:
                        from handlers.deposit_handlers import sync_to_django_admin
                        # Выполним синхронизацию в event loop, чтобы не блокировать
                        def _sync():
                            try:
                                sync_to_django_admin(
                                    user_id=uid,
                                    username='',
                                    first_name='',
                                    bookmaker=bookmaker,
                                    amount=float(amt),
                                    account_id=str(account_id),
                                    photo_file_id='',
                                    status='autodeposit_success',
                                    photo_file_url=None,
                                    request_type='deposit',
                                    auto_completed=1,
                                    status_detail='success'
                                )
                            except Exception as _e:
                                logger.warning(f"Watcher sync_to_django_admin failed: {_e}")
                        fut_sync = asyncio.run_coroutine_threadsafe(asyncio.to_thread(_sync), loop)
                        fut_sync.result(timeout=10)
                    except Exception as e:
                        logger.warning(f"AutoDepositWatcher: site sync failed: {e}")

                    # Обновляем сообщение админа: показываем подробности и внизу "Автопополнено"
                    try:
                        if admin_chat_id and admin_message_id:
                            # Рассчитаем длительность от created_at
                            try:
                                conn4 = sqlite3.connect(self.db_path)
                                cur4 = conn4.cursor()
                                cur4.execute("SELECT CAST(strftime('%s','now') - strftime('%s', created_at) AS INTEGER) FROM requests WHERE id=?", (rid,))
                                row4 = cur4.fetchone()
                                conn4.close()
                                secs = int(row4[0]) if row4 and row4[0] is not None else None
                            except Exception:
                                secs = None

                            duration_line = ""
                            if secs is not None:
                                secs_disp = max(1, int(secs))
                                duration_line = f"\n⏱ Время: {secs_disp}s"

                            details = (
                                f"Букмекер: {str(bookmaker).upper()}\n"
                                f"Сумма: {float(amt):.2f} cом\n"
                                f"ID счета: {account_id}"
                                f"{duration_line}\n\n"
                                f"✅ Автопополнено"
                            )

                            try:
                                fut3 = asyncio.run_coroutine_threadsafe(
                                    self.bot.edit_message_caption(
                                        chat_id=admin_chat_id,
                                        message_id=admin_message_id,
                                        caption=details,
                                        reply_markup=None
                                    ),
                                    loop
                                )
                                fut3.result(timeout=15)
                            except Exception:
                                fut4 = asyncio.run_coroutine_threadsafe(
                                    self.bot.edit_message_text(
                                        chat_id=admin_chat_id,
                                        message_id=admin_message_id,
                                        text=details,
                                        reply_markup=None
                                    ),
                                    loop
                                )
                                fut4.result(timeout=15)
                    except Exception as e:
                        logger.warning(f"AutoDepositWatcher: cannot update admin message for request {rid}: {e}")

                # Если чека ещё нет — просто ждём, дальше завершит процесс receipt-хендлер
                return True
            except Exception as e:
                logger.error(f"AutoDepositWatcher: exception marking bank_received: {e}")
                return False
            except Exception as e:
                logger.error(f"AutoDepositWatcher: exception during API confirm: {e}")
                return False
        except Exception as e:
            logger.error(f"AutoDepositWatcher match error: {e}")
