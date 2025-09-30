#!/usr/bin/env python3
"""
Обработчики старта для универсального бота
"""
import logging
from aiogram import Dispatcher, types
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

from translations import get_translation
import os
import urllib.parse
import re
import requests

logger = logging.getLogger(__name__)

def get_bot_settings():
    """Получает настройки бота из Django админки"""
    try:
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

async def check_channel_subscription(bot, user_id, channel_name):
    """Проверяет подписку пользователя на канал"""
    try:
        # Получаем информацию о канале
        chat_member = await bot.get_chat_member(channel_name, user_id)
        return chat_member.status in ['member', 'administrator', 'creator']
    except Exception as e:
        logger.error(f"Ошибка проверки подписки на канал {channel_name}: {e}")
        return False

async def handle_start(message: types.Message, state: FSMContext, db, bot):
    """Обработка команды /start"""
    # Сбрасываем состояние при /start
    await state.clear()
    
    try:
        logger.info(f"/start received text='{message.text}' from user_id={message.from_user.id}")
        user_id = message.from_user.id
        user_name = message.from_user.first_name or message.from_user.username or "Пользователь"
        
        # Очищаем все состояния пользователя в базе данных
        db.save_user_data(user_id, 'current_state', '')
        db.save_user_data(user_id, 'current_action', '')
        db.save_user_data(user_id, 'current_bookmaker', '')
        
        # Получаем настройки бота
        bot_settings = get_bot_settings()
        
        # Проверяем подписку на канал, если она включена
        if bot_settings.get('channel', {}).get('enabled', False):
            channel_name = bot_settings.get('channel', {}).get('name', '@bingokg_news')
            is_subscribed = await check_channel_subscription(bot, user_id, channel_name)
            
            if not is_subscribed:
                # Показываем сообщение о необходимости подписки
                await message.answer(
                    f"📢 <b>Подписка на канал обязательна!</b>\n\n"
                    f"Для использования бота необходимо подписаться на канал:\n"
                    f"🔗 {channel_name}\n\n"
                    f"После подписки нажмите /start снова.",
                    parse_mode="HTML"
                )
                return
        
        # Сохраняем пользователя
        db.save_user(
            user_id=user_id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
            last_name=message.from_user.last_name
        )
        
        # Проверяем реферальную ссылку (робастно):
        # Поддерживаем: "/start ref_123", "/startref_123", лишние пробелы, любой регистр, также просто "ref_123" в тексте
        raw = (message.text or '').strip()
        referrer_id = None
        try:
            m = re.search(r"\bref[_=]?(\d{5,})\b", raw, flags=re.IGNORECASE)
            if m:
                referrer_id = int(m.group(1))
            elif raw.lower().startswith('/startref_'):
                # fallback для редких клиентов
                digits = re.sub(r"\D", "", raw[len('/start'):])
                referrer_id = int(digits) if digits else None
        except Exception:
            referrer_id = None

        if referrer_id:
            # Обработка реферальной ссылки
            try:
                if referrer_id and referrer_id != user_id:
                    saved = db.save_referral(referrer_id, user_id)
                    if saved:
                        logger.info(f"Новый реферал: {user_id} от {referrer_id}")
                        # Уведомляем реферера при первой привязке
                        try:
                            await bot.send_message(
                                referrer_id,
                                (
                                    "🎉 По вашей ссылке зарегистрировался новый пользователь!\n\n"
                                    f"👤 @{message.from_user.username or 'пользователь'} (ID: {user_id})\n"
                                    "💸 Бонусы начнут начисляться после его депозитов."
                                )
                            )
                        except Exception as e:
                            logger.error(f"Ошибка уведомления реферера: {e}")
                    else:
                        # Если уже привязан к ЭТОМУ же рефереру — отправим уведомление о повторном визите (без дублей привязки)
                        existing_ref = db.get_referrer_id(user_id)
                        if existing_ref and int(existing_ref) == int(referrer_id):
                            # Простейший антиспам: не чаще одного раза в сутки
                            from datetime import datetime
                            key = f"ref_visit_notified_{referrer_id}"
                            last = db.get_user_data(user_id, key)
                            today = datetime.utcnow().strftime('%Y-%m-%d')
                            if last != today:
                                try:
                                    await bot.send_message(
                                        referrer_id,
                                        (
                                            "✅ Ваш реферал снова активен по вашей ссылке.\n\n"
                                            f"👤 @{message.from_user.username or 'пользователь'} (ID: {user_id})"
                                        )
                                    )
                                except Exception as e:
                                    logger.error(f"Ошибка уведомления реферера (повторный визит): {e}")
                                # Запоминаем отметку на сегодня
                                db.save_user_data(user_id, key, today)
                        else:
                            logger.info(f"Пользователь {user_id} уже привязан к другому рефереру ({existing_ref}), уведомление не отправляем")
            except Exception as e:
                logger.error(f"Ошибка обработки реферальной ссылки: {e}")
        
        # Получаем язык пользователя
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        # Показываем главное меню с локализованным приветствием
        try:
            from handlers.deposit_handlers import show_main_menu
            await show_main_menu(message, language)
        except Exception as e:
            # Фолбэк: простое приветствие без клавиатуры
            await message.answer(
                translations.get('welcome', f"Привет, {user_name}!").format(user_name=user_name, admin_username='@luxon_support'),
                parse_mode="HTML"
            )
        
    except Exception as e:
        logger.error(f"Ошибка в handle_start: {e}")
        await message.answer("Произошла ошибка при запуске бота")
    
    # Явный deep-link хендлер: /start <payload>
    @dp.message(CommandStart(deep_link=True))
    async def handle_start_deeplink(message: types.Message, state: FSMContext):
        await handle_start(message, state, db, bot)

    @dp.message(Command('start'))
    async def handle_start_wrapper(message: types.Message, state: FSMContext):
        """Обработка команды /start"""
        await handle_start(message, state, db, bot)
    
    @dp.message(Command('ref'))
    async def handle_ref_bind(message: types.Message):
        """Ручная привязка пригласившего: /ref <telegram_id>.
        Полезно, если пользователь уже запускал бота и deep-link не передал payload."""
        try:
            parts = (message.text or '').split()
            if len(parts) < 2:
                await message.reply("Укажите ID пригласившего: /ref 123456789")
                return
            referrer_id = int(parts[1])
            user_id = message.from_user.id
            if referrer_id == user_id:
                await message.reply("Нельзя указать самого себя.")
                return
            ok = db.save_referral(referrer_id, user_id)
            if ok:
                await message.reply("Пригласивший успешно привязан. Спасибо!")
                # Уведомим реферера
                try:
                    await bot.send_message(referrer_id, (
                        "🎉 По вашей ссылке зарегистрировался новый пользователь!\n\n"
                        f"👤 @{message.from_user.username or 'пользователь'} (ID: {user_id})\n"
                        "💸 Бонусы начнут начисляться после его депозитов."
                    ))
                except Exception as e:
                    logger.error(f"Notify referrer error: {e}")
            else:
                await message.reply("Привязка не выполнена: возможно, вы уже привязаны к другому пригласившему или указан неверный ID.")
        except Exception as e:
            logger.error(f"/ref error: {e}")
            await message.reply("Ошибка обработки команды /ref")
    @dp.message(Command('help'))
    async def handle_help(message: types.Message):
        """Обработка команды /help"""
        try:
            user_id = message.from_user.id
            language = db.get_user_language(user_id)
            translations = get_translation(language)
            
            help_text = translations['help_text'].format(
                bot_name="LUXON",
                admin_username='@luxon_support'
            )
            
            await message.answer(help_text, parse_mode="HTML")
            
        except Exception as e:
            logger.error(f"Ошибка в handle_help: {e}")
            await message.answer("Произошла ошибка при показе справки")
    
    @dp.message(Command('clear'))
    async def handle_clear(message: types.Message):
        """Очистка состояний пользователя"""
        try:
            user_id = message.from_user.id
            
            # Очищаем все состояния пользователя
            db.save_user_data(user_id, 'current_state', '')
            db.save_user_data(user_id, 'current_action', '')
            db.save_user_data(user_id, 'current_bookmaker', '')
            db.save_user_data(user_id, 'current_amount', '')
            db.save_user_data(user_id, 'current_qr_hash', '')
            db.save_user_data(user_id, 'qr_photo_id', '')
            db.save_user_data(user_id, 'withdraw_id', '')
            db.save_user_data(user_id, 'withdraw_code', '')
            db.save_user_data(user_id, 'selected_bank', '')
            
            await message.answer("✅ Все состояния очищены! Теперь можете начать заново.")
            
        except Exception as e:
            logger.error(f"Ошибка при очистке состояний: {e}")
            await message.answer("❌ Ошибка при очистке состояний")
    
    

