#!/usr/bin/env python3
"""
Обработчики старта для универсального бота
"""
import logging
from aiogram import Dispatcher, types
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

from translations import get_translation
import os
import urllib.parse
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
        
        # Проверяем реферальную ссылку
        start_param = None
        if message.text and len(message.text.split()) > 1:
            start_param = message.text.split()[1]
        
        if start_param and start_param.startswith('ref_'):
            # Обработка реферальной ссылки
            try:
                referrer_id = int(start_param.replace('ref_', ''))
                if referrer_id and referrer_id != user_id:
                    # Сохраняем реферала
                    db.save_referral(referrer_id, user_id)
                    logger.info(f"Новый реферал: {user_id} от {referrer_id}")
                    
                    # Уведомляем реферера
                    try:
                        referrer_lang = db.get_user_language(referrer_id)
                        referrer_translations = get_translation(referrer_lang)
                        
                        await bot.send_message(
                            referrer_id, 
                            f"🎉 У вас новый реферал!\n\n👤 @{message.from_user.username or 'Пользователь'}\n💰 Зарабатывайте 2% с его депозитов!"
                        )
                    except Exception as e:
                        logger.error(f"Ошибка уведомления реферера: {e}")
            except ValueError:
                logger.error(f"Неверный формат реферальной ссылки: {start_param}")
        
        # Получаем язык пользователя
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        # Минималистичное стартовое сообщение: кнопка открыть приложение + кнопка поделиться реф. ссылкой
        # Адрес мини‑приложения можно задать через WEB_APP_URL (например, https://luxservice.online)
        web_url = os.getenv('WEB_APP_URL', 'https://luxservice.online')
        try:
            bot_username = (await bot.get_me()).username or 'Lux_on_bot'
        except Exception:
            bot_username = 'Lux_on_bot'
        referral_link = f"https://t.me/{bot_username}?start=ref_{user_id}"
        share_text = translations.get('referral_invite', 'Присоединяйся и зарабатывай с LUXON!')
        share_url = "https://t.me/share/url?" + urllib.parse.urlencode({
            'url': referral_link,
            'text': share_text
        })

        # Добавим user_id и версию v=timestamp, чтобы обходить кеш Telegram WebView на чанках
        web_url_with_uid = web_url
        try:
            from urllib.parse import urlparse, urlencode, parse_qsl, urlunparse
            import time
            parts = urlparse(web_url)
            q = dict(parse_qsl(parts.query))
            q['uid'] = str(user_id)
            q['v'] = str(int(time.time()))
            new_query = urlencode(q)
            web_url_with_uid = urlunparse((parts.scheme, parts.netloc, parts.path or '/', parts.params, new_query, parts.fragment))
        except Exception:
            import time
            web_url_with_uid = f"{web_url.rstrip('/')}?uid={user_id}&v={int(time.time())}"

        inline_kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text='🚀 Открыть приложение', web_app=WebAppInfo(url=web_url_with_uid))],
            [InlineKeyboardButton(text='🔗 Поделиться реферальной ссылкой', url=share_url)]
        ])

        text = (
            f"<b>Добро пожаловать, {user_name}!</b>\n\n"
            f"Открой приложение, смотри статистику, делись ссылкой и зарабатывай.\n"
            f"<i>Твоя персональная ссылка появится автоматически при нажатии на ‘Поделиться’.</i>"
        )

        await message.answer(text, reply_markup=inline_kb, parse_mode="HTML")
        
    except Exception as e:
        logger.error(f"Ошибка в handle_start: {e}")
        await message.answer("Произошла ошибка при запуске бота")

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None, bot=None):
    """Регистрация обработчиков"""
    
    @dp.message(Command('start'))
    async def handle_start_wrapper(message: types.Message, state: FSMContext):
        """Обработка команды /start"""
        await handle_start(message, state, db, bot)
    
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
    
    

