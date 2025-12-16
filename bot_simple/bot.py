#!/usr/bin/env python3
"""
Простой Telegram бот для LUXON
Только команда /start с кнопками WebApp
"""

import logging
import re
import httpx
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from telegram.constants import ParseMode
from security import rate_limit_decorator, validate_input, sanitize_input

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Токен бота
BOT_TOKEN = "7927891546:AAHyroAGoOIV6qKFAnZur13i8gvw2hMnJ-4"

# URL сайта
WEBSITE_URL = "https://luxon.dad"
API_URL = "https://japar.click"

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

@rate_limit_decorator
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start"""
    user = update.effective_user
    user_id = user.id
    logger.info(f"📥 Получена команда /start от пользователя {user_id} (@{user.username})")
    
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
                    error_text = await response.text()
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
    
    # Создаем кнопки как полноэкранные мини-приложения (WebApp)
    keyboard = [
        [
            InlineKeyboardButton("💰 Пополнить", web_app=WebAppInfo(url=f"{WEBSITE_URL}/deposit/step0")),
            InlineKeyboardButton("💸 Вывести", web_app=WebAppInfo(url=f"{WEBSITE_URL}/withdraw/step0"))
        ],
        [
            InlineKeyboardButton("📊 История", web_app=WebAppInfo(url=f"{WEBSITE_URL}/history")),
            InlineKeyboardButton("👥 Рефералы", web_app=WebAppInfo(url=f"{WEBSITE_URL}/referral"))
        ],
        [
            InlineKeyboardButton("ℹ️ Инструкция", web_app=WebAppInfo(url=f"{WEBSITE_URL}/instruction")),
            InlineKeyboardButton("🆘 Поддержка", web_app=WebAppInfo(url=f"{WEBSITE_URL}/support"))
        ],
        [
            InlineKeyboardButton("🚀 Открыть приложение", web_app=WebAppInfo(url=WEBSITE_URL))
        ]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # Текст приветствия
    welcome_text = f"""Привет, {user.first_name}!

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: @operator_luxon_bot
💬 Чат для всех: @luxon_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности

Выберите действие:"""
    
    # Отправляем текст с кнопками (как в 1xbet боте - напрямую через update.message)
    try:
        await update.message.reply_text(
            welcome_text,
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

@rate_limit_decorator
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик всех текстовых сообщений от пользователей (не команд)"""
    if not update.message or not update.message.from_user:
        return
    
    user = update.message.from_user
    user_id = user.id
    message_text = update.message.text or update.message.caption or ''
    telegram_message_id = update.message.message_id
    
    # Пропускаем команды (они обрабатываются отдельными обработчиками)
    if message_text and message_text.startswith('/'):
        logger.warning(f"⚠️ handle_message получил команду {message_text} - это не должно происходить! Пропускаем.")
        return
    
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
    
    # Сохраняем сообщение в админку через API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
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
        logger.error(f"❌ Таймаут при сохранении сообщения в чат")
    except Exception as e:
        logger.error(f"❌ Ошибка при сохранении сообщения в чат: {e}", exc_info=True)
    
    # Отвечаем пользователю, предлагая использовать меню
    try:
        # Создаем кнопки как в команде /start
        keyboard = [
            [
                InlineKeyboardButton("💰 Пополнить", web_app=WebAppInfo(url=f"{WEBSITE_URL}/deposit/step0")),
                InlineKeyboardButton("💸 Вывести", web_app=WebAppInfo(url=f"{WEBSITE_URL}/withdraw/step0"))
            ],
            [
                InlineKeyboardButton("📊 История", web_app=WebAppInfo(url=f"{WEBSITE_URL}/history")),
                InlineKeyboardButton("👥 Рефералы", web_app=WebAppInfo(url=f"{WEBSITE_URL}/referral"))
            ],
            [
                InlineKeyboardButton("ℹ️ Инструкция", web_app=WebAppInfo(url=f"{WEBSITE_URL}/instruction")),
                InlineKeyboardButton("🆘 Поддержка", web_app=WebAppInfo(url=f"{WEBSITE_URL}/support"))
            ],
            [
                InlineKeyboardButton("🚀 Открыть приложение", web_app=WebAppInfo(url=WEBSITE_URL))
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        reply_text = "Используйте кнопки меню для работы с ботом 👇"
        await update.message.reply_text(reply_text, reply_markup=reply_markup)
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке ответа пользователю: {e}", exc_info=True)

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

@rate_limit_decorator
async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик callback от inline кнопок"""
    query = update.callback_query
    if not query:
        return
    
    await query.answer()
    
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
                
                # Создаем кнопки основного меню
                keyboard = [
                    [
                        InlineKeyboardButton("💰 Пополнить", web_app=WebAppInfo(url=f"{WEBSITE_URL}/deposit/step0")),
                        InlineKeyboardButton("💸 Вывести", web_app=WebAppInfo(url=f"{WEBSITE_URL}/withdraw/step0"))
                    ],
                    [
                        InlineKeyboardButton("📊 История", web_app=WebAppInfo(url=f"{WEBSITE_URL}/history")),
                        InlineKeyboardButton("👥 Рефералы", web_app=WebAppInfo(url=f"{WEBSITE_URL}/referral"))
                    ],
                    [
                        InlineKeyboardButton("ℹ️ Инструкция", web_app=WebAppInfo(url=f"{WEBSITE_URL}/instruction")),
                        InlineKeyboardButton("🆘 Поддержка", web_app=WebAppInfo(url=f"{WEBSITE_URL}/support"))
                    ],
                    [
                        InlineKeyboardButton("🚀 Открыть приложение", web_app=WebAppInfo(url=WEBSITE_URL))
                    ]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                welcome_text = f"""✅ <b>Спасибо за подписку!</b>

Привет, {user.first_name}!

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: @operator_luxon_bot
💬 Чат для всех: @luxon_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности

Выберите действие:"""
                
                await query.edit_message_text(
                    welcome_text,
                    reply_markup=reply_markup,
                    parse_mode='HTML'
                )
                logger.info(f"✅ Основное меню отправлено пользователю {user_id} после проверки подписки")
            except Exception as e:
                logger.error(f"❌ Ошибка при отправке основного меню: {e}")
                await query.edit_message_text("✅ Спасибо за подписку! Используйте команду /start для продолжения.")
        else:
            # Пользователь не подписан
            await query.answer("❌ Вы еще не подписались на канал. Пожалуйста, подпишитесь и попробуйте снова.", show_alert=True)
            logger.info(f"⚠️ Пользователь {user_id} не подписан на канал")

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
    
    # Создаем приложение
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Добавляем обработчик команды /start
    application.add_handler(CommandHandler("start", start))
    
    # Добавляем обработчик команды /referral для просмотра реферальной статистики
    application.add_handler(CommandHandler("referral", referral_command))
    
    # Добавляем обработчик callback от inline кнопок
    application.add_handler(CallbackQueryHandler(handle_callback))
    
    # Добавляем обработчик всех сообщений (для сохранения в чат)
    # Важно: должен быть добавлен последним, чтобы не перехватывать команды
    from telegram.ext import MessageHandler, filters
    # Обработчик для текстовых сообщений (не команд)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    # Обработчик для медиа (фото, видео, документы, голосовые, аудио)
    application.add_handler(MessageHandler(
        filters.PHOTO | filters.VIDEO | filters.Document.ALL | filters.VOICE | filters.AUDIO,
        handle_message
    ))
    # Обработчик для всех остальных сообщений (включая стикеры, локации и т.д.)
    application.add_handler(MessageHandler(
        ~filters.COMMAND & ~filters.TEXT & ~filters.PHOTO & ~filters.VIDEO & ~filters.Document.ALL & ~filters.VOICE & ~filters.AUDIO,
        handle_message
    ))
    
    # Добавляем обработчик ошибок
    application.add_error_handler(error_handler)
    
    # Запускаем бота
    print("🤖 Бот запущен!")
    logger.info("Bot started")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
