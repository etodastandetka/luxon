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
    status_detail = models.CharField(max_length=50, blank=True, null=True)  # success, api_error, etc.
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


class ChatMessage(models.Model):
    """Сообщения чата между админом и пользователем"""
    user_id = models.BigIntegerField(db_index=True)  # Telegram user ID
    message_text = models.TextField(blank=True, null=True)
    message_type = models.CharField(max_length=20, default='text')  # text, photo, video, document
    media_url = models.TextField(blank=True, null=True)
    direction = models.CharField(max_length=10, default='in')  # 'in' - от пользователя, 'out' - от админа
    telegram_message_id = models.BigIntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'chat_messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['user_id', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.direction} - User {self.user_id}: {self.message_text[:50] if self.message_text else 'media'}"


class IncomingPayment(models.Model):
    """Входящие переводы по QR (сохраняются из email уведомлений банков)"""
    amount = models.DecimalField(max_digits=10, decimal_places=2, db_index=True)
    bank = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    payment_date = models.DateTimeField(db_index=True)  # Дата и время поступления из email
    notification_text = models.TextField(blank=True, null=True)  # Полный текст уведомления
    request = models.ForeignKey(Request, on_delete=models.SET_NULL, blank=True, null=True, related_name='incoming_payments')
    is_processed = models.BooleanField(default=False, db_index=True)  # Обработан ли платеж (привязан к заявке)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'incoming_payments'
        ordering = ['-payment_date', '-created_at']
        indexes = [
            models.Index(fields=['amount', 'is_processed']),
            models.Index(fields=['payment_date']),
            models.Index(fields=['bank', 'is_processed']),
        ]
    
    def __str__(self):
        return f"Payment {self.amount} сом from {self.bank} at {self.payment_date}"
    
    def amount_without_cents(self):
        """Возвращает сумму без копеек для поиска"""
        return int(float(self.amount))


# ===== Модели для переноса из SQLite в PostgreSQL =====

class BotUser(models.Model):
    """Пользователь бота (из universal_bot.db -> users)"""
    user_id = models.BigIntegerField(primary_key=True, db_column='user_id')
    username = models.CharField(max_length=255, blank=True, null=True)
    first_name = models.CharField(max_length=255, blank=True, null=True)
    last_name = models.CharField(max_length=255, blank=True, null=True)
    language = models.CharField(max_length=10, default='ru')
    selected_bookmaker = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'users'
        verbose_name = 'Пользователь бота'
        verbose_name_plural = 'Пользователи бота'
    
    def __str__(self):
        return f"User {self.user_id}: {self.username or self.first_name or 'Unknown'}"


class BotUserData(models.Model):
    """Данные пользователя (из universal_bot.db -> user_data)"""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(BotUser, on_delete=models.CASCADE, related_name='user_data', db_column='user_id')
    data_type = models.CharField(max_length=255, db_index=True)
    data_value = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'user_data'
        unique_together = [['user', 'data_type']]
        verbose_name = 'Данные пользователя'
        verbose_name_plural = 'Данные пользователей'
    
    def __str__(self):
        return f"UserData {self.user.user_id}: {self.data_type}"


class BotReferral(models.Model):
    """Реферальная связь (из universal_bot.db -> referrals)"""
    id = models.AutoField(primary_key=True)
    referrer = models.ForeignKey(BotUser, on_delete=models.CASCADE, related_name='referrals_made', db_column='referrer_id')
    referred = models.OneToOneField(BotUser, on_delete=models.CASCADE, related_name='referral_from', db_column='referred_id')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'referrals'
        verbose_name = 'Реферальная связь'
        verbose_name_plural = 'Реферальные связи'
        indexes = [
            models.Index(fields=['referrer']),
            models.Index(fields=['referred']),
        ]
    
    def __str__(self):
        return f"Referral: {self.referrer.user_id} -> {self.referred.user_id}"


class BotReferralEarning(models.Model):
    """Реферальный заработок (из universal_bot.db -> referral_earnings)"""
    id = models.AutoField(primary_key=True)
    referrer = models.ForeignKey(BotUser, on_delete=models.CASCADE, related_name='referral_earnings', db_column='referrer_id')
    referred = models.ForeignKey(BotUser, on_delete=models.CASCADE, related_name='earnings_generated', db_column='referred_id')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=10, decimal_places=2)
    bookmaker = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'referral_earnings'
        verbose_name = 'Реферальный заработок'
        verbose_name_plural = 'Реферальные заработки'
        indexes = [
            models.Index(fields=['referrer', 'status']),
            models.Index(fields=['referred']),
        ]
    
    def __str__(self):
        return f"Earning: {self.referrer.user_id} <- {self.referred.user_id}: {self.commission_amount}"


class BotTransaction(models.Model):
    """Транзакция пользователя (из universal_bot.db -> transactions)"""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(BotUser, on_delete=models.CASCADE, related_name='transactions', db_column='user_id')
    bookmaker = models.CharField(max_length=50, blank=True, null=True)
    trans_type = models.CharField(max_length=50, db_index=True)  # deposit, withdraw, etc.
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'transactions'
        verbose_name = 'Транзакция'
        verbose_name_plural = 'Транзакции'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Transaction {self.id}: User {self.user.user_id} - {self.trans_type} {self.amount}"


class BotSetting(models.Model):
    """Настройка бота (из universal_bot.db -> bot_settings)"""
    key = models.CharField(max_length=100, primary_key=True, db_column='key')
    value = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'bot_settings'
        verbose_name = 'Настройка бота (SQLite)'
        verbose_name_plural = 'Настройки бота (SQLite)'
    
    def __str__(self):
        return f"{self.key}: {self.value}"


class BotRequisite(models.Model):
    """Реквизит (из universal_bot.db -> requisites)"""
    id = models.AutoField(primary_key=True)
    value = models.TextField()  # QR хеш или номер счета
    is_active = models.BooleanField(default=False, db_index=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    password = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'requisites'
        verbose_name = 'Реквизит'
        verbose_name_plural = 'Реквизиты'
        indexes = [
            models.Index(fields=['is_active']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['is_active'],
                condition=models.Q(is_active=True),
                name='unique_active_requisite'
            )
        ]
    
    def __str__(self):
        return f"Requisite {self.id}: {self.name or self.value[:20]} ({'active' if self.is_active else 'inactive'})"


class BotReferralTop(models.Model):
    """Топ рефералов (из universal_bot.db -> referral_top)"""
    id = models.AutoField(primary_key=True)
    user = models.OneToOneField(BotUser, on_delete=models.CASCADE, related_name='referral_top_entry', db_column='user_id')
    total_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_referrals = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'referral_top'
        verbose_name = 'Топ реферал'
        verbose_name_plural = 'Топ рефералов'
        ordering = ['-total_earnings']
    
    def __str__(self):
        return f"Top {self.user.user_id}: {self.total_referrals} referrals, {self.total_earnings} earned"


class BotTopPayment(models.Model):
    """Выплата топ рефералу (из universal_bot.db -> top_payments)"""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(BotUser, on_delete=models.CASCADE, related_name='top_payments', db_column='user_id')
    position = models.IntegerField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'top_payments'
        verbose_name = 'Выплата топ рефералу'
        verbose_name_plural = 'Выплаты топ рефералам'
    
    def __str__(self):
        return f"TopPayment {self.id}: User {self.user.user_id} - Position {self.position} - {self.amount}"


class BotMonthlyPayment(models.Model):
    """Месячная выплата (из universal_bot.db -> monthly_payments)"""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(BotUser, on_delete=models.CASCADE, related_name='monthly_payments', db_column='user_id')
    position = models.IntegerField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'monthly_payments'
        verbose_name = 'Месячная выплата'
        verbose_name_plural = 'Месячные выплаты'
    
    def __str__(self):
        return f"MonthlyPayment {self.id}: User {self.user.user_id} - {self.amount}"
