#!/usr/bin/env python3
"""
Универсальный бот для работы с букмекерами
"""
import logging
import asyncio
from aiogram import Bot, Dispatcher, types, F
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
import os

# Импорт обработчиков
from handlers import (
    start_handlers, 
    bookmaker_handlers,
    deposit_handlers, 
    withdraw_handlers,
    referral_handlers,
    support_handlers,
    language_handlers,
    faq_handlers,
    history_handlers,
)

from database import Database
from config import BOOKMAKERS, BOT_TOKEN as CONFIG_BOT_TOKEN
from autodeposit.watcher import AutoDepositWatcher
from translations import get_translation
from qr_utils import enforce_amount_with_kopecks
import random
from middleware.bot_status_middleware import BotStatusMiddleware

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UniversalBot:
    def __init__(self, token: str):
        self.bot = Bot(token=token)
        self.dp = Dispatcher(storage=MemoryStorage())
        self.db = Database()
        self.api_manager = None
        
        # Сначала регистрируем middleware (пауза/техработы), затем обработчики
        self._register_middleware()
        self._register_handlers()
    
    def _register_handlers(self):
        """Регистрация всех обработчиков"""
        # Register handlers
        start_handlers.register_handlers(self.dp, self.db, BOOKMAKERS, bot=self.bot)
        bookmaker_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        deposit_handlers.register_handlers(self.dp, self.db, BOOKMAKERS, self.api_manager)
        withdraw_handlers.register_handlers(self.dp, self.db, BOOKMAKERS, self.api_manager)
        referral_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        support_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        language_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        faq_handlers.register_handlers(self.dp, self.db, BOOKMAKERS)
        # Хендлеры истории: колбэки пагинации и возврат в меню
        try:
            history_handlers.register_handlers(self.dp, self.db, BOOKMAKERS, self.api_manager)
        except Exception as e:
            logger.warning(f"Failed to register history callbacks: {e}")

        # Регистрируем API обработчики
        import handlers.api_handlers as api_handlers
        api_handlers.register_handlers(self.dp, self.db, BOOKMAKERS, self.api_manager)
        
    def _get_enabled_sites(self):
        """Reads enabled bookmaker site keys from SQLite bot_settings (key='sites').
        Returns a set like {'melbet','1xbet','1win','mostbet'} or default with all.
        """
        try:
            import sqlite3, json
            conn = sqlite3.connect(self.db.db_path)
            cur = conn.cursor()
            cur.execute("SELECT value FROM bot_settings WHERE key='sites'")
            row = cur.fetchone()
            conn.close()
            if not row or not row[0]:
                return { 'melbet','1xbet','1win','mostbet' }
            lst = json.loads(row[0]) if isinstance(row[0], str) else []
            return set([str(x).lower() for x in (lst or [])]) or { 'melbet','1xbet','1win','mostbet' }
        except Exception:
            return { 'melbet','1xbet','1win','mostbet' }

    def _withdrawals_enabled(self) -> bool:
        """Reads withdrawals_enabled flag from SQLite bot_settings."""
        try:
            import sqlite3
            conn = sqlite3.connect(self.db.db_path)
            cur = conn.cursor()
            cur.execute("SELECT value FROM bot_settings WHERE key='withdrawals_enabled'")
            row = cur.fetchone()
            conn.close()
            if not row:
                return True
            return str(row[0]).strip() in ('1','true','True')
        except Exception:
            return True

    def _register_middleware(self):
        """Регистрация middleware"""
        # Включаем middleware статуса бота (пауза/техработы)
        try:
            # Передаем путь к БД, чтобы middleware читало bot_settings
            self.dp.message.middleware(BotStatusMiddleware(db_path=self.db.db_path))
            self.dp.callback_query.middleware(BotStatusMiddleware(db_path=self.db.db_path))
            logger.info("BotStatusMiddleware registered")
        except Exception as e:
            logger.error(f"Failed to register BotStatusMiddleware: {e}")

        # Обработка текстовых сообщений
        # Глобальный хендлер только для не-командных сообщений
        @self.dp.message(~F.text.startswith("/"))
        async def handle_all_messages(message: types.Message):
            """Handle all messages - text and photo"""
            user_id = message.from_user.id
            text = message.text
            language = self.db.get_user_language(user_id)
            translations = get_translation(language)

            # Глобальная кнопка "Назад в меню" должна работать как /start: очистка и возврат в меню
            try:
                if text in ("🔙 Назад в меню", translations.get('back_to_menu', '')):
                    try:
                        # Очистка состояний пользователя в БД
                        self.db.save_user_data(user_id, 'current_state', '')
                        self.db.save_user_data(user_id, 'current_action', '')
                        self.db.save_user_data(user_id, 'current_bookmaker', '')
                        self.db.save_user_data(user_id, 'current_amount', '')
                        self.db.save_user_data(user_id, 'current_qr_hash', '')
                        self.db.save_user_data(user_id, 'qr_photo_id', '')
                        self.db.save_user_data(user_id, 'withdraw_id', '')
                        self.db.save_user_data(user_id, 'withdraw_code', '')
                        self.db.save_user_data(user_id, 'selected_bank', '')
                    except Exception:
                        pass
                    await self._show_main_menu(message, language)
                    return
            except Exception:
                pass
            # Здесь команд уже быть не должно из-за фильтра, оставляем на всякий случай
            if text and text.startswith('/'):
                return
            # language уже определён выше

            # Глобальная проверка паузы на всякий случай (дополнительно к middleware)
            try:
                import sqlite3
                conn = sqlite3.connect(self.db.db_path)
                cur = conn.cursor()
                cur.execute("SELECT value FROM bot_settings WHERE key='is_active'")
                row = cur.fetchone()
                is_active = True if not row else bool(int(row[0]))
                if not is_active:
                    cur.execute("SELECT value FROM bot_settings WHERE key='maintenance_message'")
                    mm = cur.fetchone()
                    maintenance_message = mm[0] if (mm and mm[0]) else "🔧 Технические работы\nБот временно недоступен. Попробуйте позже."
                    conn.close()
                    await message.answer(maintenance_message)
                    return
                conn.close()
            except Exception:
                # В случае ошибки продолжаем обычную обработку
                pass
            
            # Save user
            self.db.save_user(
                user_id=user_id,
                username=message.from_user.username,
                first_name=message.from_user.first_name,
                last_name=message.from_user.last_name
            )
            
            # Обработка фото
            if message.photo:
                current_state = self.db.get_user_data(user_id, 'current_state')
                if current_state == 'waiting_for_receipt':
                    await self._process_receipt_photo(message)
                    return
                elif current_state == 'waiting_for_qr_photo':
                    await self._process_qr_photo(message)
                    return
                else:
                    translations = get_translation(language)
                    await message.answer(
                        f"📸 {translations['photo_not_expected']}\n\n"
                        f"ℹ️ {translations['follow_instructions']}"
                    )
                    await self._show_main_menu(message, language)
                    return
            
            # Get translations (уже получены выше)
            
            # Сначала проверяем состояние пользователя
            current_state = self.db.get_user_data(user_id, 'current_state')
            logger.info(f"User {user_id} current state: {current_state}")
            
            if current_state == 'waiting_for_id':
                # Обрабатываем ввод ID через deposit_handlers
                from handlers.deposit_handlers import handle_id_input
                await handle_id_input(message, None, self.db, BOOKMAKERS)
                return
            elif current_state == 'waiting_for_amount':
                # Обрабатываем ввод суммы
                logger.info(f"Processing amount input: {text}")
                try:
                    amount = float(text)
                    if amount <= 0:
                        await message.answer("❌ Сумма должна быть больше 0")
                        return
                    
                    logger.info(f"Amount validated: {amount}")
                    
                    # Сохраняем введённую сумму (рандомные копейки добавятся в _show_bank_selection)
                    self.db.save_user_data(user_id, 'current_amount', str(amount))
                    
                    logger.info(f"Calling deposit_handlers.show_bank_selection for amount: {amount}")
                    # Показываем банки для оплаты через общий хендлер
                    from handlers.deposit_handlers import show_bank_selection
                    await show_bank_selection(message, amount, self.db, BOOKMAKERS)
                    logger.info(f"Bank selection completed for user {user_id}")
                    return
                except ValueError:
                    await message.answer("❌ Введите корректную сумму")
                    return
                except Exception as e:
                    logger.error(f"Error processing amount: {e}")
                    await message.answer("❌ Ошибка при обработке суммы. Попробуйте еще раз.")
                    return
            elif current_state == 'waiting_for_receipt':
                await message.answer("📸 Пожалуйста, отправьте фото чека для подтверждения оплаты")
                return
            elif current_state == 'waiting_for_bank_selection':
                await message.answer("Пожалуйста, выберите банк для вывода из предложенных кнопок")
                return
            elif current_state == 'waiting_for_qr_photo':
                await message.answer("📱 Пожалуйста, отправьте фото QR-кода вашего кошелька")
                return
            elif current_state == 'waiting_for_withdraw_id':
                # Обрабатываем ввод ID для вывода через withdraw_handlers
                from handlers.withdraw_handlers import handle_withdraw_id_input
                await handle_withdraw_id_input(message, self.db, BOOKMAKERS)
                return
            elif current_state == 'waiting_for_withdraw_code':
                # Проверяем, не нажал ли пользователь кнопку главного меню
                if text in [translations['deposit'], translations['withdraw'], translations['referral'], translations['support'], translations['history'], translations['faq'], translations['language']]:
                    # Очищаем состояние и обрабатываем как обычную кнопку
                    self.db.save_user_data(user_id, 'current_state', '')
                    # Продолжаем обработку как обычное сообщение
                else:
                    # Обрабатываем ввод кода вывода через withdraw_handlers
                    from handlers.withdraw_handlers import handle_withdraw_code_input
                    await handle_withdraw_code_input(message, self.db, BOOKMAKERS)
                    return
            
            # Handle main menu buttons
            if text == translations['deposit'] or text == "💳 Пополнить":
                await self._handle_deposit(message)
            elif text == translations['withdraw'] or text == "💰 Вывести":
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
            # Обработка выбора букмекера
            elif text in ['1XBET', '1WIN', 'MELBET', 'MOSTBET', '🎯 1XBET', '🎲 MELBET', '🏆 1WIN', '🎯 MOSTBET']:
                # Определяем букмекера по тексту
                bookmaker_map = {
                    '1XBET': '1xbet',
                    'MELBET': 'melbet',
                    '1WIN': '1win',
                    'MOSTBET': 'mostbet',
                    '🎯 1XBET': '1xbet',
                    '🎲 MELBET': 'melbet',
                    '🏆 1WIN': '1win',
                    '🎯 MOSTBET': 'mostbet'
                }
                bookmaker = bookmaker_map.get(text, text.lower())
                await self._handle_bookmaker_selection(message, bookmaker, self.db.get_user_data(user_id, 'current_action'))
            else:
                # Локализованная обработка кнопок FAQ (чтобы не зависеть от порядка регистрации хендлеров)
                try:
                    supported_langs = ['ru', 'ky', 'uz']
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

                    # Если нажата любая из FAQ-кнопок — ответим сразу тут, чтобы не полагаться на порядок фильтров
                    if text in DEPOSIT_BUTTONS or text in WITHDRAW_BUTTONS or text in TIME_BUTTONS or text in IMPORTANT_BUTTONS:
                        # Сформируем повторную клавиатуру FAQ
                        kb = ReplyKeyboardMarkup(
                            keyboard=[
                                [KeyboardButton(text=translations['faq_deposit_button'])],
                                [KeyboardButton(text=translations['faq_withdraw_button'])],
                                [KeyboardButton(text=translations['faq_time_button'])],
                                [KeyboardButton(text=translations['faq_important_button'])],
                                [KeyboardButton(text=translations['back_to_menu'])]
                            ],
                            resize_keyboard=True
                        )
                        if text in DEPOSIT_BUTTONS:
                            await message.answer(translations['faq_deposit_steps'], reply_markup=kb, parse_mode="HTML")
                            return
                        if text in WITHDRAW_BUTTONS:
                            await message.answer(translations['faq_withdraw_steps'], reply_markup=kb, parse_mode="HTML")
                            return
                        if text in TIME_BUTTONS:
                            await message.answer(translations['faq_time_content'], reply_markup=kb, parse_mode="HTML")
                            return
                        if text in IMPORTANT_BUTTONS:
                            await message.answer(translations['faq_important_content'], reply_markup=kb, parse_mode="HTML")
                            return
                except Exception:
                    # В случае ошибок с переводами — просто вернём главное меню
                    await self._show_main_menu(message, language)
                    return

                # Неизвестная кнопка — вернём в главное меню
                await self._show_main_menu(message, language)
        
    
    async def _handle_deposit(self, message):
        """Handle deposit button"""
        logger.info(f"Deposit button pressed by user {message.from_user.id}")
        user_id = message.from_user.id
        self.db.save_user_data(user_id, 'current_action', 'deposit')
        await self._show_bookmaker_selection(message, 'deposit')
    
    async def _handle_withdraw(self, message):
        """Handle withdraw button"""
        logger.info(f"Withdraw button pressed by user {message.from_user.id}")
        user_id = message.from_user.id
        self.db.save_user_data(user_id, 'current_action', 'withdraw')
        # Глобальная блокировка выводов
        try:
            if not self._withdrawals_enabled():
                await message.answer("⛔ Выводы временно не работают. Попробуйте позже.")
                return
        except Exception:
            pass
        await self._show_bookmaker_selection(message, 'withdraw')
    
    async def _handle_referral(self, message):
        """Handle referral button"""
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        await referral_handlers.handle_referral(message, self.db)
    
    async def _handle_support(self, message):
        """Handle support button"""
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        await support_handlers.handle_support(message, language, self.db)
    
    async def _handle_history(self, message):
        """Handle history button"""
        user_id = message.from_user.id
        # history_handlers ожидает user_languages словарь и bot_name
        user_languages = {user_id: self.db.get_user_language(user_id)}
        try:
            await history_handlers.handle_history_command(
                message=message,
                bot_name='universal',
                user_languages=user_languages,
                db_manager=self.db
            )
        except Exception as e:
            # Если что-то пошло не так, покажем заглушку из support_handlers
            language = user_languages[user_id]
            await support_handlers.handle_history(message, language, self.db)
    
    async def _handle_faq(self, message):
        """Handle FAQ button"""
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        await faq_handlers.handle_faq_start(message, language, self.db)
    
    async def _handle_language(self, message):
        """Handle language button"""
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        await language_handlers.handle_language_selection(message, language, self.db)
    
    async def _show_bookmaker_selection(self, message, action):
        """Show bookmaker selection"""
        logger.info(f"Showing bookmaker selection for action {action}")
        user_id = message.from_user.id
        language = self.db.get_user_language(user_id)
        translations = get_translation(language)
        
        # Сохраняем текущее действие
        self.db.save_user_data(user_id, 'current_action', action)
        
        # Создаем обычную клавиатуру с кнопками букмекеров
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text="1XBET"), KeyboardButton(text="1WIN")],
                [KeyboardButton(text="MELBET"), KeyboardButton(text="MOSTBET")],
                [KeyboardButton(text="🔙 Назад в меню")]
            ],
            resize_keyboard=True
        )
        
        text = translations['select_bookmaker']
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
    
    async def _handle_bookmaker_selection(self, message, bookmaker, action):
        """Handle bookmaker selection"""
        from handlers.bookmaker_handlers import handle_bookmaker_selection

        # Нельзя редактировать сообщения пользователя. Вместо этого отправляем новое подтверждение.
        bookmaker_names = {
            '1xbet': '1XBET',
            '1win': '1WIN', 
            'melbet': 'MELBET',
            'mostbet': 'MOSTBET'
        }
        bookmaker_name = bookmaker_names.get(bookmaker.lower(), bookmaker.upper())
        # Проверка на включенность площадки
        try:
            enabled = self._get_enabled_sites()
            key = bookmaker.lower()
            if key not in enabled:
                await message.answer(
                    f"⛔ Раздел {bookmaker_name} временно недоступен.\nПопробуйте позже или выберите другого букмекера.")
                # Вернём выбор букмекера для текущего действия
                await self._show_bookmaker_selection(message, action or self.db.get_user_data(message.from_user.id, 'current_action') or 'deposit')
                return
        except Exception:
            # В случае ошибки проверки — продолжаем как обычно
            pass
        try:
            await message.answer(f"✅ <b>Выбран букмекер:</b> {bookmaker_name}", parse_mode="HTML")
        except Exception as e:
            logger.warning(f"Could not send bookmaker confirmation message: {e}")

        await handle_bookmaker_selection(message, bookmaker, action, self.db, BOOKMAKERS)
    
    async def _process_receipt_photo(self, message):
        """Process receipt photo"""
        from handlers.deposit_handlers import process_receipt_photo
        await process_receipt_photo(message, self.db, BOOKMAKERS)
    
    async def _process_qr_photo(self, message):
        """Process QR photo for withdrawal"""
        logger.info(f"Processing QR photo for user {message.from_user.id}")
        from handlers.withdraw_handlers import process_qr_photo
        await process_qr_photo(message, self.db, BOOKMAKERS)
    
    # Удалены локальные реализации _show_bank_selection и таймера, используем единый код из deposit_handlers
    
    async def _show_main_menu(self, message, language):
        """Show main menu"""
        # Очищаем все состояния пользователя
        user_id = message.from_user.id
        self.db.save_user_data(user_id, 'current_state', '')
        self.db.save_user_data(user_id, 'current_action', '')
        self.db.save_user_data(user_id, 'current_bookmaker', '')
        
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
        
        # Простое приветствие
        welcome_text = translations['welcome'].format(
            user_name=message.from_user.first_name or 'Пользователь', 
            admin_username='@luxon_support'
        )
        
        await message.answer(welcome_text, reply_markup=keyboard, parse_mode="HTML")
    
    async def start(self):
        """Start the bot"""
        logger.info("Starting universal bot...")
        # Start AutoDeposit watcher in background
        try:
            loop = asyncio.get_running_loop()
            self.auto_watcher = AutoDepositWatcher(self.db.db_path, self.bot, loop=loop)
            await self.auto_watcher.start()
        except Exception as e:
            logger.error(f"Failed to start AutoDepositWatcher: {e}")
        # Start polling
        await self.dp.start_polling(self.bot)

async def main():
    """Main function"""
    try:
        # Allow overriding token via environment variable for secure rotation
        token = os.getenv('BOT_TOKEN') or CONFIG_BOT_TOKEN
        bot = UniversalBot(token)
        logger.info("Starting universal bot...")
        await bot.start()
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Error starting bot: {e}")

if __name__ == "__main__":
    asyncio.run(main())