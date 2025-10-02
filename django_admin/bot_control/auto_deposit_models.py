from django.db import models
from django.utils import timezone
import json

class BankAccount(models.Model):
    """Банковские аккаунты с настройками email"""
    
    BANK_CHOICES = [
        ('demirbank', 'Демирбанк'),
        ('optima', 'OptimaBank'),
        ('odengi', 'О! Деньги'),
        ('bakai', 'Бакай'),
        ('balance', 'Balance.kg'),
        ('megapay', 'MegaPay'),
        ('mbank', 'MBank'),
    ]
    
    name = models.CharField(max_length=100, verbose_name="Название аккаунта")
    bank_type = models.CharField(max_length=20, choices=BANK_CHOICES, verbose_name="Тип банка")
    email = models.EmailField(verbose_name="Email для уведомлений")
    email_password = models.CharField(max_length=255, verbose_name="Пароль email", help_text="Или App Password для Gmail")
    qr_hash = models.TextField(verbose_name="QR хеш для этого аккаунта")
    
    # Настройки парсинга
    sender_pattern = models.CharField(max_length=200, default="info@", verbose_name="Паттерн отправителя")
    amount_pattern = models.CharField(max_length=200, default=r'на сумму\s+([\d,]+\.?\d*)\s+KGS', verbose_name="Паттерн суммы")
    date_pattern = models.CharField(max_length=200, default=r'от\s+(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})', verbose_name="Паттерн даты")
    
    # Настройки Gmail API
    gmail_credentials_file = models.CharField(max_length=255, blank=True, null=True, verbose_name="Файл credentials.json")
    gmail_token_file = models.CharField(max_length=255, blank=True, null=True, verbose_name="Файл token.json")
    
    is_active = models.BooleanField(default=True, verbose_name="Активен")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создан")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлен")
    
    class Meta:
        verbose_name = "Банковский аккаунт"
        verbose_name_plural = "Банковские аккаунты"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.get_bank_type_display()})"
    
    def get_email_settings(self):
        """Возвращает настройки email для этого аккаунта"""
        return {
            'email': self.email,
            'password': self.email_password,
            'credentials_file': self.gmail_credentials_file,
            'token_file': self.gmail_token_file,
        }
    
    def get_parsing_patterns(self):
        """Возвращает паттерны для парсинга уведомлений"""
        return {
            'sender_pattern': self.sender_pattern,
            'amount_pattern': self.amount_pattern,
            'date_pattern': self.date_pattern,
        }

class BankNotification(models.Model):
    """Уведомления от банков о поступлении средств"""
    BANK_CHOICES = [
        ('optima', 'OptimaBank'),
        ('demirbank', 'Демирбанк'),
        ('odengi', 'О! Деньги'),
        ('bakai', 'Бакай'),
        ('balance', 'Balance.kg'),
        ('megapay', 'MegaPay'),
        ('mbank', 'MBank'),
    ]
    
    bank = models.CharField(max_length=20, choices=BANK_CHOICES, verbose_name="Банк")
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Сумма")
    currency = models.CharField(max_length=3, default='KGS', verbose_name="Валюта")
    notification_text = models.TextField(verbose_name="Текст уведомления")
    raw_data = models.JSONField(blank=True, null=True, verbose_name="Сырые данные")
    is_processed = models.BooleanField(default=False, verbose_name="Обработано")
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name="Время обработки")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Время получения")
    
    class Meta:
        verbose_name = "Уведомление банка"
        verbose_name_plural = "Уведомления банков"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_bank_display()} - {self.amount} {self.currency}"

class AutoDepositRequest(models.Model):
    """Заявки на автоматическое пополнение"""
    STATUS_CHOICES = [
        ('pending', 'Ожидает'),
        ('processing', 'Обрабатывается'),
        ('approved', 'Подтверждено'),
        ('completed', 'Завершено'),
        ('auto_completed', 'Автопополнение'),
        ('awaiting_manual', 'Ожидает ручного пополнения'),
        ('rejected', 'Отклонено'),
        ('failed', 'Ошибка'),
        ('cancelled', 'Отменено'),
    ]
    
    user_id = models.BigIntegerField(verbose_name="ID пользователя")
    bookmaker = models.CharField(max_length=20, verbose_name="Букмекер")
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Сумма")
    bank_notification = models.ForeignKey(
        BankNotification,
        on_delete=models.CASCADE,
        verbose_name="Уведомление банка",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="Статус")
    error_message = models.TextField(blank=True, null=True, verbose_name="Сообщение об ошибке")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Время создания")
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name="Время обработки")
    
    class Meta:
        verbose_name = "Заявка автопополнения"
        verbose_name_plural = "Заявки автопополнения"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Автопополнение {self.user_id} - {self.amount} {self.bookmaker}"

class PlayerBalance(models.Model):
    """Баланс игроков по букмекерам"""
    user_id = models.BigIntegerField(verbose_name="ID пользователя")
    bookmaker = models.CharField(max_length=20, verbose_name="Букмекер")
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Баланс")
    last_updated = models.DateTimeField(auto_now=True, verbose_name="Последнее обновление")
    
    class Meta:
        verbose_name = "Баланс игрока"
        verbose_name_plural = "Балансы игроков"
        unique_together = ['user_id', 'bookmaker']
        ordering = ['-last_updated']
    
    def __str__(self):
        return f"{self.user_id} - {self.bookmaker}: {self.balance}"
    
    def add_balance(self, amount):
        """Добавить к балансу"""
        self.balance += amount
        self.save()
    
    def subtract_balance(self, amount):
        """Списать с баланса"""
        if self.balance >= amount:
            self.balance -= amount
            self.save()
            return True
        return False

class DepositRule(models.Model):
    """Правила автоматического пополнения"""
    bank = models.CharField(max_length=20, choices=BankNotification.BANK_CHOICES, verbose_name="Банк")
    amount_min = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Минимальная сумма")
    amount_max = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Максимальная сумма")
    is_active = models.BooleanField(default=True, verbose_name="Активно")
    auto_approve = models.BooleanField(default=False, verbose_name="Автоодобрение")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Время создания")
    
    class Meta:
        verbose_name = "Правило пополнения"
        verbose_name_plural = "Правила пополнения"
        ordering = ['bank', 'amount_min']
    
    def __str__(self):
        return f"{self.get_bank_display()} - {self.amount_min}-{self.amount_max}"


class AutoUnifiedRequest(models.Model):
    """Заявки на пополнение и вывод (автоматические, унифицированная модель).
    Unmanaged: используется для чтения/расширения логики без регистрации второй
    модели с тем же именем, чтобы избежать предупреждений Django.
    """
    REQUEST_TYPES = [
        ('deposit', 'Пополнение'),
        ('withdraw', 'Вывод'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Ожидает'),
        ('processing', 'Обрабатывается'),
        ('approved', 'Подтверждено'),
        ('completed', 'Завершена'),
        ('auto_completed', 'Автопополнена'),
        ('awaiting_manual', 'Ожидает ручного пополнения'),
        ('rejected', 'Отклонена'),
        ('failed', 'Ошибка'),
        ('cancelled', 'Отменена'),
    ]
    
    user_id = models.BigIntegerField(verbose_name="ID пользователя")
    username = models.CharField(max_length=100, blank=True, verbose_name="Username")
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Сумма")
    bank_name = models.CharField(max_length=100, blank=True, verbose_name="Банк")
    bookmaker = models.CharField(max_length=50, blank=True, verbose_name="Букмекер")
    transaction_id = models.CharField(max_length=100, blank=True, verbose_name="ID транзакции")
    request_type = models.CharField(max_length=20, choices=REQUEST_TYPES, default='deposit', verbose_name="Тип заявки")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="Статус")
    photo_url = models.URLField(blank=True, verbose_name="Фото чека")
    admin_comment = models.TextField(blank=True, verbose_name="Комментарий админа")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создана")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлена")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="Завершена")
    
    class Meta:
        verbose_name = "Заявка (унифицированная)"
        verbose_name_plural = "Заявки (унифицированные)"
        ordering = ['-created_at']
        managed = False
    
    def __str__(self):
        return f"Заявка #{self.id} - {self.user_id} - {self.amount} KGS"

