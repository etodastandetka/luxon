#!/usr/bin/env python3
"""
РҐРµРЅРґР»РµСЂС‹ РґР»СЏ РІС‹РІРѕРґР° СЃСЂРµРґСЃС‚РІ - СѓРїСЂРѕС‰РµРЅРЅС‹Р№ РїСЂРѕС†РµСЃСЃ
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
    """РћС‚РїСЂР°РІР»СЏРµС‚ Р·Р°СЏРІРєСѓ РЅР° РІС‹РІРѕРґ РІ РіСЂСѓРїРїСѓ Р°РґРјРёРЅСѓ"""
    try:
        # РџРѕР»СѓС‡Р°РµРј РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ
        user_info = await bot.get_chat(user_id)
        username = user_info.username or "РќРµС‚ username"
        first_name = user_info.first_name or "РќРµС‚ РёРјРµРЅРё"
        
        # РџРѕР»СѓС‡Р°РµРј РЅР°СЃС‚СЂРѕР№РєРё Р±СѓРєРјРµРєРµСЂР°
        bookmaker_config = BOOKMAKERS.get(bookmaker, {})
        group_id = bookmaker_config.get('withdraw_group_id')
        
        if not group_id:
            logger.error(f"РќРµ РЅР°Р№РґРµРЅ group_id РґР»СЏ Р±СѓРєРјРµРєРµСЂР° {bookmaker}")
            return False
            
        # РЎРѕР·РґР°РµРј С‚РµРєСЃС‚ Р·Р°СЏРІРєРё
        request_text = f"""
рџ”” <b>РќРѕРІР°СЏ Р·Р°СЏРІРєР° РЅР° РІС‹РІРѕРґ</b>

рџ‘¤ <b>РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ:</b> @{username}
рџ†” <b>ID:</b> {user_id}
рџЏў <b>Р‘СѓРєРјРµРєРµСЂ:</b> {bookmaker_config.get('name', bookmaker.upper())}
рџ’° <b>РЎСѓРјРјР°:</b> {amount:.2f} СЃРѕРј
рџЏ¦ <b>Р‘Р°РЅРє:</b> {bank_code.upper()}
рџ†” <b>ID СЃС‡РµС‚Р°:</b> {withdraw_id}
рџ”ђ <b>РљРѕРґ РІС‹РІРѕРґР°:</b> СЃРєСЂС‹С‚ (С‚РѕР»СЊРєРѕ РґР»СЏ API)

вЏ° <b>Р’СЂРµРјСЏ:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}
        """
        
        # Создаём клавиатуру для обработки заявки (исправлены тексты UTF-8)
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"confirm_withdraw_{user_id}_{amount}"),
                InlineKeyboardButton(text="✖️ Отклонить", callback_data=f"reject_withdraw_{user_id}_{amount}")
            ],
            [
                InlineKeyboardButton(text="🔍 Проверить API", callback_data=f"check_withdraw_api_{user_id}_{amount}")
            ]
        ])
        
        # РћС‚РїСЂР°РІР»СЏРµРј Р·Р°СЏРІРєСѓ РІ РіСЂСѓРїРїСѓ
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
            
        logger.info(f"вњ… Р—Р°СЏРІРєР° РЅР° РІС‹РІРѕРґ РѕС‚РїСЂР°РІР»РµРЅР° РІ РіСЂСѓРїРїСѓ {group_id}")
        return True
        
    except Exception as e:
        logger.error(f"вќЊ РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё Р·Р°СЏРІРєРё РІ РіСЂСѓРїРїСѓ: {e}")
        return False

def get_bot_settings():
    """РџРѕР»СѓС‡Р°РµС‚ РЅР°СЃС‚СЂРѕР№РєРё Р±РѕС‚Р° РёР· Django Р°РґРјРёРЅРєРё"""
    try:
        import requests
        response = requests.get('http://localhost:8081/bot/api/bot-settings/', timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error(f"РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РЅР°СЃС‚СЂРѕРµРє Р±РѕС‚Р°: {e}")
    return {
        'pause': False,
        'deposits': {'enabled': True, 'banks': []},
        'withdrawals': {'enabled': True, 'banks': []},
        'channel': {'enabled': False, 'name': '@bingokg_news'}
    }

def get_bank_settings():
    """РџРѕР»СѓС‡Р°РµС‚ РЅР°СЃС‚СЂРѕР№РєРё Р±Р°РЅРєРѕРІ"""
    return {
        'demirbank': {'deposit_enabled': True, 'withdraw_enabled': True},
        'odengi': {'deposit_enabled': True, 'withdraw_enabled': True},
        'bakai': {'deposit_enabled': True, 'withdraw_enabled': True},
        'balance': {'deposit_enabled': True, 'withdraw_enabled': True},
        'megapay': {'deposit_enabled': True, 'withdraw_enabled': True},
        'mbank': {'deposit_enabled': True, 'withdraw_enabled': True},
    }

async def show_main_menu(message: types.Message, language: str):
    """РџРѕРєР°Р·Р°С‚СЊ РіР»Р°РІРЅРѕРµ РјРµРЅСЋ"""
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
    await message.answer(translations['welcome'].format(user_name=message.from_user.first_name or 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ', admin_username='@luxon_support'), reply_markup=keyboard)

async def start_withdrawal(message: types.Message, state: FSMContext = None, bookmaker: str = None, language: str = None, db = None, bookmakers = None):
    """РќР°С‡Р°Р»Рѕ РїСЂРѕС†РµСЃСЃР° РІС‹РІРѕРґР° - РЁР°Рі 1: Р’С‹Р±РѕСЂ Р±Р°РЅРєР°"""
    if not all([bookmaker, language, db, bookmakers]):
        logger.error("Missing required parameters for start_withdrawal")
        return
        
    user_id = message.from_user.id
    translations = get_translation(language)
    
    logger.info(f"Starting withdrawal process for user {user_id}, bookmaker: {bookmaker}")
    
    # РЎРѕС…СЂР°РЅСЏРµРј РІС‹Р±СЂР°РЅРЅС‹Р№ Р±СѓРєРјРµРєРµСЂ РІ Р±Р°Р·Рµ РґР°РЅРЅС‹С…
    db.save_user_data(user_id, 'current_bookmaker', bookmaker)
    
    # РџРѕРєР°Р·С‹РІР°РµРј РІС‹Р±РѕСЂ Р±Р°РЅРєР° РґР»СЏ РІС‹РІРѕРґР°
    await show_bank_selection_for_withdrawal(message, db, bookmakers)

async def show_bank_selection_for_withdrawal(message: types.Message, db, bookmakers):
    """РџРѕРєР°Р·Р°С‚СЊ РІС‹Р±РѕСЂ Р±Р°РЅРєР° РґР»СЏ РІС‹РІРѕРґР° - РЁР°Рі 1 (РѕРґРЅРѕ СЃРѕРѕР±С‰РµРЅРёРµ СЃ РёРЅР»Р°Р№РЅ-РєРЅРѕРїРєР°РјРё)"""
    user_id = message.from_user.id
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    logger.info(f"Showing bank selection for withdrawal to user {user_id}")
    
    # РЎРѕР·РґР°РµРј РёРЅР»Р°Р№РЅ РєР»Р°РІРёР°С‚СѓСЂСѓ СЃ Р±Р°РЅРєР°РјРё РґР»СЏ РІС‹РІРѕРґР°
    kb = InlineKeyboardBuilder()

    # РџСЂРѕС‡РёС‚Р°РµРј РіР»РѕР±Р°Р»СЊРЅСѓСЋ РЅР°СЃС‚СЂРѕР№РєСѓ РІС‹РІРѕРґР° Рё СЂР°Р·СЂРµС€С‘РЅРЅС‹Рµ Р±Р°РЅРєРё РёР· bot_settings
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
            # Валидные названия банков (UTF-8)
            valid = {'Компаньон','О! Деньги','Бакаи','Balance.kg','MegaPay','MBank'}
            banks = [b for b in banks if b in valid]
            return enabled, set(banks)
        except Exception:
            return True, set()

    w_enabled, allowed_banks = _read_withdraw_settings()
    if not w_enabled:
        await message.answer("⛔ Выводы временно не работают. Попробуйте позже.")
        # Возвращаем главное меню
        await show_main_menu(message, language)
        return
    
    # РЎРїРёСЃРѕРє Р±Р°РЅРєРѕРІ РґР»СЏ РІС‹РІРѕРґР°
    banks = [
        ("Компаньон", "kompanion"),
        ("О! Деньги", "odengi"),
        ("Бакаи", "bakai"),
        ("Balance.kg", "balance"),
        ("MegaPay", "megapay"),
        ("MBank", "mbank")
    ]

    # Р РµРЅРґРµСЂРёРј: СЂР°Р·СЂРµС€С‘РЅРЅС‹Рµ Р±Р°РЅРєРё вЂ” РѕР±С‹С‡РЅС‹Рµ РєРЅРѕРїРєРё, Р·Р°РїСЂРµС‰С‘РЅРЅС‹Рµ вЂ” alert
    for bank_name, bank_code in banks:
        if not allowed_banks or bank_name in allowed_banks:
            kb.button(text=bank_name, callback_data=f"withdraw_bank_{bank_code}")
        else:
            kb.button(text=f"{bank_name} (недоступно)", callback_data=f"withdraw_bank_unavailable_{bank_code}")
    
    kb.button(text="🔙 Назад в меню", callback_data="back_to_menu")
    kb.adjust(2)
    
    bank_selection_text = f"""
{translations['withdraw_instruction']}

{translations['select_bank_for_withdraw']}
    """

    # РћС‚РїСЂР°РІР»СЏРµРј РћР”РќРћ СЃРѕРѕР±С‰РµРЅРёРµ СЃ С‚РµРєСЃС‚РѕРј Рё РёРЅР»Р°Р№РЅ-РєРЅРѕРїРєР°РјРё Р±Р°РЅРєРѕРІ
    await message.answer(bank_selection_text, reply_markup=kb.as_markup(), parse_mode="HTML")
    
    # РЎРѕС…СЂР°РЅСЏРµРј СЃРѕСЃС‚РѕСЏРЅРёРµ
    db.save_user_data(user_id, 'current_state', 'waiting_for_bank_selection')
    logger.info(f"Bank selection shown, state set to waiting_for_bank_selection for user {user_id}")

    # РћР±СЂР°Р±РѕС‚С‡РёРє РґР»СЏ РЅРµРґРѕСЃС‚СѓРїРЅС‹С… Р±Р°РЅРєРѕРІ вЂ” СЂРµРіРёСЃС‚СЂРёСЂСѓРµС‚СЃСЏ РІ register_handlers

async def handle_withdraw_bank_selection(user_id: int, bank_code: str, db, bookmakers, bot, callback_message=None):
    """РћР±СЂР°Р±РѕС‚РєР° РІС‹Р±РѕСЂР° Р±Р°РЅРєР° - РїРµСЂРµС…РѕРґ Рє РЁР°РіСѓ 2: Р—Р°РїСЂРѕСЃ QR-РєРѕРґР°"""
    language = db.get_user_language(user_id)
    translations = get_translation(language)
    
    logger.info(f"Processing bank selection: {bank_code} for user {user_id}")
    
    # РЎРѕС…СЂР°РЅСЏРµРј РІС‹Р±СЂР°РЅРЅС‹Р№ Р±Р°РЅРє
    db.save_user_data(user_id, 'selected_bank', bank_code)
    
    # РџРµСЂРµС…РѕРґРёРј Рє Р·Р°РїСЂРѕСЃСѓ QR-РєРѕРґР°
    db.save_user_data(user_id, 'current_state', 'waiting_for_qr_photo')
    logger.info(f"State set to waiting_for_qr_photo for user {user_id}")
    
    # Р•СЃР»Рё РµСЃС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ СЃ РєРЅРѕРїРєР°РјРё, СЂРµРґР°РєС‚РёСЂСѓРµРј РµРіРѕ, СѓР±РёСЂР°СЏ РєРЅРѕРїРєРё
    if callback_message:
        try:
            # РЈР±РёСЂР°РµРј РёРЅР»Р°Р№РЅ-РєРЅРѕРїРєРё Рё РґРѕРїРёСЃС‹РІР°РµРј РІС‹Р±СЂР°РЅРЅС‹Р№ Р±Р°РЅРє
            await callback_message.edit_text(
                (callback_message.text or "") + f"\n\nвњ… <b>Р’С‹Р±СЂР°РЅ Р±Р°РЅРє:</b> {bank_code.upper()}",
                parse_mode="HTML"
            )
        except Exception as e:
            logger.error(f"Error editing message: {e}")
    
    # РћС‚РїСЂР°РІР»СЏРµРј РёРЅСЃС‚СЂСѓРєС†РёСЋ РїРѕ РїРѕР»СѓС‡РµРЅРёСЋ QR-РєРѕРґР°
    qr_instruction = f"""
{translations.get('qr_instruction', ru_tr.get('qr_instruction', 'Отправьте QR-код для перевода.'))}

{translations.get('send_qr_wallet', ru_tr.get('send_qr_wallet', 'Отправьте QR код вашего кошелька:'))}
    """
    
    # РЈР±РёСЂР°РµРј РєР»Р°РІРёР°С‚СѓСЂСѓ
    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="рџ”™ РќР°Р·Р°Рґ РІ РјРµРЅСЋ")]],
        resize_keyboard=True
    )
    
    logger.info(f"Sending QR instruction to user {user_id}")
    await bot.send_message(user_id, qr_instruction, reply_markup=keyboard, parse_mode="HTML")

async def handle_withdraw_id_input(message: types.Message, db, bookmakers):
    """РћР±СЂР°Р±РѕС‚РєР° РІРІРѕРґР° ID - РїРµСЂРµС…РѕРґ Рє РЁР°РіСѓ 4: Р’РІРѕРґ РєРѕРґР°"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)
            
        # РџСЂРѕРІРµСЂСЏРµРј, РЅРµ РЅР°Р¶Р°Р» Р»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ "РќР°Р·Р°Рґ"
        if text == translations.get('back_to_menu', 'рџ”™ РќР°Р·Р°Рґ'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return
        
        # РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ ID СЃРѕСЃС‚РѕРёС‚ С‚РѕР»СЊРєРѕ РёР· С†РёС„СЂ
        if not text.isdigit():
            await message.answer(translations['id_digits_only'])
            return
            
        # РЎРѕС…СЂР°РЅСЏРµРј ID РєР°Рє С‚РµРєСѓС‰РёР№ Рё РєР°Рє РѕР±С‰РёР№ СЃРѕС…СЂР°РЅС‘РЅРЅС‹Р№ РґР»СЏ РІС‹Р±СЂР°РЅРЅРѕРіРѕ Р±СѓРєРјРµРєРµСЂР°
        db.save_user_data(user_id, 'withdraw_id', text)
        bookmaker_for_save = db.get_user_data(user_id, 'current_bookmaker')
        if bookmaker_for_save:
            db.save_user_data(user_id, 'id', text, bookmaker_for_save)
        
        # РџРµСЂРµС…РѕРґРёРј Рє РІРІРѕРґСѓ РєРѕРґР° РІС‹РІРѕРґР°
        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_code')
        
        # РџРѕР»СѓС‡Р°РµРј Р±СѓРєРјРµРєРµСЂР° РґР»СЏ РѕС‚РїСЂР°РІРєРё С„РѕС‚РєРё
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        
        # РЈР±РёСЂР°РµРј РєРЅРѕРїРєРё Рё РѕСЃС‚Р°РІР»СЏРµРј С‚РѕР»СЊРєРѕ "РќР°Р·Р°Рґ РІ РјРµРЅСЋ"
        keyboard = ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="рџ”™ РќР°Р·Р°Рґ РІ РјРµРЅСЋ")]],
            resize_keyboard=True
        )
        
        # РћС‚РїСЂР°РІР»СЏРµРј С„РѕС‚РєСѓ СЃ РїСЂРёРјРµСЂРѕРј РєРѕРґР° РІС‹РІРѕРґР°
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
                logger.warning(f"РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ С„РѕС‚Рѕ РїСЂРёРјРµСЂР° РєРѕРґР°: {e}")
                await message.answer(translations['enter_withdraw_code_final'], reply_markup=keyboard)
        else:
            await message.answer(translations['enter_withdraw_code_final'], reply_markup=keyboard)
            
    except Exception as e:
        logger.error(f"РћС€РёР±РєР° РїСЂРё РѕР±СЂР°Р±РѕС‚РєРµ ID РґР»СЏ РІС‹РІРѕРґР°: {e}")
        await message.answer("РџСЂРѕРёР·РѕС€Р»Р° РѕС€РёР±РєР°")
    
async def process_qr_photo(message: types.Message, db, bookmakers):
    """РћР±СЂР°Р±РѕС‚РєР° QR-С„РѕС‚Рѕ - РїРµСЂРµС…РѕРґ Рє РЁР°РіСѓ 3: Р’РІРѕРґ РЅРѕРјРµСЂР° С‚РµР»РµС„РѕРЅР°"""
    try:
        user_id = message.from_user.id
        language = db.get_user_language(user_id)
        translations = get_translation(language)
        
        logger.info(f"Processing QR photo for user {user_id}")
        
        # РЎРѕС…СЂР°РЅСЏРµРј С„РѕС‚Рѕ QR-РєРѕРґР°
        qr_file_id = message.photo[-1].file_id
        db.save_user_data(user_id, 'qr_photo_id', qr_file_id)
        logger.info(f"QR photo saved for user {user_id}")
        
        # РџРµСЂРµС…РѕРґРёРј Рє РІРІРѕРґСѓ РЅРѕРјРµСЂР° С‚РµР»РµС„РѕРЅР°
        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_phone')
        logger.info(f"State set to waiting_for_withdraw_phone for user {user_id}")
        
        # РџРѕР»СѓС‡Р°РµРј СЃРѕС…СЂР°РЅРµРЅРЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР° (РµСЃР»Рё РµСЃС‚СЊ)
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        saved_phone = db.get_user_data(user_id, 'phone', bookmaker)
        
        # РЎРѕР·РґР°РµРј РєР»Р°РІРёР°С‚СѓСЂСѓ СЃ СЃРѕС…СЂР°РЅРµРЅРЅС‹Рј РЅРѕРјРµСЂРѕРј
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=str(saved_phone))] if saved_phone else [],
                [KeyboardButton(text=translations.get('back_to_menu', 'рџ”™ РќР°Р·Р°Рґ'))]
            ],
            resize_keyboard=True
        )
                
        # РћС‚РїСЂР°РІР»СЏРµРј СЃРѕРѕР±С‰РµРЅРёРµ СЃ РёРЅСЃС‚СЂСѓРєС†РёРµР№
        text = translations['enter_withdraw_phone']
        
        await message.answer(text, reply_markup=keyboard)
            
    except Exception as e:
        logger.error(f"РћС€РёР±РєР° РїСЂРё РѕР±СЂР°Р±РѕС‚РєРµ QR-С„РѕС‚Рѕ: {e}")
        await message.answer("РџСЂРѕРёР·РѕС€Р»Р° РѕС€РёР±РєР°")

async def handle_withdraw_phone_input(message: types.Message, db, bookmakers):
    """РћР±СЂР°Р±РѕС‚РєР° РІРІРѕРґР° РЅРѕРјРµСЂР° С‚РµР»РµС„РѕРЅР° - РїРµСЂРµС…РѕРґ Рє РЁР°РіСѓ 4: Р’РІРѕРґ ID"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)
            
        # РџСЂРѕРІРµСЂСЏРµРј, РЅРµ РЅР°Р¶Р°Р» Р»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ "РќР°Р·Р°Рґ"
        if text == translations.get('back_to_menu', 'рџ”™ РќР°Р·Р°Рґ'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return
        
        # РџСЂРѕРІРµСЂСЏРµРј С„РѕСЂРјР°С‚ РЅРѕРјРµСЂР° С‚РµР»РµС„РѕРЅР° (РґРѕР»Р¶РµРЅ РЅР°С‡РёРЅР°С‚СЊСЃСЏ СЃ 996 Рё СЃРѕРґРµСЂР¶Р°С‚СЊ 12 С†РёС„СЂ)
        phone_clean = text.strip().replace('+', '').replace(' ', '').replace('-', '')
        if not phone_clean.isdigit() or len(phone_clean) != 12 or not phone_clean.startswith('996'):
            await message.answer("вќЊ РќРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚ РЅРѕРјРµСЂР°. Р’РІРµРґРёС‚Рµ РЅРѕРјРµСЂ РІ С„РѕСЂРјР°С‚Рµ: 996505000000")
            return
            
        # РЎРѕС…СЂР°РЅСЏРµРј РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°
        db.save_user_data(user_id, 'withdraw_phone', phone_clean)
        bookmaker_for_save = db.get_user_data(user_id, 'current_bookmaker')
        if bookmaker_for_save:
            db.save_user_data(user_id, 'phone', phone_clean, bookmaker_for_save)
        
        # РџРµСЂРµС…РѕРґРёРј Рє РІРІРѕРґСѓ ID
        db.save_user_data(user_id, 'current_state', 'waiting_for_withdraw_id')
        logger.info(f"State set to waiting_for_withdraw_id for user {user_id}")
        
        # РџРѕР»СѓС‡Р°РµРј Р±СѓРєРјРµРєРµСЂР° Рё СЃРѕС…СЂР°РЅРµРЅРЅС‹Р№ ID
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        saved_id = db.get_user_data(user_id, 'id', bookmaker)
        
        # РЎРѕР·РґР°РµРј РєР»Р°РІРёР°С‚СѓСЂСѓ СЃ СЃРѕС…СЂР°РЅРµРЅРЅС‹Рј ID
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=str(saved_id))] if saved_id else [],
                [KeyboardButton(text=translations.get('back_to_menu', 'рџ”™ РќР°Р·Р°Рґ'))]
            ],
            resize_keyboard=True
        )
                
        # РћС‚РїСЂР°РІР»СЏРµРј СЃРѕРѕР±С‰РµРЅРёРµ СЃ РёРЅСЃС‚СЂСѓРєС†РёРµР№
        text = f"""
{translations['enter_withdraw_id']}
        """
        
        # РћС‚РїСЂР°РІР»СЏРµРј С„РѕС‚РєСѓ СЃ РїСЂРёРјРµСЂРѕРј ID
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
                logger.warning(f"РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ С„РѕС‚Рѕ РїСЂРёРјРµСЂР° ID: {e}")
                await message.answer(text, reply_markup=keyboard)
        else:
            await message.answer(text, reply_markup=keyboard)
            
    except Exception as e:
        logger.error(f"РћС€РёР±РєР° РїСЂРё РѕР±СЂР°Р±РѕС‚РєРµ РЅРѕРјРµСЂР° С‚РµР»РµС„РѕРЅР° РґР»СЏ РІС‹РІРѕРґР°: {e}")
        await message.answer("РџСЂРѕРёР·РѕС€Р»Р° РѕС€РёР±РєР°")
    
async def handle_withdraw_code_input(message: types.Message, db, bookmakers):
    """РћР±СЂР°Р±РѕС‚РєР° РІРІРѕРґР° РєРѕРґР° РІС‹РІРѕРґР° - С„РёРЅР°Р»СЊРЅС‹Р№ С€Р°Рі"""
    try:
        user_id = message.from_user.id
        text = message.text
        language = db.get_user_language(user_id)
        translations = get_translation(language)
            
        # РџСЂРѕРІРµСЂСЏРµРј, РЅРµ РЅР°Р¶Р°Р» Р»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ "РќР°Р·Р°Рґ"
        if text == translations.get('back_to_menu', 'рџ”™ РќР°Р·Р°Рґ'):
            await show_main_menu(message, language)
            db.save_user_data(user_id, 'current_state', '')
            return
            
        # РЎРѕС…СЂР°РЅСЏРµРј РєРѕРґ РІС‹РІРѕРґР°
        db.save_user_data(user_id, 'withdraw_code', text)
        
        # РџРѕР»СѓС‡Р°РµРј РґР°РЅРЅС‹Рµ Р·Р°СЏРІРєРё
        bookmaker = db.get_user_data(user_id, 'current_bookmaker')
        bank_code = db.get_user_data(user_id, 'selected_bank')
        withdraw_id = db.get_user_data(user_id, 'withdraw_id')
        withdraw_phone = db.get_user_data(user_id, 'withdraw_phone')
        qr_photo_id = db.get_user_data(user_id, 'qr_photo_id')
        
        # РџРѕР»СѓС‡Р°РµРј СЃСѓРјРјСѓ С‡РµСЂРµР· API РґР»СЏ РєРѕРЅРєСЂРµС‚РЅРѕРіРѕ Р±СѓРєРјРµРєРµСЂР°
        try:
            # РџРѕР»СѓС‡Р°РµРј РєРѕРЅС„РёРіСѓСЂР°С†РёСЋ РґР»СЏ Р±СѓРєРјРµРєРµСЂР° РёР· BOOKMAKERS (РёР·Р±РµРіР°РµРј РёРјРїРѕСЂС‚Р° BOOKMAKER_CONFIGS)
            bookmaker_config = BOOKMAKERS.get(bookmaker, {})
            if not bookmaker_config:
                logger.error(f"No config found for bookmaker: {bookmaker}")
                amount = 0
            else:
                # Р’С‹Р±РёСЂР°РµРј РїСЂР°РІРёР»СЊРЅС‹Р№ API РєР»РёРµРЅС‚ РґР»СЏ Р±СѓРєРјРµРєРµСЂР°
                if bookmaker == "1xbet":
                    from api_clients.onexbet_client import OneXBetAPIClient
                    # Р’ 1XBET РєРѕРЅС„РёРі Р»РµР¶РёС‚ РІ СЃРµРєС†РёРё api_config (РєР°Рє Рё РґР»СЏ РґРµРїРѕР·РёС‚РѕРІ)
                    api_client = OneXBetAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.payout(withdraw_id, text)
                elif bookmaker == "1win":
                    # РСЃРїРѕР»СЊР·СѓРµРј РѕС„РёС†РёР°Р»СЊРЅС‹Р№ РєР»РёРµРЅС‚ 1WIN, С‡С‚РѕР±С‹ РїРѕР»СѓС‡Р°С‚СЊ СЃС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅС‹Рµ РѕС€РёР±РєРё
                    from api_clients.onewin_client import OneWinAPIClient
                    api_client = OneWinAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.withdrawal(int(withdraw_id), text)
                elif bookmaker == "melbet":
                    # РСЃРїРѕР»СЊР·СѓРµРј СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Р№ РєР»РёРµРЅС‚ СЃ РєРѕСЂСЂРµРєС‚РЅС‹Рј base_url
                    from api_clients.melbet_client import MelbetAPIClient
                    api_client = MelbetAPIClient(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    payout_result = api_client.payout(withdraw_id, text)
                elif bookmaker == "mostbet":
                    # РСЃРїРѕР»СЊР·СѓРµРј РѕС„РёС†РёР°Р»СЊРЅС‹Р№ РєР»РёРµРЅС‚ Mostbet Рё РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РІС‹РІРѕРґР° РїРѕ transactionId+code
                    from api_clients.mostbet_client import MostbetAPI
                    api_client = MostbetAPI(bookmaker_config.get('api_config', {}) or bookmaker_config)
                    try:
                        resp = await api_client.confirm_cashout(int(withdraw_id), text)
                    except Exception as e:
                        logger.error(f"Mostbet confirm_cashout call error: {e}")
                        resp = None
                    # РџСЂРёРІРѕРґРёРј Рє СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅРѕРјСѓ РІРёРґСѓ
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
                    # РџРѕР»СѓС‡Р°РµРј СЃСѓРјРјСѓ РёР· РѕС‚РІРµС‚Р° API (СѓС‡РёС‚С‹РІР°РµРј СЂР°Р·РЅС‹Рµ РєР»СЋС‡Рё: amount/summa)
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
                    # РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё Р·Р°СЏРІРєР° РЅР° РІС‹РІРѕРґ
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
                    # Fallback: РїСЂРѕР±СѓРµРј РІС‹С‚Р°С‰РёС‚СЊ СЃСѓРјРјСѓ РёР· С‚РµРєСЃС‚Р° РѕС‚РІРµС‚Р° (РЅР°РїСЂРёРјРµСЂ, "100.39" РёР»Рё "100,39")
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
                    # РќРµРєРѕС‚РѕСЂС‹Рµ РїСЂРѕРІР°Р№РґРµСЂС‹ РїСЂРёСЃС‹Р»Р°СЋС‚ С‚РµРєСЃС‚ "РѕРїРµСЂР°С†РёСЏ РІС‹РїРѕР»РЅРµРЅР° СѓСЃРїРµС€РЅРѕ" РґР°Р¶Рµ РµСЃР»Рё success=false вЂ” СЃС‡РёС‚Р°РµРј СЌС‚Рѕ СѓСЃРїРµС…РѕРј
                    if any(x in error_message for x in ["СѓСЃРїРµС€РЅ", "operation completed successfully", "successfully"]):
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
                        # РќРµ РІРѕР·РІСЂР°С‰Р°РµРјСЃСЏ вЂ” РїСЂРѕРґРѕР»Р¶Р°РµРј РєР°Рє РѕР±С‹С‡РЅС‹Р№ СѓСЃРїРµС… (СЃРѕС…СЂР°РЅРµРЅРёРµ Р·Р°СЏРІРєРё/СѓРІРµРґРѕРјР»РµРЅРёСЏ РЅРёР¶Рµ)
                    elif (
                        "РЅРµ РЅР°Р№РґРµРЅР°" in error_message or "not found" in error_message or "РЅРµС‚ С‚Р°РєРѕР№" in error_message
                        or status_code == 404
                    ):
                        # Р—Р°СЏРІРєР° РЅР° РІС‹РІРѕРґ РЅРµ РЅР°Р№РґРµРЅР° Сѓ РїСЂРѕРІР°Р№РґРµСЂР° вЂ” РїСЂРѕРґРѕР»Р¶Р°РµРј РєР°Рє СЂСѓС‡РЅСѓСЋ (РѕСЃС‚Р°РІРёРј pending РЅР° СЃР°Р№С‚Рµ)
                        await message.answer(translations.get('withdrawal_not_found', "вќЊ РўР°РєРѕР№ Р·Р°СЏРІРєРё Сѓ РїСЂРѕРІР°Р№РґРµСЂР° РЅРµ РЅР°Р№РґРµРЅРѕ. РњС‹ РѕР±СЂР°Р±РѕС‚Р°РµРј РµС‘ РІСЂСѓС‡РЅСѓСЋ."))
                        # РїСЂРѕРґРѕР»Р¶РёРј РІРЅРёР·: СЃРѕС…СЂР°РЅРёРј РєР°Рє pending
                    else:
                        logger.error(f"API payout failed: {raw_msg or (payout_result or {}).get('error', 'No response')}")
                        # РџРѕРєР°Р¶РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ С‚РµРєСЃС‚ РѕС€РёР±РєРё РѕС‚ РїСЂРѕРІР°Р№РґРµСЂР°, РµСЃР»Рё РѕРЅ РµСЃС‚СЊ
                        if raw_msg:
                            await message.answer(f"вќЊ РћС€РёР±РєР° РІС‹РІРѕРґР°: {raw_msg}. Р—Р°СЏРІРєР° РѕС‚РїСЂР°РІР»РµРЅР° РЅР° СЂСѓС‡РЅСѓСЋ РѕР±СЂР°Р±РѕС‚РєСѓ.")
                        else:
                            await message.answer(translations['withdrawal_api_error'])
                        # РЅРµ РІС‹С…РѕРґРёРј вЂ” СЃРѕС…СЂР°РЅРёРј РєР°Рє pending
            
        except Exception as e:
            logger.error(f"Error calling API for payout: {e}")
            amount = 0  # Р•СЃР»Рё API РЅРµ СЂР°Р±РѕС‚Р°РµС‚, РёСЃРїРѕР»СЊР·СѓРµРј 0
        
        try:
            # РЎРѕС…СЂР°РЅСЏРµРј Р·Р°СЏРІРєСѓ РІ РµРґРёРЅСѓСЋ С‚Р°Р±Р»РёС†Сѓ requests (РґР»СЏ СЃР°Р№С‚Р°)
            import sqlite3
            from pathlib import Path
            # Р’РђР–РќРћ: РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ С‚РѕС‚ Р¶Рµ РїСѓС‚СЊ, С‡С‚Рѕ Рё Сѓ Django (settings.BOT_DATABASE_PATH)
            # РЎРЅР°С‡Р°Р»Р° РїСЂРѕР±СѓРµРј РІР·СЏС‚СЊ РїСѓС‚СЊ РёР· РїРµСЂРµРґР°РЅРЅРѕРіРѕ РѕР±СЉРµРєС‚Р° db
            db_path = getattr(db, 'db_path', None)
            if not db_path:
                # Fallback: РєРѕСЂРµРЅСЊ СЂРµРїРѕ (bets/universal_bot.db), Р° РЅРµ bot/universal_bot.db
                db_path = str(Path(__file__).resolve().parents[2] / 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            # Р“Р°СЂР°РЅС‚РёСЂСѓРµРј РЅР°Р»РёС‡РёРµ С‚Р°Р±Р»РёС†С‹ requests СЃ РЅСѓР¶РЅС‹РјРё РєРѕР»РѕРЅРєР°РјРё
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
            
            # Р”РѕР±Р°РІР»СЏРµРј РєРѕР»РѕРЅРєСѓ phone РµСЃР»Рё РµС‘ РЅРµС‚
            try:
                cur.execute("ALTER TABLE requests ADD COLUMN phone TEXT")
            except Exception:
                pass  # РљРѕР»РѕРЅРєР° СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚

            # РџРѕР»СѓС‡РёРј РїСЂСЏРјРѕР№ URL Рє С„Р°Р№Р»Сѓ РѕС‚ Telegram API (РµСЃР»Рё РµСЃС‚СЊ)
            photo_file_url = None
            if qr_photo_id:
                try:
                    file_info = await message.bot.get_file(qr_photo_id)
                    fpath = getattr(file_info, 'file_path', None)
                    if fpath:
                        photo_file_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{fpath}"
                except Exception as e:
                    logger.warning(f"РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РїСЂСЏРјРѕР№ URL С„РѕС‚Рѕ РІС‹РІРѕРґР°: {e}")

            # РЎРѕС…СЂР°РЅСЏРµРј Р·Р°СЏРІРєСѓ РІ requests
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

            # РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃ СЃР°Р№С‚РѕРј (Django): РѕС‚РїСЂР°РІРёРј Рё file_id, Рё РїСЂСЏРјРѕР№ URL Рє С„РѕС‚Рѕ
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
                logger.error(f"РћС€РёР±РєР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё Р·Р°СЏРІРєРё РЅР° РІС‹РІРѕРґ СЃ Django: {e}")

            # РћС‚РїСЂР°РІР»СЏРµРј Р·Р°СЏРІРєСѓ РІ РіСЂСѓРїРїСѓ
            group_id = bookmakers[bookmaker]['withdraw_group_id']
            logger.info(f"Sending withdraw request to group {group_id} for bookmaker {bookmaker}")
            
            # Р“РµРЅРµСЂРёСЂСѓРµРј СѓРЅРёРєР°Р»СЊРЅС‹Р№ ID Р·Р°СЏРІРєРё
            request_id = random.randint(1000, 9999)
            
            # РЎРѕС…СЂР°РЅСЏРµРј РґР°РЅРЅС‹Рµ Р·Р°СЏРІРєРё РІ СЃР»РѕРІР°СЂСЊ РґР»СЏ API РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ
            import handlers.api_handlers as api_handlers
            api_handlers.pending_requests[request_id] = {
                'user_id': user_id,
                'amount': amount,  # РЎСѓРјРјР° РїРѕР»СѓС‡РµРЅРЅР°СЏ С‡РµСЂРµР· API
                'xbet_id': withdraw_id,
                'bookmaker': bookmaker,
                'type': 'withdraw',
                'bank_code': bank_code,
                'withdraw_code': text
            }
            
            application_text = f"""
рџ”” <b>РќРѕРІР°СЏ Р·Р°СЏРІРєР° РЅР° РІС‹РІРѕРґ</b>

рџ‘¤ <b>РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ:</b> @{message.from_user.username or 'Р±РµР· username'}
рџ†” <b>ID:</b> <code>{withdraw_id}</code>
рџ“± <b>РўРµР»РµС„РѕРЅ:</b> +{withdraw_phone or 'РЅРµ СѓРєР°Р·Р°РЅ'}
рџЏў <b>Р‘СѓРєРјРµРєРµСЂ:</b> {bookmakers[bookmaker]['name']}
рџЏ¦ <b>Р‘Р°РЅРє:</b> {bank_code.title()}
рџ’° <b>РЎСѓРјРјР°:</b> {amount} СЃРѕРј
рџ”ђ <b>РљРѕРґ РІС‹РІРѕРґР°:</b> СЃРєСЂС‹С‚ (С‚РѕР»СЊРєРѕ РґР»СЏ API)
рџ†” <b>ID Р·Р°СЏРІРєРё:</b> {request_id}
"""
            
            # РЎРѕР·РґР°РµРј РєР»Р°РІРёР°С‚СѓСЂСѓ СЃ РєРЅРѕРїРєР°РјРё
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [
                    InlineKeyboardButton(text="вњ… РџРѕРґС‚РІРµСЂРґРёС‚СЊ", callback_data=f"approve_withdraw_{request_id}"),
                    InlineKeyboardButton(text="вќЊ РћС‚РєР»РѕРЅРёС‚СЊ", callback_data=f"reject_withdraw_{request_id}")
                ]
            ])
            
            # РћС‚РїСЂР°РІР»СЏРµРј Р·Р°СЏРІРєСѓ РІ РіСЂСѓРїРїСѓ СЃ QR-С„РѕС‚Рѕ
            await message.bot.send_photo(
                chat_id=group_id,
                photo=qr_photo_id,
                caption=application_text,
                reply_markup=keyboard,
                parse_mode="HTML"
            )
            
            # РЈРІРµРґРѕРјР»СЏРµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
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
            
            # РћС‚РїСЂР°РІР»СЏРµРј Р·Р°СЏРІРєСѓ РІ РіСЂСѓРїРїСѓ Р°РґРјРёРЅСѓ
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
            
            # РћС‡РёС‰Р°РµРј СЃРѕСЃС‚РѕСЏРЅРёРµ
            db.save_user_data(user_id, 'current_state', '')
            
        except Exception as e:
            logger.error(f"РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё Р·Р°СЏРІРєРё РЅР° РІС‹РІРѕРґ РІ РіСЂСѓРїРїСѓ: {e}")
            await message.answer("вќЊ РћС€РёР±РєР° РїСЂРё РѕС‚РїСЂР°РІРєРµ Р·Р°СЏРІРєРё. РџРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ.")
            
    except Exception as e:
        logger.error(f"РћС€РёР±РєР° РїСЂРё РѕР±СЂР°Р±РѕС‚РєРµ РєРѕРґР° РІС‹РІРѕРґР°: {e}")
        await message.answer("РџСЂРѕРёР·РѕС€Р»Р° РѕС€РёР±РєР°")

def sync_withdraw_to_django_admin(*, user_id, username, first_name, bookmaker, amount, withdraw_id, bank_code, withdraw_code, withdraw_phone, photo_file_id, photo_file_url, status):
    """РћС‚РїСЂР°РІРєР° Р·Р°СЏРІРєРё РЅР° РІС‹РІРѕРґ РЅР° СЃР°Р№С‚ (Django) СЃ URL С‡РµРєР°."""
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
            logger.info("вњ… Р—Р°СЏРІРєР° РЅР° РІС‹РІРѕРґ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅР° СЃ Django Р°РґРјРёРЅРєРѕР№")
        else:
            logger.error(f"вќЊ РћС€РёР±РєР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё РІС‹РІРѕРґР°: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"вќЊ РћС€РёР±РєР° РїСЂРё РѕС‚РїСЂР°РІРєРµ Р·Р°СЏРІРєРё РЅР° РІС‹РІРѕРґ РІ Django: {e}")

def register_handlers(dp: Dispatcher, db, bookmakers, api_manager=None):
    """Р РµРіРёСЃС‚СЂР°С†РёСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ"""
    
    # РћР±СЂР°Р±РѕС‚С‡РёРєРё С‚РµРєСЃС‚РѕРІС‹С… СЃРѕРѕР±С‰РµРЅРёР№ РґР»СЏ СЃРѕСЃС‚РѕСЏРЅРёР№ РІС‹РІРѕРґР°
    @dp.message(lambda message: message.photo and db.get_user_data(message.from_user.id, 'current_state') == 'waiting_for_receipt')
    async def handle_receipt_photo_handler(message: types.Message):
        """РћР±СЂР°Р±РѕС‚РєР° С„РѕС‚Рѕ С‡РµРєР° РґР»СЏ РїРѕРїРѕР»РЅРµРЅРёСЏ"""
        await process_receipt_photo(message, db, bookmakers)

    # Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ РѕР±СЂР°Р±РѕС‚С‡РёРє: РЅРµРґРѕСЃС‚СѓРїРЅС‹Рµ Р±Р°РЅРєРё РІС‹РІРѕРґР°
    @dp.callback_query(F.data.startswith('withdraw_bank_unavailable_'))
    async def handle_unavailable(cb: types.CallbackQuery):
        try:
            await cb.answer("РќР° РґР°РЅРЅС‹Р№ РјРѕРјРµРЅС‚ РІС‹РІРѕРґ РЅР° СЌС‚РѕС‚ Р±Р°РЅРє РЅРµРґРѕСЃС‚СѓРїРµРЅ", show_alert=True)
        except Exception:
            try:
                await cb.answer("РќРµРґРѕСЃС‚СѓРїРЅРѕ", show_alert=True)
            except Exception:
                pass

    # РћР±СЂР°Р±РѕС‚РєР° РЅР°Р¶Р°С‚РёСЏ РЅР° РёРЅР»Р°Р№РЅ-РєРЅРѕРїРєСѓ РІС‹Р±РѕСЂР° Р±Р°РЅРєР° РґР»СЏ РІС‹РІРѕРґР° (РґРѕСЃС‚СѓРїРЅС‹Рµ)
    @dp.callback_query(F.data.startswith("withdraw_bank_"))
    async def handle_withdraw_bank_callback(callback: types.CallbackQuery):
        data = callback.data or ''
        # Р•СЃР»Рё СЌС‚Рѕ РЅРµРґРѕСЃС‚СѓРїРЅС‹Р№ Р±Р°РЅРє вЂ” РїСЂРѕСЃС‚Рѕ Р°Р»РµСЂС‚ (РїРµСЂРµС…РІР°С‚С‹РІР°РµС‚СЃСЏ РІС‹С€Рµ), РІС‹С…РѕРґРёРј
        if data.startswith('withdraw_bank_unavailable_'):
            try:
                await callback.answer("РќРµРґРѕСЃС‚СѓРїРЅРѕ", show_alert=True)
            except Exception:
                pass
            return
        # Р¤РѕСЂРјР°С‚: withdraw_bank_<code>
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
                await callback.answer("РћС€РёР±РєР° РѕР±СЂР°Р±РѕС‚РєРё", show_alert=True)
            except Exception:
                pass
