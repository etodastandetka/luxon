#!/usr/bin/env python3
"""
Telegram бот для техподдержки LUXON
Обрабатывает вопросы пользователей и собирает информацию
"""

import logging
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Токен бота техподдержки
SUPPORT_BOT_TOKEN = os.getenv('SUPPORT_BOT_TOKEN', '8390085986:AAH9iS53RgIleXC-JfExWv8SxwvJR1rPdbI')

# Состояния пользователей (для отслеживания этапа диалога)
user_states = {}

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start"""
    user = update.effective_user
    user_id = user.id
    
    # Сбрасываем состояние пользователя
    user_states[user_id] = {'step': 'main_menu', 'data': {}}
    
    welcome_text = """👋 Добро пожаловать в техподдержку LUXON!

Чем мы можем вам помочь? Выберите тип проблемы:"""
    
    keyboard = [
        [InlineKeyboardButton("💰 Проблема с пополнением", callback_data="deposit_issue")],
        [InlineKeyboardButton("💸 Проблема с выводом", callback_data="withdraw_issue")],
        [InlineKeyboardButton("📊 Вопрос по истории", callback_data="history_issue")],
        [InlineKeyboardButton("👥 Вопрос по рефералам", callback_data="referral_issue")],
        [InlineKeyboardButton("❓ Другая проблема", callback_data="other_issue")]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        welcome_text,
        reply_markup=reply_markup
    )

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик нажатий на кнопки"""
    query = update.callback_query
    await query.answer()
    
    user_id = query.from_user.id
    callback_data = query.data
    
    if callback_data == "main_menu":
        user_states[user_id] = {'step': 'main_menu', 'data': {}}
        await start_from_query(query, context)
        return
    
    if callback_data == "deposit_issue":
        user_states[user_id] = {'step': 'deposit_amount', 'data': {'issue_type': 'deposit'}}
        await query.edit_message_text(
            "💰 Проблема с пополнением\n\n"
            "Вы отправляли средства с копейками?",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("✅ Да", callback_data="yes_cents")],
                [InlineKeyboardButton("❌ Нет", callback_data="no_cents")],
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data == "withdraw_issue":
        user_states[user_id] = {'step': 'withdraw_amount', 'data': {'issue_type': 'withdraw'}}
        await query.edit_message_text(
            "💸 Проблема с выводом\n\n"
            "Вы отправляли средства с копейками?",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("✅ Да", callback_data="yes_cents")],
                [InlineKeyboardButton("❌ Нет", callback_data="no_cents")],
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data == "history_issue":
        user_states[user_id] = {'step': 'history_question', 'data': {'issue_type': 'history'}}
        await query.edit_message_text(
            "📊 Вопрос по истории\n\n"
            "Опишите вашу проблему текстом, и мы поможем вам разобраться.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data == "referral_issue":
        user_states[user_id] = {'step': 'referral_question', 'data': {'issue_type': 'referral'}}
        await query.edit_message_text(
            "👥 Вопрос по рефералам\n\n"
            "Опишите вашу проблему текстом, и мы поможем вам разобраться.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data == "other_issue":
        user_states[user_id] = {'step': 'other_question', 'data': {'issue_type': 'other'}}
        await query.edit_message_text(
            "❓ Другая проблема\n\n"
            "Опишите вашу проблему текстом, и мы поможем вам разобраться.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data == "yes_cents":
        state = user_states.get(user_id, {})
        state['data']['has_cents'] = True
        state['step'] = 'request_receipt'
        user_states[user_id] = state
        
        await query.edit_message_text(
            "📤 Пожалуйста, отправьте скриншот чека об оплате.\n\n"
            "Это поможет нам быстрее обработать вашу заявку.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data == "no_cents":
        state = user_states.get(user_id, {})
        state['data']['has_cents'] = False
        state['step'] = 'request_receipt'
        user_states[user_id] = state
        
        await query.edit_message_text(
            "📤 Пожалуйста, отправьте скриншот чека об оплате.\n\n"
            "Это поможет нам быстрее обработать вашу заявку.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )

async def start_from_query(query, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Вспомогательная функция для отправки главного меню из query"""
    user = query.from_user
    
    welcome_text = """👋 Добро пожаловать в техподдержку LUXON!

Чем мы можем вам помочь? Выберите тип проблемы:"""
    
    keyboard = [
        [InlineKeyboardButton("💰 Проблема с пополнением", callback_data="deposit_issue")],
        [InlineKeyboardButton("💸 Проблема с выводом", callback_data="withdraw_issue")],
        [InlineKeyboardButton("📊 Вопрос по истории", callback_data="history_issue")],
        [InlineKeyboardButton("👥 Вопрос по рефералам", callback_data="referral_issue")],
        [InlineKeyboardButton("❓ Другая проблема", callback_data="other_issue")]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        welcome_text,
        reply_markup=reply_markup
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик текстовых сообщений"""
    if not update.message:
        return
    
    user_id = update.effective_user.id
    message_text = update.message.text or ""
    
    # Если пользователь не в состоянии, отправляем главное меню
    if user_id not in user_states:
        await start(update, context)
        return
    
    state = user_states[user_id]
    step = state.get('step', 'main_menu')
    
    # Если пользователь написал /start или "привет", возвращаем в главное меню
    if message_text.lower() in ['/start', 'start', 'привет', 'hi', 'hello', 'начать', 'меню']:
        user_states[user_id] = {'step': 'main_menu', 'data': {}}
        await start(update, context)
        return
    
    # Обработка различных этапов
    if step in ['history_question', 'referral_question', 'other_question']:
        # Сохраняем описание проблемы
        state['data']['description'] = message_text
        state['step'] = 'request_receipt'
        user_states[user_id] = state
        
        await update.message.reply_text(
            "📤 Пожалуйста, отправьте скриншот чека об оплате (если применимо).\n\n"
            "Или отправьте любое другое фото, связанное с вашей проблемой.\n\n"
            "Если у вас нет чека, отправьте любое сообщение для продолжения."
        )
    
    elif step == 'request_receipt':
        # Пользователь отправил текст вместо чека или после чека
        if message_text and message_text.lower() not in ['/start', 'start', 'привет', 'hi', 'hello', 'начать', 'меню']:
            state['data']['additional_info'] = message_text
        
        # Завершаем сбор информации (если пользователь не вернулся в меню)
        if message_text.lower() not in ['/start', 'start', 'привет', 'hi', 'hello', 'начать', 'меню']:
            await finish_support_request(update, context, user_id, state['data'])
            # Сбрасываем состояние
            user_states[user_id] = {'step': 'main_menu', 'data': {}}
        else:
            # Возвращаем в главное меню
            user_states[user_id] = {'step': 'main_menu', 'data': {}}
            await start(update, context)
    
    else:
        # Неизвестное состояние, возвращаем в главное меню
        user_states[user_id] = {'step': 'main_menu', 'data': {}}
        await start(update, context)

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик отправки фото (чека)"""
    user_id = update.effective_user.id
    
    if user_id not in user_states:
        user_states[user_id] = {'step': 'main_menu', 'data': {}}
        await start(update, context)
        return
    
    state = user_states.get(user_id, {})
    step = state.get('step', 'main_menu')
    
    if step == 'request_receipt':
        # Сохраняем информацию о фото
        photo = update.message.photo[-1] if update.message.photo else None
        if photo:
            state['data']['has_receipt'] = True
            state['data']['receipt_file_id'] = photo.file_id
        
        # Завершаем сбор информации
        await finish_support_request(update, context, user_id, state['data'])
        
        # Сбрасываем состояние
        user_states[user_id] = {'step': 'main_menu', 'data': {}}
    else:
        # Если фото отправлено вне контекста, предлагаем вернуться в меню
        user_states[user_id] = {'step': 'main_menu', 'data': {}}
        await update.message.reply_text(
            "Пожалуйста, сначала выберите тип проблемы из меню.",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔙 В главное меню", callback_data="main_menu")
            ]])
        )

async def finish_support_request(update: Update, context: ContextTypes.DEFAULT_TYPE, user_id: int, data: dict) -> None:
    """Завершение сбора информации и отправка финального сообщения"""
    issue_type = data.get('issue_type', 'unknown')
    has_cents = data.get('has_cents', None)
    has_receipt = data.get('has_receipt', False)
    description = data.get('description', '')
    additional_info = data.get('additional_info', '')
    
    # Формируем сводку для пользователя
    summary = "✅ Ваша заявка принята!\n\n"
    summary += f"Тип проблемы: {get_issue_type_name(issue_type)}\n"
    
    if has_cents is not None:
        summary += f"Средства с копейками: {'Да' if has_cents else 'Нет'}\n"
    
    if has_receipt:
        summary += "Чек отправлен: ✅\n"
    
    if description:
        summary += f"\nОписание: {description}\n"
    
    if additional_info:
        summary += f"\nДополнительная информация: {additional_info}\n"
    
    summary += "\n\n⏳ Ожидайте, вам ответит админ в течение 5 минут."
    
    # Если есть чек, отправляем его вместе с текстом
    if has_receipt and 'receipt_file_id' in data:
        await update.message.reply_photo(
            photo=data['receipt_file_id'],
            caption=summary
        )
    else:
        await update.message.reply_text(summary)
    
    # Предлагаем вернуться в меню
    await update.message.reply_text(
        "Если у вас есть еще вопросы, выберите действие:",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🔄 Новая заявка", callback_data="main_menu")
        ]])
    )
    
    # Логируем информацию для админа
    logger.info(f"📋 Новая заявка в техподдержку от пользователя {user_id}")
    logger.info(f"   Тип: {issue_type}")
    logger.info(f"   Данные: {data}")

def get_issue_type_name(issue_type: str) -> str:
    """Получает название типа проблемы"""
    names = {
        'deposit': '💰 Проблема с пополнением',
        'withdraw': '💸 Проблема с выводом',
        'history': '📊 Вопрос по истории',
        'referral': '👥 Вопрос по рефералам',
        'other': '❓ Другая проблема'
    }
    return names.get(issue_type, 'Неизвестная проблема')

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик ошибок"""
    logger.error(f"Ошибка: {context.error}")

def main() -> None:
    """Главная функция"""
    # Создаем приложение
    application = Application.builder().token(SUPPORT_BOT_TOKEN).build()
    
    # Добавляем обработчик команды /start
    application.add_handler(CommandHandler("start", start))
    
    # Добавляем обработчик нажатий на кнопки
    application.add_handler(CallbackQueryHandler(handle_callback))
    
    # Добавляем обработчик текстовых сообщений
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    # Добавляем обработчик фото
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    
    # Добавляем обработчик ошибок
    application.add_error_handler(error_handler)
    
    # Запускаем бота
    print("🤖 Бот техподдержки запущен!")
    logger.info("Support bot started")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()

