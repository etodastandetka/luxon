"""
Middleware для проверки статуса бота
"""
import logging
import sqlite3
from typing import Callable, Dict, Any, Awaitable
from aiogram import BaseMiddleware
from aiogram.types import Message, CallbackQuery, Update
from aiogram.filters import Command
from translations import get_translation

logger = logging.getLogger(__name__)

class BotStatusMiddleware(BaseMiddleware):
    """Middleware для проверки статуса бота"""
    
    def __init__(self, db_path: str = "universal_bot.db"):
        self.db_path = db_path
    
    async def __call__(
        self,
        handler: Callable[[Update, Dict[str, Any]], Awaitable[Any]],
        event: Update,
        data: Dict[str, Any]
    ) -> Any:
        """Проверяет статус бота перед обработкой сообщения"""
        
        # Получаем объект события
        if isinstance(event, Message):
            user_id = event.from_user.id
            user_language = data.get('user_language', 'ru')
        elif isinstance(event, CallbackQuery):
            user_id = event.from_user.id
            user_language = data.get('user_language', 'ru')
        else:
            # Если это не сообщение и не callback, пропускаем проверку
            return await handler(event, data)
        
        # Проверяем статус бота
        logger.debug(f"[BotStatusMiddleware] Using DB: {self.db_path}")
        if not await self.is_bot_active():
            # Бот на паузе - отправляем сообщение о технических работах для любых входящих событий
            maintenance_message = await self.get_maintenance_message()
            logger.info(f"[BotStatusMiddleware] Bot paused. Sending maintenance message. Event type: {type(event).__name__}")
            if isinstance(event, Message):
                try:
                    preview = (maintenance_message or '').replace('\n', ' ')[:80]
                    logger.debug(f"[BotStatusMiddleware] Reply to Message: '{preview}...' ")
                except Exception:
                    pass
                await event.answer(maintenance_message)
                return  # Не обрабатываем сообщение дальше
            elif isinstance(event, CallbackQuery):
                try:
                    preview = (maintenance_message or '').replace('\n', ' ')[:80]
                    logger.debug(f"[BotStatusMiddleware] Answer to Callback: '{preview}...' ")
                except Exception:
                    pass
                await event.answer(maintenance_message, show_alert=True)
                return  # Не обрабатываем callback дальше
        
        # Бот активен - продолжаем обработку
        return await handler(event, data)
    
    async def is_bot_active(self) -> bool:
        """Проверяет, активен ли бот"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT value FROM bot_settings WHERE key = 'is_active'
            ''')
            result = cursor.fetchone()
            
            conn.close()
            
            # Если настройка не найдена, считаем бота активным
            if not result:
                logger.warning("[BotStatusMiddleware] 'is_active' not found in bot_settings. Assuming active.")
                return True
            
            is_active = bool(int(result[0]))
            logger.debug(f"[BotStatusMiddleware] is_active={is_active}")
            return is_active
            
        except Exception as e:
            logger.error(f"Ошибка проверки статуса бота: {e}")
            # В случае ошибки считаем бота активным
            return True
    
    async def get_maintenance_message(self) -> str:
        """Получает сообщение о технических работах"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT value FROM bot_settings WHERE key = 'maintenance_message'
            ''')
            result = cursor.fetchone()
            
            conn.close()
            
            if result:
                logger.debug("[BotStatusMiddleware] Loaded maintenance_message from DB")
                return result[0]
            else:
                logger.debug("[BotStatusMiddleware] maintenance_message not set, using default")
                return "🔧 Технические работы\nБот временно недоступен. Попробуйте позже."
                
        except Exception as e:
            logger.error(f"Ошибка получения сообщения о технических работах: {e}")
            return "🔧 Технические работы\nБот временно недоступен. Попробуйте позже."





























