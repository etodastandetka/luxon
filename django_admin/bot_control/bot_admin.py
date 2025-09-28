#!/usr/bin/env python3
"""
Админка для моделей бота
"""
from django.contrib import admin
from django.contrib import messages
from django.utils import timezone
from .bot_models import BotDepositRequestRaw, BotWithdrawRequestRaw, BotUser, BotTransaction, BotKVSetting
from .models import BotConfiguration

@admin.register(BotDepositRequestRaw)
class BotDepositRequestRawAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_id', 'username', 'first_name', 'bookmaker', 'amount', 'status', 'created_at']
    list_filter = ['bookmaker', 'status', 'created_at']
    search_fields = ['user_id', 'username', 'first_name', 'account_id']
    readonly_fields = ['id', 'user_id', 'username', 'first_name', 'bookmaker', 'amount', 'account_id', 'photo_file_id', 'status', 'created_at']
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        return False  # Запрещаем добавление через админку
    
    def has_change_permission(self, request, obj=None):
        return False  # Запрещаем изменение через админку
    
    def has_delete_permission(self, request, obj=None):
        return False  # Запрещаем удаление через админку

@admin.register(BotWithdrawRequestRaw)
class BotWithdrawRequestRawAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_id', 'bookmaker', 'amount', 'status', 'created_at', 'processed_at']
    list_filter = ['bookmaker', 'status', 'created_at']
    search_fields = ['user_id', 'bookmaker']
    readonly_fields = ['id', 'user_id', 'bookmaker', 'amount', 'status', 'created_at', 'processed_at']
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False

# Админка для конфигураций бота
@admin.register(BotConfiguration)
class BotConfigurationAdmin(admin.ModelAdmin):
    list_display = ['key', 'value_preview', 'description', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['key', 'description', 'value']
    readonly_fields = ['created_at', 'updated_at']

    def value_preview(self, obj):
        val = obj.value or ''
        return f"{val[:50]}..." if len(val) > 50 else val
    value_preview.short_description = "Значение"

# KV настройки бота прямо из таблицы bot_settings
@admin.register(BotKVSetting)
class BotKVSettingAdmin(admin.ModelAdmin):
    list_display = ['key', 'value_short', 'created_at', 'updated_at']
    search_fields = ['key', 'value']
    list_filter = ['created_at', 'updated_at']

    def value_short(self, obj):
        val = obj.value or ''
        return f"{val[:50]}..." if len(val) > 50 else val
    value_short.short_description = 'Значение'


@admin.register(BotUser)
class BotUserAdmin(admin.ModelAdmin):
    list_display = ['user_id', 'username', 'first_name', 'last_name', 'language', 'created_at']
    list_filter = ['language', 'created_at']
    search_fields = ['user_id', 'username', 'first_name', 'last_name']
    readonly_fields = ['user_id', 'username', 'first_name', 'last_name', 'language', 'created_at']
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(BotTransaction)
class BotTransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_id', 'bookmaker', 'trans_type', 'amount', 'status', 'created_at']
    list_filter = ['bookmaker', 'trans_type', 'status', 'created_at']
    search_fields = ['user_id', 'bookmaker']
    readonly_fields = ['id', 'user_id', 'bookmaker', 'trans_type', 'amount', 'status', 'photo_file_id', 'created_at']
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False
