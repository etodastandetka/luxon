#!/usr/bin/env python3
"""
Модели для чтения данных из базы данных бота
"""
from django.db import models
from django.db import connection

class BotDepositRequestRaw(models.Model):
    """Модель для чтения заявок на пополнение из базы бота"""
    
    class Meta:
        managed = False  # Django не будет управлять этой таблицей
        db_table = 'deposit_requests'
        verbose_name = 'Заявка на пополнение (из бота)'
        verbose_name_plural = 'Заявки на пополнение (из бота)'
    
    id = models.AutoField(primary_key=True)
    user_id = models.BigIntegerField(verbose_name='ID пользователя')
    username = models.CharField(max_length=255, blank=True, verbose_name='Username')
    first_name = models.CharField(max_length=255, blank=True, verbose_name='Имя')
    bookmaker = models.CharField(max_length=50, verbose_name='Букмекер')
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Сумма')
    account_id = models.CharField(max_length=255, verbose_name='ID счета')
    photo_file_id = models.CharField(max_length=255, blank=True, verbose_name='Фото чека')
    status = models.CharField(max_length=50, default='pending', verbose_name='Статус')
    created_at = models.DateTimeField(verbose_name='Дата создания')
    
    def __str__(self):
        return f"Заявка #{self.id} - {self.username} - {self.amount} {self.bookmaker}"

class BotWithdrawRequestRaw(models.Model):
    """Модель для чтения заявок на вывод из базы бота"""
    
    class Meta:
        managed = False  # Django не будет управлять этой таблицей
        db_table = 'withdrawals'
        verbose_name = 'Заявка на вывод (из бота)'
        verbose_name_plural = 'Заявки на вывод (из бота)'
    
    id = models.AutoField(primary_key=True)
    user_id = models.BigIntegerField(verbose_name='ID пользователя')
    bookmaker = models.CharField(max_length=50, verbose_name='Букмекер')
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Сумма')
    status = models.CharField(max_length=50, default='pending', verbose_name='Статус')
    created_at = models.DateTimeField(verbose_name='Дата создания')
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата обработки')
    
    def __str__(self):
        return f"Вывод #{self.id} - {self.user_id} - {self.amount} {self.bookmaker}"

# BotUser и BotTransaction теперь в models.py для PostgreSQL
# Эти модели удалены, чтобы избежать конфликта

class BotKVSetting(models.Model):
    """Прямая модель для таблицы bot_settings (ключ-значение) в БД бота"""
    class Meta:
        managed = False
        db_table = 'bot_settings'
        verbose_name = 'Настройка бота (KV)'
        verbose_name_plural = 'Настройки бота (KV)'

    key = models.CharField(primary_key=True, max_length=100, verbose_name='Ключ')
    value = models.TextField(blank=True, verbose_name='Значение')
    created_at = models.DateTimeField(null=True, blank=True, verbose_name='Создано')
    updated_at = models.DateTimeField(null=True, blank=True, verbose_name='Обновлено')

    def __str__(self):
        return f"{self.key}"
