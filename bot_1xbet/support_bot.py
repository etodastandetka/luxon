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
        user_states[user_id] = {'step': 'withdraw_qr_photo', 'data': {'issue_type': 'withdraw'}}
        await query.edit_message_text(
            "💸 Проблема с выводом\n\n"
            "Вы отправили правильное фото с QR кодом?\n\n"
            "QR код должен быть четким, полностью видимым и соответствовать выбранному банку.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("✅ Да, фото правильное", callback_data="qr_photo_ok")],
                [InlineKeyboardButton("❌ Нет, проблема с фото", callback_data="qr_photo_issue")],
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
    
    elif callback_data == "qr_photo_ok":
        state = user_states.get(user_id, {})
        state['data']['qr_photo_ok'] = True
        state['step'] = 'withdraw_code'
        user_states[user_id] = state
        
        await query.edit_message_text(
            "✅ Хорошо, фото QR кода правильное.\n\n"
            "Вы правильно ввели код подтверждения с сайта букмекера?\n\n"
            "Код обычно находится в личном кабинете на сайте букмекера в разделе вывода средств.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("✅ Да, код правильный", callback_data="code_ok")],
                [InlineKeyboardButton("❌ Нет, проблема с кодом", callback_data="code_issue")],
                [InlineKeyboardButton("❓ Не знаю, где найти код", callback_data="code_unknown")],
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data == "qr_photo_issue":
        state = user_states.get(user_id, {})
        state['data']['qr_photo_ok'] = False
        state['step'] = 'request_qr_photo'
        user_states[user_id] = state
        
        await query.edit_message_text(
            "📤 Пожалуйста, отправьте новое фото QR кода.\n\n"
            "Убедитесь, что:\n"
            "• QR код четкий и полностью виден\n"
            "• Фото не размытое\n"
            "• Выбран правильный банк\n"
            "• QR код соответствует сумме вывода",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data == "code_ok":
        state = user_states.get(user_id, {})
        state['data']['code_ok'] = True
        state['step'] = 'withdraw_additional'
        user_states[user_id] = state
        
        await query.edit_message_text(
            "✅ Хорошо, код введен правильно.\n\n"
            "Какая именно проблема возникла с выводом?\n\n"
            "Выберите вариант или опишите проблему текстом:",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("⏰ Долго не приходят средства", callback_data="withdraw_delay")],
                [InlineKeyboardButton("❌ Заявка отклонена", callback_data="withdraw_rejected")],
                [InlineKeyboardButton("💳 Неправильные реквизиты", callback_data="withdraw_wrong_details")],
                [InlineKeyboardButton("❓ Другая проблема", callback_data="withdraw_other")],
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data == "code_issue":
        state = user_states.get(user_id, {})
        state['data']['code_ok'] = False
        state['step'] = 'request_code_info'
        user_states[user_id] = state
        
        await query.edit_message_text(
            "📝 Опишите проблему с кодом:\n\n"
            "• Код не принимается?\n"
            "• Неправильный формат?\n"
            "• Код не найден на сайте?\n\n"
            "Опишите вашу ситуацию текстом:",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data == "code_unknown":
        state = user_states.get(user_id, {})
        state['data']['code_unknown'] = True
        state['step'] = 'request_receipt'
        user_states[user_id] = state
        
        await query.edit_message_text(
            "ℹ️ Инструкция по поиску кода:\n\n"
            "1. Зайдите в личный кабинет на сайте букмекера\n"
            "2. Перейдите в раздел 'Вывод средств' или 'Касса'\n"
            "3. Найдите активную заявку на вывод\n"
            "4. Код подтверждения обычно показывается в деталях заявки\n\n"
            "Если код не найден, отправьте скриншот раздела вывода или опишите проблему:",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 Назад", callback_data="main_menu")]
            ])
        )
    
    elif callback_data in ["withdraw_delay", "withdraw_rejected", "withdraw_wrong_details", "withdraw_other"]:
        state = user_states.get(user_id, {})
        state['data']['withdraw_problem'] = callback_data
        state['step'] = 'request_receipt'
        user_states[user_id] = state
        
        problem_texts = {
            "withdraw_delay": "⏰ Долго не приходят средства",
            "withdraw_rejected": "❌ Заявка отклонена",
            "withdraw_wrong_details": "💳 Неправильные реквизиты",
            "withdraw_other": "❓ Другая проблема"
        }
        
        await query.edit_message_text(
            f"📤 {problem_texts.get(callback_data, 'Проблема с выводом')}\n\n"
            "Пожалуйста, отправьте скриншот:\n"
            "• Заявки на вывод в личном кабинете\n"
            "• Или любую другую информацию, связанную с проблемой",
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
    
    elif step == 'request_qr_photo':
        # Пользователь отправляет новое фото QR кода
        if message_text and message_text.lower() not in ['/start', 'start', 'привет', 'hi', 'hello', 'начать', 'меню']:
            state['data']['qr_photo_description'] = message_text
            state['step'] = 'request_receipt'
            user_states[user_id] = state
            
            await update.message.reply_text(
                "📤 Пожалуйста, отправьте фото QR кода.\n\n"
                "Если у вас есть дополнительные вопросы, опишите их текстом."
            )
        else:
            # Возвращаем в главное меню
            user_states[user_id] = {'step': 'main_menu', 'data': {}}
            await start(update, context)
    
    elif step == 'request_code_info':
        # Пользователь описывает проблему с кодом
        if message_text and message_text.lower() not in ['/start', 'start', 'привет', 'hi', 'hello', 'начать', 'меню']:
            state['data']['code_description'] = message_text
            state['step'] = 'request_receipt'
            user_states[user_id] = state
            
            await update.message.reply_text(
                "📤 Пожалуйста, отправьте скриншот:\n"
                "• Заявки на вывод в личном кабинете\n"
                "• Или раздела с кодом подтверждения\n\n"
                "Это поможет нам быстрее разобраться в проблеме."
            )
        else:
            # Возвращаем в главное меню
            user_states[user_id] = {'step': 'main_menu', 'data': {}}
            await start(update, context)
    
    elif step == 'withdraw_additional':
        # Пользователь описывает дополнительную проблему с выводом
        if message_text and message_text.lower() not in ['/start', 'start', 'привет', 'hi', 'hello', 'начать', 'меню']:
            state['data']['additional_withdraw_info'] = message_text
            state['step'] = 'request_receipt'
            user_states[user_id] = state
            
            await update.message.reply_text(
                "📤 Пожалуйста, отправьте скриншот:\n"
                "• Заявки на вывод в личном кабинете\n"
                "• Или любую другую информацию, связанную с проблемой"
            )
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
    
    if step in ['request_receipt', 'request_qr_photo']:
        # Сохраняем информацию о фото
        photo = update.message.photo[-1] if update.message.photo else None
        if photo:
            state['data']['has_receipt'] = True
            state['data']['receipt_file_id'] = photo.file_id
            
            if step == 'request_qr_photo':
                state['data']['qr_photo_received'] = True
        
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
    
    # Информация для пополнения
    if issue_type == 'deposit':
        has_cents = data.get('has_cents', None)
        if has_cents is not None:
            summary += f"Средства с копейками: {'Да' if has_cents else 'Нет'}\n"
    
    # Информация для вывода
    if issue_type == 'withdraw':
        qr_photo_ok = data.get('qr_photo_ok')
        if qr_photo_ok is not None:
            summary += f"Фото QR кода: {'✅ Правильное' if qr_photo_ok else '❌ Проблема'}\n"
        
        code_ok = data.get('code_ok')
        if code_ok is not None:
            summary += f"Код подтверждения: {'✅ Правильный' if code_ok else '❌ Проблема'}\n"
        
        code_unknown = data.get('code_unknown')
        if code_unknown:
            summary += "Код подтверждения: ❓ Не знаю, где найти\n"
        
        withdraw_problem = data.get('withdraw_problem')
        if withdraw_problem:
            problem_names = {
                "withdraw_delay": "⏰ Долго не приходят средства",
                "withdraw_rejected": "❌ Заявка отклонена",
                "withdraw_wrong_details": "💳 Неправильные реквизиты",
                "withdraw_other": "❓ Другая проблема"
            }
            summary += f"Проблема: {problem_names.get(withdraw_problem, 'Не указано')}\n"
        
        code_description = data.get('code_description')
        if code_description:
            summary += f"\nОписание проблемы с кодом: {code_description}\n"
        
        qr_photo_description = data.get('qr_photo_description')
        if qr_photo_description:
            summary += f"\nОписание проблемы с фото: {qr_photo_description}\n"
        
        additional_withdraw_info = data.get('additional_withdraw_info')
        if additional_withdraw_info:
            summary += f"\nДополнительная информация: {additional_withdraw_info}\n"
    
    if has_receipt:
        summary += "\nФото/скриншот отправлен: ✅\n"
    
    description = data.get('description')
    if description:
        summary += f"\nОписание: {description}\n"
    
    additional_info = data.get('additional_info')
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
    
    # Дополнительное логирование для вывода
    if issue_type == 'withdraw':
        logger.info(f"   QR фото: {'OK' if data.get('qr_photo_ok') else 'Issue'}")
        logger.info(f"   Код: {'OK' if data.get('code_ok') else 'Issue' if data.get('code_ok') is not None else 'Unknown'}")
        if data.get('withdraw_problem'):
            logger.info(f"   Проблема: {data.get('withdraw_problem')}")

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

