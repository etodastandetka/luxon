from django.db import models
from django.utils import timezone
import json
import sqlite3
from django.conf import settings

# Импортируем модели автопополнения
from .auto_deposit_models import *
from .bot_models import *

class BotSettings(models.Model):
    """Настройки бота"""
    is_active = models.BooleanField(default=True, verbose_name="Бот активен")
    maintenance_message = models.TextField(
        default="🔧 Технические работы\nБот временно недоступен. Попробуйте позже.",
        verbose_name="Сообщение о технических работах"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Настройки бота"
        verbose_name_plural = "Настройки бота"
    
    def __str__(self):
        return f"Бот {'активен' if self.is_active else 'неактивен'}"

class BroadcastMessage(models.Model):
    """Сообщения для рассылки"""
    title = models.CharField(max_length=200, verbose_name="Заголовок")
    message = models.TextField(verbose_name="Текст сообщения")
    is_sent = models.BooleanField(default=False, verbose_name="Отправлено")
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name="Время отправки")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Сообщение для рассылки"
        verbose_name_plural = "Сообщения для рассылки"
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title

class BankSettings(models.Model):
    """Настройки банков"""
    BANK_CHOICES = [
        ('demirbank', 'Демирбанк'),
        ('odengi', 'О! Деньги'),
        ('bakai', 'Бакай'),
        ('balance', 'Balance.kg'),
        ('megapay', 'MegaPay'),
        ('mbank', 'MBank'),
    ]
    
    bank_code = models.CharField(max_length=20, choices=BANK_CHOICES, unique=True, verbose_name="Код банка")
    bank_name = models.CharField(max_length=100, verbose_name="Название банка")
    is_enabled_deposit = models.BooleanField(default=True, verbose_name="Включен для пополнения")
    is_enabled_withdraw = models.BooleanField(default=True, verbose_name="Включен для вывода")
    url_template = models.CharField(max_length=200, verbose_name="Шаблон URL")
    icon = models.CharField(max_length=10, default="🏦", verbose_name="Иконка")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Настройки банка"
        verbose_name_plural = "Настройки банков"
        ordering = ['bank_name']
    
    def __str__(self):
        return f"{self.icon} {self.bank_name}"

class QRHash(models.Model):
    """QR хеши для аккаунтов Демирбанка с настройками email"""
    
    account_name = models.CharField(max_length=100, default="Демирбанк Аккаунт", verbose_name="Название аккаунта", help_text="Например: Демирбанк Аккаунт 1")
    hash_value = models.TextField(verbose_name="QR Hash")
    
    # Настройки email для мониторинга (общие для всех аккаунтов)
    gmail_email = models.EmailField(default="", verbose_name="Gmail для мониторинга", help_text="Ваша почта, куда приходят уведомления")
    gmail_password = models.CharField(max_length=255, default="", verbose_name="Пароль Gmail", help_text="Пароль от Gmail или App Password")
    
    # Настройки парсинга уведомлений (общие для всех аккаунтов)
    amount_pattern = models.CharField(max_length=200, default=r'на сумму\s+([\d,]+\.?\d*)\s+KGS', verbose_name="Паттерн суммы")
    date_pattern = models.CharField(max_length=200, default=r'от\s+(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})', verbose_name="Паттерн даты")
    
    is_active = models.BooleanField(default=False, verbose_name="Активен")
    is_main = models.BooleanField(default=False, verbose_name="Основной аккаунт", help_text="Используется для пополнений по умолчанию")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Аккаунт Демирбанка"
        verbose_name_plural = "Аккаунты Демирбанка"
        ordering = ['-is_main', '-created_at']
    
    def __str__(self):
        status = "✅ Активен" if self.is_active else "❌ Неактивен"
        main = "⭐ Основной" if self.is_main else ""
        return f"{self.account_name} - {self.hash_value[:20]}... ({status}) {main}"
    
    def save(self, *args, **kwargs):
        if self.is_main:
            QRHash.objects.filter(is_main=True).exclude(id=self.id).update(is_main=False)
        super().save(*args, **kwargs)


class BankWallet(models.Model):
    """Кошельки для банков (MBank/Bakai/Optima и др.) с выбором активного и основного кошелька на банк.

    Используется для хранения реквизита (hash_value) в специфичном формате для каждого банка.
    """
    BANK_CHOICES = [
        ('mbank', 'MBank'),
        ('bakai', 'Bakai'),
        ('optima', 'Optima'),
    ]

    bank_code = models.CharField(max_length=20, choices=BANK_CHOICES, verbose_name="Банк")
    account_name = models.CharField(max_length=100, verbose_name="Название реквизита")
    hash_value = models.TextField(verbose_name="Hash/реквизит")

    is_active = models.BooleanField(default=False, verbose_name="Активен")
    is_main = models.BooleanField(default=False, verbose_name="Основной для банка")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Кошелёк банка"
        verbose_name_plural = "Кошельки банков"
        ordering = ['bank_code', '-is_main', '-is_active', '-created_at']
        indexes = [
            models.Index(fields=['bank_code', 'is_active']),
            models.Index(fields=['bank_code', 'is_main']),
        ]

    def __str__(self):
        flags = ("⭐" if self.is_main else "") + (" ✅" if self.is_active else " ❌")
        return f"{self.bank_code}:{self.account_name} {flags}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Гарантируем единственность основного кошелька на банк
        if self.is_main:
            BankWallet.objects.filter(bank_code=self.bank_code, is_main=True).exclude(id=self.id).update(is_main=False)

class BotConfiguration(models.Model):
    """Конфигурация настроек бота"""
    key = models.CharField(max_length=128, unique=True)
    value = models.TextField(blank=True, default="")
    description = models.CharField(max_length=200, blank=True, verbose_name="Описание")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Настройка бота"
        verbose_name_plural = "Настройки бота"

    def __str__(self):
        return f"{self.key}"

    def get_json_value(self):
        try:
            return json.loads(self.value or "{}")
        except Exception:
            return {}

    def set_json_value(self, data):
        self.value = json.dumps(data, ensure_ascii=False)


class BotDepositRequest(models.Model):
    """Заявки на пополнение от бота"""
    STATUS_CHOICES = [
        ('pending', 'Ожидает'),
        ('processing', 'Обрабатывается'),
        ('completed', 'Завершено'),
        ('rejected', 'Отклонено'),
    ]

    BOOKMAKER_CHOICES = [
        ('1xbet', '1XBET'),
        ('1win', '1WIN'),
        ('melbet', 'MELBET'),
        ('mostbet', 'MOSTBET'),
    ]

    user_id = models.BigIntegerField(verbose_name="ID пользователя")
    username = models.CharField(max_length=100, blank=True, verbose_name="Username")
    first_name = models.CharField(max_length=100, blank=True, verbose_name="Имя")
    last_name = models.CharField(max_length=100, blank=True, verbose_name="Фамилия")

    bookmaker = models.CharField(max_length=20, choices=BOOKMAKER_CHOICES, verbose_name="Букмекер")
    account_id = models.CharField(max_length=50, verbose_name="ID аккаунта")
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Сумма")
    bank = models.CharField(max_length=50, verbose_name="Банк")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="Статус")
    receipt_photo = models.TextField(blank=True, verbose_name="Фото чека (file_id)")
    receipt_photo_url = models.URLField(blank=True, default='', verbose_name="URL фото чека")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлено")
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name="Обработано")

    class Meta:
        verbose_name = "Заявка на пополнение"
        verbose_name_plural = "Заявки на пополнение"
        ordering = ['-created_at']

    def __str__(self):
        return f"Пополнение {self.bookmaker} - {self.amount} сом ({self.status})"

    @classmethod
    def sync_from_bot_db(cls):
        """Синхронизация заявок на пополнение из базы бота"""
        bot_db_path = settings.BOT_DATABASE_PATH

        try:
            conn = sqlite3.connect(bot_db_path)
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT user_id, username, first_name, last_name, bookmaker,
                       account_id, amount, bank, status, receipt_photo,
                       created_at, updated_at, processed_at
                FROM deposit_requests
                WHERE created_at > datetime('now', '-7 days')
                """
            )

            bot_requests = cursor.fetchall()

            for row in bot_requests:
                (
                    user_id, username, first_name, last_name,
                    bookmaker, account_id, amount, bank, status,
                    receipt_photo, created_at, updated_at, processed_at
                ) = row

                request_obj, created = cls.objects.get_or_create(
                    user_id=user_id,
                    bookmaker=bookmaker,
                    account_id=account_id,
                    amount=amount,
                    created_at=created_at,
                    defaults={
                        'username': username or '',
                        'first_name': first_name or '',
                        'last_name': last_name or '',
                        'bank': bank or '',
                        'status': status,
                        'receipt_photo': receipt_photo or '',
                        'updated_at': updated_at,
                        'processed_at': processed_at,
                    },
                )

                if not created:
                    request_obj.status = status
                    request_obj.updated_at = updated_at
                    request_obj.processed_at = processed_at
                    request_obj.save()

            conn.close()
            return len(bot_requests)
        except Exception as e:
            print(f"Ошибка синхронизации: {e}")
            return 0

class BotWithdrawRequest(models.Model):
    """Заявки на вывод от бота"""
    STATUS_CHOICES = [
        ('pending', 'Ожидает'),
        ('processing', 'Обрабатывается'),
        ('completed', 'Завершено'),
        ('rejected', 'Отклонено'),
    ]
    
    BOOKMAKER_CHOICES = [
        ('1xbet', '1XBET'),
        ('1win', '1WIN'),
        ('melbet', 'MELBET'),
        ('mostbet', 'MOSTBET'),
    ]
    
    user_id = models.BigIntegerField(verbose_name="ID пользователя")
    username = models.CharField(max_length=100, blank=True, verbose_name="Username")
    first_name = models.CharField(max_length=100, blank=True, verbose_name="Имя")
    last_name = models.CharField(max_length=100, blank=True, verbose_name="Фамилия")
    
    bookmaker = models.CharField(max_length=20, choices=BOOKMAKER_CHOICES, verbose_name="Букмекер")
    account_id = models.CharField(max_length=50, verbose_name="ID аккаунта")
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Сумма")
    bank = models.CharField(max_length=50, verbose_name="Банк")
    withdrawal_code = models.CharField(max_length=100, verbose_name="Код вывода")
    qr_photo = models.TextField(blank=True, verbose_name="QR/чек (file_id)")
    qr_photo_url = models.URLField(blank=True, default='', verbose_name="URL QR/чека")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="Статус")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлено")
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name="Обработано")
    
    class Meta:
        verbose_name = "Заявка на вывод"
        verbose_name_plural = "Заявки на вывод"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Вывод {self.bookmaker} - {self.amount} сом ({self.status})"
    
    @classmethod
    def sync_from_bot_db(cls):
        """Синхронизация заявок на вывод из базы бота"""
        bot_db_path = settings.BOT_DATABASE_PATH
        
        try:
            conn = sqlite3.connect(bot_db_path)
            cursor = conn.cursor()
            
            # Получаем все заявки на вывод из базы бота
            cursor.execute("""
                SELECT user_id, bookmaker, amount, status, created_at, processed_at
                FROM withdrawals
                WHERE created_at > datetime('now', '-7 days')
            """)
            
            bot_requests = cursor.fetchall()
            
            for row in bot_requests:
                user_id, bookmaker, amount, status, created_at, processed_at = row
                
                # Создаем или обновляем заявку в Django
                request_obj, created = cls.objects.get_or_create(
                    user_id=user_id,
                    bookmaker=bookmaker,
                    amount=amount,
                    created_at=created_at,
                    defaults={
                        'username': '',
                        'first_name': '',
                        'last_name': '',
                        'account_id': '',
                        'bank': '',
                        'withdrawal_code': '',
                        'qr_photo': '',
                        'status': status,
                        'processed_at': processed_at
                    }
                )
                
                if not created:
                    # Обновляем существующую заявку
                    request_obj.status = status
                    request_obj.processed_at = processed_at
                    request_obj.save()
            
            conn.close()
            return len(bot_requests)
        except Exception as e:
            print(f"Ошибка синхронизации (withdraw): {e}")
            return 0


class TransactionLog(models.Model):
    """Логи входящих платежных уведомлений от Android-приложения"""
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    bank = models.CharField(max_length=50)
    timestamp = models.DateTimeField()
    raw_message = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[
            ('received', 'Получено'),
            ('error', 'Ошибка'),
            ('processed', 'Обработано'),
        ],
        default='received'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Лог платежа'
        verbose_name_plural = 'Логи платежей'
        indexes = [
            models.Index(fields=['timestamp']),
            models.Index(fields=['bank']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.bank} {self.amount} @ {self.timestamp:%Y-%m-%d %H:%M} ({self.status})"
