#!/usr/bin/env python3
"""
Универсальный бот для работы с букмекерами
"""
import logging
import asyncio
from aiogram import Bot, Dispatcher, types
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton

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
from config import BOT_TOKEN, BOOKMAKERS
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
        @self.dp.message()
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
            # Safety net: если пришёл /start, принудительно сбрасываем состояние и показываем меню
            if text == '/start':
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
            # Не обрабатываем прочие команды здесь — их обрабатывают специализированные хендлеры
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
                # Проверяем, не является ли это кнопкой FAQ
                # Если да, то не делаем ничего - пусть faq_handlers сам обработает
                # Если нет - возвращаем в главное меню
                is_faq_button = any([
                    text == "💰 Как пополнить счет?",
                    text == "💳 Как вывести деньги?",
                    text == "🔗 Как работает реферальная система?",
                    text == "❓ Другие вопросы"
                ])
                
                if not is_faq_button:
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
        bot = UniversalBot(BOT_TOKEN)
        logger.info("Starting universal bot...")
        await bot.start()
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Error starting bot: {e}")

if __name__ == "__main__":
    asyncio.run(main())