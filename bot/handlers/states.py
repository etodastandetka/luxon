#!/usr/bin/env python3
"""
Состояния FSM для универсального бота
"""
from aiogram.fsm.state import State, StatesGroup

class ExtendedStates(StatesGroup):
    """Расширенные состояния для универсального бота"""
    
    # Основные состояния
    WAITING_FOR_LANGUAGE = State()
    WAITING_FOR_BOOKMAKER = State()
    
    # Состояния для пополнения
    WAITING_FOR_ID = State()
    WAITING_FOR_AMOUNT = State()
    WAITING_FOR_PHONE = State()
    WAITING_FOR_RECEIPT = State()
    waiting_for_id = State()
    waiting_for_amount = State()
    waiting_for_bank = State()
    waiting_for_phone = State()
    waiting_for_name = State()
    waiting_for_qr_amount = State()
    waiting_for_receipt = State()
    
    # Состояния для вывода
    WAITING_FOR_WITHDRAW_QR = State()
    WAITING_FOR_WITHDRAW_ID = State()
    WAITING_FOR_WITHDRAW_CODE = State()
    WAITING_FOR_WITHDRAW_AMOUNT = State()
    waiting_for_withdraw_bank = State()
    waiting_for_withdraw_phone = State()
    waiting_for_withdraw_name = State()
    waiting_for_withdraw_amount = State()
    waiting_for_withdraw_id = State()
    waiting_for_withdraw_code = State()
    waiting_for_withdraw_qr_photo = State()
    waiting_for_withdraw_qr = State()
    waiting_for_withdraw_phone_new = State()
    waiting_for_withdraw_id_photo = State()

    waiting_for_withdraw_bank = State()
    waiting_for_withdraw_phone = State()
    waiting_for_withdraw_name = State()
    waiting_for_withdraw_amount = State()
    waiting_for_withdraw_id = State()
    waiting_for_withdraw_code = State()
    waiting_for_withdraw_qr_photo = State()
    waiting_for_withdraw_qr = State()
    waiting_for_withdraw_phone_new = State()
    waiting_for_withdraw_id_photo = State()