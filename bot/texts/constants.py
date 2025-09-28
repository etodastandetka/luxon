#!/usr/bin/env python3
"""
Constants for message templates and UI elements
"""
from typing import Dict, Any

class Emoji:
    """Emoji constants for consistent usage"""
    
    # Money and transactions
    MONEY = "💰"
    CARD = "💳"
    BANK = "🏦"
    COINS = "🪙"
    
    # Status indicators
    SUCCESS = "✅"
    ERROR = "❌"
    WARNING = "⚠️"
    INFO = "ℹ️"
    LOADING = "⏳"
    
    # Navigation
    BACK = "🔙"
    NEXT = "➡️"
    HOME = "🏠"
    MENU = "📋"
    
    # Referral system
    REFERRAL = "💎"
    TROPHY = "🏆"
    ROCKET = "🚀"
    LINK = "🔗"
    STATS = "📊"
    GIFT = "🎁"
    
    # Communication
    PHONE = "📱"
    CHAT = "💬"
    SUPPORT = "👨‍💻"
    CLOCK = "⏰"
    SECURITY = "🔒"
    
    # Bookmakers
    BOOKMAKER = "🎰"
    SPORTS = "⚽"
    CASINO = "🎲"
    
    # Actions
    SEND = "📤"
    RECEIVE = "📥"
    CHECK = "🔍"
    SETTINGS = "⚙️"
    HELP = "❓"

class URLs:
    """URL constants for the application"""
    
    # Bot URLs
    BOT_USERNAME = "bingokg_bot"
    BOT_LINK = f"https://t.me/bingokg_bot"
    
    # Web interface
    WEB_BASE = "http://localhost:8080"
    WEB_TOP = f"{WEB_BASE}/top"
    WEB_REFERRAL = f"{WEB_BASE}/referral"
    
    # Support
    SUPPORT_USERNAME = "luxon_support"
    SUPPORT_LINK = f"https://t.me/luxon_support"
    CHAT_LINK = "https://t.me/luxkassa_chat"
    
    # Referral system
    REFERRAL_BASE = f"{BOT_LINK}?start=ref"
    
    @classmethod
    def get_referral_link(cls, user_id: int) -> str:
        """Generate referral link for user"""
        return f"{cls.REFERRAL_BASE}{user_id}"

class Limits:
    """Transaction and system limits"""
    
    # Amount limits (in KGS)
    MIN_DEPOSIT = 100
    MAX_DEPOSIT = 100000
    MIN_WITHDRAW = 100
    MAX_WITHDRAW = 100000
    
    # Referral system
    MIN_DEPOSIT_FOR_COMMISSION = 100
    COMMISSION_RATE = 0.02  # 2%
    MAX_DAILY_COMMISSIONS = 1000  # Protection against abuse
    
    # API limits
    API_TIMEOUT = 30  # seconds
    MAX_RETRIES = 3
    RATE_LIMIT_PER_MINUTE = 60

class Messages:
    """Common message parts"""
    
    # Welcome messages
    WELCOME_TITLE = "Пополнение | Вывод"
    WELCOME_SUBTITLE = "из букмекерских контор!"
    
    # Features
    FEATURE_DEPOSIT = "📥 Пополнение — 0%"
    FEATURE_WITHDRAW = "📤 Вывод — 0%"
    FEATURE_24_7 = "🕒 Работаем 24/7"
    
    # Security
    SECURITY_MESSAGE = "🔒 Финансовый контроль обеспечен личным отделом безопасности"
    
    # Support
    SUPPORT_MESSAGE = "👨‍💻 Поддержка: {admin_username}"
    CHAT_MESSAGE = "💬 Чат для всех: @luxkassa_chat"
    
    # Referral system
    REFERRAL_TITLE = "💎 Реферальная программа LUXON"
    REFERRAL_TOP_REWARDS = "🏆 ТОП рефероводы каждый месяц получают награды"
    REFERRAL_COMMISSION = "💰 +2% от пополнений приглашённых на твой баланс"
    REFERRAL_INVITE = "🚀 Приглашай друзей и входи в ТОП!"
    
    # How it works
    REFERRAL_HOW_IT_WORKS = [
        "• За каждый депозит реферала вы получаете 2% на свой баланс",
        "• Топ рассчитывается по сумме депозитов ваших рефералов",
        "• Ежемесячные награды для лучших рефероводов",
        "• Минимальная сумма депозита: 100 KGS"
    ]
    
    # Transaction messages
    TRANSACTION_PROCESSING = "⏳ Обрабатываем вашу заявку..."
    TRANSACTION_SUCCESS = "✅ Операция выполнена успешно!"
    TRANSACTION_ERROR = "❌ Произошла ошибка при выполнении операции"
    
    # Validation messages
    VALIDATION_AMOUNT_MIN = f"❌ Минимальная сумма: {Limits.MIN_DEPOSIT} KGS"
    VALIDATION_AMOUNT_MAX = f"❌ Максимальная сумма: {Limits.MAX_DEPOSIT} KGS"
    VALIDATION_INVALID_ID = "❌ ID должен состоять только из цифр"
    VALIDATION_INVALID_BOOKMAKER = "❌ Выбран неверный букмекер"

class Colors:
    """Color constants for web interface"""
    
    # Primary colors
    PRIMARY = "#e94560"
    SECONDARY = "#533483"
    ACCENT = "#4ade80"
    
    # Background colors
    BG_DARK = "#0f0f23"
    BG_CARD = "#1a1a2e"
    BG_LIGHTER = "#2a2a4a"
    
    # Text colors
    TEXT_PRIMARY = "#ffffff"
    TEXT_SECONDARY = "#a0a0a0"
    TEXT_MUTED = "#666666"
    
    # Status colors
    SUCCESS_COLOR = "#10b981"
    ERROR_COLOR = "#ef4444"
    WARNING_COLOR = "#f59e0b"
    INFO_COLOR = "#3b82f6"
    
    # Border colors
    BORDER_LIGHT = "rgba(255, 255, 255, 0.1)"
    BORDER_MEDIUM = "rgba(255, 255, 255, 0.2)"
    BORDER_STRONG = "rgba(255, 255, 255, 0.3)"

class Timeouts:
    """Timeout constants for various operations"""
    
    # API operations
    API_DEPOSIT = 30
    API_WITHDRAW = 30
    API_BALANCE = 15
    
    # UI operations
    UI_LOADING = 5
    UI_NOTIFICATION = 3
    
    # Database operations
    DB_QUERY = 10
    DB_TRANSACTION = 30
    
    # Web operations
    WEB_REQUEST = 15
    WEB_RESPONSE = 10

class Config:
    """Configuration constants"""
    
    # Database
    DB_NAME = "universal_bot.db"
    DB_BACKUP_DIR = "backups/"
    
    # Logging
    LOG_LEVEL = "INFO"
    LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    LOG_FILE = "bot.log"
    
    # Web server
    WEB_HOST = "localhost"
    WEB_PORT = 8080
    WEB_DEBUG = False
    
    # Bot settings
    BOT_POLLING_TIMEOUT = 30
    BOT_MAX_WORKERS = 4
    
    # Security
    MAX_LOGIN_ATTEMPTS = 3
    SESSION_TIMEOUT = 3600  # 1 hour
    PASSWORD_MIN_LENGTH = 8

