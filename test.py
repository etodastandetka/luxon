#!/usr/bin/env python3
"""
Р ТђР ВµР Р…Р Т‘Р В»Р ВµРЎР‚РЎвЂ№ Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В° РЎРѓРЎР‚Р ВµР Т‘РЎРѓРЎвЂљР Р† - РЎС“Р С—РЎР‚Р С•РЎвЂ°Р ВµР Р…Р Р…РЎвЂ№Р в„– Р С—РЎР‚Р С•РЎвЂ Р ВµРЎРѓРЎРѓ
"""
import logging
import random
from datetime import datetime
from aiogram import types, Dispatcher, F
from aiogram.fsm.context import FSMContext
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, FSInputFile
from aiogram.utils.keyboard import InlineKeyboardBuilder
from translations import get_translation
from config import BOOKMAKERS, BOT_TOKEN

logger = logging.getLogger(__name__)

async def send_withdraw_request_to_group(bot, user_id: int, amount: float, bookmaker: str, bank_code: str, withdraw_id: str, code: str, photo_file_id: str = None):
    """Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµРЎвЂљ Р В·Р В°РЎРЏР Р†Р С”РЎС“ Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘ Р Р† Р С–РЎР‚РЎС“Р С—Р С—РЎС“ Р В°Р Т‘Р СР С‘Р Р…РЎС“"""
    try:
        # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р С‘Р Р…РЎвЂћР С•РЎР‚Р СР В°РЎвЂ Р С‘РЎР‹ Р С• Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р Вµ
        user_info = await bot.get_chat(user_id)
        username = user_info.username or "Р СњР ВµРЎвЂљ username"
        first_name = user_info.first_name or "Р СњР ВµРЎвЂљ Р С‘Р СР ВµР Р…Р С‘"
        
        # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”Р С‘ Р В±РЎС“Р С”Р СР ВµР С”Р ВµРЎР‚Р В°
        bookmaker_config = BOOKMAKERS.get(bookmaker, {})
        group_id = bookmaker_config.get('withdraw_group_id')
        
        if not group_id:
            logger.error(f"Р СњР Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р… group_id Р Т‘Р В»РЎРЏ Р В±РЎС“Р С”Р СР ВµР С”Р ВµРЎР‚Р В° {bookmaker}")
            return False
            
        # Р РЋР С•Р В·Р Т‘Р В°Р ВµР С РЎвЂљР ВµР С”РЎРѓРЎвЂљ Р В·Р В°РЎРЏР Р†Р С”Р С‘
        request_text = f"""
СЂСџвЂќвЂќ <b>Р СњР С•Р Р†Р В°РЎРЏ Р В·Р В°РЎРЏР Р†Р С”Р В° Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘</b>

СЂСџвЂВ¤ <b>Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ:</b> @{username}
СЂСџвЂ вЂќ <b>ID:</b> {user_id}
СЂСџРЏСћ <b>Р вЂРЎС“Р С”Р СР ВµР С”Р ВµРЎР‚:</b> {bookmaker_config.get('name', bookmaker.upper())}
СЂСџвЂ™В° <b>Р РЋРЎС“Р СР СР В°:</b> {amount:.2f} РЎРѓР С•Р С
СЂСџРЏВ¦ <b>Р вЂР В°Р Р…Р С”:</b> {bank_code.upper()}
СЂСџвЂ вЂќ <b>ID РЎРѓРЎвЂЎР ВµРЎвЂљР В°:</b> {withdraw_id}
СЂСџвЂќС’ <b>Р С™Р С•Р Т‘ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°:</b> РЎРѓР С”РЎР‚РЎвЂ№РЎвЂљ (РЎвЂљР С•Р В»РЎРЉР С”Р С• Р Т‘Р В»РЎРЏ API)

РІРЏВ° <b>Р вЂ™РЎР‚Р ВµР СРЎРЏ:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}
        """
        
        # РЎРѕР·РґР°С‘Рј РєР»Р°РІРёР°С‚СѓСЂСѓ РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё Р·Р°СЏРІРєРё (РёСЃРїСЂР°РІР»РµРЅС‹ С‚РµРєСЃС‚С‹ UTF-8)
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="вњ… РџРѕРґС‚РІРµСЂРґРёС‚СЊ", callback_data=f"confirm_withdraw_{user_id}_{amount}"),
                InlineKeyboardButton(text="вњ–пёЏ РћС‚РєР»РѕРЅРёС‚СЊ", callback_data=f"reject_withdraw_{user_id}_{amount}")
            ],
            [
                InlineKeyboardButton(text="рџ”Ќ РџСЂРѕРІРµСЂРёС‚СЊ API", callback_data=f"check_withdraw_api_{user_id}_{amount}")
            ]
        ])
        
        # Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р В·Р В°РЎРЏР Р†Р С”РЎС“ Р Р† Р С–РЎР‚РЎС“Р С—Р С—РЎС“
        if photo_file_id:
            await bot.send_photo(
                chat_id=group_id,
                photo=photo_file_id,
                caption=request_text,
                parse_mode="HTML",
                reply_markup=keyboard
            )
        else:
            await bot.send_message(
                chat_id=group_id,
                text=request_text,
                parse_mode="HTML",
                reply_markup=keyboard
            )
            
        logger.info(f"РІСљвЂ¦ Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р В° Р Р† Р С–РЎР‚РЎС“Р С—Р С—РЎС“ {group_id}")
        return True
        
    except Exception as e:
        logger.error(f"РІСњРЉ Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С‘ Р В·Р В°РЎРЏР Р†Р С”Р С‘ Р Р† Р С–РЎР‚РЎС“Р С—Р С—РЎС“: {e}")
        return False

def get_bot_settings():
    """Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµРЎвЂљ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”Р С‘ Р В±Р С•РЎвЂљР В° Р С‘Р В· Django Р В°Р Т‘Р СР С‘Р Р…Р С”Р С‘"""
    try:
        import requests
        response = requests.get('http://localhost:8081/bot/api/bot-settings/', timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error(f"Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—Р С•Р В»РЎС“РЎвЂЎР ВµР Р…Р С‘РЎРЏ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р ВµР С” Р В±Р С•РЎвЂљР В°: {e}")
    return {
        'pause': False,
        'deposits': {'enabled': True, 'banks': []},
        'withdrawals': {'enabled': True, 'banks': []},
        'channel': {'enabled': False, 'name': '@bingokg_news'}
    }

def get_bank_settings():
    """Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµРЎвЂљ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”Р С‘ Р В±Р В°Р Р…Р С”Р С•Р Р†"""
    return {
        'demirbank': {'deposit_enabled': True, 'withdraw_enabled': True},
        'odengi': {'deposit_enabled': True, 'withdraw_enabled': True},
        'bakai': {'deposit_enabled': True, 'withdraw_enabled': True},
        'balance': {'deposit_enabled': True, 'withdraw_enabled': True},
        'megapay': {'deposit_enabled': True, 'withdraw_enabled': True},
        'mbank': {'deposit_enabled': True, 'withdraw_enabled': True},
    }

async def show_main_menu(message: types.Message, language: str):
    """Р СџР С•Р С”Р В°Р В·Р В°РЎвЂљРЎРЉ Р С–Р В»Р В°Р Р†Р Р…Р С•Р Вµ Р СР ВµР Р…РЎР‹"""
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
    await message.answer(translations['welcome'].format(user_name=message.from_user.first_name or 'Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ', admin_username='@luxon_support'), reply_markup=keyboard)

async def start_withdrawal(message: types.Message, state: FSMContext = None, bookmaker: str = None, language: str = None, db = None, bookmakers = None):
    """Р СњР В°РЎвЂЎР В°Р В»Р С• Р С—РЎР‚Р С•РЎвЂ Р ВµРЎРѓРЎРѓР В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В° - Р РЃР В°Р С– 1: Р вЂ™РЎвЂ№Р В±Р С•РЎР‚ Р В±Р В°Р Р…Р С”Р В°"""
    if not all([bookmaker, language, db, bookmakers]):
        logger.error("Missing required parameters for start_withdrawal")
        return
        
    user_id = message.from_user.id
    translations = get_translation(language)
    
    logger.info(f"Starting withdrawal process for user {user_id}, bookmaker: {bookmaker}")
    
    # Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…РЎвЂ№Р в„– Р В±РЎС“Р С”Р СР ВµР С”Р ВµРЎР‚ Р Р† Р В±Р В°Р В·Р Вµ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦
    db.save_user_data(user_id, 'current_bookmaker', bookmaker)
    
    # Р СџР С•Р С”Р В°Р В·РЎвЂ№Р Р†Р В°Р ВµР С Р Р†РЎвЂ№Р В±Р С•РЎР‚ Р В±Р В°Р Р…Р С”Р В° Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°
    await show_bank_selection_for_withdrawal(message, db, bookmakers)

async def show_bank_selection_for_withdrawal(message: types.Message, db, bookmakers):
    """Р СџР С•Р С”Р В°Р В·Р В°РЎвЂљРЎРЉ Р Р†РЎвЂ№Р В±Р С•РЎР‚ Р В±Р В°Р Р…Р С”Р В° Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В° - Р РЃР В°Р С– 1 (Р С•Р Т‘Р Р…Р С• РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ РЎРѓ Р С‘Р Р…Р В»Р В°Р в„–Р Р…-Р С”Р Р…Р С•Р С—Р С”Р В°Р СР С‘)"""
    user_id = message.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    logger.info(f"Showing bank selection for withdrawal to user {user_id}")
    
    # Р РЋР С•Р В·Р Т‘Р В°Р ВµР С Р С‘Р Р…Р В»Р В°Р в„–Р Р… Р С”Р В»Р В°Р Р†Р С‘Р В°РЎвЂљРЎС“РЎР‚РЎС“ РЎРѓ Р В±Р В°Р Р…Р С”Р В°Р СР С‘ Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°
    kb = InlineKeyboardBuilder()

    # Р СџРЎР‚Р С•РЎвЂЎР С‘РЎвЂљР В°Р ВµР С Р С–Р В»Р С•Р В±Р В°Р В»РЎРЉР Р…РЎС“РЎР‹ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”РЎС“ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В° Р С‘ РЎР‚Р В°Р В·РЎР‚Р ВµРЎв‚¬РЎвЂР Р…Р Р…РЎвЂ№Р Вµ Р В±Р В°Р Р…Р С”Р С‘ Р С‘Р В· bot_settings
    def _read_withdraw_settings():
        try:
            import sqlite3, json
            db_path = getattr(db, 'db_path', '') or ''
            if not db_path:
                from pathlib import Path
                db_path = str(Path(__file__).resolve().parents[1] / 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("SELECT value FROM bot_settings WHERE key='withdrawals_enabled'")
            row_en = cur.fetchone()
            cur.execute("SELECT value FROM bot_settings WHERE key='withdraw_banks'")
            row_banks = cur.fetchone()
            conn.close()
            enabled = True if not row_en else (str(row_en[0]).strip() in ('1','true','True'))
            banks = []
            try:
                banks = json.loads(row_banks[0]) if row_banks and row_banks[0] else []
            except Exception:
                banks = []
            # Р’Р°Р»РёРґРЅС‹Рµ РЅР°Р·РІР°РЅРёСЏ Р±Р°РЅРєРѕРІ (UTF-8)
            valid = {'РљРѕРјРїР°РЅСЊРѕРЅ','Рћ! Р”РµРЅСЊРіРё','Р‘Р°РєР°Рё','Balance.kg','MegaPay','MBank'}
            banks = [b for b in banks if b in valid]
            return enabled, set(banks)
        except Exception:
            return True, set()

    w_enabled, allowed_banks = _read_withdraw_settings()
    if not w_enabled:
        await message.answer("в›” Р’С‹РІРѕРґС‹ РІСЂРµРјРµРЅРЅРѕ РЅРµ СЂР°Р±РѕС‚Р°СЋС‚. РџРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ.")
        # Р’РѕР·РІСЂР°С‰Р°РµРј РіР»Р°РІРЅРѕРµ РјРµРЅСЋ
        await show_main_menu(message, language)
        return
    
    # Р РЋР С—Р С‘РЎРѓР С•Р С” Р В±Р В°Р Р…Р С”Р С•Р Р† Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°
    banks = [
        ("РљРѕРјРїР°РЅСЊРѕРЅ", "kompanion"),
        ("Рћ! Р”РµРЅСЊРіРё", "odengi"),
        ("Р‘Р°РєР°Рё", "bakai"),
        ("Balance.kg", "balance"),
        ("MegaPay", "megapay"),
        ("MBank", "mbank")
    ]

    # Р В Р ВµР Р…Р Т‘Р ВµРЎР‚Р С‘Р С: РЎР‚Р В°Р В·РЎР‚Р ВµРЎв‚¬РЎвЂР Р…Р Р…РЎвЂ№Р Вµ Р В±Р В°Р Р…Р С”Р С‘ РІР‚вЂќ Р С•Р В±РЎвЂ№РЎвЂЎР Р…РЎвЂ№Р Вµ Р С”Р Р…Р С•Р С—Р С”Р С‘, Р В·Р В°Р С—РЎР‚Р ВµРЎвЂ°РЎвЂР Р…Р Р…РЎвЂ№Р Вµ РІР‚вЂќ alert
    for bank_name, bank_code in banks:
        if not allowed_banks or bank_name in allowed_banks:
            kb.button(text=bank_name, callback_data=f"withdraw_bank_{bank_code}")
        else:
            kb.button(text=f"{bank_name} (РЅРµРґРѕСЃС‚СѓРїРЅРѕ)", callback_data=f"withdraw_bank_unavailable_{bank_code}")
    
    kb.button(text="рџ”™ РќР°Р·Р°Рґ РІ РјРµРЅСЋ", callback_data="back_to_menu")
    kb.adjust(2)
    
    bank_selection_text = f"""
{translations['withdraw_instruction']}

{translations['select_bank_for_withdraw']}
    """

    # Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р С›Р вЂќР СњР С› РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ РЎРѓ РЎвЂљР ВµР С”РЎРѓРЎвЂљР С•Р С Р С‘ Р С‘Р Р…Р В»Р В°Р в„–Р Р…-Р С”Р Р…Р С•Р С—Р С”Р В°Р СР С‘ Р В±Р В°Р Р…Р С”Р С•Р Р†
    await message.answer(bank_selection_text, reply_markup=kb.as_markup(), parse_mode="HTML")
    
    # Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ
    db.save_user_data(user_id, 'current_state', 'waiting_for_bank_selection')
    logger.info(f"Bank selection shown, state set to waiting_for_bank_selection for user {user_id}")

    # Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С” Р Т‘Р В»РЎРЏ Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…РЎвЂ№РЎвЂ¦ Р В±Р В°Р Р…Р С”Р С•Р Р† РІР‚вЂќ РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р С‘РЎР‚РЎС“Р ВµРЎвЂљРЎРѓРЎРЏ Р Р† register_handlers

async def handle_withdraw_bank_selection(user_id: int, bank_code: str, db, bookmakers, bot, callback_message=None):
    """Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р В° Р Р†РЎвЂ№Р В±Р С•РЎР‚Р В° Р В±Р В°Р Р…Р С”Р В° - Р С—Р ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘ Р С” Р РЃР В°Р С–РЎС“ 2: Р вЂ”Р В°Р С—РЎР‚Р С•РЎРѓ QR-Р С”Р С•Р Т‘Р В°"""
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    logger.info(f"Processing bank selection: {bank_code} for user {user_id}")
    
    # Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…РЎвЂ№Р в„– Р В±Р В°Р Р…Р С”
    db.save_user_data(user_id, 'selected_bank', bank_code)
    
    # Р СџР ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘Р С‘Р С Р С” Р В·Р В°Р С—РЎР‚Р С•РЎРѓРЎС“ QR-Р С”Р С•Р Т‘Р В°
    db.save_user_data(user_id, 'current_state', 'waiting_for_qr_photo')
    logger.info(f"State set to waiting_for_qr_photo for user {user_id}")
    
    # Р вЂўРЎРѓР В»Р С‘ Р ВµРЎРѓРЎвЂљРЎРЉ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ РЎРѓ Р С”Р Р…Р С•Р С—Р С”Р В°Р СР С‘, РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚РЎС“Р ВµР С Р ВµР С–Р С•, РЎС“Р В±Р С‘РЎР‚Р В°РЎРЏ Р С”Р Р…Р С•Р С—Р С”Р С‘
    if callback_message:
        try:
            # Р Р€Р В±Р С‘РЎР‚Р В°Р ВµР С Р С‘Р Р…Р В»Р В°Р в„–Р Р…-Р С”Р Р…Р С•Р С—Р С”Р С‘ Р С‘ Р Т‘Р С•Р С—Р С‘РЎРѓРЎвЂ№Р Р†Р В°Р ВµР С Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…РЎвЂ№Р в„– Р В±Р В°Р Р…Р С”
            await callback_message.edit_text(
                (callback_message.text or "") + f"\n\nвњ… <b>Р’С‹Р±СЂР°РЅ Р±Р°РЅРє:</b> {bank_code.upper()}",
                parse_mode="HTML"
            )
        except Exception as e:
            logger.error(f"Error editing message: {e}")
    
    # Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р С‘Р Р…РЎРѓРЎвЂљРЎР‚РЎС“Р С”РЎвЂ Р С‘РЎР‹ Р С—Р С• Р С—Р С•Р В»РЎС“РЎвЂЎР ВµР Р…Р С‘РЎР‹ QR-Р С”Р С•Р Т‘Р В°
    qr_instruction = f"""
{translations.get('qr_instruction', ru_tr.get('qr_instruction', 'РћС‚РїСЂР°РІСЊС‚Рµ QR-РєРѕРґ РґР»СЏ РїРµСЂРµРІРѕРґР°.'))}

{translations.get('send_qr_wallet', ru_tr.get('send_qr_wallet', 'РћС‚РїСЂР°РІСЊС‚Рµ QR РєРѕРґ РІР°С€РµРіРѕ РєРѕС€РµР»СЊРєР°:'))}
    """
    
    # Р Р€Р В±Р С‘РЎР‚Р В°Р ВµР С Р С”Р В»Р В°Р Р†Р С‘Р В°РЎвЂљРЎС“РЎР‚РЎС“
    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="СЂСџвЂќв„ў Р СњР В°Р В·Р В°Р Т‘ Р Р† Р СР ВµР Р…РЎР‹")]],
        resize_keyboard=True
    )
    
    logger.info(f"Sending QR instruction to user {user_id}")
    await bot.send_message(user_id, qr_instruction, reply_markup=keyboard, parse_mode="HTML")

async def handle_withdraw_id_input(message: types.Message, db, bookmakers):
    """Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р В° Р Р†Р Р†Р С•Р Т‘Р В° ID - Р С—Р ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘ Р С” Р РЃР В°Р С–РЎС“ 4: Р вЂ™Р Р†Р С•Р Т‘ Р С”Р С•Р Т‘Р В°"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)
            
        # Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С, Р Р…Р Вµ Р Р…Р В°Р В¶Р В°Р В» Р В»Р С‘ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ "Р СњР В°Р В·Р В°Р Т‘"
        if text == translations.get('back_to_menu', 'рџ”™ РќР°Р·Р°Рґ'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return
        
        # Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С, РЎвЂЎРЎвЂљР С• ID РЎРѓР С•РЎРѓРЎвЂљР С•Р С‘РЎвЂљ РЎвЂљР С•Р В»РЎРЉР С”Р С• Р С‘Р В· РЎвЂ Р С‘РЎвЂћРЎР‚
        if not text.isdigit():
            await message.answer(translations['id_digits_only'])
            return
            
        # Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С ID Р С”Р В°Р С” РЎвЂљР ВµР С”РЎС“РЎвЂ°Р С‘Р в„– Р С‘ Р С”Р В°Р С” Р С•Р В±РЎвЂ°Р С‘Р в„– РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎвЂР Р…Р Р…РЎвЂ№Р в„– Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р С–Р С• Р В±РЎС“Р С”Р СР ВµР С”Р ВµРЎР‚Р В°
        db.save_user_data(user_id, 'withdraw_id', text)
        bookmaker_for_save = db.get_user_data(user_id, 'current_bookmaker')
        if bookmaker_for_save:
            db.save_user_data(user_id, 'id', text, bookmaker_for_save)
        
        # Р СџР ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘Р С‘Р С Р С” Р Р†Р Р†Р С•Р Т‘РЎС“ Р С”Р С•Р Т‘Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°
        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_code')
        
        # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р В±РЎС“Р С”Р СР ВµР С”Р ВµРЎР‚Р В° Р Т‘Р В»РЎРЏ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С‘ РЎвЂћР С•РЎвЂљР С”Р С‘
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        
        # Р Р€Р В±Р С‘РЎР‚Р В°Р ВµР С Р С”Р Р…Р С•Р С—Р С”Р С‘ Р С‘ Р С•РЎРѓРЎвЂљР В°Р Р†Р В»РЎРЏР ВµР С РЎвЂљР С•Р В»РЎРЉР С”Р С• "Р СњР В°Р В·Р В°Р Т‘ Р Р† Р СР ВµР Р…РЎР‹"
        keyboard = ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="рџ”™ РќР°Р·Р°Рґ РІ РјРµРЅСЋ")]],
            resize_keyboard=True
        )
        
        # Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С РЎвЂћР С•РЎвЂљР С”РЎС“ РЎРѓ Р С—РЎР‚Р С‘Р СР ВµРЎР‚Р С•Р С Р С”Р С•Р Т‘Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°
        from pathlib import Path
        photo_path = Path(f"images/{bookmaker}-code.jpg")
        if photo_path.exists():
            try:
                photo = FSInputFile(str(photo_path))
                await message.answer_photo(
                    photo=photo,
                    caption=translations['enter_withdraw_code_final'],
                    reply_markup=keyboard
                )
            except Exception as e:
                logger.warning(f"Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ РЎвЂћР С•РЎвЂљР С• Р С—РЎР‚Р С‘Р СР ВµРЎР‚Р В° Р С”Р С•Р Т‘Р В°: {e}")
                await message.answer(translations['enter_withdraw_code_final'], reply_markup=keyboard)
        else:
            await message.answer(translations['enter_withdraw_code_final'], reply_markup=keyboard)
            
    except Exception as e:
        logger.error(f"Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—РЎР‚Р С‘ Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р Вµ ID Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°: {e}")
        await message.answer("РџСЂРѕРёР·РѕС€Р»Р° РѕС€РёР±РєР°")
    
async def process_qr_photo(message: types.Message, db, bookmakers):
    """Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р В° QR-РЎвЂћР С•РЎвЂљР С• - Р С—Р ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘ Р С” Р РЃР В°Р С–РЎС“ 3: Р вЂ™Р Р†Р С•Р Т‘ Р Р…Р С•Р СР ВµРЎР‚Р В° РЎвЂљР ВµР В»Р ВµРЎвЂћР С•Р Р…Р В°"""
    try:
        user_id = message.from_user.id
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        logger.info(f"Processing QR photo for user {user_id}")
        
        # Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С РЎвЂћР С•РЎвЂљР С• QR-Р С”Р С•Р Т‘Р В°
        qr_file_id = message.photo[-1].file_id
        db.save_user_data(user_id, 'qr_photo_id', qr_file_id)
        logger.info(f"QR photo saved for user {user_id}")
        
        # Р СџР ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘Р С‘Р С Р С” Р Р†Р Р†Р С•Р Т‘РЎС“ Р Р…Р С•Р СР ВµРЎР‚Р В° РЎвЂљР ВµР В»Р ВµРЎвЂћР С•Р Р…Р В°
        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_phone')
        logger.info(f"State set to waiting_for_withdraw_phone for user {user_id}")
        
        # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р Р…РЎвЂ№Р в„– Р Р…Р С•Р СР ВµРЎР‚ РЎвЂљР ВµР В»Р ВµРЎвЂћР С•Р Р…Р В° (Р ВµРЎРѓР В»Р С‘ Р ВµРЎРѓРЎвЂљРЎРЉ)
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        saved_phone = db.get_user_data(user_id, 'phone', bookmaker)
        
        # Р РЋР С•Р В·Р Т‘Р В°Р ВµР С Р С”Р В»Р В°Р Р†Р С‘Р В°РЎвЂљРЎС“РЎР‚РЎС“ РЎРѓ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р Р…РЎвЂ№Р С Р Р…Р С•Р СР ВµРЎР‚Р С•Р С
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=str(saved_phone))] if saved_phone else [],
                [KeyboardButton(text=translations.get('back_to_menu', 'рџ”™ РќР°Р·Р°Рґ'))]
            ],
            resize_keyboard=True
        )
                
        # Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ РЎРѓ Р С‘Р Р…РЎРѓРЎвЂљРЎР‚РЎС“Р С”РЎвЂ Р С‘Р ВµР в„–
        text = translations['enter_withdraw_phone']
        
        await message.answer(text, reply_markup=keyboard)
            
    except Exception as e:
        logger.error(f"Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—РЎР‚Р С‘ Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р Вµ QR-РЎвЂћР С•РЎвЂљР С•: {e}")
        await message.answer("Р СџРЎР‚Р С•Р С‘Р В·Р С•РЎв‚¬Р В»Р В° Р С•РЎв‚¬Р С‘Р В±Р С”Р В°")

async def handle_withdraw_phone_input(message: types.Message, db, bookmakers):
    """Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р В° Р Р†Р Р†Р С•Р Т‘Р В° Р Р…Р С•Р СР ВµРЎР‚Р В° РЎвЂљР ВµР В»Р ВµРЎвЂћР С•Р Р…Р В° - Р С—Р ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘ Р С” Р РЃР В°Р С–РЎС“ 4: Р вЂ™Р Р†Р С•Р Т‘ ID"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)
            
        # Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С, Р Р…Р Вµ Р Р…Р В°Р В¶Р В°Р В» Р В»Р С‘ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ "Р СњР В°Р В·Р В°Р Т‘"
        if text == translations.get('back_to_menu', 'СЂСџвЂќв„ў Р СњР В°Р В·Р В°Р Т‘'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return
        
        # Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С РЎвЂћР С•РЎР‚Р СР В°РЎвЂљ Р Р…Р С•Р СР ВµРЎР‚Р В° РЎвЂљР ВµР В»Р ВµРЎвЂћР С•Р Р…Р В° (Р Т‘Р С•Р В»Р В¶Р ВµР Р… Р Р…Р В°РЎвЂЎР С‘Р Р…Р В°РЎвЂљРЎРЉРЎРѓРЎРЏ РЎРѓ 996 Р С‘ РЎРѓР С•Р Т‘Р ВµРЎР‚Р В¶Р В°РЎвЂљРЎРЉ 12 РЎвЂ Р С‘РЎвЂћРЎР‚)
        phone_clean = text.strip().replace('+', '').replace(' ', '').replace('-', '')
        if not phone_clean.isdigit() or len(phone_clean) != 12 or not phone_clean.startswith('996'):
            await message.answer("вќЊ РќРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚ РЅРѕРјРµСЂР°. Р’РІРµРґРёС‚Рµ РЅРѕРјРµСЂ РІ С„РѕСЂРјР°С‚Рµ: 996505000000")
            return
            
        # Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Р…Р С•Р СР ВµРЎР‚ РЎвЂљР ВµР В»Р ВµРЎвЂћР С•Р Р…Р В°
        db.save_user_data(user_id, 'withdraw_phone', phone_clean)
        bookmaker_for_save = db.get_user_data(user_id, 'current_bookmaker')
        if bookmaker_for_save:
            db.save_user_data(user_id, 'phone', phone_clean, bookmaker_for_save)
        
        # Р СџР ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘Р С‘Р С Р С” Р Р†Р Р†Р С•Р Т‘РЎС“ ID
        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_id')
        logger.info(f"State set to waiting_for_withdraw_id for user {user_id}")
        
        # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р В±РЎС“Р С”Р СР ВµР С”Р ВµРЎР‚Р В° Р С‘ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р Р…РЎвЂ№Р в„– ID
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        saved_id = db.get_user_data(user_id, 'id', bookmaker)
        
        # Р РЋР С•Р В·Р Т‘Р В°Р ВµР С Р С”Р В»Р В°Р Р†Р С‘Р В°РЎвЂљРЎС“РЎР‚РЎС“ РЎРѓ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р Р…РЎвЂ№Р С ID
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=str(saved_id))] if saved_id else [],
                [KeyboardButton(text=translations.get('back_to_menu', 'СЂСџвЂќв„ў Р СњР В°Р В·Р В°Р Т‘'))]
            ],
            resize_keyboard=True
        )
                
        # Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ РЎРѓ Р С‘Р Р…РЎРѓРЎвЂљРЎР‚РЎС“Р С”РЎвЂ Р С‘Р ВµР в„–
        text = f"""
{translations['enter_withdraw_id']}
        """
        
        # Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С РЎвЂћР С•РЎвЂљР С”РЎС“ РЎРѓ Р С—РЎР‚Р С‘Р СР ВµРЎР‚Р С•Р С ID
        from pathlib import Path
        photo_path = Path(f"images/{bookmaker}-id.jpg")
        if photo_path.exists():
            try:
                photo = FSInputFile(str(photo_path))
                await message.answer_photo(
                    photo=photo,
                    caption=text,
                    reply_markup=keyboard
                )
            except Exception as e:
                logger.warning(f"Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ РЎвЂћР С•РЎвЂљР С• Р С—РЎР‚Р С‘Р СР ВµРЎР‚Р В° ID: {e}")
                await message.answer(text, reply_markup=keyboard)
        else:
            await message.answer(text, reply_markup=keyboard)
            
    except Exception as e:
        logger.error(f"Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—РЎР‚Р С‘ Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р Вµ Р Р…Р С•Р СР ВµРЎР‚Р В° РЎвЂљР ВµР В»Р ВµРЎвЂћР С•Р Р…Р В° Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°: {e}")
        await message.answer("Р СџРЎР‚Р С•Р С‘Р В·Р С•РЎв‚¬Р В»Р В° Р С•РЎв‚¬Р С‘Р В±Р С”Р В°")
    
async def handle_withdraw_code_input(message: types.Message, db, bookmakers):
    """Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р В° Р Р†Р Р†Р С•Р Т‘Р В° Р С”Р С•Р Т‘Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В° - РЎвЂћР С‘Р Р…Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– РЎв‚¬Р В°Р С–"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)
            
        # Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С, Р Р…Р Вµ Р Р…Р В°Р В¶Р В°Р В» Р В»Р С‘ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ "Р СњР В°Р В·Р В°Р Т‘"
        if text == translations.get('back_to_menu', 'СЂСџвЂќв„ў Р СњР В°Р В·Р В°Р Т‘'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return
            
        # Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р С”Р С•Р Т‘ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°
        db.save_user_data(user_id, 'withdraw_code', text)
        
        # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р В·Р В°РЎРЏР Р†Р С”Р С‘
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        bank_code = db.get_user_data(user_id, 'selected_bank')
        withdraw_id = db.get_user_data(user_id, 'withdraw_id')
        withdraw_phone = db.get_user_data(user_id, 'withdraw_phone')
        qr_photo_id = db.get_user_data(user_id, 'qr_photo_id')
        
        # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С РЎРѓРЎС“Р СР СРЎС“ РЎвЂЎР ВµРЎР‚Р ВµР В· API Р Т‘Р В»РЎРЏ Р С”Р С•Р Р…Р С”РЎР‚Р ВµРЎвЂљР Р…Р С•Р С–Р С• Р В±РЎС“Р С”Р СР ВµР С”Р ВµРЎР‚Р В°
        try:
            # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р С”Р С•Р Р…РЎвЂћР С‘Р С–РЎС“РЎР‚Р В°РЎвЂ Р С‘РЎР‹ Р Т‘Р В»РЎРЏ Р В±РЎС“Р С”Р СР ВµР С”Р ВµРЎР‚Р В° Р С‘Р В· BOOKMAKERS (Р С‘Р В·Р В±Р ВµР С–Р В°Р ВµР С Р С‘Р СР С—Р С•РЎР‚РЎвЂљР В° BOOKMAKER_CONFIGS)
            bookmaker_config = BOOKMAKERS.get(bookmaker, {})
            if not bookmaker_config:
                logger.error(f"No config found for bookmaker: {bookmaker}")
                amount = 0
            else:
                # Р вЂ™РЎвЂ№Р В±Р С‘РЎР‚Р В°Р ВµР С Р С—РЎР‚Р В°Р Р†Р С‘Р В»РЎРЉР Р…РЎвЂ№Р в„– API Р С”Р В»Р С‘Р ВµР Р…РЎвЂљ Р Т‘Р В»РЎРЏ Р В±РЎС“Р С”Р СР ВµР С”Р ВµРЎР‚Р В°
                if bookmaker == "1xbet":
                    from api_clients.onexbet_client import OneXBetAPIClient
                    # Р вЂ™ 1XBET Р С”Р С•Р Р…РЎвЂћР С‘Р С– Р В»Р ВµР В¶Р С‘РЎвЂљ Р Р† РЎРѓР ВµР С”РЎвЂ Р С‘Р С‘ api_config (Р С”Р В°Р С” Р С‘ Р Т‘Р В»РЎРЏ Р Т‘Р ВµР С—Р С•Р В·Р С‘РЎвЂљР С•Р Р†)
                    api_client = OneXBetAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.payout(withdraw_id, text)
                elif bookmaker == "1win":
                    # Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С Р С•РЎвЂћР С‘РЎвЂ Р С‘Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– Р С”Р В»Р С‘Р ВµР Р…РЎвЂљ 1WIN, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р С—Р С•Р В»РЎС“РЎвЂЎР В°РЎвЂљРЎРЉ РЎРѓРЎвЂљРЎР‚РЎС“Р С”РЎвЂљРЎС“РЎР‚Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р С•РЎв‚¬Р С‘Р В±Р С”Р С‘
                    from api_clients.onewin_client import OneWinAPIClient
                    api_client = OneWinAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.withdrawal(int(withdraw_id), text)
                elif bookmaker == "melbet":
                    # Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С РЎРѓР С—Р ВµРЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№Р в„– Р С”Р В»Р С‘Р ВµР Р…РЎвЂљ РЎРѓ Р С”Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…РЎвЂ№Р С base_url
                    from api_clients.melbet_client import MelbetAPIClient
                    api_client = MelbetAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.payout(withdraw_id, text)
                elif bookmaker == "mostbet":
                    # Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С Р С•РЎвЂћР С‘РЎвЂ Р С‘Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– Р С”Р В»Р С‘Р ВµР Р…РЎвЂљ Mostbet Р С‘ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘Р Вµ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В° Р С—Р С• transactionId+code
                    from api_clients.mostbet_client import MostbetAPI
                    api_client = MostbetAPI(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    try:
                        resp = await api_client.confirm_cashout(int(withdraw_id), text)
                    except Exception as e:
                        logger.error(f"Mostbet confirm_cashout call error: {e}")
                        resp = None
                    # Р СџРЎР‚Р С‘Р Р†Р С•Р Т‘Р С‘Р С Р С” РЎС“Р Р…Р С‘РЎвЂћР С‘РЎвЂ Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р Р…Р С•Р СРЎС“ Р Р†Р С‘Р Т‘РЎС“
                    if resp and isinstance(resp, dict):
                        if resp.get('success') is True:
                            payout_result = {"success": True, "data": resp.get('data') or {}}
                        else:
                            payout_result = {
                                "success": False,
                                "error": (resp.get('error') or '').strip() or 'Mostbet error',
                                "status_code": resp.get('status_code')
                            }
                    else:
                        payout_result = {"success": False, "error": "Mostbet no response"}
                else:
                    logger.error(f"Unknown bookmaker: {bookmaker}")
                    amount = 0
                    payout_result = None
                
                if payout_result and payout_result.get("success"):
                    # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С РЎРѓРЎС“Р СР СРЎС“ Р С‘Р В· Р С•РЎвЂљР Р†Р ВµРЎвЂљР В° API (РЎС“РЎвЂЎР С‘РЎвЂљРЎвЂ№Р Р†Р В°Р ВµР С РЎР‚Р В°Р В·Р Р…РЎвЂ№Р Вµ Р С”Р В»РЎР‹РЎвЂЎР С‘: amount/summa)
                    data_obj = payout_result.get("data", {}) or {}
                    amount = (
                        data_obj.get("amount")
                        or data_obj.get("summa")
                        or data_obj.get("Sum")
                        or 0
                    )
                    try:
                        amount = float(amount)
                    except Exception:
                        amount = float(amount or 0)
                    logger.info(f"API payout successful: {amount} for ID: {withdraw_id}, code: {text}, bookmaker: {bookmaker}")
                else:
                    # Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С, Р ВµРЎРѓРЎвЂљРЎРЉ Р В»Р С‘ Р В·Р В°РЎРЏР Р†Р С”Р В° Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘
                    raw_msg = ""
                    if payout_result:
                        raw_msg = (
                            payout_result.get("message")
                            or (payout_result.get("data") or {}).get("message")
                            or (payout_result.get("data") or {}).get("Message")
                            or payout_result.get("error")
                            or ""
                        )
                    error_message = (raw_msg or "").lower()
                    # Fallback: Р С—РЎР‚Р С•Р В±РЎС“Р ВµР С Р Р†РЎвЂ№РЎвЂљР В°РЎвЂ°Р С‘РЎвЂљРЎРЉ РЎРѓРЎС“Р СР СРЎС“ Р С‘Р В· РЎвЂљР ВµР С”РЎРѓРЎвЂљР В° Р С•РЎвЂљР Р†Р ВµРЎвЂљР В° (Р Р…Р В°Р С—РЎР‚Р С‘Р СР ВµРЎР‚, "100.39" Р С‘Р В»Р С‘ "100,39")
                    if not (payout_result and payout_result.get("success")):
                        try:
                            import re
                            m = re.search(r"(\d+[\.,]\d{2})", raw_msg or "")
                            if m:
                                amt_str = m.group(1).replace(',', '.')
                                amount = float(amt_str)
                        except Exception:
                            pass
                    status_code = (payout_result or {}).get('status_code')
                    # Р СњР ВµР С”Р С•РЎвЂљР С•РЎР‚РЎвЂ№Р Вµ Р С—РЎР‚Р С•Р Р†Р В°Р в„–Р Т‘Р ВµРЎР‚РЎвЂ№ Р С—РЎР‚Р С‘РЎРѓРЎвЂ№Р В»Р В°РЎР‹РЎвЂљ РЎвЂљР ВµР С”РЎРѓРЎвЂљ "Р С•Р С—Р ВµРЎР‚Р В°РЎвЂ Р С‘РЎРЏ Р Р†РЎвЂ№Р С—Р С•Р В»Р Р…Р ВµР Р…Р В° РЎС“РЎРѓР С—Р ВµРЎв‚¬Р Р…Р С•" Р Т‘Р В°Р В¶Р Вµ Р ВµРЎРѓР В»Р С‘ success=false РІР‚вЂќ РЎРѓРЎвЂЎР С‘РЎвЂљР В°Р ВµР С РЎРЊРЎвЂљР С• РЎС“РЎРѓР С—Р ВµРЎвЂ¦Р С•Р С
                    if any(x in error_message for x in ["РЎС“РЎРѓР С—Р ВµРЎв‚¬Р Р…", "operation completed successfully", "successfully"]):
                        data_obj = (payout_result or {}).get("data", {}) or {}
                        amount = (
                            data_obj.get("amount")
                            or data_obj.get("summa")
                            or data_obj.get("Sum")
                            or 0
                        )
                        try:
                            amount = float(amount)
                        except Exception:
                            amount = float(amount or 0)
                        logger.warning("Provider returned success-like message but success flag is false. Proceeding as success.")
                        # Р СњР Вµ Р Р†Р С•Р В·Р Р†РЎР‚Р В°РЎвЂ°Р В°Р ВµР СРЎРѓРЎРЏ РІР‚вЂќ Р С—РЎР‚Р С•Р Т‘Р С•Р В»Р В¶Р В°Р ВµР С Р С”Р В°Р С” Р С•Р В±РЎвЂ№РЎвЂЎР Р…РЎвЂ№Р в„– РЎС“РЎРѓР С—Р ВµРЎвЂ¦ (РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р Вµ Р В·Р В°РЎРЏР Р†Р С”Р С‘/РЎС“Р Р†Р ВµР Т‘Р С•Р СР В»Р ВµР Р…Р С‘РЎРЏ Р Р…Р С‘Р В¶Р Вµ)
                    elif (
                        "Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р В°" in error_message or "not found" in error_message or "Р Р…Р ВµРЎвЂљ РЎвЂљР В°Р С”Р С•Р в„–" in error_message
                        or status_code == 404
                    ):
                        # Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘ Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р В° РЎС“ Р С—РЎР‚Р С•Р Р†Р В°Р в„–Р Т‘Р ВµРЎР‚Р В° РІР‚вЂќ Р С—РЎР‚Р С•Р Т‘Р С•Р В»Р В¶Р В°Р ВµР С Р С”Р В°Р С” РЎР‚РЎС“РЎвЂЎР Р…РЎС“РЎР‹ (Р С•РЎРѓРЎвЂљР В°Р Р†Р С‘Р С pending Р Р…Р В° РЎРѓР В°Р в„–РЎвЂљР Вµ)
                        await message.answer(translations.get('withdrawal_not_found', "РІСњРЉ Р СћР В°Р С”Р С•Р в„– Р В·Р В°РЎРЏР Р†Р С”Р С‘ РЎС“ Р С—РЎР‚Р С•Р Р†Р В°Р в„–Р Т‘Р ВµРЎР‚Р В° Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р С•. Р СљРЎвЂ№ Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР В°Р ВµР С Р ВµРЎвЂ Р Р†РЎР‚РЎС“РЎвЂЎР Р…РЎС“РЎР‹."))
                        # Р С—РЎР‚Р С•Р Т‘Р С•Р В»Р В¶Р С‘Р С Р Р†Р Р…Р С‘Р В·: РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘Р С Р С”Р В°Р С” pending
                    else:
                        logger.error(f"API payout failed: {raw_msg or (payout_result or {}).get('error', 'No response')}")
                        # Р СџР С•Р С”Р В°Р В¶Р ВµР С Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎР‹ РЎвЂљР ВµР С”РЎРѓРЎвЂљ Р С•РЎв‚¬Р С‘Р В±Р С”Р С‘ Р С•РЎвЂљ Р С—РЎР‚Р С•Р Р†Р В°Р в„–Р Т‘Р ВµРЎР‚Р В°, Р ВµРЎРѓР В»Р С‘ Р С•Р Р… Р ВµРЎРѓРЎвЂљРЎРЉ
                        if raw_msg:
                            await message.answer(f"РІСњРЉ Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°: {raw_msg}. Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р В° Р Р…Р В° РЎР‚РЎС“РЎвЂЎР Р…РЎС“РЎР‹ Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”РЎС“.")
                        else:
                            await message.answer(translations['withdrawal_api_error'])
                        # Р Р…Р Вµ Р Р†РЎвЂ№РЎвЂ¦Р С•Р Т‘Р С‘Р С РІР‚вЂќ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘Р С Р С”Р В°Р С” pending
            
        except Exception as e:
            logger.error(f"Error calling API for payout: {e}")
            amount = 0  # Р вЂўРЎРѓР В»Р С‘ API Р Р…Р Вµ РЎР‚Р В°Р В±Р С•РЎвЂљР В°Р ВµРЎвЂљ, Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С 0
        
        try:
            # Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р В·Р В°РЎРЏР Р†Р С”РЎС“ Р Р† Р ВµР Т‘Р С‘Р Р…РЎС“РЎР‹ РЎвЂљР В°Р В±Р В»Р С‘РЎвЂ РЎС“ requests (Р Т‘Р В»РЎРЏ РЎРѓР В°Р в„–РЎвЂљР В°)
            import sqlite3
            from pathlib import Path
            # Р вЂ™Р С’Р вЂ“Р СњР С›: Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎвЂљР С•РЎвЂљ Р В¶Р Вµ Р С—РЎС“РЎвЂљРЎРЉ, РЎвЂЎРЎвЂљР С• Р С‘ РЎС“ Django (settings.BOT_DATABASE_PATH)
            # Р РЋР Р…Р В°РЎвЂЎР В°Р В»Р В° Р С—РЎР‚Р С•Р В±РЎС“Р ВµР С Р Р†Р В·РЎРЏРЎвЂљРЎРЉ Р С—РЎС“РЎвЂљРЎРЉ Р С‘Р В· Р С—Р ВµРЎР‚Р ВµР Т‘Р В°Р Р…Р Р…Р С•Р С–Р С• Р С•Р В±РЎР‰Р ВµР С”РЎвЂљР В° db
            db_path = getattr(db, 'db_path', None)
            if not db_path:
                # Fallback: Р С”Р С•РЎР‚Р ВµР Р…РЎРЉ РЎР‚Р ВµР С—Р С• (bets/universal_bot.db), Р В° Р Р…Р Вµ bot/universal_bot.db
                db_path = str(Path(__file__).resolve().parents[2] / 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            # Р вЂњР В°РЎР‚Р В°Р Р…РЎвЂљР С‘РЎР‚РЎС“Р ВµР С Р Р…Р В°Р В»Р С‘РЎвЂЎР С‘Р Вµ РЎвЂљР В°Р В±Р В»Р С‘РЎвЂ РЎвЂ№ requests РЎРѓ Р Р…РЎС“Р В¶Р Р…РЎвЂ№Р СР С‘ Р С”Р С•Р В»Р С•Р Р…Р С”Р В°Р СР С‘
            cur.execute('''
                CREATE TABLE IF NOT EXISTS requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    bookmaker TEXT,
                    account_id TEXT,
                    amount REAL NOT NULL DEFAULT 0,
                    request_type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    withdrawal_code TEXT,
                    photo_file_id TEXT,
                    photo_file_url TEXT,
                    bank TEXT,
                    phone TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP,
                    processed_at TIMESTAMP
                )
            ''')
            
            # Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С”Р С•Р В»Р С•Р Р…Р С”РЎС“ phone Р ВµРЎРѓР В»Р С‘ Р ВµРЎвЂ Р Р…Р ВµРЎвЂљ
            try:
                cur.execute("ALTER TABLE requests ADD COLUMN phone TEXT")
            except Exception:
                pass  # Р С™Р С•Р В»Р С•Р Р…Р С”Р В° РЎС“Р В¶Р Вµ РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“Р ВµРЎвЂљ

            # Р СџР С•Р В»РЎС“РЎвЂЎР С‘Р С Р С—РЎР‚РЎРЏР СР С•Р в„– URL Р С” РЎвЂћР В°Р в„–Р В»РЎС“ Р С•РЎвЂљ Telegram API (Р ВµРЎРѓР В»Р С‘ Р ВµРЎРѓРЎвЂљРЎРЉ)
            photo_file_url = None
            if qr_photo_id:
                try:
                    file_info = await message.bot.get_file(qr_photo_id)
                    fpath = getattr(file_info, 'file_path', None)
                    if fpath:
                        photo_file_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{fpath}"
                except Exception as e:
                    logger.warning(f"Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С—Р С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ Р С—РЎР‚РЎРЏР СР С•Р в„– URL РЎвЂћР С•РЎвЂљР С• Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°: {e}")

            # Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р В·Р В°РЎРЏР Р†Р С”РЎС“ Р Р† requests
            cur.execute('''
                INSERT INTO requests
                (user_id, username, first_name, bookmaker, account_id, amount, request_type, status,
                 withdrawal_code, photo_file_id, photo_file_url, bank, phone)
                VALUES (?, ?, ?, ?, ?, ?, 'withdraw', 'pending', ?, ?, ?, ?, ?)
            ''', (
                user_id,
                message.from_user.username or '',
                message.from_user.first_name or '',
                bookmaker,
                withdraw_id or '',
                float(amount or 0),
                text,
                qr_photo_id,
                photo_file_url,
                bank_code,
                withdraw_phone or ''
            ))
            conn.commit()
            conn.close()

            # Р РЋР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ РЎРѓ РЎРѓР В°Р в„–РЎвЂљР С•Р С (Django): Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘Р С Р С‘ file_id, Р С‘ Р С—РЎР‚РЎРЏР СР С•Р в„– URL Р С” РЎвЂћР С•РЎвЂљР С•
            try:
                sync_withdraw_to_django_admin(
                    user_id=user_id,
                    username=message.from_user.username or '',
                    first_name=message.from_user.first_name or '',
                    bookmaker=bookmaker,
                    amount=amount,
                    withdraw_id=withdraw_id,
                    bank_code=bank_code,
                    withdraw_code=text,
                    withdraw_phone=withdraw_phone,
                    photo_file_id=qr_photo_id,
                    photo_file_url=photo_file_url,
                    status='pending'
                )
            except Exception as e:
                logger.error(f"Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘ Р В·Р В°РЎРЏР Р†Р С”Р С‘ Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘ РЎРѓ Django: {e}")

            # Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р В·Р В°РЎРЏР Р†Р С”РЎС“ Р Р† Р С–РЎР‚РЎС“Р С—Р С—РЎС“
            group_id = bookmakers[bookmaker]['withdraw_group_id']
            logger.info(f"Sending withdraw request to group {group_id} for bookmaker {bookmaker}")
            
            # Р вЂњР ВµР Р…Р ВµРЎР‚Р С‘РЎР‚РЎС“Р ВµР С РЎС“Р Р…Р С‘Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– ID Р В·Р В°РЎРЏР Р†Р С”Р С‘
            request_id = random.randint(1000, 9999)
            
            # Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р В·Р В°РЎРЏР Р†Р С”Р С‘ Р Р† РЎРѓР В»Р С•Р Р†Р В°РЎР‚РЎРЉ Р Т‘Р В»РЎРЏ API Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С”Р С•Р Р†
            import handlers.api_handlers as api_handlers
            api_handlers.pending_requests[request_id] = {
                'user_id': user_id,
                'amount': amount,  # Р РЋРЎС“Р СР СР В° Р С—Р С•Р В»РЎС“РЎвЂЎР ВµР Р…Р Р…Р В°РЎРЏ РЎвЂЎР ВµРЎР‚Р ВµР В· API
                'xbet_id': withdraw_id,
                'bookmaker': bookmaker,
                'type': 'withdraw',
                'bank_code': bank_code,
                'withdraw_code': text
            }
            
            application_text = f"""
СЂСџвЂќвЂќ <b>Р СњР С•Р Р†Р В°РЎРЏ Р В·Р В°РЎРЏР Р†Р С”Р В° Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘</b>

СЂСџвЂВ¤ <b>Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ:</b> @{message.from_user.username or 'Р В±Р ВµР В· username'}
СЂСџвЂ вЂќ <b>ID:</b> <code>{withdraw_id}</code>
СЂСџвЂњВ± <b>Р СћР ВµР В»Р ВµРЎвЂћР С•Р Р…:</b> +{withdraw_phone or 'Р Р…Р Вµ РЎС“Р С”Р В°Р В·Р В°Р Р…'}
СЂСџРЏСћ <b>Р вЂРЎС“Р С”Р СР ВµР С”Р ВµРЎР‚:</b> {bookmakers[bookmaker]['name']}
СЂСџРЏВ¦ <b>Р вЂР В°Р Р…Р С”:</b> {bank_code.title()}
СЂСџвЂ™В° <b>Р РЋРЎС“Р СР СР В°:</b> {amount} РЎРѓР С•Р С
СЂСџвЂќС’ <b>Р С™Р С•Р Т‘ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°:</b> РЎРѓР С”РЎР‚РЎвЂ№РЎвЂљ (РЎвЂљР С•Р В»РЎРЉР С”Р С• Р Т‘Р В»РЎРЏ API)
СЂСџвЂ вЂќ <b>ID Р В·Р В°РЎРЏР Р†Р С”Р С‘:</b> {request_id}
"""
            
            # Р РЋР С•Р В·Р Т‘Р В°Р ВµР С Р С”Р В»Р В°Р Р†Р С‘Р В°РЎвЂљРЎС“РЎР‚РЎС“ РЎРѓ Р С”Р Р…Р С•Р С—Р С”Р В°Р СР С‘
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [
                    InlineKeyboardButton(text="РІСљвЂ¦ Р СџР С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р Т‘Р С‘РЎвЂљРЎРЉ", callback_data=f"approve_withdraw_{request_id}"),
                    InlineKeyboardButton(text="РІСњРЉ Р С›РЎвЂљР С”Р В»Р С•Р Р…Р С‘РЎвЂљРЎРЉ", callback_data=f"reject_withdraw_{request_id}")
                ]
            ])
            
            # Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р В·Р В°РЎРЏР Р†Р С”РЎС“ Р Р† Р С–РЎР‚РЎС“Р С—Р С—РЎС“ РЎРѓ QR-РЎвЂћР С•РЎвЂљР С•
            await message.bot.send_photo(
                chat_id=group_id,
                photo=qr_photo_id,
                caption=application_text,
                reply_markup=keyboard,
                parse_mode="HTML"
            )
            
            # Р Р€Р Р†Р ВµР Т‘Р С•Р СР В»РЎРЏР ВµР С Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ
            keyboard = ReplyKeyboardMarkup(
                keyboard=[
                    [KeyboardButton(text=translations['deposit']), KeyboardButton(text=translations['withdraw'])],
                    [KeyboardButton(text=translations['referral'])],
                    [KeyboardButton(text=translations['support']), KeyboardButton(text=translations['history'])],
                    [KeyboardButton(text=translations['faq']), KeyboardButton(text=translations['language'])]
                ],
                resize_keyboard=True
            )
            
            success_message = translations['withdrawal_request_sent_simple'].format(
                amount=float(amount or 0),
                xbet_id=withdraw_id
            )
            
            await message.answer(success_message, reply_markup=keyboard, parse_mode="HTML")
            
            # Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р В·Р В°РЎРЏР Р†Р С”РЎС“ Р Р† Р С–РЎР‚РЎС“Р С—Р С—РЎС“ Р В°Р Т‘Р СР С‘Р Р…РЎС“
            await send_withdraw_request_to_group(
                bot=message.bot,
                user_id=user_id,
                amount=amount,
                bookmaker=bookmaker,
                bank_code=bank_code,
                withdraw_id=withdraw_id,
                code=text,
                photo_file_id=qr_photo_id
            )
            
            # Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ
            db.save_user_data(user_id, 'current_state', '')
            
        except Exception as e:
            logger.error(f"Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С‘ Р В·Р В°РЎРЏР Р†Р С”Р С‘ Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘ Р Р† Р С–РЎР‚РЎС“Р С—Р С—РЎС“: {e}")
            await message.answer("РІСњРЉ Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—РЎР‚Р С‘ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р Вµ Р В·Р В°РЎРЏР Р†Р С”Р С‘. Р СџР С•Р С—РЎР‚Р С•Р В±РЎС“Р в„–РЎвЂљР Вµ Р С—Р С•Р В·Р В¶Р Вµ.")
            
    except Exception as e:
        logger.error(f"Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—РЎР‚Р С‘ Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р Вµ Р С”Р С•Р Т‘Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°: {e}")
        await message.answer("Р СџРЎР‚Р С•Р С‘Р В·Р С•РЎв‚¬Р В»Р В° Р С•РЎв‚¬Р С‘Р В±Р С”Р В°")

def sync_withdraw_to_django_admin(*, user_id, username, first_name, bookmaker, amount, withdraw_id, bank_code, withdraw_code, withdraw_phone, photo_file_id, photo_file_url, status):
    """Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р В° Р В·Р В°РЎРЏР Р†Р С”Р С‘ Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘ Р Р…Р В° РЎРѓР В°Р в„–РЎвЂљ (Django) РЎРѓ URL РЎвЂЎР ВµР С”Р В°."""
    try:
        import requests
        import os
        data = {
            'user_id': user_id,
            'username': username or '',
            'first_name': first_name or '',
            'bookmaker': bookmaker,
            'amount': amount,
            'withdraw_id': withdraw_id,
            'account_id': withdraw_id,
            'bank': bank_code,
            'withdrawal_code': withdraw_code,
            'phone': withdraw_phone or '',
            'receipt_photo': photo_file_id or '',
            'receipt_photo_url': photo_file_url or '',
            'status': status,
        }
        base_url = os.getenv('DJANGO_ADMIN_URL', 'http://localhost:8081')
        endpoint = f"{base_url.rstrip('/')}/bot/api/bot/withdraw-request/"
        resp = requests.post(endpoint, json=data, timeout=8)
        if resp.status_code in (200, 201):
            logger.info("РІСљвЂ¦ Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘ РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р В° РЎРѓ Django Р В°Р Т‘Р СР С‘Р Р…Р С”Р С•Р в„–")
        else:
            logger.error(f"РІСњРЉ Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"РІСњРЉ Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—РЎР‚Р С‘ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р Вµ Р В·Р В°РЎРЏР Р†Р С”Р С‘ Р Р…Р В° Р Р†РЎвЂ№Р Р†Р С•Р Т‘ Р Р† Django: {e}")

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None):
    """Р В Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎРЏ Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С”Р С•Р Р†"""
    
    # Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С”Р С‘ РЎвЂљР ВµР С”РЎРѓРЎвЂљР С•Р Р†РЎвЂ№РЎвЂ¦ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р в„– Р Т‘Р В»РЎРЏ РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р в„– Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°
    @dp.message(lambda message: message.photo and db.get_user_data(message.from_user.id, 'current_state') == 'waiting_for_receipt')
    async def handle_receipt_photo_handler(message: types.Message):
        """Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р В° РЎвЂћР С•РЎвЂљР С• РЎвЂЎР ВµР С”Р В° Р Т‘Р В»РЎРЏ Р С—Р С•Р С—Р С•Р В»Р Р…Р ВµР Р…Р С‘РЎРЏ"""
        await process_receipt_photo(message, db, bookmakers)

    # Р вЂњР В»Р С•Р В±Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С”: Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…РЎвЂ№Р Вµ Р В±Р В°Р Р…Р С”Р С‘ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В°
    @dp.callback_query(F.data.startswith('withdraw_bank_unavailable_'))
    async def handle_unavailable(cb: types.CallbackQuery):
        try:
            await cb.answer("Р СњР В° Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р в„– Р СР С•Р СР ВµР Р…РЎвЂљ Р Р†РЎвЂ№Р Р†Р С•Р Т‘ Р Р…Р В° РЎРЊРЎвЂљР С•РЎвЂљ Р В±Р В°Р Р…Р С” Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р…", show_alert=True)
        except Exception:
            try:
                await cb.answer("Р СњР ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…Р С•", show_alert=True)
            except Exception:
                pass

    # Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р В° Р Р…Р В°Р В¶Р В°РЎвЂљР С‘РЎРЏ Р Р…Р В° Р С‘Р Р…Р В»Р В°Р в„–Р Р…-Р С”Р Р…Р С•Р С—Р С”РЎС“ Р Р†РЎвЂ№Р В±Р С•РЎР‚Р В° Р В±Р В°Р Р…Р С”Р В° Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р Р†Р С•Р Т‘Р В° (Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…РЎвЂ№Р Вµ)
    @dp.callback_query(F.data.startswith("withdraw_bank_"))
    async def handle_withdraw_bank_callback(callback: types.CallbackQuery):
        data = callback.data or ''
        # Р вЂўРЎРѓР В»Р С‘ РЎРЊРЎвЂљР С• Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…РЎвЂ№Р в„– Р В±Р В°Р Р…Р С” РІР‚вЂќ Р С—РЎР‚Р С•РЎРѓРЎвЂљР С• Р В°Р В»Р ВµРЎР‚РЎвЂљ (Р С—Р ВµРЎР‚Р ВµРЎвЂ¦Р Р†Р В°РЎвЂљРЎвЂ№Р Р†Р В°Р ВµРЎвЂљРЎРѓРЎРЏ Р Р†РЎвЂ№РЎв‚¬Р Вµ), Р Р†РЎвЂ№РЎвЂ¦Р С•Р Т‘Р С‘Р С
        if data.startswith('withdraw_bank_unavailable_'):
            try:
                await callback.answer("Р СњР ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…Р С•", show_alert=True)
            except Exception:
                pass
            return
        # Р В¤Р С•РЎР‚Р СР В°РЎвЂљ: withdraw_bank_<code>
        try:
            bank_code = data.split('_', 2)[-1]
        except Exception:
            bank_code = data.replace('withdraw_bank_', '')
        try:
            await handle_withdraw_bank_selection(
                user_id=callback.from_user.id,
                bank_code=bank_code,
                db=db,
                bookmakers=bookmakers,
                bot=callback.bot,
                callback_message=callback.message
            )
            await callback.answer()
        except Exception as e:
            logger.error(f"withdraw bank callback error: {e}")
            try:
                await callback.answer("Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р С‘", show_alert=True)
            except Exception:
                pass
