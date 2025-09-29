#!/usr/bin/env python3
"""
Обработчики реферальной системы
"""
import logging
from aiogram import types
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder
from translations import get_translation
import os
import urllib.parse

logger = logging.getLogger(__name__)

async def handle_referral(message: types.Message, db):
    """Обработка реферальной системы"""
    user_id = message.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    # Получаем статистику пользователя
    stats = db.get_user_referral_stats(user_id)
    
    # Создаем реферальную ссылку
    try:
        bot_username = message.bot.username
    except:
        bot_username = "Lux_on_bot"  # Fallback username
    referral_link = f"https://t.me/{bot_username}?start=ref_{user_id}"
    
    # URL мини‑приложения + фолбэк с uid
    web_url = os.getenv('WEB_APP_URL', 'https://luxservice.online')
    try:
        parts = urllib.parse.urlparse(web_url)
        q = dict(urllib.parse.parse_qsl(parts.query))
        new_query = urllib.parse.urlencode(q)
        web_url_with_uid = urllib.parse.urlunparse((parts.scheme, parts.netloc, parts.path or '/', parts.params, new_query, parts.fragment))
    except Exception:
        web_url_with_uid = f"{web_url.rstrip('/')}?uid={user_id}"

    # Клавиатура: только открыть приложение и поделиться, плюс назад
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text='🚀 Открыть приложение', web_app=WebAppInfo(url=web_url_with_uid))],
        [InlineKeyboardButton(text=translations['referral_share_button'], url=f"https://t.me/share/url?url={referral_link}&text={translations['referral_invite']}")],
        [InlineKeyboardButton(text=translations['back_to_main'], callback_data="back_to_menu")]
    ])
    
    # Короткий текст без блока статистики
    text = (
        "💎 <b>Реферальная система LUXON</b>\n\n"
        "🏆 Призы топ‑3 ежемесячно: 10 000 / 5 000 / 2 500 KGS\n"
        "💰 Комиссия: 5% с депозитов ваших рефералов\n\n"
        "🔗 <b>Ваша ссылка:</b> <code>{link}</code>\n"
    ).format(link=referral_link)
    
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")

async def handle_referral_stats(callback: types.CallbackQuery, db):
    """Обработка статистики рефералов"""
    user_id = callback.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    # Получаем статистику пользователя
    stats = db.get_user_referral_stats(user_id)
    
    # Получаем список рефералов
    referrals = db.get_user_referrals(user_id)
    
    # Создаем красивую статистику с пагинацией
    text = f"""
📊 <b>Ваша статистика</b>

┌─────────────────────────────┐
│  👥 Приглашено: {stats['total_referrals']:>10} │
│  💰 Заработано: {stats['total_earnings']:>8.2f} сом │
│  🏆 Позиция: {stats['position']:>13} │
└─────────────────────────────┘

📋 <b>Ваши рефералы:</b>
"""
    
    if referrals:
        for i, ref in enumerate(referrals[:5], 1):  # Показываем только первые 5
            text += f"• @{ref['username']} - {ref['amount']:.2f} сом\n"
        
        if len(referrals) > 5:
            text += f"\n... и еще {len(referrals) - 5} рефералов"
    else:
        text += "Пока нет рефералов 😔"
    
    text += f"\n\n💡 <i>Приглашайте друзей и зарабатывайте вместе!</i>"
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🏆 Топ рефералов", callback_data="referral_top"),
            InlineKeyboardButton(text="📊 Все рефералы", callback_data="all_referrals")
        ],
        [
            InlineKeyboardButton(text="🔙 Назад", callback_data="referral_back")
        ]
    ])
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()

async def handle_referral_top(callback: types.CallbackQuery, db):
    """Обработка топа рефералов"""
    user_id = callback.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    # Получаем топ рефералов
    top = db.get_referral_top(10)
    
    text = f"""
🏆 <b>Топ рефералов</b>

┌─────────────────────────────┐
│  💎 Ежемесячные выплаты:    │
│  🥇 1 место: 10,000 сом     │
│  🥈 2 место: 5,000 сом      │
│  🥉 3 место: 2,500 сом      │
└─────────────────────────────┘

📊 <b>Текущий рейтинг:</b>
"""
    
    if top:
        for i, user in enumerate(top[:10], 1):  # Показываем топ-10
            if i <= 3:
                position_emoji = "🥇" if i == 1 else "🥈" if i == 2 else "🥉"
                text += f"{position_emoji} <b>@{user['username']}</b> - {user['total_earnings']:.2f} сом\n"
            else:
                text += f"{i:2d}. @{user['username']} - {user['total_earnings']:.2f} сом\n"
    else:
        text += "Пока нет данных 📊"
    
    text += f"\n💡 <i>Станьте частью топа и зарабатывайте больше!</i>"
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📊 Моя статистика", callback_data="referral_stats"),
            InlineKeyboardButton(text="🌐 Полный рейтинг", callback_data="full_rating")
        ],
        [
            InlineKeyboardButton(text="🔙 Назад", callback_data="referral_back")
        ]
    ])
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()

async def handle_all_referrals(callback: types.CallbackQuery, db, page=1):
    """Показать всех рефералов с пагинацией"""
    user_id = callback.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    # Получаем всех рефералов
    referrals = db.get_user_referrals(user_id)
    
    # Пагинация
    items_per_page = 8
    total_pages = (len(referrals) + items_per_page - 1) // items_per_page
    start_idx = (page - 1) * items_per_page
    end_idx = start_idx + items_per_page
    page_referrals = referrals[start_idx:end_idx]
    
    text = f"""
📊 <b>Все ваши рефералы</b>

┌─────────────────────────────┐
│  📄 Страница {page} из {total_pages}        │
│  👥 Всего: {len(referrals)} рефералов       │
└─────────────────────────────┘

"""
    
    if page_referrals:
        for i, ref in enumerate(page_referrals, start_idx + 1):
            text += f"{i:2d}. @{ref['username']} - {ref['amount']:.2f} сом\n"
    else:
        text += "Пока нет рефералов 😔"
    
    text += f"\n💡 <i>Приглашайте друзей и зарабатывайте вместе!</i>"
    
    # Создаем клавиатуру с пагинацией
    keyboard_buttons = []
    
    # Кнопки навигации
    nav_buttons = []
    if page > 1:
        nav_buttons.append(InlineKeyboardButton(text="⬅️", callback_data=f"referrals_page_{page-1}"))
    if page < total_pages:
        nav_buttons.append(InlineKeyboardButton(text="➡️", callback_data=f"referrals_page_{page+1}"))
    
    if nav_buttons:
        keyboard_buttons.append(nav_buttons)
    
    # Основные кнопки
    keyboard_buttons.extend([
        [
            InlineKeyboardButton(text="📊 Статистика", callback_data="referral_stats"),
            InlineKeyboardButton(text="🏆 Топ", callback_data="referral_top")
        ],
        [
            InlineKeyboardButton(text="🔙 Назад", callback_data="referral_back")
        ]
    ])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()

async def handle_full_rating(callback: types.CallbackQuery, db, page=1):
    """Показать полный рейтинг с пагинацией"""
    user_id = callback.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    # Получаем всех пользователей
    all_users = db.get_referral_top(100)  # Получаем больше пользователей
    
    # Пагинация
    items_per_page = 10
    total_pages = (len(all_users) + items_per_page - 1) // items_per_page
    start_idx = (page - 1) * items_per_page
    end_idx = start_idx + items_per_page
    page_users = all_users[start_idx:end_idx]
    
    text = f"""
🌐 <b>Полный рейтинг</b>

┌─────────────────────────────┐
│  📄 Страница {page} из {total_pages}        │
│  👥 Всего: {len(all_users)} участников     │
└─────────────────────────────┘

"""
    
    if page_users:
        for i, user in enumerate(page_users, start_idx + 1):
            if i <= 3:
                position_emoji = "🥇" if i == 1 else "🥈" if i == 2 else "🥉"
                text += f"{position_emoji} <b>@{user['username']}</b> - {user['total_earnings']:.2f} сом\n"
            else:
                text += f"{i:2d}. @{user['username']} - {user['total_earnings']:.2f} сом\n"
    else:
        text += "Пока нет данных 📊"
    
    text += f"\n💡 <i>Станьте частью рейтинга и зарабатывайте больше!</i>"
    
    # Создаем клавиатуру с пагинацией
    keyboard_buttons = []
    
    # Кнопки навигации
    nav_buttons = []
    if page > 1:
        nav_buttons.append(InlineKeyboardButton(text="⬅️", callback_data=f"rating_page_{page-1}"))
    if page < total_pages:
        nav_buttons.append(InlineKeyboardButton(text="➡️", callback_data=f"rating_page_{page+1}"))
    
    if nav_buttons:
        keyboard_buttons.append(nav_buttons)
    
    # Основные кнопки
    keyboard_buttons.extend([
        [
            InlineKeyboardButton(text="📊 Моя статистика", callback_data="referral_stats"),
            InlineKeyboardButton(text="🏆 Топ-10", callback_data="referral_top")
        ],
        [
            InlineKeyboardButton(text="🔙 Назад", callback_data="referral_back")
        ]
    ])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()
    
async def handle_referral_back(callback: types.CallbackQuery, db):
    """Возврат к реферальной системе"""
    user_id = callback.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    # Получаем статистику пользователя
    stats = db.get_user_referral_stats(user_id)
    
    # Создаем реферальную ссылку
    try:
        bot_username = callback.bot.username
    except:
        bot_username = "Lux_on_bot"  # Fallback username
    referral_link = f"https://t.me/{bot_username}?start=ref_{user_id}"
    
    # Создаем клавиатуру
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=translations['referral_my_stats'], callback_data="referral_stats"),
            InlineKeyboardButton(text=translations['referral_top'], callback_data="referral_top")
        ],
        [
            InlineKeyboardButton(text=translations['referral_share_button'], url=f"https://t.me/share/url?url={referral_link}&text={translations['referral_invite']}")
        ],
        [
            InlineKeyboardButton(text=translations['back_to_main'], callback_data="back_to_menu")
        ]
    ])
    
    # Формируем сообщение
    text = f"""
{translations['referral_title']}

{translations['referral_top_rewards']}

{translations['referral_commission']}

{translations['referral_how_it_works']}
{translations['referral_commission_desc']}
{translations['referral_top_calc']}
{translations['referral_monthly_rewards']}
{translations['referral_min_deposit']}

{translations['referral_link']}
<code>{referral_link}</code>

{translations['referral_stats']}
{translations['referral_invited']} {stats['total_referrals']}
{translations['referral_earned']} {stats['total_earnings']:.2f} сом
{translations['referral_position']} #{stats['position']}

{translations['referral_share']}
"""
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()

def add_referral_commission(db, referrer_id: int, referred_id: int, amount: float, bookmaker: str):
    """Добавление реферальной комиссии"""
    try:
        # 2% комиссия
        commission_amount = amount * 0.02
        
        # Добавляем заработок
        db.add_referral_earning(referrer_id, referred_id, amount, commission_amount, bookmaker)
        
        logger.info(f"Added referral commission: {commission_amount} for referrer {referrer_id} from {referred_id}")
        return True
    except Exception as e:
        logger.error(f"Error adding referral commission: {e}")
        return False

def process_monthly_top_payments(db):
    """Обработка ежемесячных выплат топ-3"""
    try:
        # Обрабатываем выплаты
        db.process_top_payments()
        
        # Получаем топ-3
        top_3 = db.get_referral_top(3)
        
        logger.info(f"Processed monthly top payments for {len(top_3)} users")
        return top_3
    except Exception as e:
        logger.error(f"Error processing monthly top payments: {e}")
        return []

def register_handlers(dp, db, bookmakers):
    """Регистрация обработчиков реферальной системы"""
    # Обработчики уже зарегистрированы в main.py
    pass