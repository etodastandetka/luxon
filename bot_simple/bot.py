#!/usr/bin/env python3
"""
Простой Telegram бот для LUXON
Только команда /start с кнопками WebApp
"""

import logging
import re
import httpx
import base64
from io import BytesIO
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from telegram.constants import ParseMode
from security import rate_limit_decorator, validate_input, sanitize_input
import asyncio

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

# Словарь для хранения состояний пользователей
user_states = {}

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
    
    # Создаем кнопки для пополнения и вывода
    keyboard = [
        [
            InlineKeyboardButton("💰 Пополнить", callback_data="deposit"),
            InlineKeyboardButton("💸 Вывести", callback_data="withdraw")
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

🔒 Финансовый контроль обеспечен личным отделом безопасности"""
    
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
    
    # Проверяем, есть ли активный диалог
    if user_id in user_states:
        state = user_states[user_id]
        step = state.get('step', '')
        data = state.get('data', {})
        
        # Если отправлено фото, но не в состоянии withdraw_qr - показываем ошибку
        if (update.message.photo or (update.message.document and update.message.document.mime_type and update.message.document.mime_type.startswith('image/'))) and step != 'withdraw_qr':
            await update.message.reply_text("❌ Сейчас не требуется отправка фото. Следуйте инструкциям выше.")
            return
        
        # Обработка отмены заявки через Reply клавиатуру
        if message_text and "отменить заявку" in message_text.lower():
            if user_id in user_states:
                del user_states[user_id]
            await update.message.reply_text(
                "❌ Заявка отменена",
                reply_markup=ReplyKeyboardRemove()
            )
            keyboard = [
                [
                    InlineKeyboardButton("💰 Пополнить", callback_data="deposit"),
                    InlineKeyboardButton("💸 Вывести", callback_data="withdraw")
                ]
            ]
            await update.message.reply_text(
                "Выберите действие:",
                reply_markup=InlineKeyboardMarkup(keyboard)
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
            
            # Сохраняем ID для этого казино
            if 'saved_player_ids' not in data:
                data['saved_player_ids'] = {}
            data['saved_player_ids'][data['bookmaker']] = player_id
            
            data['player_id'] = player_id
            state['step'] = 'deposit_amount'
            user_states[user_id] = state
            
            # Создаем Reply клавиатуру с кнопкой отмены
            keyboard_buttons = [[KeyboardButton("❌ Отменить заявку")]]
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            await update.message.reply_text(
                f"💰 <b>Пополнение счета</b>\n\nКазино: {data['bookmaker'].upper()}\nID игрока: {data['player_id']}\n\nВведите сумму пополнения (от 35 до 100,000 сом):",
                parse_mode='HTML',
                reply_markup=reply_markup
            )
            return
        
        elif step == 'deposit_amount':
            try:
                amount = float(message_text.replace(',', '.').strip())
                if amount < 35 or amount > 100000:
                    await update.message.reply_text("❌ Сумма должна быть от 35 до 100,000 сом")
                    return
            except ValueError:
                await update.message.reply_text("❌ Введите корректную сумму (число)")
                return
            
            data['amount'] = amount
            state['step'] = 'deposit_bank'
            user_states[user_id] = state
            
            # Получаем ссылки на оплату через API
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    qr_response = await client.post(
                        f"{API_URL}/api/public/generate-qr",
                        json={
                            "amount": amount,
                            "playerId": data['player_id'],
                            "bank": "demirbank"  # По умолчанию, но ссылки будут для всех банков
                        },
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if qr_response.status_code == 200:
                        qr_data = qr_response.json()
                        if qr_data.get('success') and qr_data.get('data'):
                            bank_links = qr_data['data'].get('bankLinks', {})
                            timer_seconds = qr_data['data'].get('timerSeconds', 300)
                            
                            # Форматируем таймер
                            minutes = timer_seconds // 60
                            seconds = timer_seconds % 60
                            timer_text = f"{minutes:02d}:{seconds:02d}"
                            
                            # Создаем инлайн кнопки с ссылками для всех банков
                            keyboard = []
                            bank_names = {
                                'demirbank': 'DemirBank',
                                'omoney': 'O!Money',
                                'balance': 'Balance.kg',
                                'bakai': 'Bakai',
                                'megapay': 'MegaPay',
                                'mbank': 'MBank'
                            }
                            
                            for bank_code, bank_name in bank_names.items():
                                if bank_code in bank_links or bank_name in bank_links:
                                    url = bank_links.get(bank_code) or bank_links.get(bank_name)
                                    if url:
                                        keyboard.append([InlineKeyboardButton(f"💳 {bank_name}", url=url)])
                            
                            keyboard.append([InlineKeyboardButton("❌ Отменить заявку", callback_data="cancel_request")])
                            reply_markup = InlineKeyboardMarkup(keyboard)
                            
                            # Убираем Reply клавиатуру
                            await update.message.reply_text(
                                f"💰 <b>Пополнение счета</b>\n\n"
                                f"Казино: {data['bookmaker'].upper()}\n"
                                f"ID игрока: {data['player_id']}\n"
                                f"Сумма: {amount} сом\n\n"
                                f"⏰ <b>Таймер: {timer_text}</b>\n\n"
                                f"Выберите банк для оплаты:",
                                reply_markup=reply_markup,
                                parse_mode='HTML'
                            )
                            # Сохраняем данные для последующего создания заявки после выбора банка
                            user_states[user_id]['step'] = 'deposit_bank_select'
                            return
            except Exception as e:
                logger.error(f"❌ Ошибка при получении ссылок на оплату: {e}")
            
            # Если не удалось получить ссылки, показываем обычные кнопки
            keyboard = [
                [
                    InlineKeyboardButton("DemirBank", callback_data="deposit_bank_demirbank"),
                    InlineKeyboardButton("O!Money", callback_data="deposit_bank_omoney")
                ],
                [
                    InlineKeyboardButton("Balance.kg", callback_data="deposit_bank_balance"),
                    InlineKeyboardButton("Bakai", callback_data="deposit_bank_bakai")
                ],
                [
                    InlineKeyboardButton("MegaPay", callback_data="deposit_bank_megapay"),
                    InlineKeyboardButton("MBank", callback_data="deposit_bank_mbank")
                ],
                [InlineKeyboardButton("❌ Отменить заявку", callback_data="cancel_request")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await update.message.reply_text(
                f"💰 <b>Пополнение счета</b>\n\nКазино: {data['bookmaker'].upper()}\nID игрока: {data['player_id']}\nСумма: {amount} сом\n\nВыберите банк для оплаты:",
                reply_markup=reply_markup,
                parse_mode='HTML'
            )
            return
        
        # Обработка отправки фото чека для депозита
        elif step == 'deposit_receipt_photo':
            # Проверяем, есть ли фото
            photo_file_id = None
            if update.message.photo:
                photo_file_id = update.message.photo[-1].file_id
            elif update.message.document and update.message.document.mime_type and update.message.document.mime_type.startswith('image/'):
                photo_file_id = update.message.document.file_id
            
            if not photo_file_id:
                await update.message.reply_text("❌ Пожалуйста, отправьте фото чека")
                return
            
            # Получаем фото в base64
            try:
                await update.message.reply_text("⏳ Обрабатываю фото чека...")
                receipt_photo_base64 = await get_photo_base64(context.bot, photo_file_id)
                
                # Обновляем заявку с фото чека
                request_id = data.get('request_id')
                if request_id and request_id != 'N/A':
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        # Обновляем заявку через PATCH
                        update_response = await client.patch(
                            f"{API_URL}/api/requests/{request_id}",
                            json={
                                "photoFileUrl": receipt_photo_base64
                            },
                            headers={"Content-Type": "application/json"}
                        )
                        
                        if update_response.status_code == 200:
                            await update.message.reply_text(
                                f"✅ <b>Фото чека отправлено!</b>\n\n"
                                f"Заявка #{request_id} обновлена.\n"
                                f"Ожидайте обработки заявки администратором.",
                                parse_mode='HTML',
                                reply_markup=ReplyKeyboardRemove()
                            )
                        else:
                            error_text = await update_response.text()
                            await update.message.reply_text(f"⚠️ Фото получено, но не удалось обновить заявку: {error_text[:200]}")
                else:
                    await update.message.reply_text("✅ Фото чека получено!")
                
                # Очищаем состояние
                del user_states[user_id]
            except Exception as e:
                logger.error(f"❌ Ошибка при обработке фото чека: {e}")
                await update.message.reply_text(f"❌ Ошибка при обработке фото: {str(e)[:200]}")
            return
        
        # Обработка вывода
        elif step == 'withdraw_phone':
            phone = message_text.strip()
            clean_phone = re.sub(r'[^\d]', '', phone)
            if len(clean_phone) < 12:
                await update.message.reply_text("❌ Введите корректный номер телефона (минимум 12 цифр, формат: +996XXXXXXXXX)")
                return
            
            data['phone'] = clean_phone
            state['step'] = 'withdraw_qr'
            user_states[user_id] = state
            
            # Создаем Reply клавиатуру с кнопкой отмены
            keyboard_buttons = [[KeyboardButton("❌ Отменить заявку")]]
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            await update.message.reply_text(
                f"💸 <b>Вывод средств</b>\n\nКазино: {data['bookmaker'].upper()}\nБанк: {data['bank']}\nТелефон: +{clean_phone}\n\nОтправьте фото QR-кода кошелька:",
                parse_mode='HTML',
                reply_markup=reply_markup
            )
            return
        
        elif step == 'withdraw_qr':
            # Проверяем, есть ли фото (может быть отправлено как фото или как медиа)
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
            
            # Получаем сохраненный ID для этого казино
            saved_id = data.get('saved_player_ids', {}).get(data['bookmaker'], '')
            
            # Создаем Reply клавиатуру с сохраненным ID и кнопкой отмены
            keyboard_buttons = []
            if saved_id:
                keyboard_buttons.append([KeyboardButton(f"ID: {saved_id}")])
            keyboard_buttons.append([KeyboardButton("❌ Отменить заявку")])
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            await update.message.reply_text(
                f"💸 <b>Вывод средств</b>\n\nКазино: {data['bookmaker'].upper()}\nБанк: {data['bank']}\nТелефон: +{data['phone']}\nQR-код: ✅ Загружен\n\nВведите ваш ID игрока в казино:",
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
            
            # Сохраняем ID для этого казино
            if 'saved_player_ids' not in data:
                data['saved_player_ids'] = {}
            data['saved_player_ids'][data['bookmaker']] = player_id
            
            data['player_id'] = player_id
            state['step'] = 'withdraw_code'
            user_states[user_id] = state
            
            # Создаем Reply клавиатуру с кнопкой отмены
            keyboard_buttons = [[KeyboardButton("❌ Отменить заявку")]]
            reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
            
            await update.message.reply_text(
                f"💸 <b>Вывод средств</b>\n\nКазино: {data['bookmaker'].upper()}\nБанк: {data['bank']}\nТелефон: +{data['phone']}\nID игрока: {data['player_id']}\n\nВведите код подтверждения с сайта казино:",
                parse_mode='HTML',
                reply_markup=reply_markup
            )
            return
        
        elif step == 'withdraw_code':
            if not message_text or not message_text.strip():
                await update.message.reply_text("❌ Введите код подтверждения")
                return
            
            data['code'] = message_text.strip()
            
            # Отправляем заявку на вывод
            await submit_withdraw_request(update, context, user_id, data)
            
            # Очищаем состояние и убираем клавиатуру
            del user_states[user_id]
            await update.message.reply_text(
                "✅ Заявка отправлена!",
                reply_markup=ReplyKeyboardRemove()
            )
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
    
    # Если нет активного диалога, показываем меню
    keyboard = [
        [
            InlineKeyboardButton("💰 Пополнить", callback_data="deposit"),
            InlineKeyboardButton("💸 Вывести", callback_data="withdraw")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    reply_text = "Выберите действие:"
    await update.message.reply_text(reply_text, reply_markup=reply_markup)

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
    
    # Обработка кнопок пополнения и вывода
    if callback_data == "deposit":
        # Начинаем диалог пополнения
        user_states[user_id] = {
            'step': 'deposit_bookmaker',
            'data': {}
        }
        
        keyboard = [
            [
                InlineKeyboardButton("1XBET", callback_data="deposit_bookmaker_1xbet"),
                InlineKeyboardButton("1WIN", callback_data="deposit_bookmaker_1win")
            ],
            [
                InlineKeyboardButton("MELBET", callback_data="deposit_bookmaker_melbet"),
                InlineKeyboardButton("MOSTBET", callback_data="deposit_bookmaker_mostbet")
            ],
            [
                InlineKeyboardButton("WINWIN", callback_data="deposit_bookmaker_winwin"),
                InlineKeyboardButton("888STARZ", callback_data="deposit_bookmaker_888starz")
            ],
            [InlineKeyboardButton("❌ Отменить заявку", callback_data="cancel_request")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            "💰 <b>Пополнение счета</b>\n\nВыберите казино:",
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
        return
    
    if callback_data == "withdraw":
        # Начинаем диалог вывода
        user_states[user_id] = {
            'step': 'withdraw_bookmaker',
            'data': {}
        }
        
        keyboard = [
            [
                InlineKeyboardButton("1XBET", callback_data="withdraw_bookmaker_1xbet"),
                InlineKeyboardButton("1WIN", callback_data="withdraw_bookmaker_1win")
            ],
            [
                InlineKeyboardButton("MELBET", callback_data="withdraw_bookmaker_melbet"),
                InlineKeyboardButton("MOSTBET", callback_data="withdraw_bookmaker_mostbet")
            ],
            [
                InlineKeyboardButton("WINWIN", callback_data="withdraw_bookmaker_winwin"),
                InlineKeyboardButton("888STARZ", callback_data="withdraw_bookmaker_888starz")
            ],
            [InlineKeyboardButton("❌ Отменить заявку", callback_data="cancel_request")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            "💸 <b>Вывод средств</b>\n\nВыберите казино:",
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
        return
    
    # Обработка выбора казино для пополнения
    if callback_data and callback_data.startswith("deposit_bookmaker_"):
        bookmaker = callback_data.replace("deposit_bookmaker_", "")
        user_states[user_id]['data']['bookmaker'] = bookmaker
        user_states[user_id]['step'] = 'deposit_player_id'
        
        # Получаем сохраненный ID для этого казино
        saved_id = user_states[user_id]['data'].get('saved_player_ids', {}).get(bookmaker, '')
        
        # Создаем Reply клавиатуру с сохраненным ID и кнопкой отмены
        keyboard_buttons = []
        if saved_id:
            keyboard_buttons.append([KeyboardButton(f"ID: {saved_id}")])
        keyboard_buttons.append([KeyboardButton("❌ Отменить заявку")])
        reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
        
        await query.edit_message_text(
            f"💰 <b>Пополнение счета</b>\n\nКазино: {bookmaker.upper()}\n\nВведите ваш ID игрока в казино:",
            parse_mode='HTML'
        )
        await query.message.reply_text(
            "Используйте клавиатуру ниже или введите ID вручную:",
            reply_markup=reply_markup
        )
        return
    
    # Обработка выбора казино для вывода
    if callback_data and callback_data.startswith("withdraw_bookmaker_"):
        bookmaker = callback_data.replace("withdraw_bookmaker_", "")
        user_states[user_id]['data']['bookmaker'] = bookmaker
        user_states[user_id]['step'] = 'withdraw_bank'
        
        keyboard = [
            [
                InlineKeyboardButton("Компаньон", callback_data="withdraw_bank_kompanion"),
                InlineKeyboardButton("DemirBank", callback_data="withdraw_bank_demirbank")
            ],
            [
                InlineKeyboardButton("O!Money", callback_data="withdraw_bank_omoney"),
                InlineKeyboardButton("Balance.kg", callback_data="withdraw_bank_balance")
            ],
            [
                InlineKeyboardButton("Bakai", callback_data="withdraw_bank_bakai"),
                InlineKeyboardButton("MegaPay", callback_data="withdraw_bank_megapay")
            ],
            [
                InlineKeyboardButton("MBank", callback_data="withdraw_bank_mbank")
            ],
            [InlineKeyboardButton("❌ Отменить заявку", callback_data="cancel_request")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            f"💸 <b>Вывод средств</b>\n\nКазино: {bookmaker.upper()}\n\nВыберите банк для получения средств:",
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
        return
    
    # Обработка выбора банка для депозита
    if callback_data and callback_data.startswith("deposit_bank_"):
        bank = callback_data.replace("deposit_bank_", "")
        data = user_states[user_id]['data']
        data['bank'] = bank
        
        # Сначала создаем заявку на депозит
        user = query.from_user
        request_body = {
            "type": "deposit",
            "bookmaker": data['bookmaker'],
            "userId": str(user_id),
            "telegram_user_id": str(user_id),
            "amount": data['amount'],
            "bank": bank,
            "account_id": data['player_id'],
            "playerId": data['player_id'],
            "telegram_username": user.username,
            "telegram_first_name": user.first_name,
            "telegram_last_name": user.last_name
        }
        
        # Получаем ссылки на оплату через API
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Создаем заявку
                payment_response = await client.post(
                    f"{API_URL}/api/payment",
                    json=request_body,
                    headers={"Content-Type": "application/json"}
                )
                
                if payment_response.status_code != 200:
                    error_text = await payment_response.text()
                    await query.edit_message_text(f"❌ Ошибка создания заявки: {error_text[:200]}")
                    return
                
                result = payment_response.json()
                if result.get('success') == False:
                    error_msg = result.get('error') or 'Неизвестная ошибка'
                    await query.edit_message_text(f"❌ Ошибка создания заявки: {error_msg}")
                    return
                
                # Получаем QR ссылки
                qr_response = await client.post(
                    f"{API_URL}/api/public/generate-qr",
                    json={
                        "amount": data['amount'],
                        "playerId": data['player_id'],
                        "bank": bank
                    },
                    headers={"Content-Type": "application/json"}
                )
                
                if qr_response.status_code == 200:
                    qr_data = qr_response.json()
                    if qr_data.get('success') and qr_data.get('data'):
                        bank_links = qr_data['data'].get('bankLinks', {})
                        timer_seconds = qr_data['data'].get('timerSeconds', 300)
                        
                        # Создаем инлайн кнопки с ссылками для всех банков
                        keyboard = []
                        bank_names = {
                            'demirbank': 'DemirBank',
                            'omoney': 'O!Money',
                            'balance': 'Balance.kg',
                            'bakai': 'Bakai',
                            'megapay': 'MegaPay',
                            'mbank': 'MBank'
                        }
                        
                        for bank_code, bank_name in bank_names.items():
                            if bank_code in bank_links or bank_name in bank_links:
                                url = bank_links.get(bank_code) or bank_links.get(bank_name)
                                if url:
                                    keyboard.append([InlineKeyboardButton(f"💳 {bank_name}", url=url)])
                        
                        keyboard.append([InlineKeyboardButton("❌ Отменить заявку", callback_data="cancel_request")])
                        reply_markup = InlineKeyboardMarkup(keyboard)
                        
                        # Форматируем таймер
                        minutes = timer_seconds // 60
                        seconds = timer_seconds % 60
                        timer_text = f"{minutes:02d}:{seconds:02d}"
                        
                        request_id = result.get('id') or result.get('data', {}).get('id') or 'N/A'
                        
                        # Сохраняем request_id для последующего обновления фото чека
                        data['request_id'] = request_id
                        user_states[user_id]['step'] = 'deposit_receipt_photo'
                        user_states[user_id]['data'] = data
                        
                        # Создаем Reply клавиатуру с кнопкой отмены
                        keyboard_buttons = [[KeyboardButton("❌ Отменить заявку")]]
                        reply_markup_keyboard = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
                        
                        await query.edit_message_text(
                            f"✅ <b>Заявка на пополнение создана!</b>\n\n"
                            f"💰 Сумма: {data['amount']} сом\n"
                            f"🎰 Казино: {data['bookmaker'].upper()}\n"
                            f"🆔 ID игрока: {data['player_id']}\n"
                            f"🏦 Банк: {bank}\n"
                            f"🆔 ID заявки: #{request_id}\n\n"
                            f"⏰ <b>Таймер: {timer_text}</b>\n\n"
                            f"Выберите банк для оплаты:",
                            reply_markup=reply_markup,
                            parse_mode='HTML'
                        )
                        await query.message.reply_text(
                            "После оплаты отправьте фото чека:",
                            reply_markup=reply_markup_keyboard
                        )
                        return
        except Exception as e:
            logger.error(f"❌ Ошибка при создании заявки или получении ссылок: {e}")
            await query.edit_message_text(f"❌ Произошла ошибка: {str(e)[:200]}")
            return
        
        # Если не удалось получить ссылки, просто показываем успех
        request_id = result.get('id') or result.get('data', {}).get('id') or 'N/A'
        await query.edit_message_text(
            f"✅ <b>Заявка на пополнение создана!</b>\n\n"
            f"💰 Сумма: {data['amount']} сом\n"
            f"🎰 Казино: {data['bookmaker'].upper()}\n"
            f"🆔 ID игрока: {data['player_id']}\n"
            f"🏦 Банк: {bank}\n"
            f"🆔 ID заявки: #{request_id}\n\n"
            f"⏳ Ожидайте обработки заявки администратором.",
            parse_mode='HTML'
        )
        del user_states[user_id]
        return
    
    # Обработка выбора банка для вывода
    if callback_data and callback_data.startswith("withdraw_bank_"):
        bank = callback_data.replace("withdraw_bank_", "")
        user_states[user_id]['data']['bank'] = bank
        user_states[user_id]['step'] = 'withdraw_phone'
        
        # Создаем Reply клавиатуру с кнопкой отмены
        keyboard_buttons = [[KeyboardButton("❌ Отменить заявку")]]
        reply_markup = ReplyKeyboardMarkup(keyboard_buttons, resize_keyboard=True, one_time_keyboard=False)
        
        await query.edit_message_text(
            f"💸 <b>Вывод средств</b>\n\nКазино: {user_states[user_id]['data']['bookmaker'].upper()}\nБанк: {bank}\n\nВведите номер телефона для получения средств (формат: +996XXXXXXXXX):",
            parse_mode='HTML'
        )
        await query.message.reply_text(
            "Используйте клавиатуру ниже:",
            reply_markup=reply_markup
        )
        return
    
    # Обработка отмены заявки
    if callback_data == "cancel_request":
        if user_id in user_states:
            del user_states[user_id]
        await query.answer("Заявка отменена")
        
        # Убираем Reply клавиатуру если она была
        try:
            await query.message.reply_text(
                "❌ Заявка отменена",
                reply_markup=ReplyKeyboardRemove()
            )
        except:
            pass
        
        keyboard = [
            [
                InlineKeyboardButton("💰 Пополнить", callback_data="deposit"),
                InlineKeyboardButton("💸 Вывести", callback_data="withdraw")
            ]
        ]
        await query.edit_message_text(
            "Выберите действие:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return
    
    # Обработка возврата в меню
    if callback_data == "back_to_menu":
        if user_id in user_states:
            del user_states[user_id]
        # Показываем главное меню
        keyboard = [
            [
                InlineKeyboardButton("💰 Пополнить", callback_data="deposit"),
                InlineKeyboardButton("💸 Вывести", callback_data="withdraw")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        welcome_text = f"""Привет, {user.first_name}!

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: @operator_luxon_bot
💬 Чат для всех: @luxon_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности"""
        
        await query.edit_message_text(
            welcome_text,
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
                
                # Создаем кнопки для пополнения и вывода
                keyboard = [
                    [
                        InlineKeyboardButton("💰 Пополнить", callback_data="deposit"),
                        InlineKeyboardButton("💸 Вывести", callback_data="withdraw")
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

🔒 Финансовый контроль обеспечен личным отделом безопасности"""
                
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

async def get_photo_base64(bot, file_id: str) -> str:
    """Получает фото из Telegram и конвертирует в base64"""
    try:
        file = await bot.get_file(file_id)
        file_data = await file.download_as_bytearray()
        base64_data = base64.b64encode(file_data).decode('utf-8')
        return f"data:image/jpeg;base64,{base64_data}"
    except Exception as e:
        logger.error(f"❌ Ошибка при получении фото: {e}")
        raise

async def submit_withdraw_request(update: Update, context: ContextTypes.DEFAULT_TYPE, user_id: int, data: dict) -> None:
    """Отправляет заявку на вывод"""
    try:
        await update.message.reply_text("⏳ Проверяю код и отправляю заявку...")
        
        # Получаем фото QR кода в base64
        qr_photo_base64 = None
        if 'qr_photo_id' in data:
            qr_photo_base64 = await get_photo_base64(context.bot, data['qr_photo_id'])
        
        # Проверяем код через API
        async with httpx.AsyncClient(timeout=30.0) as client:
            check_response = await client.post(
                f"{API_URL}/api/withdraw-check",
                json={
                    "bookmaker": data['bookmaker'],
                    "playerId": data['player_id'],
                    "code": data['code']
                },
                headers={"Content-Type": "application/json"}
            )
            
            if check_response.status_code != 200:
                error_text = await check_response.text()
                await update.message.reply_text(f"❌ Ошибка проверки кода: {error_text[:200]}")
                return
            
            check_data = check_response.json()
            if not check_data.get('success'):
                error_msg = check_data.get('error') or check_data.get('message') or 'Код неверный'
                await update.message.reply_text(f"❌ {error_msg}")
                return
            
            # Получаем сумму
            amount = None
            if check_data.get('data') and check_data['data'].get('amount'):
                amount = float(check_data['data']['amount'])
            elif check_data.get('amount'):
                amount = float(check_data['amount'])
            
            if not amount or amount <= 0:
                await update.message.reply_text("❌ Не удалось получить сумму вывода")
                return
            
            # Для 1xbet выполняем вывод
            if data['bookmaker'].lower() in ['1xbet', 'xbet']:
                execute_response = await client.post(
                    f"{API_URL}/api/withdraw-execute",
                    json={
                        "bookmaker": data['bookmaker'],
                        "playerId": data['player_id'],
                        "code": data['code'],
                        "amount": amount
                    },
                    headers={"Content-Type": "application/json"}
                )
                
                if execute_response.status_code != 200:
                    error_text = await execute_response.text()
                    await update.message.reply_text(f"❌ Ошибка выполнения вывода: {error_text[:200]}")
                    return
            
            # Создаем заявку
            user = update.effective_user
            request_body = {
                "type": "withdraw",
                "bookmaker": data['bookmaker'],
                "userId": str(user_id),
                "telegram_user_id": str(user_id),
                "phone": data['phone'],
                "amount": amount,
                "bank": data['bank'],
                "account_id": data['player_id'],
                "playerId": data['player_id'],
                "qr_photo": qr_photo_base64,
                "site_code": data['code'],
                "telegram_username": user.username,
                "telegram_first_name": user.first_name,
                "telegram_last_name": user.last_name,
                "source": "bot"  # Указываем, что заявка создана через бота
            }
            
            payment_response = await client.post(
                f"{API_URL}/api/payment",
                json=request_body,
                headers={"Content-Type": "application/json"}
            )
            
            if payment_response.status_code == 200:
                result = payment_response.json()
                if result.get('success') != False:
                    await update.message.reply_text(
                        f"✅ <b>Заявка на вывод создана успешно!</b>\n\n"
                        f"💰 Сумма: {amount} сом\n"
                        f"🏦 Банк: {data['bank']}\n"
                        f"📱 Телефон: +{data['phone']}\n"
                        f"🆔 ID заявки: #{result.get('id') or result.get('data', {}).get('id')}\n\n"
                        f"⏳ Ожидайте обработки заявки администратором.",
                        parse_mode='HTML'
                    )
                else:
                    error_msg = result.get('error') or 'Неизвестная ошибка'
                    await update.message.reply_text(f"❌ Ошибка создания заявки: {error_msg}")
            else:
                error_text = await payment_response.text()
                await update.message.reply_text(f"❌ Ошибка создания заявки: {error_text[:200]}")
                
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке заявки на вывод: {e}", exc_info=True)
        await update.message.reply_text(f"❌ Произошла ошибка: {str(e)[:200]}")

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
        
        async with httpx.AsyncClient(timeout=30.0) as client:
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
                error_text = await payment_response.text()
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
