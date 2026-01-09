#!/usr/bin/env python3
"""
Простой Telegram бот для LUXON
Только команда /start с кнопками WebApp
"""

import logging
import re
import httpx
import base64
import random
from io import BytesIO
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from telegram.constants import ParseMode
from security import validate_input, sanitize_input
import asyncio

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Отключаем спам от httpx (только WARNING и ERROR)
logging.getLogger("httpx").setLevel(logging.WARNING)

# Токен бота
BOT_TOKEN = "7927891546:AAHyroAGoOIV6qKFAnZur13i8gvw2hMnJ-4"

# URL сайта
WEBSITE_URL = "https://lux-on.org"
API_URL = "https://pipiska.net"

# Словарь для хранения состояний пользователей
user_states = {}

# Словарь для хранения активных таймеров (user_id -> task)
active_timers = {}

# Кеш настроек (обновляется при старте и периодически)
settings_cache = {
    'casinos': {},
    'deposit_banks': [],
    'withdrawal_banks': [],
    'deposits_enabled': True,
    'withdrawals_enabled': True,
    'pause': False,
    'maintenance_message': 'Технические работы. Попробуйте позже.',
    'last_update': 0
}

# Маппинг названий банков
BANK_NAMES = {
    'kompanion': 'Компаньон',
    'demirbank': 'DemirBank',
    'demir': 'DemirBank',
    'omoney': 'O!Money',
    'balance': 'Balance.kg',
    'bakai': 'Bakai',
    'megapay': 'MegaPay',
    'mbank': 'MBank',
    'odengi': 'O!Money'
}

# Маппинг названий казино
CASINO_NAMES = {
    '1xbet': '1XBET',
    '1win': '1WIN',
    'melbet': 'MELBET',
    'mostbet': 'MOSTBET',
    'winwin': 'WINWIN',
    '888starz': '888STARZ'
}

async def load_settings():
    """Загружает настройки из API"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{API_URL}/api/public/payment-settings")
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    data = result
                else:
                    data = result
                
                settings_cache['casinos'] = data.get('casinos', {})
                deposits_data = data.get('deposits', {})
                withdrawals_data = data.get('withdrawals', {})
                
                if isinstance(deposits_data, dict):
                    settings_cache['deposit_banks'] = deposits_data.get('banks', [])
                    settings_cache['deposits_enabled'] = deposits_data.get('enabled', True)
                else:
                    settings_cache['deposit_banks'] = []
                    settings_cache['deposits_enabled'] = True
                
                if isinstance(withdrawals_data, dict):
                    settings_cache['withdrawal_banks'] = withdrawals_data.get('banks', [])
                    settings_cache['withdrawals_enabled'] = withdrawals_data.get('enabled', True)
                else:
                    settings_cache['withdrawal_banks'] = []
                    settings_cache['withdrawals_enabled'] = True
                
                settings_cache['pause'] = data.get('pause', False)
                settings_cache['maintenance_message'] = data.get('maintenance_message', 'Технические работы. Попробуйте позже.')
                settings_cache['last_update'] = asyncio.get_event_loop().time()
                logger.info(f"✅ Настройки загружены: казино={len(settings_cache['casinos'])}, депозиты={settings_cache['deposits_enabled']} (банки: {len(settings_cache['deposit_banks'])}), выводы={settings_cache['withdrawals_enabled']} (банки: {len(settings_cache['withdrawal_banks'])}), пауза={settings_cache['pause']}")
    except Exception as e:
        logger.warning(f"⚠️ Не удалось загрузить настройки: {e}, используем значения по умолчанию")
        # Значения по умолчанию
        settings_cache['casinos'] = {'1xbet': True, '1win': True, 'melbet': True, 'mostbet': True, 'winwin': True, '888starz': True}
        settings_cache['deposit_banks'] = ['mbank', 'bakai', 'balance', 'demir', 'omoney', 'megapay']
        settings_cache['withdrawal_banks'] = ['kompanion', 'odengi', 'bakai', 'balance', 'megapay', 'mbank']
        settings_cache['deposits_enabled'] = True
        settings_cache['withdrawals_enabled'] = True
        settings_cache['pause'] = False
        settings_cache['maintenance_message'] = 'Технические работы. Попробуйте позже.'

async def check_channel_subscription(user_id: int, channel_id: str) -> bool:
    """Проверяет подписку пользователя на канал"""
    try:
        check_url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMember"
        logger.info(f"🔍 Проверяю подписку пользователя {user_id} на канал {channel_id}")
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                check_url,
                json={
                    "chat_id": channel_id,
                    "user_id": user_id
                }
            )
            if response.status_code == 200:
                data = response.json()
                logger.info(f"📋 Ответ от Telegram API: {data}")
                if data.get('ok'):
                    member = data.get('result', {})
                    status = member.get('status', '')
                    logger.info(f"📊 Статус пользователя в канале: {status}")
                    is_subscribed = status in ['member', 'administrator', 'creator']
                    logger.info(f"{'✅' if is_subscribed else '❌'} Пользователь {'подписан' if is_subscribed else 'не подписан'}")
                    return is_subscribed
                else:
                    error_description = data.get('description', 'Unknown error')
                    logger.error(f"❌ Telegram API вернул ошибку: {error_description}")
                    # Если бот не может проверить (например, не админ канала), считаем что не подписан
                    return False
            else:
                logger.error(f"❌ HTTP ошибка при проверке подписки: {response.status_code}")
                return False
    except Exception as e:
        logger.error(f"❌ Ошибка при проверке подписки: {e}", exc_info=True)
        return False

async def send_channel_subscription_message(update: Update, channel_username: str, channel_id: str) -> None:
    """Отправляет сообщение с кнопками для подписки на канал"""
    user = update.effective_user
    user_id = user.id
    
    # Формируем ссылку на канал
    channel_url = f"https://t.me/{channel_username.lstrip('@')}"
    
    # Создаем кнопки
    keyboard = [
        [
            InlineKeyboardButton("📢 Подписаться на канал", url=channel_url),
            InlineKeyboardButton("✅ Проверить подписку", callback_data=f"check_sub_{channel_id}")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    message_text = f"""🔔 <b>Подписка на канал</b>

Для продолжения работы с ботом необходимо подписаться на наш канал.

📢 Канал: @{channel_username.lstrip('@')}

После подписки нажмите кнопку "✅ Проверить подписку"."""
    
    try:
        await update.message.reply_text(
            message_text,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
        logger.info(f"✅ Сообщение о подписке отправлено пользователю {user_id}")
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке сообщения о подписке: {e}")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start"""
    user = update.effective_user
    user_id = user.id
    logger.info(f"📥 Получена команда /start от пользователя {user_id} (@{user.username})")
    
    # Загружаем настройки если они устарели
    if asyncio.get_event_loop().time() - settings_cache.get('last_update', 0) > 300:
        await load_settings()
    
    # Проверяем паузу
    if settings_cache.get('pause', False):
        maintenance_message = settings_cache.get('maintenance_message', 'Технические работы. Попробуйте позже.')
        await update.message.reply_text(
            f"⏸️ <b>Бот на паузе</b>\n\n{maintenance_message}",
            parse_mode='HTML'
        )
        logger.info(f"⏸️ Бот на паузе, пользователь {user_id} получил сообщение о технических работах")
        return
    
    # Проверяем настройки канала
    logger.info(f"🔍 Проверяю настройки канала для пользователя {user_id}")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            logger.info(f"📡 Запрос к API: {API_URL}/api/channel/settings")
            response = await client.get(
                f"{API_URL}/api/channel/settings",
                headers={"Content-Type": "application/json"}
            )
            logger.info(f"📥 Ответ API: статус {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"📋 Данные от API: {data}")
                
                if data.get('success'):
                    channel_settings = data.get('data', {})
                    logger.info(f"⚙️ Настройки канала: enabled={channel_settings.get('enabled')}, channel_id={channel_settings.get('channel_id')}, username={channel_settings.get('username')}")
                    
                    if channel_settings.get('enabled'):
                        logger.info("✅ Проверка подписки включена")
                        channel_id = channel_settings.get('channel_id')
                        channel_username = channel_settings.get('username', '')
                        
                        if channel_id:
                            logger.info(f"🔍 Проверяю подписку на канал {channel_id}")
                            # Проверяем подписку
                            is_subscribed = await check_channel_subscription(
                                user_id, 
                                channel_id
                            )
                            
                            if not is_subscribed:
                                logger.info(f"❌ Пользователь {user_id} не подписан на канал, отправляю сообщение о подписке")
                                # Отправляем сообщение о подписке
                                await send_channel_subscription_message(
                                    update,
                                    channel_username,
                                    channel_id
                                )
                                return  # Не показываем основное меню, пока не подпишется
                            else:
                                logger.info(f"✅ Пользователь {user_id} подписан на канал, показываю основное меню")
                        else:
                            logger.warning("⚠️ channel_id не указан в настройках, пропускаю проверку подписки")
                    else:
                        logger.info("ℹ️ Проверка подписки отключена в настройках")
                else:
                    logger.warning(f"⚠️ API вернул success=false: {data.get('error')}")
            else:
                logger.error(f"❌ Ошибка API при получении настроек канала: {response.status_code}")
                try:
                    error_text = response.text
                    logger.error(f"📄 Текст ошибки: {error_text[:200]}")
                except:
                    pass
    except Exception as e:
        logger.error(f"❌ Ошибка при проверке настроек канала: {e}", exc_info=True)
        # Продолжаем выполнение, если ошибка
    
    # Обработка реферальной ссылки
    referral_code = None
    if update.message and update.message.text:
        parts = update.message.text.split()
        if len(parts) > 1:
            param = parts[1]
            # Обрабатываем формат ref123456 или ref_123456
            if param.startswith('ref'):
                referral_code = param[3:]  # Убираем 'ref'
                if referral_code.startswith('_'):
                    referral_code = referral_code[1:]  # Убираем '_' если есть
                
                # Пытаемся извлечь ID рефера
                try:
                    referrer_id = int(referral_code)
                    if referrer_id != user_id:
                        # Регистрируем реферальную связь через API
                        try:
                            async with httpx.AsyncClient(timeout=5.0) as client:
                                response = await client.post(
                                    f"{API_URL}/api/referral/register",
                                    json={
                                        "referrer_id": str(referrer_id),
                                        "referred_id": str(user_id),
                                        "username": user.username,
                                        "first_name": user.first_name,
                                        "last_name": user.last_name
                                    }
                                )
                                if response.status_code == 200:
                                    data = response.json()
                                    if data.get('success'):
                                        logger.info(f"✅ Реферальная связь зарегистрирована: {referrer_id} -> {user_id}")
                                    else:
                                        logger.warning(f"⚠️ Не удалось зарегистрировать реферала: {data.get('error')}")
                                else:
                                    logger.error(f"❌ Ошибка API при регистрации реферала: {response.status_code}")
                        except Exception as e:
                            logger.error(f"❌ Ошибка при регистрации реферала: {e}")
                except ValueError:
                    logger.warning(f"⚠️ Неверный формат реферального кода: {referral_code}")
    
    # Создаем Reply клавиатуру с кнопками
    reply_keyboard = [
        [
            KeyboardButton("💰 Пополнить"),
            KeyboardButton("💸 Вывести")
        ]
    ]
    reply_markup = ReplyKeyboardMarkup(reply_keyboard, resize_keyboard=True, one_time_keyboard=False)
    
    # Текст приветствия
    welcome_text = f"""Привет, {user.first_name}!

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: @operator_luxon_bot
💬 Чат для всех: @luxon_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности"""
    
    # Отправляем текст с Reply клавиатурой
    try:
        await update.message.reply_text(
            f"{welcome_text}\n\nВыберите действие:",
            reply_markup=reply_markup
        )
        logger.info(f"✅ Ответ отправлен пользователю {user_id}")
    except Exception as e:
        # Игнорируем ошибки заблокированных пользователей
        if "Forbidden: bot was blocked by the user" in str(e):
            logger.debug(f"⚠️ Пользователь {user_id} заблокировал бота")
        else:
            logger.error(f"❌ Ошибка при отправке ответа пользователю {user_id}: {e}")
            raise

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик всех текстовых сообщений от пользователей (не команд)"""
    if not update.message or not update.message.from_user:
        logger.warning("⚠️ handle_message: нет сообщения или пользователя")
        return
    
    user = update.message.from_user
    user_id = user.id
    message_text = update.message.text or update.message.caption or ''
    telegram_message_id = update.message.message_id
    
    logger.info(f"📨 handle_message: пользователь {user_id} (@{user.username}), сообщение: '{message_text[:50]}...'")
    
    # Пропускаем команды (они обрабатываются отдельными обработчиками)
    if message_text and message_text.startswith('/'):
        logger.warning(f"⚠️ handle_message получил команду {message_text} - это не должно происходить! Пропускаем.")
        return
    
    # Обработка отмены заявки через Reply клавиатуру (проверяем в самом начале, независимо от состояния)
    if message_text and ("отменить заявку" in message_text.lower() or message_text.strip() == "❌ Отменить заявку"):
        logger.info(f"🛑 Пользователь {user_id} отменил заявку через Reply-клавиатуру")
        
        # Останавливаем таймер если он активен
        if user_id in active_timers:
            try:
                active_timers[user_id].cancel()
                logger.info(f"⏹️ Таймер остановлен для пользователя {user_id}")
            except Exception as e:
                logger.warning(f"⚠️ Ошибка при остановке таймера: {e}")
            del active_timers[user_id]
        
        # Очищаем состояние
        if user_id in user_states:
            del user_states[user_id]
            logger.info(f"✅ Состояние очищено для пользователя {user_id}")
        
        # Создаем Reply клавиатуру с кнопками
        reply_keyboard = [
            [
                KeyboardButton("💰 Пополнить"),
                KeyboardButton("💸 Вывести")
            ]
        ]
        reply_markup = ReplyKeyboardMarkup(reply_keyboard, resize_keyboard=True, one_time_keyboard=False)
        
        # Отправляем приветственное сообщение (как в /start)
        welcome_text = f"""Привет, {user.first_name}!

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: @operator_luxon_bot
💬 Чат для всех: @luxon_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности"""
        
        await update.message.reply_text(
            f"{welcome_text}\n\nВыберите действие:",
            reply_markup=reply_markup
        )
        return
    
    # Обработка кнопок Reply клавиатуры (должна быть ПЕРЕД проверкой user_states)
    # Отвечаем ВСЕМ пользователям, независимо от подписки на канал
    if message_text in ["💰 Пополнить", "💸 Вывести"]:
        logger.info(f"📨 Пользователь {user_id} нажал кнопку: {message_text}")
        
        # Загружаем настройки если они устарели
        if asyncio.get_event_loop().time() - settings_cache.get('last_update', 0) > 300:
            await load_settings()
        
        # Проверяем паузу
        if settings_cache.get('pause', False):
            maintenance_message = settings_cache.get('maintenance_message', 'Технические работы. Попробуйте позже.')
            await update.message.reply_text(
                f"⏸️ <b>Бот на паузе</b>\n\n{maintenance_message}",
                parse_mode='HTML'
            )
            logger.info(f"⏸️ Бот на паузе, пользователь {user_id} попытался использовать функцию")
            return
        
        if message_text == "💰 Пополнить":
            # Проверяем, включены ли депозиты
            if not settings_cache.get('deposits_enabled', True):
                await update.message.reply_text(
                    "❌ Пополнение временно отключено. Попробуйте позже.",
                    parse_mode='HTML'
                )
                logger.info(f"❌ Депозиты отключены, пользователь {user_id} попытался пополнить")
                return
            
            # Начинаем диалог пополнения
            user_states[user_id] = {
                'step': 'deposit_bookmaker',
                'data': {}
            }
            
            # Формируем список доступных казино через Reply клавиатуру
            all_casinos = [
                ('1xbet', '🎰 1XBET'),
                ('1win', '🎰 1WIN'),
                ('melbet', '🎰 MELBET'),
                ('mostbet', '🎰 MOSTBET'),
                ('winwin', '🎰 WINWIN'),
                ('888starz', '🎰 888STARZ')
            ]
            
            # Фильтруем доступные казино
            enabled_casinos = []
            for casino_key, casino_name in all_casinos:
                is_enabled = settings_cache.get('casinos', {}).get(casino_key, True)
                if is_enabled:
                    enabled_casinos.append((casino_key, casino_name))
            
            # Группируем кнопки по 2 в ряд
            keyboard_buttons = []
            for i in range(0, len(enabled_casinos), 2):
                row = [KeyboardButton(enabled_casinos[i][1])]
                if i + 1 < len(enabled_casinos):
                    row.append(KeyboardButton(enabled_casinos[i + 1][1]))
                keyboard_buttons.append(row)
            
            keyboard_buttons.append([KeyboardButton("❌ Отменить заявку")])
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            await update.message.reply_text(
                "💰 <b>Пополнение счета</b>\n\nВыберите казино:",
                reply_markup=reply_markup,
                parse_mode='HTML'
            )
        else:
            # Проверяем, включены ли выводы
            if not settings_cache.get('withdrawals_enabled', True):
                await update.message.reply_text(
                    "❌ Вывод временно отключен. Попробуйте позже.",
                    parse_mode='HTML'
                )
                logger.info(f"❌ Выводы отключены, пользователь {user_id} попытался вывести")
                return
            
            # Начинаем диалог вывода
            user_states[user_id] = {
                'step': 'withdraw_bookmaker',
                'data': {}
            }
            
            # Формируем список доступных казино через Reply клавиатуру
            all_casinos = [
                ('1xbet', '🎰 1XBET'),
                ('1win', '🎰 1WIN'),
                ('melbet', '🎰 MELBET'),
                ('mostbet', '🎰 MOSTBET'),
                ('winwin', '🎰 WINWIN'),
                ('888starz', '🎰 888STARZ')
            ]
            
            # Фильтруем доступные казино
            enabled_casinos = []
            for casino_key, casino_name in all_casinos:
                is_enabled = settings_cache.get('casinos', {}).get(casino_key, True)
                if is_enabled:
                    enabled_casinos.append((casino_key, casino_name))
            
            # Группируем кнопки по 2 в ряд
            keyboard_buttons = []
            for i in range(0, len(enabled_casinos), 2):
                row = [KeyboardButton(enabled_casinos[i][1])]
                if i + 1 < len(enabled_casinos):
                    row.append(KeyboardButton(enabled_casinos[i + 1][1]))
                keyboard_buttons.append(row)
            
            keyboard_buttons.append([KeyboardButton("❌ Отменить заявку")])
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            await update.message.reply_text(
                "💸 <b>Вывод средств</b>\n\nВыберите казино:",
                reply_markup=reply_markup,
                parse_mode='HTML'
            )
        return
    
    # Проверяем, есть ли активный диалог
    if user_id in user_states:
        state = user_states[user_id]
        step = state.get('step', '')
        data = state.get('data', {})
        
        # Если отправлено фото, но не в состоянии, где требуется фото - показываем ошибку
        if (update.message.photo or (update.message.document and update.message.document.mime_type and update.message.document.mime_type.startswith('image/'))):
            # Проверяем, требуется ли фото в текущем шаге
            if step not in ['withdraw_qr', 'deposit_receipt_photo', 'deposit_bank']:
                await update.message.reply_text("❌ Сейчас не требуется отправка фото. Следуйте инструкциям выше.")
                return
        
        # Обработка выбора казино для пополнения
        if step == 'deposit_bookmaker':
            try:
                # Определяем казино по тексту кнопки
                bookmaker_map = {
                    '🎰 1XBET': '1xbet',
                    '🎰 1WIN': '1win',
                    '🎰 MELBET': 'melbet',
                    '🎰 MOSTBET': 'mostbet',
                    '🎰 WINWIN': 'winwin',
                    '🎰 888STARZ': '888starz',
                    '1XBET': '1xbet',
                    '1WIN': '1win',
                    'MELBET': 'melbet',
                    'MOSTBET': 'mostbet',
                    'WINWIN': 'winwin',
                    '888STARZ': '888starz'
                }
                
                bookmaker = bookmaker_map.get(message_text)
                if not bookmaker:
                    await update.message.reply_text("❌ Пожалуйста, выберите казино из предложенных кнопок")
                    return
                
                data['bookmaker'] = bookmaker
                state['step'] = 'deposit_player_id'
                user_states[user_id] = state
                
                # Получаем сохраненный ID для этого казино
                saved_id = data.get('saved_player_ids', {}).get(bookmaker, '')
                if not saved_id:
                    try:
                        async with httpx.AsyncClient(timeout=5.0) as client:
                            response = await client.get(
                                f"{API_URL}/api/public/casino-account",
                                params={"user_id": str(user_id), "casino_id": bookmaker.lower()}
                            )
                            if response.status_code == 200:
                                result = response.json()
                                if result.get('success') and result.get('data', {}).get('accountId'):
                                    saved_id = result.get('data', {}).get('accountId')
                                    if 'saved_player_ids' not in data:
                                        data['saved_player_ids'] = {}
                                    data['saved_player_ids'][bookmaker] = saved_id
                    except Exception as e:
                        logger.warning(f"Не удалось получить сохраненный ID из API: {e}")
                
                # Создаем Reply клавиатуру с сохраненным ID и кнопкой отмены
                keyboard_buttons = []
                if saved_id:
                    keyboard_buttons.append([KeyboardButton(f"ID: {saved_id}")])
                keyboard_buttons.append([KeyboardButton("❌ Отменить заявку")])
                reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
                
                await update.message.reply_text(
                    f"💰 <b>Пополнение счета</b>\n\nКазино: {bookmaker.upper()}\n\nВведите ваш ID игрока в казино:",
                    parse_mode='HTML',
                    reply_markup=reply_markup
                )
                return
            except Exception as e:
                logger.error(f"❌ Ошибка при обработке выбора казино для пополнения: {e}", exc_info=True)
                await update.message.reply_text("❌ Произошла ошибка при обработке выбора казино. Попробуйте еще раз или введите /start")
                return
        
        # Обработка выбора казино для вывода
        if step == 'withdraw_bookmaker':
            try:
                # Определяем казино по тексту кнопки
                bookmaker_map = {
                    '🎰 1XBET': '1xbet',
                    '🎰 1WIN': '1win',
                    '🎰 MELBET': 'melbet',
                    '🎰 MOSTBET': 'mostbet',
                    '🎰 WINWIN': 'winwin',
                    '🎰 888STARZ': '888starz',
                    '1XBET': '1xbet',
                    '1WIN': '1win',
                    'MELBET': 'melbet',
                    'MOSTBET': 'mostbet',
                    'WINWIN': 'winwin',
                    '888STARZ': '888starz'
                }
                
                bookmaker = bookmaker_map.get(message_text)
                if not bookmaker:
                    await update.message.reply_text("❌ Пожалуйста, выберите казино из предложенных кнопок")
                    return
                
                data['bookmaker'] = bookmaker
                state['step'] = 'withdraw_bank'
                user_states[user_id] = state
                
                # Получаем сохраненный ID для этого казино
                saved_id = data.get('saved_player_ids', {}).get(bookmaker, '')
                if not saved_id:
                    try:
                        async with httpx.AsyncClient(timeout=5.0) as client:
                            response = await client.get(
                                f"{API_URL}/api/public/casino-account",
                                params={"user_id": str(user_id), "casino_id": bookmaker.lower()}
                            )
                            if response.status_code == 200:
                                result = response.json()
                                if result.get('success') and result.get('data', {}).get('accountId'):
                                    saved_id = result.get('data', {}).get('accountId')
                                    if 'saved_player_ids' not in data:
                                        data['saved_player_ids'] = {}
                                    data['saved_player_ids'][bookmaker] = saved_id
                    except Exception as e:
                        logger.warning(f"Не удалось получить сохраненный ID из API: {e}")
                
                # Загружаем настройки если они устарели
                if asyncio.get_event_loop().time() - settings_cache.get('last_update', 0) > 300:
                    await load_settings()
                
                # Формируем список банков через Reply клавиатуру
                enabled_banks = settings_cache.get('withdrawal_banks', [])
                all_banks = [
                    ('kompanion', 'Компаньон'),
                    ('demirbank', 'DemirBank'),
                    ('omoney', 'O!Money'),
                    ('balance', 'Balance.kg'),
                    ('bakai', 'Bakai'),
                    ('megapay', 'MegaPay'),
                    ('mbank', 'MBank')
                ]
                
                # Фильтруем доступные банки
                enabled_banks_list = []
                for bank_key, bank_name in all_banks:
                    is_enabled = bank_key in enabled_banks or bank_key == 'kompanion'
                    if is_enabled:
                        enabled_banks_list.append((bank_key, bank_name))
                
                # Группируем кнопки по 2 в ряд
                keyboard_buttons = []
                for i in range(0, len(enabled_banks_list), 2):
                    row = [KeyboardButton(f"🏦 {enabled_banks_list[i][1]}")]
                    if i + 1 < len(enabled_banks_list):
                        row.append(KeyboardButton(f"🏦 {enabled_banks_list[i + 1][1]}"))
                    keyboard_buttons.append(row)
                
                keyboard_buttons.append([KeyboardButton("❌ Отменить заявку")])
                reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
                
                await update.message.reply_text(
                    f"💸 <b>Вывод средств</b>\n\nКазино: {bookmaker.upper()}\n\nВыберите банк для получения средств:",
                    parse_mode='HTML',
                    reply_markup=reply_markup
                )
                return
            except Exception as e:
                logger.error(f"❌ Ошибка при обработке выбора казино для вывода: {e}", exc_info=True)
                await update.message.reply_text("❌ Произошла ошибка при обработке выбора казино. Попробуйте еще раз или введите /start")
                return
        
        # Обработка выбора банка для вывода
        if step == 'withdraw_bank':
            # Определяем банк по тексту кнопки
            bank_map = {
                '🏦 Компаньон': 'kompanion',
                '🏦 DemirBank': 'demirbank',
                '🏦 O!Money': 'omoney',
                '🏦 Balance.kg': 'balance',
                '🏦 Bakai': 'bakai',
                '🏦 MegaPay': 'megapay',
                '🏦 MBank': 'mbank',
                'Компаньон': 'kompanion',
                'DemirBank': 'demirbank',
                'O!Money': 'omoney',
                'Balance.kg': 'balance',
                'Bakai': 'bakai',
                'MegaPay': 'megapay',
                'MBank': 'mbank'
            }
            
            bank = bank_map.get(message_text)
            if not bank:
                await update.message.reply_text("❌ Пожалуйста, выберите банк из предложенных кнопок")
                return
            
            data['bank'] = bank
            state['step'] = 'withdraw_phone'
            user_states[user_id] = state
            
            # Получаем сохраненный номер телефона (сначала из локального состояния, потом из API)
            saved_phone = data.get('saved_phones', {}).get('phone')
            if not saved_phone:
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        response = await client.get(
                            f"{API_URL}/api/public/casino-account",
                            params={"user_id": str(user_id), "casino_id": "phone"}
                        )
                        if response.status_code == 200:
                            result = response.json()
                            if result.get('success') and result.get('data', {}).get('phone'):
                                saved_phone = result.get('data', {}).get('phone')
                                # Сохраняем в локальное состояние для быстрого доступа
                                if 'saved_phones' not in data:
                                    data['saved_phones'] = {}
                                data['saved_phones']['phone'] = saved_phone
                                user_states[user_id]['data'] = data
                except Exception as e:
                    logger.warning(f"Не удалось получить сохраненный телефон из API: {e}")
            
            # Создаем Reply клавиатуру с сохраненным номером и кнопкой отмены
            keyboard_buttons = []
            if saved_phone:
                keyboard_buttons.append([KeyboardButton(f"📱 {saved_phone}")])
            keyboard_buttons.append([KeyboardButton("❌ Отменить заявку")])
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            bookmaker_name = data.get('bookmaker', '').upper()
            await update.message.reply_text(
                f"💸 <b>Вывод средств</b>\n\nКазино: {bookmaker_name}\nБанк: {bank}\n\nВведите номер телефона (начинается с +996):",
                parse_mode='HTML',
                reply_markup=reply_markup
            )
            return
        
        # Обработка пополнения
        if step == 'deposit_player_id':
            # Проверяем, не нажата ли кнопка с сохраненным ID
            if message_text and message_text.startswith("ID: "):
                player_id = message_text.replace("ID: ", "").strip()
            else:
                if not message_text or not message_text.strip().isdigit():
                    await update.message.reply_text("❌ Введите корректный ID игрока (только цифры)")
                    return
                player_id = message_text.strip()
            
            # Сохраняем ID для этого казино в user_states
            if 'saved_player_ids' not in data:
                data['saved_player_ids'] = {}
            data['saved_player_ids'][data['bookmaker']] = player_id
            
            # Сохраняем ID через API в базу данных (нормализуем название казино)
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{API_URL}/api/public/casino-account",
                        json={
                            "user_id": str(user_id),
                            "casino_id": data['bookmaker'].lower(),
                            "account_id": player_id
                        },
                        headers={"Content-Type": "application/json"}
                    )
            except Exception as e:
                logger.warning(f"Не удалось сохранить ID через API: {e}")
            
            data['player_id'] = player_id
            state['step'] = 'deposit_amount'
            user_states[user_id] = state
            
            # Создаем Reply клавиатуру с кнопками сумм и отмены
            keyboard_buttons = [
                [KeyboardButton("100"), KeyboardButton("200"), KeyboardButton("500")],
                [KeyboardButton("1000"), KeyboardButton("2000"), KeyboardButton("5000")],
                [KeyboardButton("10000")],
                [KeyboardButton("❌ Отменить заявку")]
            ]
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            await update.message.reply_text(
                f"💰 <b>Пополнение счета</b>\n\nКазино: {data['bookmaker'].upper()}\nID игрока: {data['player_id']}\n\nВведите сумму пополнения (от 35 до 100,000 сом) или выберите из кнопок:",
                parse_mode='HTML',
                reply_markup=reply_markup
            )
            return
        
        elif step == 'deposit_amount':
            logger.info(f"💰 Обработка суммы пополнения для пользователя {user_id}: message_text='{message_text}'")
            
            # Проверяем, не нажата ли кнопка с суммой
            if message_text in ["100", "200", "500", "1000", "2000", "5000", "10000"]:
                amount = float(message_text)
            else:
                try:
                    amount = float(message_text.replace(',', '.').strip())
                except ValueError as e:
                    logger.error(f"❌ Ошибка парсинга суммы: {e}, message_text='{message_text}'")
                    await update.message.reply_text("❌ Введите корректную сумму (число) или выберите из кнопок")
                    return
            
            logger.info(f"💰 Сумма распознана: {amount}")
            if amount < 35 or amount > 100000:
                logger.warning(f"⚠️ Сумма вне диапазона: {amount}")
                await update.message.reply_text("❌ Сумма должна быть от 35 до 100,000 сом")
                return
            
            # Добавляем случайные копейки к сумме (1-99 копеек), если сумма целая
            if amount == int(amount):
                random_kopecks = random.randint(1, 99)
                amount = amount + (random_kopecks / 100)
                logger.info(f"💰 Добавлены случайные копейки: {random_kopecks}, итоговая сумма: {amount}")
            
            data['amount'] = amount
            state['step'] = 'deposit_bank'
            user_states[user_id] = state
            
            # Отправляем сообщение о генерации QR и очищаем клавиатуру
            generating_message = await update.message.reply_text(
                "⏳ Генерирую QR code...",
                reply_markup=ReplyKeyboardRemove()
            )
            
            # Получаем только QR ссылки (заявку создадим после отправки фото)
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    # Получаем QR ссылки для всех банков
                    qr_response = await client.post(
                        f"{API_URL}/api/public/generate-qr",
                        json={
                            "amount": amount,
                            "playerId": data['player_id'],
                            "bank": "demirbank"  # По умолчанию, но ссылки будут для всех банков
                        },
                        headers={"Content-Type": "application/json"}
                    )
                    
                    logger.info(f"📥 Ответ от API generate-qr: status={qr_response.status_code}")
                    
                    if qr_response.status_code == 200:
                        qr_data = qr_response.json()
                        logger.info(f"📋 Данные QR: {qr_data}")
                        if qr_data.get('success'):
                            # API возвращает all_bank_urls напрямую, а не внутри data
                            bank_links = qr_data.get('all_bank_urls', {})
                            # Таймер по умолчанию 5 минут (300 секунд)
                            timer_seconds = 300
                            logger.info(f"🔗 Получены ссылки для банков: {list(bank_links.keys())}")
                            
                            # Форматируем таймер
                            minutes = timer_seconds // 60
                            seconds = timer_seconds % 60
                            timer_text = f"{minutes:02d}:{seconds:02d}"
                            
                            # Загружаем настройки если они устарели
                            if asyncio.get_event_loop().time() - settings_cache.get('last_update', 0) > 300:
                                await load_settings()
                            
                            # Получаем список доступных банков из настроек
                            enabled_banks = settings_cache.get('deposit_banks', [])
                            
                            # Формируем клавиатуру с учетом доступности банков
                            keyboard = []
                            bank_names_map = {
                                'demirbank': 'DemirBank',
                                'omoney': 'O!Money',
                                'balance': 'Balance.kg',
                                'bakai': 'Bakai',
                                'megapay': 'MegaPay',
                                'mbank': 'MBank'
                            }
                            
                            # Создаем кнопки для всех банков с URL ссылками (как на втором фото)
                            all_banks_list = []
                            added_banks = set()  # Отслеживаем уже добавленные банки
                            for bank_key, bank_name in bank_names_map.items():
                                # Проверяем, есть ли ссылка для этого банка
                                bank_link = bank_links.get(bank_key) or bank_links.get(bank_name)
                                # Также проверяем варианты с 'demir' для demirbank
                                if not bank_link and bank_key == 'demirbank':
                                    bank_link = bank_links.get('demir') or bank_links.get('DemirBank')
                                
                                if bank_link and bank_name not in added_banks:
                                    added_banks.add(bank_name)  # Помечаем банк как добавленный
                                    is_enabled = bank_key in enabled_banks or 'demir' in bank_key.lower() or 'demirbank' in enabled_banks
                                    if is_enabled:
                                        # Кнопка с URL - сразу открывает ссылку на оплату
                                        all_banks_list.append(InlineKeyboardButton(bank_name, url=bank_link))
                                    else:
                                        # Недоступный банк - показываем, но без ссылки (callback для показа сообщения)
                                        all_banks_list.append(InlineKeyboardButton(f"{bank_name} ⚠️", callback_data=f"deposit_bank_{bank_key}_disabled"))
                            
                            # Разделяем на пары (по 2 в ряд)
                            for i in range(0, len(all_banks_list), 2):
                                if i + 1 < len(all_banks_list):
                                    keyboard.append([all_banks_list[i], all_banks_list[i + 1]])
                                else:
                                    keyboard.append([all_banks_list[i]])
                            
                            if not keyboard:
                                logger.warning(f"⚠️ Нет ссылок для банков, отправляю сообщение без кнопок")
                                # Удаляем сообщение "Генерирую QR code..."
                                try:
                                    await generating_message.delete()
                                except Exception as e:
                                    logger.warning(f"⚠️ Не удалось удалить сообщение 'Генерирую QR code...': {e}")
                                await update.message.reply_text(
                                    f"❌ Не удалось получить ссылки для оплаты. Обратитесь в поддержку.",
                                    parse_mode='HTML'
                                )
                                return
                            
                            keyboard.append([InlineKeyboardButton("❌ Отменить заявку", callback_data="cancel_request")])
                            reply_markup = InlineKeyboardMarkup(keyboard)
                            
                            logger.info(f"📤 Отправляю сообщение с кнопками банков для пользователя {user_id}")
                            
                            # Отправляем сообщение с кнопками банков (заявка будет создана после отправки фото)
                            timer_message = await update.message.reply_text(
                                f"💰 <b>Пополнение счета</b>\n\n"
                                f"💰 <b>Сумма:</b> {amount} сом\n"
                                f"🎰 <b>Казино:</b> {data['bookmaker'].upper()}\n"
                                f"🆔 <b>ID игрока:</b> {data['player_id']}\n\n"
                                f"⏰ <b>Таймер: {timer_text}</b>\n\n"
                                f"После оплаты отправьте фото чека:",
                                reply_markup=reply_markup,
                                parse_mode='HTML'
                            )
                            
                            # Сохраняем данные для таймера
                            data['timer_message_id'] = timer_message.message_id
                            data['timer_chat_id'] = timer_message.chat.id
                            user_states[user_id]['data'] = data
                            
                            # Сохраняем ссылки в состоянии для последующего использования
                            user_states[user_id]['data']['bank_links'] = bank_links
                            user_states[user_id]['data']['timer_seconds'] = timer_seconds
                            
                            # Удаляем сообщение "Генерирую QR code..."
                            try:
                                await generating_message.delete()
                            except Exception as e:
                                logger.warning(f"⚠️ Не удалось удалить сообщение 'Генерирую QR code...': {e}")
                            
                            # Запускаем таймер как фоновую задачу
                            timer_task = asyncio.create_task(
                                update_timer(context.bot, user_id, timer_seconds, data, timer_message.message_id, timer_message.chat.id)
                            )
                            active_timers[user_id] = timer_task
                            
                            # Состояние остается deposit_bank - ждем выбора банка или фото
                            logger.info(f"✅ Сообщение с кнопками банков отправлено пользователю {user_id}, таймер запущен")
                            return
                        else:
                            logger.error(f"❌ QR данные не содержат success или data: {qr_data}")
                            # Удаляем сообщение "Генерирую QR code..."
                            try:
                                await generating_message.delete()
                            except Exception as e:
                                logger.warning(f"⚠️ Не удалось удалить сообщение 'Генерирую QR code...': {e}")
                            await update.message.reply_text(
                                f"❌ Ошибка при получении ссылок на оплату. Попробуйте еще раз."
                            )
                            return
                    else:
                        error_text = qr_response.text
                        logger.error(f"❌ Ошибка при получении QR ссылок: status={qr_response.status_code}, error={error_text}")
                        # Удаляем сообщение "Генерирую QR code..."
                        try:
                            await generating_message.delete()
                        except Exception as e:
                            logger.warning(f"⚠️ Не удалось удалить сообщение 'Генерирую QR code...': {e}")
                        await update.message.reply_text(
                            f"❌ Ошибка при получении ссылок на оплату. Попробуйте еще раз."
                        )
                        return
            except Exception as e:
                logger.error(f"❌ Ошибка при создании заявки или получении ссылок: {e}")
                # Удаляем сообщение "Генерирую QR code..."
                try:
                    await generating_message.delete()
                except Exception as delete_error:
                    logger.warning(f"⚠️ Не удалось удалить сообщение 'Генерирую QR code...': {delete_error}")
                await update.message.reply_text(
                    f"❌ Ошибка при создании заявки. Попробуйте еще раз или обратитесь в поддержку."
                )
                return
        
        # Обработка отправки фото чека для депозита (или выбора банка)
        elif step == 'deposit_bank' or step == 'deposit_receipt_photo':
            # Проверяем, есть ли фото
            photo_file_id = None
            if update.message.photo:
                photo_file_id = update.message.photo[-1].file_id
            elif update.message.document and update.message.document.mime_type and update.message.document.mime_type.startswith('image/'):
                photo_file_id = update.message.document.file_id
            
            if not photo_file_id:
                # Если нет фото, но есть текст - возможно пользователь выбрал банк через callback
                # Или просто ждем фото
                if step == 'deposit_bank':
                    await update.message.reply_text("❌ Пожалуйста, отправьте фото чека после оплаты")
                else:
                    await update.message.reply_text("❌ Пожалуйста, отправьте фото чека")
                return
            
            # Получаем фото в base64 и создаем заявку
            try:
                await update.message.reply_text("⏳ Обрабатываю фото чека и создаю заявку...")
                receipt_photo_base64 = await get_photo_base64(context.bot, photo_file_id)
                logger.info(f"📤 Создаю заявку с фото чека, длина base64: {len(receipt_photo_base64)}")
                
                # Создаем заявку с фото чека
                user = update.effective_user
                # По умолчанию используем omoney (о деньги), но не сохраняем выбор банка для отслеживания
                bank = 'omoney'  # Всегда используем omoney по умолчанию
                
                request_body = {
                    "type": "deposit",
                    "bookmaker": data['bookmaker'],
                    "userId": str(user_id),
                    "telegram_user_id": str(user_id),
                    "amount": data['amount'],
                    "bank": bank,
                    "account_id": data['player_id'],
                    "playerId": data['player_id'],
                    "receipt_photo": receipt_photo_base64,  # Фото чека
                    "telegram_username": user.username,
                    "telegram_first_name": user.first_name,
                    "telegram_last_name": user.last_name,
                    "source": "bot"
                }
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    # Создаем заявку с фото
                    payment_response = await client.post(
                        f"{API_URL}/api/payment",
                        json=request_body,
                        headers={"Content-Type": "application/json"}
                    )
                    
                    logger.info(f"📥 Ответ от API payment: status={payment_response.status_code}")
                    
                    if payment_response.status_code == 200:
                        result = payment_response.json()
                        logger.info(f"📋 Результат создания заявки: {result}")
                        if result.get('success') != False:
                            request_id = result.get('id') or result.get('data', {}).get('id') or 'N/A'
                            
                            await update.message.reply_text(
                                f"✅ <b>Ваша заявка отправлена!</b>\n\n"
                                f"💰 <b>Сумма:</b> {data['amount']} сом\n"
                                f"🎰 <b>Казино:</b> {data['bookmaker'].upper()}\n"
                                f"🆔 <b>ID игрока:</b> {data['player_id']}\n"
                                f"🆔 <b>ID заявки:</b> #{request_id}\n\n"
                                f"Ожидайте обработки заявки администратором.",
                                parse_mode='HTML',
                                reply_markup=ReplyKeyboardRemove()
                            )
                        else:
                            error_msg = result.get('error') or 'Неизвестная ошибка'
                            logger.error(f"❌ Заявка не создана: {error_msg}")
                            await update.message.reply_text(f"❌ Ошибка создания заявки: {error_msg}")
                    else:
                        error_text = payment_response.text
                        logger.error(f"❌ Ошибка создания заявки: {error_text}")
                        await update.message.reply_text(f"❌ Ошибка создания заявки: {error_text[:200]}")
                
                # Очищаем состояние
                del user_states[user_id]
            except Exception as e:
                logger.error(f"❌ Ошибка при обработке фото чека: {e}", exc_info=True)
                await update.message.reply_text(f"❌ Ошибка при обработке фото: {str(e)[:200]}")
            return
        
        # Обработка вывода
        elif step == 'withdraw_phone':
            # Проверяем, не нажата ли кнопка с сохраненным номером
            if message_text and message_text.startswith("📱 "):
                phone = message_text.replace("📱 ", "").strip()
            else:
                phone = message_text.strip()
            
            # Проверка формата телефона
            if not phone.startswith('+996'):
                await update.message.reply_text('❌ Номер телефона должен начинаться с +996')
                return
            
            if len(phone) < 13 or len(phone) > 16:
                await update.message.reply_text('❌ Неверный формат номера телефона')
                return
            
            # Сохраняем номер телефона через API
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.post(
                        f"{API_URL}/api/public/casino-account",
                        json={
                            "user_id": str(user_id),
                            "casino_id": "phone",
                            "account_id": phone
                        },
                        headers={"Content-Type": "application/json"}
                    )
                    if response.status_code == 200:
                        result = response.json()
                        if result.get('success'):
                            # Сохраняем в локальное состояние для быстрого доступа
                            if 'saved_phones' not in data:
                                data['saved_phones'] = {}
                            data['saved_phones']['phone'] = phone
                            user_states[user_id]['data'] = data
            except Exception as e:
                logger.warning(f"Не удалось сохранить телефон через API: {e}")
            
            data['phone'] = phone
            state['step'] = 'withdraw_qr'
            user_states[user_id] = state
            
            # Создаем Reply клавиатуру с кнопкой отмены
            keyboard_buttons = [[KeyboardButton("❌ Отменить заявку")]]
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            await update.message.reply_text(
                f"💸 <b>Вывод средств</b>\n\nКазино: {data['bookmaker'].upper()}\nБанк: {data['bank']}\nТелефон: {phone}\n\nОтправьте фото QR-кода кошелька:",
                parse_mode='HTML',
                reply_markup=reply_markup
            )
            return
        
        elif step == 'withdraw_qr':
            # Проверяем, есть ли фото
            photo_file_id = None
            if update.message.photo:
                photo_file_id = update.message.photo[-1].file_id
            elif update.message.document and update.message.document.mime_type and update.message.document.mime_type.startswith('image/'):
                photo_file_id = update.message.document.file_id
            
            if not photo_file_id:
                await update.message.reply_text("❌ Пожалуйста, отправьте фото QR-кода")
                return
            
            # Сохраняем file_id фото
            data['qr_photo_id'] = photo_file_id
            state['step'] = 'withdraw_player_id'
            user_states[user_id] = state
            
            # Получаем сохраненный ID для этого казино из user_states
            saved_id = data.get('saved_player_ids', {}).get(data['bookmaker'], '')
            
            # Пытаемся получить сохраненный ID из API (нормализуем название казино)
            if not saved_id:
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        response = await client.get(
                            f"{API_URL}/api/public/casino-account",
                            params={"user_id": str(user_id), "casino_id": data['bookmaker'].lower()}
                        )
                        if response.status_code == 200:
                            result = response.json()
                            if result.get('success') and result.get('data', {}).get('accountId'):
                                saved_id = result.get('data', {}).get('accountId')
                                # Сохраняем в user_states для быстрого доступа
                                if 'saved_player_ids' not in data:
                                    data['saved_player_ids'] = {}
                                data['saved_player_ids'][data['bookmaker']] = saved_id
                                user_states[user_id]['data'] = data
                except Exception as e:
                    logger.warning(f"Не удалось получить сохраненный ID из API: {e}")
            
            # Создаем Reply клавиатуру с сохраненным ID и кнопкой отмены
            keyboard_buttons = []
            if saved_id:
                keyboard_buttons.append([KeyboardButton(f"ID: {saved_id}")])
            keyboard_buttons.append([KeyboardButton("❌ Отменить заявку")])
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            await update.message.reply_text(
                f"💸 <b>Вывод средств</b>\n\nКазино: {data['bookmaker'].upper()}\nБанк: {data['bank']}\nТелефон: {data['phone']}\nQR-код: ✅ Загружен\n\nВведите ваш ID игрока в казино:",
                parse_mode='HTML',
                reply_markup=reply_markup
            )
            return
        
        elif step == 'withdraw_player_id':
            # Проверяем, не нажата ли кнопка с сохраненным ID
            if message_text and message_text.startswith("ID: "):
                player_id = message_text.replace("ID: ", "").strip()
            else:
                if not message_text or not message_text.strip().isdigit():
                    await update.message.reply_text("❌ Введите корректный ID игрока (только цифры)")
                    return
                player_id = message_text.strip()
            
            # Сохраняем ID для этого казино в user_states
            if 'saved_player_ids' not in data:
                data['saved_player_ids'] = {}
            data['saved_player_ids'][data['bookmaker']] = player_id
            
            # Сохраняем ID через API в базу данных (нормализуем название казино)
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{API_URL}/api/public/casino-account",
                        json={
                            "user_id": str(user_id),
                            "casino_id": data['bookmaker'].lower(),
                            "account_id": player_id
                        },
                        headers={"Content-Type": "application/json"}
                    )
            except Exception as e:
                logger.warning(f"Не удалось сохранить ID через API: {e}")
            
            data['player_id'] = player_id
            state['step'] = 'withdraw_code'
            user_states[user_id] = state
            
            # Создаем Reply клавиатуру с кнопкой отмены
            keyboard_buttons = [[KeyboardButton("❌ Отменить заявку")]]
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            # Определяем адрес в зависимости от казино
            bookmaker_lower = data['bookmaker'].lower()
            if '1xbet' in bookmaker_lower or '1x' in bookmaker_lower:
                address_text = "tsum lux"
            else:
                address_text = "Lux on 24/7"
            
            instruction_text = f"""💸 <b>Вывод средств</b>

Казино: {data['bookmaker'].upper()}
Банк: {data['bank']}
Телефон: {data['phone']}
ID игрока: {data['player_id']}

📍 Заходим👇🏻
📍1. Настройки!
📍2. Вывести со счета!
📍3. Касса
📍4. Сумму для Вывода!
📍(Город Бишкек, улица: {address_text})
📍5. Подтвердить
📍6. Получить Код!
📍7. Отправить его нам"""
            
            await update.message.reply_text(
                instruction_text,
                parse_mode='HTML',
                reply_markup=reply_markup
            )
            return
        
        elif step == 'withdraw_code':
            if not message_text or not message_text.strip():
                await update.message.reply_text("❌ Введите код подтверждения")
                return
            
            withdrawal_code = message_text.strip()
            data['code'] = withdrawal_code
            
            # Получаем сумму вывода перед созданием заявки
            withdraw_amount = 0
            amount_check_ok = True
            try:
                checking_msg = await update.message.reply_text("🔍 Проверяю код вывода...")
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        f"{API_URL}/api/withdraw-check",
                        json={
                            "bookmaker": data['bookmaker'],
                            "playerId": data['player_id'],
                            "code": withdrawal_code
                        }
                    )
                    
                    try:
                        await checking_msg.delete()
                    except:
                        pass
                    
                    # Парсим JSON независимо от статуса, чтобы получить детальное сообщение об ошибке
                    try:
                        result = response.json()
                        logger.info(f"Ответ проверки суммы (статус {response.status_code}): {result}")
                    except Exception as json_error:
                        logger.error(f"Ошибка парсинга JSON ответа: {json_error}, статус: {response.status_code}")
                        try:
                            response_text = response.text[:200] if hasattr(response, 'text') else str(response.content[:200] if hasattr(response, 'content') else 'N/A')
                            logger.error(f"Текст ответа: {response_text}")
                        except:
                            pass
                        amount_check_ok = False
                        await update.message.reply_text("⚠️ Не удалось проверить сумму вывода. Попробуйте еще раз.")
                        # Выходим из блока try, но не из функции - обработка продолжится ниже
                    
                    if response.status_code == 200:
                        if result.get('success'):
                            # Парсим сумму: проверяем data.amount, data.summa, amount, summa
                            data_obj = result.get('data', {})
                            amount_value = (
                                data_obj.get('amount') or 
                                data_obj.get('summa') or 
                                result.get('amount') or 
                                result.get('summa')
                            )
                            
                            if amount_value is not None:
                                try:
                                    withdraw_amount = float(amount_value)
                                    if withdraw_amount <= 0:
                                        amount_check_ok = False
                                        await update.message.reply_text("⚠️ Сумма вывода не найдена. Проверьте код и попробуйте ещё раз.")
                                    else:
                                        logger.info(f"Сумма вывода получена: {withdraw_amount}")
                                except (ValueError, TypeError) as e:
                                    logger.error(f"Ошибка парсинга суммы: {e}, значение: {amount_value}")
                                    amount_check_ok = False
                                    await update.message.reply_text("⚠️ Ошибка при обработке суммы вывода. Попробуйте ещё раз.")
                            else:
                                amount_check_ok = False
                                error_message = result.get('error') or result.get('message') or 'Не удалось получить сумму вывода'
                                logger.error(f"Сумма не найдена в ответе. Структура ответа: {result}")
                                await update.message.reply_text(f"⚠️ {error_message}")
                        else:
                            amount_check_ok = False
                            error_message = result.get('error') or result.get('message') or 'Не удалось проверить код вывода'
                            await update.message.reply_text(f"⚠️ {error_message}")
                    else:
                        # Статус не 200 - показываем детальное сообщение об ошибке из JSON
                        amount_check_ok = False
                        error_message = result.get('error') or result.get('message') or f'Ошибка сервера (статус {response.status_code})'
                        logger.error(f"Ошибка проверки суммы вывода: статус {response.status_code}, сообщение: {error_message}, полный ответ: {result}")
                        await update.message.reply_text(f"⚠️ {error_message}")
            except Exception as e:
                logger.error(f"Ошибка проверки суммы вывода: {e}")
                amount_check_ok = False
                await update.message.reply_text("⚠️ Не удалось проверить сумму вывода. Попробуйте еще раз.")
            
            if not amount_check_ok:
                if user_id in user_states:
                    del user_states[user_id]
                await start(update, context)
                return
            
            # Отправляем заявку на вывод
            await submit_withdraw_request(update, context, user_id, data, withdraw_amount)
            
            # Очищаем состояние и убираем клавиатуру
            if user_id in user_states:
                del user_states[user_id]
            return
    
    # Если нет активного диалога, сохраняем сообщение в чат как обычно
    # 🛡️ Валидация входных данных
    if message_text:
        is_valid, error_msg = validate_input(message_text)
        if not is_valid:
            logger.warning(f"🚫 Invalid input from user {user_id}: {error_msg}")
            try:
                await update.message.reply_text("⚠️ Сообщение содержит недопустимые символы. Пожалуйста, отправьте корректное сообщение.")
            except:
                pass
            return
        # Очищаем входные данные
        message_text = sanitize_input(message_text)
    
    logger.info(f"📨 Получено сообщение от пользователя {user_id}: {message_text[:50] if message_text else 'медиа'}")
    
    # Определяем тип сообщения и медиа URL
    message_type = 'text'
    media_url = None
    
    if update.message.photo:
        message_type = 'photo'
        # Берем самое большое фото (последнее в массиве)
        media_url = update.message.photo[-1].file_id
    elif update.message.video:
        message_type = 'video'
        media_url = update.message.video.file_id
    elif update.message.document:
        message_type = 'document'
        media_url = update.message.document.file_id
    elif update.message.voice:
        message_type = 'voice'
        media_url = update.message.voice.file_id
    elif update.message.audio:
        message_type = 'audio'
        media_url = update.message.audio.file_id
    elif update.message.sticker:
        message_type = 'sticker'
        media_url = update.message.sticker.file_id
    
    # Пропускаем сохранение системных сообщений (кнопки отмены и т.д.)
    system_messages = ["❌ Отменить заявку", "💰 Пополнить", "💸 Вывести"]
    if message_text in system_messages:
        logger.debug(f"⏭️ Пропускаю сохранение системного сообщения: {message_text}")
    else:
        # Сохраняем сообщение в админку через API (неблокирующе)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                payload = {
                    "message_text": message_text,
                    "message_type": message_type,
                    "media_url": media_url,
                    "telegram_message_id": telegram_message_id
                }
                logger.debug(f"Отправка в API: {API_URL}/api/users/{user_id}/chat/ingest")
                logger.debug(f"Payload: {payload}")
                
                response = await client.post(
                    f"{API_URL}/api/users/{user_id}/chat/ingest",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    try:
                        response_data = response.json()
                        if response_data.get('success'):
                            logger.info(f"✅ Сообщение от пользователя {user_id} сохранено в чат (ID: {response_data.get('messageId')})")
                        else:
                            logger.warning(f"⚠️ API вернул success=false: {response_data.get('error')}")
                    except Exception as parse_error:
                        logger.warning(f"⚠️ Не удалось распарсить ответ API: {parse_error}")
                else:
                    try:
                        error_text = response.text
                        logger.error(f"❌ Ошибка API при сохранении сообщения: {response.status_code} - {error_text[:200]}")
                    except:
                        logger.error(f"❌ Ошибка API при сохранении сообщения: {response.status_code}")
        except httpx.TimeoutException:
            logger.warning(f"⚠️ Таймаут при сохранении сообщения в чат (не критично)")
        except Exception as e:
            logger.warning(f"⚠️ Ошибка при сохранении сообщения в чат (не критично): {e}")
    
    # Если нет активного диалога, показываем меню
    # Кнопки уже в Reply клавиатуре, не нужно отправлять отдельное сообщение
    # await update.message.reply_text(reply_text, reply_markup=reply_markup)

async def referral_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /referral для просмотра реферальной статистики"""
    user = update.effective_user
    user_id = user.id
    
    try:
        # Получаем данные реферальной программы через API
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{API_URL}/api/public/referral-data",
                params={"user_id": str(user_id)}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success'):
                    earned = data.get('earned', 0)
                    referral_count = data.get('referral_count', 0)
                    available_balance = data.get('available_balance', 0)
                    top_players = data.get('top_players', [])
                    user_rank = data.get('user_rank', 0)
                    
                    # Формируем сообщение
                    message_text = f"👥 <b>Реферальная программа</b>\n\n"
                    message_text += f"💰 Заработано: <b>{earned:.2f} сом</b>\n"
                    message_text += f"👤 Рефералов: <b>{referral_count}</b>\n"
                    
                    if available_balance > 0:
                        message_text += f"💵 Доступно для вывода: <b>{available_balance:.2f} сом</b>\n"
                    
                    if user_rank > 0:
                        message_text += f"\n🏆 Ваше место в топе: <b>#{user_rank}</b>\n"
                    
                    # Генерируем реферальную ссылку
                    referral_link = f"https://t.me/{context.bot.username}?start=ref{user_id}"
                    message_text += f"\n🔗 Ваша реферальная ссылка:\n<code>{referral_link}</code>\n"
                    
                    # Добавляем топ-5 игроков
                    if top_players:
                        message_text += f"\n🏆 <b>Топ-5 реферов:</b>\n"
                        for i, player in enumerate(top_players[:5], 1):
                            prize_text = ""
                            if player.get('prize'):
                                prize_text = f" (Приз: {player['prize']:.0f} сом)"
                            player_id = player.get('id', '')
                            player_username = player.get('username', f'Игрок #{player_id}')
                            message_text += f"{i}. {player_username}\n"
                            message_text += f"   💰 {player.get('total_deposits', 0):.0f} сом | 👥 {player.get('referral_count', 0)} реф.{prize_text}\n"
                    
                    # Кнопки
                    keyboard = [
                        [
                            InlineKeyboardButton("🚀 Открыть приложение", web_app=WebAppInfo(url=f"{WEBSITE_URL}/referral"))
                        ]
                    ]
                    reply_markup = InlineKeyboardMarkup(keyboard)
                    
                    await update.message.reply_text(
                        message_text,
                        reply_markup=reply_markup,
                        parse_mode='HTML'
                    )
                else:
                    await update.message.reply_text("❌ Ошибка при получении данных реферальной программы")
            else:
                await update.message.reply_text("❌ Ошибка при получении данных реферальной программы")
                
    except Exception as e:
        logger.error(f"Ошибка при получении реферальной статистики: {e}")
        await update.message.reply_text("❌ Произошла ошибка при получении данных")

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик callback от inline кнопок"""
    query = update.callback_query
    if not query:
        return
    
    # Отвечаем на callback, игнорируем ошибки для старых запросов
    try:
        await query.answer()
    except Exception as e:
        # Игнорируем ошибки "Query is too old" - это нормально для старых кнопок
        if "too old" in str(e).lower() or "timeout" in str(e).lower():
            logger.debug(f"⚠️ Callback query истек: {e}")
        else:
            logger.warning(f"⚠️ Ошибка при ответе на callback query: {e}")
    
    user = update.effective_user
    user_id = user.id
    callback_data = query.data
    
    # 🛡️ Валидация callback_data
    if callback_data:
        is_valid, error_msg = validate_input(callback_data, max_length=64)
        if not is_valid:
            logger.warning(f"🚫 Invalid callback_data from user {user_id}: {error_msg}")
            try:
                await query.answer("⚠️ Недопустимые данные", show_alert=True)
            except:
                pass
            return
        callback_data = sanitize_input(callback_data)
    
    logger.info(f"📥 Получен callback от пользователя {user_id}: {callback_data}")
    
    # Обработка callback'ов для выбора казино и банков убрана
    # Теперь выбор происходит через Reply клавиатуру в handle_message
    
    # Обработка выбора банка для вывода теперь через Reply клавиатуру (убрана callback обработка)
    
    # Обработка отмены заявки
    if callback_data == "cancel_request":
        logger.info(f"🛑 Пользователь {user_id} отменил заявку через инлайн-кнопку")
        
        # Останавливаем таймер если он активен
        if user_id in active_timers:
            try:
                active_timers[user_id].cancel()
                logger.info(f"⏹️ Таймер остановлен для пользователя {user_id}")
            except Exception as e:
                logger.warning(f"⚠️ Ошибка при остановке таймера: {e}")
            del active_timers[user_id]
        
        # Очищаем состояние
        if user_id in user_states:
            del user_states[user_id]
            logger.info(f"✅ Состояние очищено для пользователя {user_id}")
        
        await query.answer("Заявка отменена")
        
        # Создаем Reply клавиатуру с кнопками
        reply_keyboard = [
            [
                KeyboardButton("💰 Пополнить"),
                KeyboardButton("💸 Вывести")
            ]
        ]
        reply_markup = ReplyKeyboardMarkup(reply_keyboard, resize_keyboard=True, one_time_keyboard=False)
        
        # Отправляем приветственное сообщение (как в /start)
        user = query.from_user
        welcome_text = f"""Привет, {user.first_name}!

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: @operator_luxon_bot
💬 Чат для всех: @luxon_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности"""
        
        # Отправляем приветственное сообщение
        try:
            await query.message.reply_text(
                f"{welcome_text}\n\nВыберите действие:",
                reply_markup=reply_markup
            )
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке приветственного сообщения: {e}")
        return
    
    # Обработка возврата в главное меню
    if callback_data == "back_to_menu":
        if user_id in user_states:
            del user_states[user_id]
        await query.answer("Возврат в главное меню")
        
        # Создаем Reply клавиатуру с кнопками
        reply_keyboard = [
            [
                KeyboardButton("💰 Пополнить"),
                KeyboardButton("💸 Вывести")
            ]
        ]
        reply_markup = ReplyKeyboardMarkup(reply_keyboard, resize_keyboard=True, one_time_keyboard=False)
        
        user = query.from_user
        welcome_text = f"""Привет, {user.first_name}!

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: @operator_luxon_bot
💬 Чат для всех: @luxon_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности"""
        
        try:
            await query.edit_message_text(
                f"{welcome_text}\n\nВыберите действие:",
                parse_mode='HTML'
            )
            await query.message.reply_text(
                " ",
                reply_markup=reply_markup
            )
        except:
            # Если не удалось отредактировать сообщение, отправляем новое
            await query.message.reply_text(
                f"{welcome_text}\n\nВыберите действие:",
                parse_mode='HTML',
                reply_markup=reply_markup
            )
        return
    
    # Обработка проверки подписки
    if callback_data and callback_data.startswith('check_sub_'):
        channel_id = callback_data.replace('check_sub_', '')
        
        # Проверяем подписку
        is_subscribed = await check_channel_subscription(user_id, channel_id)
        
        if is_subscribed:
            # Пользователь подписан, отправляем основное меню
            try:
                # Получаем настройки канала для username
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{API_URL}/api/channel/settings")
                    channel_username = ''
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('success'):
                            channel_username = data.get('data', {}).get('username', '')
                
                # Создаем Reply клавиатуру с кнопками
                reply_keyboard = [
                    [
                        KeyboardButton("💰 Пополнить"),
                        KeyboardButton("💸 Вывести")
                    ]
                ]
                reply_markup = ReplyKeyboardMarkup(reply_keyboard, resize_keyboard=True, one_time_keyboard=False)
                
                welcome_text = f"""✅ <b>Спасибо за подписку!</b>

Привет, {user.first_name}!

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: @operator_luxon_bot
💬 Чат для всех: @luxon_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности"""
                
                await query.edit_message_text(
                    f"{welcome_text}\n\nВыберите действие:",
                    parse_mode='HTML'
                )
                await query.message.reply_text(
                    " ",
                    reply_markup=reply_markup
                )
                logger.info(f"✅ Основное меню отправлено пользователю {user_id} после проверки подписки")
            except Exception as e:
                logger.error(f"❌ Ошибка при отправке основного меню: {e}")
                await query.edit_message_text("✅ Спасибо за подписку! Используйте команду /start для продолжения.")
        else:
            # Пользователь не подписан
            await query.answer("❌ Вы еще не подписались на канал. Пожалуйста, подпишитесь и попробуйте снова.", show_alert=True)
            logger.info(f"⚠️ Пользователь {user_id} не подписан на канал")

async def update_timer(bot, user_id: int, total_seconds: int, data: dict, message_id: int, chat_id: int) -> None:
    """Обновляет таймер каждую секунду и отменяет заявку при истечении"""
    try:
        start_time = asyncio.get_event_loop().time()
        remaining_seconds = total_seconds
        
        while remaining_seconds > 0:
            await asyncio.sleep(1)
            
            # Проверяем, не была ли заявка уже создана (если создана, останавливаем таймер)
            if user_id not in user_states:
                logger.info(f"⏹️ Таймер остановлен для пользователя {user_id} - состояние очищено")
                # Удаляем таймер из активных
                if user_id in active_timers:
                    del active_timers[user_id]
                break  # Используем break вместо return для корректного завершения
            
            current_state = user_states.get(user_id, {})
            current_step = current_state.get('step', '')
            
            # Если заявка уже создана (отправлено фото), останавливаем таймер
            if current_step != 'deposit_bank' and current_step != 'deposit_receipt_photo':
                logger.info(f"⏹️ Таймер остановлен для пользователя {user_id} - заявка создана")
                # Удаляем таймер из активных
                if user_id in active_timers:
                    del active_timers[user_id]
                break  # Используем break вместо return для корректного завершения
            
            # Вычисляем оставшееся время
            elapsed = int(asyncio.get_event_loop().time() - start_time)
            remaining_seconds = max(0, total_seconds - elapsed)
            
            # Форматируем таймер
            minutes = remaining_seconds // 60
            seconds = remaining_seconds % 60
            timer_text = f"{minutes:02d}:{seconds:02d}"
            
            # Обновляем сообщение
            try:
                # Получаем актуальные данные
                current_data = user_states.get(user_id, {}).get('data', data)
                bank_links = current_data.get('bank_links', {})
                
                # Загружаем настройки если они устарели
                if asyncio.get_event_loop().time() - settings_cache.get('last_update', 0) > 300:
                    await load_settings()
                
                # Получаем список доступных банков из настроек
                enabled_banks = settings_cache.get('deposit_banks', [])
                
                # Создаем кнопки банков заново с учетом доступности
                keyboard = []
                bank_names_map = {
                    'demirbank': 'DemirBank',
                    'omoney': 'O!Money',
                    'balance': 'Balance.kg',
                    'bakai': 'Bakai',
                    'megapay': 'MegaPay',
                    'mbank': 'MBank'
                }
                
                all_banks_list = []
                added_banks = set()  # Отслеживаем уже добавленные банки
                for bank_key, bank_name in bank_names_map.items():
                    bank_link = bank_links.get(bank_key) or bank_links.get(bank_name)
                    # Также проверяем варианты с 'demir' для demirbank
                    if not bank_link and bank_key == 'demirbank':
                        bank_link = bank_links.get('demir') or bank_links.get('DemirBank')
                    
                    if bank_link and bank_name not in added_banks:
                        added_banks.add(bank_name)  # Помечаем банк как добавленный
                        is_enabled = bank_key in enabled_banks or 'demir' in bank_key.lower() or 'demirbank' in enabled_banks
                        if is_enabled:
                            # Кнопка с URL - сразу открывает ссылку на оплату
                            all_banks_list.append(InlineKeyboardButton(bank_name, url=bank_link))
                        else:
                            # Недоступный банк - показываем, но без ссылки (callback для показа сообщения)
                            all_banks_list.append(InlineKeyboardButton(f"{bank_name} ⚠️", callback_data=f"deposit_bank_{bank_key}_disabled"))
                
                # Разделяем на пары (по 2 в ряд)
                for i in range(0, len(all_banks_list), 2):
                    if i + 1 < len(all_banks_list):
                        keyboard.append([all_banks_list[i], all_banks_list[i + 1]])
                    else:
                        keyboard.append([all_banks_list[i]])
                
                keyboard.append([InlineKeyboardButton("❌ Отменить заявку", callback_data="cancel_request")])
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=message_id,
                    text=f"💰 <b>Пополнение счета</b>\n\n"
                         f"💰 <b>Сумма:</b> {current_data.get('amount', 0)} сом\n"
                         f"🎰 <b>Казино:</b> {current_data.get('bookmaker', '').upper()}\n"
                         f"🆔 <b>ID игрока:</b> {current_data.get('player_id', '')}\n\n"
                         f"⏰ <b>Таймер: {timer_text}</b>\n\n"
                         f"После оплаты отправьте фото чека:",
                    reply_markup=reply_markup,
                    parse_mode='HTML'
                )
            except Exception as e:
                logger.warning(f"⚠️ Не удалось обновить таймер для пользователя {user_id}: {e}")
                # Продолжаем работу таймера даже если не удалось обновить сообщение
        
        # Время истекло - отменяем заявку
        if user_id in user_states:
            logger.info(f"⏰ Таймер истек для пользователя {user_id}, отменяю заявку")
            
            # Очищаем состояние
            del user_states[user_id]
            
            # Удаляем таймер из активных
            if user_id in active_timers:
                del active_timers[user_id]
            
            # Отправляем сообщение об отмене
            try:
                # Создаем Reply клавиатуру с кнопками
                reply_keyboard = [
                    [
                        KeyboardButton("💰 Пополнить"),
                        KeyboardButton("💸 Вывести")
                    ]
                ]
                reply_markup = ReplyKeyboardMarkup(reply_keyboard, resize_keyboard=True, one_time_keyboard=False)
                
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=message_id,
                    text="⏰ <b>Пополнение отменено, время оплаты прошло</b>\n\n❌ <b>Не переводите по старым реквизитам</b>\n\nНачните заново, нажав на <b>Пополнить</b>",
                    parse_mode='HTML'
                )
                
                await bot.send_message(
                    chat_id=chat_id,
                    text="Выберите действие:",
                    reply_markup=reply_markup
                )
            except Exception as e:
                logger.error(f"❌ Ошибка при отправке сообщения об отмене для пользователя {user_id}: {e}")
    except asyncio.CancelledError:
        logger.info(f"⏹️ Таймер отменен для пользователя {user_id}")
        # Удаляем таймер из активных
        if user_id in active_timers:
            del active_timers[user_id]
    except Exception as e:
        logger.error(f"❌ Ошибка в таймере для пользователя {user_id}: {e}", exc_info=True)
        # Очищаем состояние при ошибке
        if user_id in user_states:
            del user_states[user_id]
        if user_id in active_timers:
            del active_timers[user_id]
    finally:
        # Гарантируем, что таймер удален из активных
        if user_id in active_timers:
            del active_timers[user_id]

async def get_photo_base64(bot, file_id: str) -> str:
    """Получает фото из Telegram и конвертирует в base64"""
    try:
        logger.info(f"📷 Начинаю загрузку фото: file_id={file_id}")
        file = await bot.get_file(file_id)
        logger.info(f"📷 Файл получен: file_path={file.file_path}, file_size={file.file_size}")
        file_data = await file.download_as_bytearray()
        logger.info(f"📷 Файл загружен: размер={len(file_data)} байт")
        base64_data = base64.b64encode(file_data).decode('utf-8')
        logger.info(f"📷 Base64 сгенерирован: длина={len(base64_data)} символов")
        result = f"data:image/jpeg;base64,{base64_data}"
        logger.info(f"✅ Фото успешно конвертировано в base64, итоговая длина: {len(result)} символов")
        return result
    except Exception as e:
        logger.error(f"❌ Ошибка при получении фото: {e}", exc_info=True)
        raise

async def submit_withdraw_request(update: Update, context: ContextTypes.DEFAULT_TYPE, user_id: int, data: dict, withdraw_amount: float) -> None:
    """Отправляет заявку на вывод"""
    try:
        # Получаем фото QR кода в base64
        qr_photo_base64 = None
        if 'qr_photo_id' in data:
            qr_photo_base64 = await get_photo_base64(context.bot, data['qr_photo_id'])
        
        bookmaker = data['bookmaker']
        normalized_bookmaker = bookmaker.lower()
        
        # Для 1xbet сначала выполняем вывод через withdraw-execute (как в клиентском сайте)
        if '1xbet' in normalized_bookmaker:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    execute_response = await client.post(
                        f"{API_URL}/api/withdraw-execute",
                        json={
                            "bookmaker": bookmaker,
                            "playerId": data['player_id'],
                            "code": data['code'],
                            "amount": withdraw_amount
                        },
                        headers={"Content-Type": "application/json"}
                    )
                    
                    # Парсим JSON независимо от статуса (как в клиентском сайте)
                    try:
                        execute_result = execute_response.json()
                        logger.info(f"Ответ withdraw-execute (статус {execute_response.status_code}): {execute_result}")
                    except Exception as json_error:
                        logger.error(f"Ошибка парсинга JSON ответа withdraw-execute: {json_error}, статус: {execute_response.status_code}")
                        try:
                            response_text = execute_response.text[:200] if hasattr(execute_response, 'text') else str(execute_response.content[:200] if hasattr(execute_response, 'content') else 'N/A')
                            logger.error(f"Текст ответа: {response_text}")
                        except:
                            pass
                        await update.message.reply_text("❌ Ошибка выполнения вывода. Попробуйте еще раз.")
                        await start(update, context)
                        return
                    
                    if execute_response.status_code != 200:
                        error_msg = execute_result.get('error') or execute_result.get('message') or f"Ошибка выполнения вывода: {execute_response.status_code}"
                        logger.error(f"Ошибка withdraw-execute: статус {execute_response.status_code}, сообщение: {error_msg}, полный ответ: {execute_result}")
                        await update.message.reply_text(f"❌ {error_msg}")
                        await start(update, context)
                        return
                    
                    if not execute_result.get('success'):
                        error_msg = execute_result.get('message') or execute_result.get('error') or 'Ошибка выполнения вывода'
                        await update.message.reply_text(f"❌ {error_msg}")
                        await start(update, context)
                        return
            except Exception as e:
                logger.error(f"Ошибка выполнения вывода для 1xbet: {e}")
                await update.message.reply_text("❌ Ошибка выполнения вывода. Попробуйте еще раз.")
                await start(update, context)
                return
        
        # Создаем заявку (используем те же поля, что и в клиентском сайте)
        user = update.effective_user
        request_body = {
            "type": "withdraw",  # Как в клиентском сайте
            "telegram_user_id": str(user_id),
            "userId": str(user_id),  # Добавляем userId как в клиентском сайте
            "amount": withdraw_amount,
            "bookmaker": bookmaker,
            "bank": data['bank'],
            "phone": data['phone'],
            "account_id": data['player_id'],
            "playerId": data['player_id'],  # Добавляем playerId как в клиентском сайте
            "telegram_username": user.username,
            "telegram_first_name": user.first_name,
            "telegram_last_name": user.last_name,
            "qr_photo": qr_photo_base64,  # Используем qr_photo как в клиентском сайте
            "site_code": data['code'],  # Используем site_code как в клиентском сайте (основное поле)
            "source": "bot"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            payment_response = await client.post(
                f"{API_URL}/api/payment",
                json=request_body,
                headers={"Content-Type": "application/json"}
            )
            
            # Парсим JSON независимо от статуса, чтобы получить детальное сообщение об ошибке
            try:
                result = payment_response.json()
                logger.info(f"Ответ API payment (статус {payment_response.status_code}): {result}")
            except Exception as json_error:
                logger.error(f"Ошибка парсинга JSON ответа payment: {json_error}, статус: {payment_response.status_code}")
                try:
                    response_text = payment_response.text[:200] if hasattr(payment_response, 'text') else str(payment_response.content[:200] if hasattr(payment_response, 'content') else 'N/A')
                    logger.error(f"Текст ответа: {response_text}")
                except:
                    pass
                await update.message.reply_text('❌ Ошибка создания заявки. Попробуйте еще раз.')
                await start(update, context)
                return
            
            if payment_response.status_code == 200:
                request_id = result.get('data', {}).get('id')
                
                # Проверяем success (как в клиентском сайте: result.success !== false)
                if result.get('success') is False:
                    error_message = result.get('error') or 'Неизвестная ошибка'
                    await update.message.reply_text(f'❌ {error_message}')
                    await start(update, context)
                    return
                
                if request_id:
                    # Форматируем сумму
                    amount_str = f"{withdraw_amount:.2f}".rstrip('0').rstrip('.')
                    
                    success_message = f"✅ Сумма вывода на {amount_str} сом получена.\n\n"
                    success_message += f"🎰 Казино: {data['bookmaker'].upper()}\n"
                    success_message += f"🏦 Банк: {data['bank']}\n"
                    success_message += f"📱 Телефон: {data['phone']}\n"
                    success_message += f"🆔 ID: {data['player_id']}\n\n"
                    success_message += "Ожидайте поступление денег. Ваша заявка будет обработана в ближайшее время."
                    
                    request_created_msg = await update.message.reply_text(success_message)
                    
                    # Сохраняем ID сообщения в заявке
                    if request_created_msg.message_id:
                        try:
                            async with httpx.AsyncClient(timeout=5.0) as client2:
                                await client2.patch(
                                    f"{API_URL}/api/requests/{request_id}",
                                    json={"telegram_message_id": request_created_msg.message_id}
                                )
                        except Exception as e:
                            logger.warning(f"Не удалось сохранить ID сообщения: {e}")
                else:
                    await update.message.reply_text('❌ Ошибка создания заявки')
            else:
                # Статус не 200 - показываем детальное сообщение об ошибке из JSON (как в клиентском сайте)
                error_message = result.get('error') or result.get('message') or f'Ошибка создания заявки ({payment_response.status_code})'
                logger.error(f"Ошибка API payment: статус {payment_response.status_code}, сообщение: {error_message}, полный ответ: {result}")
                await update.message.reply_text(f'❌ {error_message}')
        
        # Показываем главное меню
        await start(update, context)
                
    except Exception as e:
        logger.error(f"Ошибка создания заявки на вывод: {e}")
        error_msg = str(e).lower()
        if 'connection' in error_msg or 'connect' in error_msg or 'refused' in error_msg:
            await update.message.reply_text(
                '❌ Сервер недоступен. Пожалуйста, убедитесь, что админ-панель запущена на порту 3001.\n\n'
                'Запустите админ-панель:\n'
                'cd admin_nextjs\n'
                'npm run dev'
            )
        else:
            await update.message.reply_text('❌ Ошибка создания заявки. Попробуйте еще раз.')
        
        # Показываем главное меню
        await start(update, context)

async def submit_deposit_request(query, context: ContextTypes.DEFAULT_TYPE, user_id: int, data: dict) -> None:
    """Отправляет заявку на пополнение"""
    try:
        await query.answer("⏳ Отправляю заявку...")
        
        user = query.from_user
        request_body = {
            "type": "deposit",
            "bookmaker": data['bookmaker'],
            "userId": str(user_id),
            "telegram_user_id": str(user_id),
            "amount": data['amount'],
            "bank": data['bank'],
            "account_id": data['player_id'],
            "playerId": data['player_id'],
            "telegram_username": user.username,
            "telegram_first_name": user.first_name,
            "telegram_last_name": user.last_name,
            "source": "bot"  # Указываем, что заявка создана через бота
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            payment_response = await client.post(
                f"{API_URL}/api/payment",
                json=request_body,
                headers={"Content-Type": "application/json"}
            )
            
            if payment_response.status_code == 200:
                result = payment_response.json()
                if result.get('success') != False:
                    # Получаем ссылку на оплату
                    payment_url = result.get('data', {}).get('payment_url') or result.get('payment_url')
                    
                    if payment_url:
                        keyboard = [
                            [InlineKeyboardButton("💳 Оплатить", url=payment_url)]
                        ]
                        reply_markup = InlineKeyboardMarkup(keyboard)
                        
                        await query.edit_message_text(
                            f"✅ <b>Заявка на пополнение создана!</b>\n\n"
                            f"💰 Сумма: {data['amount']} сом\n"
                            f"🎰 Казино: {data['bookmaker'].upper()}\n"
                            f"🆔 ID игрока: {data['player_id']}\n"
                            f"🏦 Банк: {data['bank']}\n\n"
                            f"Нажмите кнопку ниже для оплаты:",
                            reply_markup=reply_markup,
                            parse_mode='HTML'
                        )
                    else:
                        await query.edit_message_text(
                            f"✅ <b>Заявка на пополнение создана!</b>\n\n"
                            f"💰 Сумма: {data['amount']} сом\n"
                            f"⏳ Ожидайте обработки заявки администратором.",
                            parse_mode='HTML'
                        )
                else:
                    error_msg = result.get('error') or 'Неизвестная ошибка'
                    await query.edit_message_text(f"❌ Ошибка создания заявки: {error_msg}")
            else:
                error_text = payment_response.text
                await query.edit_message_text(f"❌ Ошибка создания заявки: {error_text[:200]}")
                
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке заявки на пополнение: {e}", exc_info=True)
        await query.edit_message_text(f"❌ Произошла ошибка: {str(e)[:200]}")

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик ошибок"""
    error = context.error
    
    # Игнорируем ошибки заблокированных пользователей (это нормально)
    if "Forbidden: bot was blocked by the user" in str(error):
        logger.debug(f"⚠️ Пользователь заблокировал бота (update_id: {update.update_id if update else 'None'})")
        return
    
    # Логируем остальные ошибки
    logger.error(f"❌ Ошибка в боте: {error}", exc_info=error)
    
    # Пытаемся отправить сообщение пользователю об ошибке (только если не заблокирован)
    try:
        if update and update.effective_chat:
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="❌ Произошла ошибка. Попробуйте позже или напишите /start"
            )
    except Exception as e:
        # Игнорируем ошибки при отправке сообщения об ошибке (чтобы не зациклиться)
        if "Forbidden: bot was blocked by the user" not in str(e):
            logger.error(f"❌ Не удалось отправить сообщение об ошибке: {e}")

def main() -> None:
    """Главная функция"""
    # Проверяем, что используется правильный токен
    expected_token_start = "7927891546"  # Начало токена основного бота
    if not BOT_TOKEN.startswith(expected_token_start):
        logger.error(f"❌ ОШИБКА: Используется неправильный токен! Ожидается токен начинающийся с {expected_token_start}, получен: {BOT_TOKEN[:10]}...")
        print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Неправильный токен бота!")
        raise ValueError(f"Неправильный токен бота. Ожидается токен начинающийся с {expected_token_start}")
    
    logger.info(f"✅ Используется правильный токен основного бота: {BOT_TOKEN[:10]}...")
    print(f"✅ Токен бота проверен: {BOT_TOKEN[:10]}...")
    
    # Создаем приложение с post_init для загрузки настроек
    async def post_init(app: Application) -> None:
        """Загружает настройки после инициализации приложения"""
        logger.info("🔄 Загрузка настроек из админки...")
        try:
            await load_settings()
        except Exception as e:
            logger.warning(f"⚠️ Не удалось загрузить настройки при старте: {e}")
    
    application = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    
    # Добавляем обработчик команды /start
    application.add_handler(CommandHandler("start", start))
    
    # Добавляем обработчик команды /referral для просмотра реферальной статистики
    application.add_handler(CommandHandler("referral", referral_command))
    
    # Добавляем обработчик callback от inline кнопок
    application.add_handler(CallbackQueryHandler(handle_callback))
    
    # Добавляем обработчик всех сообщений (для сохранения в чат)
    # Важно: должен быть добавлен последним, чтобы не перехватывать команды
    from telegram.ext import MessageHandler, filters
    # Обработчик для всех сообщений кроме команд
    application.add_handler(MessageHandler(~filters.COMMAND, handle_message))
    
    # Добавляем обработчик ошибок
    application.add_error_handler(error_handler)
    
    # Запускаем бота
    print("🤖 Бот запущен!")
    logger.info("Bot started")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
