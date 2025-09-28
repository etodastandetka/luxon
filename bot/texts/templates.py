#!/usr/bin/env python3
"""
Message templates for universal bot
"""
from typing import Dict, Any

def get_message(language: str, key: str, **kwargs) -> str:
    """Get message by language and key with fallback to Russian"""
    # For now, return the key as fallback
    # This will be replaced with proper translation system
    return key

class MessageTemplates:
    """Message templates for all bookmakers"""
    
    @staticmethod
    def welcome(user_name: str, admin_username: str) -> str:
        """Welcome message template"""
        return f"""Привет, {user_name}

Пополнение | Вывод
из букмекерских контор!

📥 Пополнение — 0%
📤 Вывод — 0%
🕒 Работаем 24/7

👨‍💻 Поддержка: {admin_username}
💬 Чат для всех: @luxkassa_chat

🔒 Финансовый контроль обеспечен личным отделом безопасности"""
    
    @staticmethod
    def select_bookmaker() -> str:
        """Bookmaker selection message"""
        return "Выберите букмекера:"
    
    @staticmethod
    def deposit_start(bookmaker_name: str) -> str:
        """Deposit start message"""
        return f"💳 Начинаем пополнение через {bookmaker_name}..."
    
    @staticmethod
    def withdraw_start(bookmaker_name: str) -> str:
        """Withdraw start message"""
        return f"💰 Начинаем вывод через {bookmaker_name}..."
    
    @staticmethod
    def enter_id(saved_id: str = None) -> str:
        """Enter ID message"""
        text = "📱 Введите ID вашего счета"
        if saved_id:
            text += f"\n\n💾 Сохраненный ID: {saved_id}"
        return text
    
    @staticmethod
    def enter_amount() -> str:
        """Enter amount message"""
        return "💳 Введите сумму пополнения (от 100 до 100,000 KGS):"
    
    @staticmethod
    def payment_info(amount: float, user_id: str, bookmaker_name: str) -> str:
        """Payment information message"""
        return f"""💳 <b>Оплата пополнения</b>

💰 Сумма: {amount:.2f} KGS
🆔 ID: {user_id}
🏢 Букмекер: {bookmaker_name}

📱 <b>Выберите способ оплаты:</b>

📸 <b>После оплаты отправьте фото чека:</b>"""
    
    @staticmethod
    def request_sent(bookmaker_name: str) -> str:
        """Request sent confirmation"""
        return f"""✅ Заявка отправлена в {bookmaker_name}!

⏰ Деньги поступят в течение 5-10 минут.
📱 Ожидайте уведомления от бота."""
    
    @staticmethod
    def referral_info(user_id: int, bot_username: str, stats: Dict[str, Any]) -> str:
        """Referral system information"""
        return f"""💎 <b>Реферальная программа LUXON</b>

🏆 <b>ТОП рефероводы каждый месяц получают награды</b>
💰 <b>+2% от пополнений приглашённых на твой баланс</b>
🚀 <b>Приглашай друзей и входи в ТОП!</b>

🔗 <b>Ваша реферальная ссылка:</b>
<code>https://t.me/{bot_username}?start=ref{user_id}</code>

📊 <b>Ваша статистика:</b>
👥 Приглашено игроков: {stats.get('referrals_count', 0)}
💵 Заработано: {stats.get('total_earnings', 0)} KGS
⏳ Ожидает выплаты: {stats.get('pending_earnings', 0)} KGS

🎁 <b>Как это работает:</b>
• За каждый депозит реферала вы получаете 2% на свой баланс
• Топ рассчитывается по сумме депозитов ваших рефералов
• Ежемесячные награды для лучших рефероводов
• Минимальная сумма депозита: 100 KGS

🌐 <b>Веб-сайт топа:</b> http://localhost:8080

📱 <b>Поделитесь ссылкой с друзьями и зарабатывайте вместе!</b>"""
    
    @staticmethod
    def referral_stats(stats: Dict[str, Any]) -> str:
        """Referral statistics message"""
        text = f"""📊 <b>Детальная статистика рефералов</b>

💰 <b>Общий заработок:</b> {stats.get('total_earnings', 0)} KGS
⏳ <b>Ожидает выплаты:</b> {stats.get('pending_earnings', 0)} KGS

👥 <b>Ваши рефералы:</b>"""
        
        referrals = stats.get('referrals', [])
        if referrals:
            for i, referral in enumerate(referrals[:10], 1):
                text += f"\n{i}. ID: {referral.get('user_id')} | Депозит: {referral.get('amount')} KGS"
        else:
            text += "\nПока нет приглашенных игроков"
        
        return text
    
    @staticmethod
    def referral_top(top_list: list) -> str:
        """Referral top message"""
        text = "🏆 <b>ТОП рефероводов</b>\n\n"
        
        for i, user in enumerate(top_list[:10], 1):
            username = user.get('username', 'Без username')
            earnings = user.get('total_earnings', 0)
            referrals = user.get('referrals_count', 0)
            
            if i == 1:
                text += f"🥇 {username} | {earnings} KGS | {referrals} реф.\n"
            elif i == 2:
                text += f"🥈 {username} | {earnings} KGS | {referrals} реф.\n"
            elif i == 3:
                text += f"🥉 {username} | {earnings} KGS | {referrals} реф.\n"
            else:
                text += f"{i}. {username} | {earnings} KGS | {referrals} реф.\n"
        
        return text
    
    @staticmethod
    def error_message() -> str:
        """Generic error message"""
        return "❌ Произошла ошибка. Попробуйте позже или обратитесь в поддержку."
    
    @staticmethod
    def invalid_amount() -> str:
        """Invalid amount message"""
        return "❌ Сумма должна быть от 100 до 100,000 KGS"
    
    @staticmethod
    def invalid_id() -> str:
        """Invalid ID message"""
        return "❌ ID должен состоять только из цифр"
    
    @staticmethod
    def back_to_menu() -> str:
        """Back to menu message"""
        return "🔙 В главное меню"
