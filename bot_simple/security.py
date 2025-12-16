#!/usr/bin/env python3
"""
🛡️ Модуль защиты от DDoS и атак для Telegram ботов
"""

import time
import logging
from collections import defaultdict
from typing import Dict, Optional
from functools import wraps

logger = logging.getLogger(__name__)

# Хранилище для rate limiting (в продакшене используйте Redis)
_rate_limit_store: Dict[str, Dict] = defaultdict(dict)
_blocked_users: Dict[int, float] = {}  # user_id -> unblock_time

# Настройки rate limiting
RATE_LIMIT_WINDOW = 60  # секунд
MAX_REQUESTS_PER_WINDOW = 30  # запросов в окне
BLOCK_DURATION = 900  # секунд (15 минут)


def get_user_id(update) -> Optional[int]:
    """Извлекает user_id из update"""
    if hasattr(update, 'effective_user') and update.effective_user:
        return update.effective_user.id
    if hasattr(update, 'message') and update.message and update.message.from_user:
        return update.message.from_user.id
    if hasattr(update, 'callback_query') and update.callback_query and update.callback_query.from_user:
        return update.callback_query.from_user.id
    return None


def is_user_blocked(user_id: int) -> bool:
    """Проверяет, заблокирован ли пользователь"""
    if user_id in _blocked_users:
        unblock_time = _blocked_users[user_id]
        if time.time() < unblock_time:
            return True
        else:
            # Удаляем истекшую блокировку
            del _blocked_users[user_id]
    return False


def block_user(user_id: int, duration: int = BLOCK_DURATION) -> None:
    """Блокирует пользователя на указанное время"""
    unblock_time = time.time() + duration
    _blocked_users[user_id] = unblock_time
    logger.warning(f"🚫 User {user_id} blocked for {duration} seconds")


def check_rate_limit(user_id: int):
    """
    Проверяет rate limit для пользователя
    Возвращает (is_allowed, error_message)
    """
    # Проверяем блокировку
    if is_user_blocked(user_id):
        remaining_time = int(_blocked_users[user_id] - time.time())
        return False, f"User temporarily blocked. Try again in {remaining_time} seconds."
    
    # Получаем текущее время
    now = time.time()
    
    # Получаем или создаем запись для пользователя
    user_data = _rate_limit_store.get(user_id, {})
    
    # Проверяем, нужно ли сбросить счетчик
    reset_time = user_data.get('reset_time', 0)
    if reset_time < now:
        # Сбрасываем счетчик
        user_data = {
            'count': 0,
            'reset_time': now + RATE_LIMIT_WINDOW
        }
    
    # Увеличиваем счетчик
    user_data['count'] = user_data.get('count', 0) + 1
    
    # Проверяем превышение лимита
    if user_data['count'] > MAX_REQUESTS_PER_WINDOW:
        # Блокируем пользователя
        block_user(user_id, BLOCK_DURATION)
        logger.warning(f"🚫 Rate limit exceeded for user {user_id}. Blocked for {BLOCK_DURATION} seconds.")
        return False, "Rate limit exceeded. You have been temporarily blocked."
    
    # Сохраняем обновленные данные
    _rate_limit_store[user_id] = user_data
    
    return True, None


def rate_limit_decorator(func):
    """Декоратор для rate limiting обработчиков"""
    @wraps(func)
    async def wrapper(update, context):
        user_id = get_user_id(update)
        
        if user_id is None:
            logger.warning("⚠️ Could not extract user_id from update")
            return
        
        # Проверяем rate limit
        is_allowed, error_message = check_rate_limit(user_id)
        
        if not is_allowed:
            logger.warning(f"🚫 Rate limit check failed for user {user_id}: {error_message}")
            try:
                if hasattr(update, 'message') and update.message:
                    await update.message.reply_text(
                        f"⚠️ {error_message}\n\n"
                        f"Пожалуйста, подождите перед повторной попыткой."
                    )
                elif hasattr(update, 'callback_query') and update.callback_query:
                    await update.callback_query.answer(
                        text=error_message,
                        show_alert=True
                    )
            except Exception as e:
                logger.error(f"❌ Error sending rate limit message: {e}")
            return
        
        # Вызываем оригинальную функцию
        return await func(update, context)
    
    return wrapper


def validate_input(text: Optional[str], max_length: int = 4096):
    """
    Валидирует входной текст
    Возвращает (is_valid, error_message)
    """
    if text is None:
        return True, None
    
    # Проверка длины
    if len(text) > max_length:
        return False, f"Text too long. Maximum length is {max_length} characters."
    
    # Проверка на SQL инъекции
    sql_patterns = [
        r'\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION)\b',
        r'--|#|/\*|\*/|;',
        r"('|`|\").*(\bOR\b|\bAND\b).*('|`|\")",
    ]
    
    import re
    for pattern in sql_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return False, "Invalid input detected."
    
    # Проверка на XSS
    xss_patterns = [
        r'<script',
        r'javascript:',
        r'onerror=',
        r'onload=',
        r'<iframe',
    ]
    
    for pattern in xss_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return False, "Invalid input detected."
    
    return True, None


def sanitize_input(text: str) -> str:
    """Очищает входной текст от потенциально опасных символов"""
    import html
    # Экранируем HTML
    text = html.escape(text)
    # Удаляем опасные символы
    text = text.replace("'", "").replace('"', '').replace(';', '').replace('--', '')
    return text


def cleanup_old_entries():
    """Очищает старые записи из хранилища (вызывать периодически)"""
    now = time.time()
    
    # Очищаем rate limit store
    users_to_remove = []
    for user_id, user_data in _rate_limit_store.items():
        if user_data.get('reset_time', 0) < now:
            users_to_remove.append(user_id)
    
    for user_id in users_to_remove:
        del _rate_limit_store[user_id]
    
    # Очищаем блокировки
    users_to_unblock = []
    for user_id, unblock_time in _blocked_users.items():
        if unblock_time < now:
            users_to_unblock.append(user_id)
    
    for user_id in users_to_unblock:
        del _blocked_users[user_id]
    
    if users_to_remove or users_to_unblock:
        logger.info(f"🧹 Cleaned up {len(users_to_remove)} rate limit entries and {len(users_to_unblock)} block entries")


# Запускаем очистку каждые 5 минут
import threading

def periodic_cleanup():
    """Периодическая очистка старых записей"""
    while True:
        time.sleep(5 * 60)  # 5 минут
        cleanup_old_entries()

# Запускаем в фоновом потоке
cleanup_thread = threading.Thread(target=periodic_cleanup, daemon=True)
cleanup_thread.start()

