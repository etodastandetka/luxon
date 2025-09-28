"""
Обработчики для автоматического пополнения
Интегрируются с Android приложением и Django API
"""

import logging
import requests
from aiogram import types
from aiogram.dispatcher import FSMContext
from aiogram.dispatcher.filters.state import State, StatesGroup
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from ..database import Database
from ..translations import get_translation as get_text
from ..core.base_bot import BaseBot

logger = logging.getLogger(__name__)

# Настройки Django API
DJANGO_API_URL = "http://147.45.141.113:8081/bot/api"

class AutoDepositStates(StatesGroup):
    """Состояния для автоматического пополнения"""
    waiting_for_amount = State()
    waiting_for_confirmation = State()

class AutoDepositHandlers:
    """Обработчики для автоматического пополнения"""
    
    def __init__(self, bot: BaseBot):
        self.bot = bot
        self.db = Database()
    
    async def start_auto_deposit(self, message: types.Message, state: FSMContext):
        """Начинает процесс автоматического пополнения"""
        try:
            user_id = message.from_user.id
            
            # Проверяем, есть ли активная заявка
            active_request = await self.get_active_deposit_request(user_id)
            if active_request:
                await message.answer(
                    f"⚠️ У вас уже есть активная заявка на пополнение!\n"
                    f"💰 Сумма: {active_request['amount']} KGS\n"
                    f"📊 Статус: {active_request['status']}\n\n"
                    f"Дождитесь завершения текущей заявки или отмените её."
                )
                return
            
            # Язык по умолчанию: ru (можно заменить на язык пользователя, если он хранится)
            lang = 'ru'
            text = get_text(lang, 'user_found_account', account_id=user_id, min_amount=35, max_amount=100000)
            await message.answer(text, parse_mode="HTML")
            
            await state.set_state(AutoDepositStates.waiting_for_amount)
            
        except Exception as e:
            logger.error(f"Ошибка начала автоматического пополнения: {e}")
            await message.answer("❌ Произошла ошибка. Попробуйте позже.")
    
    async def process_amount(self, message: types.Message, state: FSMContext):
        """Обрабатывает введенную сумму"""
        try:
            user_id = message.from_user.id
            text = message.text.strip()
            
            # Парсим сумму
            try:
                amount = float(text)
                if amount <= 0:
                    await message.answer("❌ Сумма должна быть больше 0. Попробуйте еще раз:")
                    return
                
                if amount < 10:
                    await message.answer("❌ Минимальная сумма пополнения: 10 KGS. Попробуйте еще раз:")
                    return
                
                if amount > 10000:
                    await message.answer("❌ Максимальная сумма пополнения: 10,000 KGS. Попробуйте еще раз:")
                    return
                    
            except ValueError:
                await message.answer("❌ Неверный формат суммы. Введите число (например: 100.50):")
                return
            
            # Сохраняем сумму в состоянии
            await state.update_data(amount=amount)
            
            # Создаем заявку на пополнение
            request_id = await self.create_deposit_request(user_id, amount)
            
            if request_id:
                # Показываем QR-код и инструкции
                await self.show_deposit_instructions(message, amount, request_id)
                await state.set_state(AutoDepositStates.waiting_for_confirmation)
            else:
                await message.answer("❌ Ошибка создания заявки. Попробуйте позже.")
                await state.finish()
                
        except Exception as e:
            logger.error(f"Ошибка обработки суммы: {e}")
            await message.answer("❌ Произошла ошибка. Попробуйте позже.")
            await state.finish()
    
    async def show_deposit_instructions(self, message: types.Message, amount: float, request_id: str):
        """Показывает инструкции по пополнению"""
        try:
            # Получаем QR-код (если есть)
            qr_info = await self.get_qr_code_info()
            
            instructions = f"""
🎯 **Заявка на пополнение создана!**

💰 **Сумма:** {amount} KGS
🆔 **ID заявки:** {request_id}
📊 **Статус:** Ожидает пополнения

📱 **Инструкции:**
1. Откройте мобильное приложение вашего банка
2. Переведите **точно {amount} KGS** на указанный счет
3. Дождитесь уведомления о пополнении
4. Баланс пополнится автоматически!

⏰ **Время ожидания:** 10 минут
🔄 **Статус:** Ожидает поступления средств

💡 **Важно:** Сумма должна быть точно {amount} KGS!
            """.strip()
            
            # Создаем клавиатуру
            keyboard = InlineKeyboardMarkup(row_width=2)
            keyboard.add(
                InlineKeyboardButton("🔄 Проверить статус", callback_data=f"check_deposit_{request_id}"),
                InlineKeyboardButton("❌ Отменить заявку", callback_data=f"cancel_deposit_{request_id}")
            )
            
            if qr_info:
                keyboard.add(InlineKeyboardButton("📱 Показать QR-код", callback_data=f"show_qr_{request_id}"))
            
            await message.answer(instructions, parse_mode="Markdown", reply_markup=keyboard)
            
        except Exception as e:
            logger.error(f"Ошибка показа инструкций: {e}")
            await message.answer("❌ Ошибка загрузки инструкций.")
    
    async def create_deposit_request(self, user_id: int, amount: float) -> str:
        """Создает заявку на пополнение через Django API"""
        try:
            url = f"{DJANGO_API_URL}/manual-deposit/"
            data = {
                "user_id": user_id,
                "amount": amount,
                "bank_name": "Auto Deposit",
                "request_type": "auto_deposit"
            }
            
            response = requests.post(url, json=data, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                return result.get("request_id", f"auto_{user_id}_{int(amount * 100)}")
            else:
                logger.error(f"Ошибка создания заявки: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Ошибка создания заявки: {e}")
            return None
    
    async def get_active_deposit_request(self, user_id: int) -> dict:
        """Получает активную заявку на пополнение"""
        try:
            url = f"{DJANGO_API_URL}/player-balance/{user_id}/"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "amount": data.get("pending_amount", 0),
                    "status": data.get("status", "none")
                }
            else:
                return None
                
        except Exception as e:
            logger.error(f"Ошибка получения заявки: {e}")
            return None
    
    async def get_qr_code_info(self) -> dict:
        """Получает информацию о QR-коде для пополнения"""
        try:
            # Здесь можно добавить логику получения QR-кода
            # Пока возвращаем заглушку
            return {
                "qr_data": "bank_account_info",
                "account_number": "1234567890"
            }
        except Exception as e:
            logger.error(f"Ошибка получения QR-кода: {e}")
            return None
    
    async def check_deposit_status(self, callback_query: types.CallbackQuery):
        """Проверяет статус пополнения"""
        try:
            user_id = callback_query.from_user.id
            request_id = callback_query.data.split("_")[-1]
            
            # Получаем статус через API
            url = f"{DJANGO_API_URL}/player-balance/{user_id}/"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                balance = data.get("balance", 0)
                last_updated = data.get("last_updated", "Неизвестно")
                
                await callback_query.message.edit_text(
                    f"📊 **Статус заявки**\n\n"
                    f"💰 **Текущий баланс:** {balance} KGS\n"
                    f"🕐 **Последнее обновление:** {last_updated}\n"
                    f"🆔 **ID заявки:** {request_id}\n\n"
                    f"Если баланс не обновился, попробуйте позже.",
                    parse_mode="Markdown"
                )
            else:
                await callback_query.answer("❌ Ошибка проверки статуса", show_alert=True)
                
        except Exception as e:
            logger.error(f"Ошибка проверки статуса: {e}")
            await callback_query.answer("❌ Произошла ошибка", show_alert=True)
    
    async def cancel_deposit_request(self, callback_query: types.CallbackQuery):
        """Отменяет заявку на пополнение"""
        try:
            user_id = callback_query.from_user.id
            request_id = callback_query.data.split("_")[-1]
            
            # Здесь можно добавить логику отмены заявки
            await callback_query.message.edit_text(
                f"❌ **Заявка отменена**\n\n"
                f"🆔 **ID заявки:** {request_id}\n"
                f"📊 **Статус:** Отменена\n\n"
                f"Для создания новой заявки используйте /deposit",
                parse_mode="Markdown"
            )
            
        except Exception as e:
            logger.error(f"Ошибка отмены заявки: {e}")
            await callback_query.answer("❌ Произошла ошибка", show_alert=True)
    
    async def show_qr_code(self, callback_query: types.CallbackQuery):
        """Показывает QR-код для пополнения"""
        try:
            request_id = callback_query.data.split("_")[-1]
            
            # Здесь можно добавить генерацию QR-кода
            await callback_query.message.answer(
                f"📱 **QR-код для пополнения**\n\n"
                f"🆔 **ID заявки:** {request_id}\n"
                f"💳 **Счет:** 1234567890\n"
                f"🏦 **Банк:** OptimaBank\n\n"
                f"Используйте QR-код для быстрого пополнения!",
                parse_mode="Markdown"
            )
            
        except Exception as e:
            logger.error(f"Ошибка показа QR-кода: {e}")
            await callback_query.answer("❌ Произошла ошибка", show_alert=True)

def register_auto_deposit_handlers(dp, bot: BaseBot):
    """Регистрирует обработчики автоматического пополнения"""
    handlers = AutoDepositHandlers(bot)
    
    # Команды убраны - авто депозит работает только для существующих заявок
    
    # Обработка суммы убрана - авто депозит работает только для существующих заявок
    
    # Callback queries
    dp.register_callback_query_handler(
        handlers.check_deposit_status,
        lambda c: c.data.startswith('check_deposit_')
    )
    
    dp.register_callback_query_handler(
        handlers.cancel_deposit_request,
        lambda c: c.data.startswith('cancel_deposit_')
    )
    
    dp.register_callback_query_handler(
        handlers.show_qr_code,
        lambda c: c.data.startswith('show_qr_')
    )













