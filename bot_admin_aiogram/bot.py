import asyncio
import json
import logging
import os
from typing import Dict, List, Tuple

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
)

from config import (
    ADMIN_API_URL,
    ADMIN_AUTH_TOKEN,
    AUTHORIZED_USERS_FILE,
    BOT_PASSWORD,
    BOT_TOKEN,
    REQUEST_TIMEOUT,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AuthState(StatesGroup):
    waiting_password = State()


class TopupState(StatesGroup):
    waiting_account_id = State()
    waiting_amount = State()


AUTHORIZED_USERS = set()


def load_authorized_users() -> None:
    if not os.path.exists(AUTHORIZED_USERS_FILE):
        return
    try:
        with open(AUTHORIZED_USERS_FILE, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, list):
            AUTHORIZED_USERS.update(int(user_id) for user_id in data)
    except Exception as exc:
        logger.warning("Failed to load authorized users: %s", exc)


def save_authorized_users() -> None:
    try:
        with open(AUTHORIZED_USERS_FILE, "w", encoding="utf-8") as handle:
            json.dump(sorted(AUTHORIZED_USERS), handle)
    except Exception as exc:
        logger.warning("Failed to save authorized users: %s", exc)

CASINO_LABELS = {
    "1xbet": "1XBET",
    "1win": "1WIN",
    "melbet": "Melbet",
    "mostbet": "Mostbet",
    "winwin": "Winwin",
    "888starz": "888starz",
}


def main_menu_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="💰 Пополнить")]],
        resize_keyboard=True,
    )


async def fetch_enabled_casinos() -> List[Tuple[str, str]]:
    url = f"{ADMIN_API_URL}/api/public/payment-settings"
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(url)
            data = response.json()
    except Exception as exc:
        logger.warning("Failed to fetch casinos: %s", exc)
        data = {}

    casinos = data.get("casinos") if isinstance(data, dict) else None
    if not isinstance(casinos, dict):
        casinos = {key: True for key in CASINO_LABELS.keys()}
    if "888starz" not in casinos:
        casinos["888starz"] = True

    enabled = []
    for key, is_enabled in casinos.items():
        if is_enabled is False:
            continue
        label = CASINO_LABELS.get(key, key.upper())
        enabled.append((key, label))

    if not enabled:
        enabled = [(key, label) for key, label in CASINO_LABELS.items()]
    return enabled


def build_casino_keyboard(casinos: List[Tuple[str, str]]) -> InlineKeyboardMarkup:
    rows = []
    for i in range(0, len(casinos), 2):
        row = [InlineKeyboardButton(text=casinos[i][1], callback_data=f"casino:{casinos[i][0]}")]
        if i + 1 < len(casinos):
            row.append(
                InlineKeyboardButton(text=casinos[i + 1][1], callback_data=f"casino:{casinos[i + 1][0]}")
            )
        rows.append(row)
    return InlineKeyboardMarkup(inline_keyboard=rows)


def auth_headers() -> Dict[str, str]:
    return {"Cookie": f"auth_token={ADMIN_AUTH_TOKEN}"}


async def admin_post(path: str, payload: Dict) -> Dict:
    url = f"{ADMIN_API_URL}{path}"
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(url, json=payload, headers=auth_headers())
        try:
            data = response.json() if response.content else {}
        except ValueError:
            data = {}
        if response.status_code >= 400:
            error = data.get("error") or data.get("message") or response.text
            logger.error("Admin API error %s %s: %s", response.status_code, url, error)
            raise RuntimeError(error or f"HTTP {response.status_code}")
        return data


async def create_deposit_request(user: Message, bookmaker: str, account_id: str, amount: float) -> int:
    payload = {
        "userId": str(user.from_user.id),
        "username": user.from_user.username,
        "firstName": user.from_user.first_name,
        "lastName": user.from_user.last_name,
        "bookmaker": bookmaker,
        "accountId": account_id,
        "amount": str(amount),
        "requestType": "deposit",
    }
    data = await admin_post("/api/requests", payload)
    if not data.get("success"):
        raise RuntimeError(data.get("error") or data.get("message") or "Failed to create request")
    request_id = data.get("data", {}).get("id")
    if not request_id:
        raise RuntimeError("Request ID missing in response")
    return int(request_id)


async def deposit_to_casino(request_id: int, bookmaker: str, account_id: str, amount: float) -> None:
    payload = {
        "requestId": request_id,
        "bookmaker": bookmaker,
        "accountId": account_id,
        "amount": str(amount),
    }
    data = await admin_post("/api/deposit-balance", payload)
    if not data.get("success"):
        raise RuntimeError(data.get("error") or data.get("message") or "Deposit failed")


async def require_auth(message: Message, state: FSMContext) -> bool:
    if message.from_user.id in AUTHORIZED_USERS:
        return True
    await state.set_state(AuthState.waiting_password)
    await message.answer("Введите пароль:")
    return False


async def handle_start(message: Message, state: FSMContext) -> None:
    if message.from_user.id in AUTHORIZED_USERS:
        await state.clear()
        await message.answer("✅ Доступ открыт.", reply_markup=main_menu_keyboard())
        return
    await state.set_state(AuthState.waiting_password)
    await message.answer("Введите пароль:")


async def handle_password(message: Message, state: FSMContext) -> None:
    if message.text != BOT_PASSWORD:
        await message.answer("Неверный пароль. Попробуйте еще раз:")
        return
    AUTHORIZED_USERS.add(message.from_user.id)
    save_authorized_users()
    await state.clear()
    await message.answer("✅ Доступ открыт.", reply_markup=main_menu_keyboard())


async def handle_deposit_menu(message: Message, state: FSMContext) -> None:
    if not await require_auth(message, state):
        return
    casinos = await fetch_enabled_casinos()
    keyboard = build_casino_keyboard(casinos)
    await message.answer("Выберите казино:", reply_markup=keyboard)


async def handle_casino_callback(query: CallbackQuery, state: FSMContext) -> None:
    if query.from_user.id not in AUTHORIZED_USERS:
        await query.answer("Сначала введите пароль.", show_alert=True)
        return
    _, casino_key = query.data.split(":", 1)
    await state.update_data(bookmaker=casino_key)
    await state.set_state(TopupState.waiting_account_id)
    await query.message.answer(f"Введите ID игрока для {CASINO_LABELS.get(casino_key, casino_key)}:")
    await query.answer()


async def handle_account_id(message: Message, state: FSMContext) -> None:
    if not await require_auth(message, state):
        return
    account_id = message.text.strip()
    if not account_id:
        await message.answer("Введите корректный ID:")
        return
    await state.update_data(account_id=account_id)
    await state.set_state(TopupState.waiting_amount)
    await message.answer("Введите сумму пополнения:")


async def handle_amount(message: Message, state: FSMContext) -> None:
    if not await require_auth(message, state):
        return
    raw = message.text.replace(",", ".").strip()
    try:
        amount = float(raw)
    except ValueError:
        await message.answer("Введите корректную сумму:")
        return
    if amount <= 0:
        await message.answer("Сумма должна быть больше 0:")
        return

    data = await state.get_data()
    bookmaker = data.get("bookmaker")
    account_id = data.get("account_id")
    if not bookmaker or not account_id:
        await state.clear()
        await message.answer("Данные потеряны. Начните заново.", reply_markup=main_menu_keyboard())
        return

    try:
        request_id = await create_deposit_request(message, bookmaker, account_id, amount)
        await deposit_to_casino(request_id, bookmaker, account_id, amount)
    except Exception as exc:
        await message.answer(f"❌ Ошибка пополнения: {exc}")
        await state.clear()
        return

    await state.clear()
    await message.answer(
        f"✅ Пополнил.\n\nКазино: {CASINO_LABELS.get(bookmaker, bookmaker)}\n"
        f"ID: {account_id}\nСумма: {amount:.2f}",
        reply_markup=main_menu_keyboard(),
    )


async def main() -> None:
    load_authorized_users()
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())

    dp.message.register(handle_start, CommandStart())
    dp.message.register(handle_password, AuthState.waiting_password)
    dp.message.register(handle_deposit_menu, F.text == "💰 Пополнить")
    dp.callback_query.register(handle_casino_callback, F.data.startswith("casino:"))
    dp.message.register(handle_account_id, TopupState.waiting_account_id)
    dp.message.register(handle_amount, TopupState.waiting_amount)

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

