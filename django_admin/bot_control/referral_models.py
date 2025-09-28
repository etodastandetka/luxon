from django.db import models
from django.utils import timezone

class ReferralWithdrawalRequest(models.Model):
    """
    Модель для заявок на вывод реферальных средств
    """
    STATUS_CHOICES = [
        ('pending', 'Ожидает обработки'),
        ('processing', 'В обработке'),
        ('completed', 'Выплачено'),
        ('rejected', 'Отклонено'),
    ]
    
    PAYMENT_METHOD_CHOICES = [
        ('bank_card', 'Банковская карта'),
        ('e_wallet', 'Электронный кошелек'),
        ('crypto', 'Криптовалюта'),
    ]
    BOOKMAKER_CHOICES = [
        ('1xbet', '1XBET'),
        ('1win', '1WIN'),
        ('melbet', 'MELBET'),
        ('mostbet', 'MOSTBET'),
    ]
    
    # Информация о пользователе
    user_id = models.BigIntegerField(verbose_name="ID пользователя")
    username = models.CharField(max_length=100, blank=True, verbose_name="Username")
    first_name = models.CharField(max_length=100, blank=True, verbose_name="Имя")
    last_name = models.CharField(max_length=100, blank=True, verbose_name="Фамилия")
    phone_number = models.CharField(max_length=20, blank=True, verbose_name="Номер телефона")
    
    # Детали вывода
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Сумма вывода")
    currency = models.CharField(max_length=10, default='KGS', verbose_name="Валюта")
    bookmaker = models.CharField(max_length=20, choices=BOOKMAKER_CHOICES, verbose_name="Букмекер")
    bookmaker_account_id = models.CharField(max_length=64, verbose_name="ID аккаунта в БК")
    payment_method = models.CharField(
        max_length=20, 
        choices=PAYMENT_METHOD_CHOICES, 
        verbose_name="Способ выплаты"
    )
    wallet_details = models.TextField(verbose_name="Реквизиты для выплаты")
    
    # Статус и метаданные
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='pending', 
        verbose_name="Статус заявки"
    )
    admin_comment = models.TextField(blank=True, verbose_name="Комментарий администратора")
    
    # Временные метки
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name="Дата обработки")
    
    class Meta:
        verbose_name = "Заявка на вывод реферальных"
        verbose_name_plural = "Заявки на вывод реферальных"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Заявка #{self.id} - {self.get_status_display()} - {self.amount} {self.currency}"
    
    def save(self, *args, **kwargs):
        # Обновляем дату обработки при изменении статуса
        if self.pk:
            old_status = ReferralWithdrawalRequest.objects.get(pk=self.pk).status
            if old_status != self.status and self.status in ['completed', 'rejected']:
                self.processed_at = timezone.now()
        super().save(*args, **kwargs)


class ReferralRequestsBoard(ReferralWithdrawalRequest):
    """
    Прокси-модель для отдельной страницы в Django-админке
    (отдельный пункт меню), использует те же данные, что и
    ReferralWithdrawalRequest.
    """
    class Meta:
        proxy = True
        verbose_name = "Обработка реферальных заявок"
        verbose_name_plural = "Обработка реферальных заявок"
