from django.contrib import admin
from bot_control.models import BotSettings, BroadcastMessage

@admin.register(BotSettings)
class BotSettingsAdmin(admin.ModelAdmin):
    list_display = ['is_active', 'created_at', 'updated_at']
    list_editable = ['is_active']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Основные настройки', {
            'fields': ('is_active', 'maintenance_message')
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(BroadcastMessage)
class BroadcastMessageAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_sent', 'created_at', 'sent_at']
    list_filter = ['is_sent', 'created_at']
    search_fields = ['title', 'message']
    readonly_fields = ['is_sent', 'sent_at', 'created_at']
    
    fieldsets = (
        ('Сообщение', {
            'fields': ('title', 'message')
        }),
        ('Статус', {
            'fields': ('is_sent', 'sent_at'),
            'classes': ('collapse',)
        }),
        ('Временные метки', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


