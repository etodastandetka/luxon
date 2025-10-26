from django.contrib.auth.models import User
from django.db import models
import pyotp

class UserProfile(models.Model):
    """Профиль пользователя с 2FA"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    secret_key = models.CharField(max_length=32, blank=True, null=True)
    is_2fa_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def generate_secret_key(self):
        """Генерировать новый секретный ключ"""
        self.secret_key = pyotp.random_base32()
        self.save()
        return self.secret_key
    
    def get_totp_uri(self):
        """Получить URI для QR кода"""
        if not self.secret_key:
            return None
        return pyotp.TOTP(self.secret_key).provisioning_uri(
            name=self.user.username,
            issuer_name="Luxon Admin"
        )
    
    def verify_totp(self, token):
        """Проверить TOTP токен"""
        if not self.secret_key:
            return False
        totp = pyotp.TOTP(self.secret_key)
        return totp.verify(token)
    
    def __str__(self):
        return f"{self.user.username} Profile"

class BotSettings(models.Model):
    """Настройки бота"""
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.key}: {self.value}"
    
    class Meta:
        verbose_name = "Настройка бота"
        verbose_name_plural = "Настройки бота"

class BroadcastMessage(models.Model):
    """Сообщения для рассылки"""
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_sent = models.BooleanField(default=False)
    sent_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title

class BankSettings(models.Model):
    """Настройки банков"""
    bank_name = models.CharField(max_length=100)
    bank_code = models.CharField(max_length=50, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_enabled_deposit = models.BooleanField(default=True)
    is_enabled_withdraw = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.bank_name

class QRHash(models.Model):
    """QR коды"""
    hash_value = models.CharField(max_length=255, unique=True)
    account_name = models.CharField(max_length=100, blank=True, null=True)
    is_used = models.BooleanField(default=False)
    is_main = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    gmail_email = models.EmailField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.hash_value

class BotDepositRequest(models.Model):
    """Запросы на пополнение"""
    user_id = models.IntegerField()
    username = models.CharField(max_length=100, blank=True, null=True)
    bookmaker = models.CharField(max_length=50, blank=True, null=True)
    account_id = models.CharField(max_length=50, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    bank = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=50, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(blank=True, null=True)
    
    def __str__(self):
        return f"Deposit {self.user_id}: {self.amount}"

class BotWithdrawRequest(models.Model):
    """Запросы на вывод"""
    user_id = models.IntegerField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=50, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Withdraw {self.user_id}: {self.amount}"

class BotConfiguration(models.Model):
    """Конфигурация бота"""
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.key}: {self.value}"
    
    @classmethod
    def get_setting(cls, key, default=None):
        """Получить настройку по ключу"""
        try:
            config = cls.objects.get(key=key)
            # Пытаемся преобразовать в boolean если значение 'true'/'false'
            if config.value.lower() in ['true', 'false']:
                return config.value.lower() == 'true'
            return config.value
        except cls.DoesNotExist:
            return default
    
    @classmethod
    def set_setting(cls, key, value, description=''):
        """Установить настройку"""
        config, created = cls.objects.get_or_create(
            key=key,
            defaults={'value': str(value), 'description': description}
        )
        if not created:
            config.value = str(value)
            config.description = description
            config.save()
        return config

class Request(models.Model):
    """Заявки пользователей (пополнение/вывод)"""
    user_id = models.BigIntegerField()
    username = models.CharField(max_length=255, blank=True, null=True)
    first_name = models.CharField(max_length=255, blank=True, null=True)
    last_name = models.CharField(max_length=255, blank=True, null=True)
    bookmaker = models.CharField(max_length=100, blank=True, null=True)
    account_id = models.CharField(max_length=255, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    request_type = models.CharField(max_length=20)  # deposit/withdraw
    status = models.CharField(max_length=20, default='pending')
    withdrawal_code = models.CharField(max_length=255, blank=True, null=True)
    photo_file_id = models.CharField(max_length=255, blank=True, null=True)
    photo_file_url = models.TextField(blank=True, null=True)
    bank = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        db_table = 'requests'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Request {self.user_id}: {self.request_type} {self.amount}"

class TransactionLog(models.Model):
    """Логи транзакций"""
    user_id = models.IntegerField()
    transaction_type = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Transaction {self.user_id}: {self.amount}"

class BankWallet(models.Model):
    """Кошельки банков"""
    bank_name = models.CharField(max_length=100, default='Unknown')
    bank_code = models.CharField(max_length=50, default='unknown')
    wallet_address = models.CharField(max_length=255, default='')
    is_active = models.BooleanField(default=True)
    is_main = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.bank_name}: {self.wallet_address}"
