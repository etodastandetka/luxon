

from django.contrib import admin
from django.http import HttpResponseRedirect
from django.contrib import messages
from django.urls import path, reverse
from django.utils.html import format_html
from .models import (
    BotSettings, BroadcastMessage, BankSettings, QRHash, 
    BotDepositRequest, BotWithdrawRequest, BotConfiguration
)
from .referral_models import ReferralWithdrawalRequest, ReferralRequestsBoard
import logging
from django.utils import timezone
from django.conf import settings
import requests
from .bot_models import BotUser, BotTransaction, BotDepositRequestRaw, BotWithdrawRequestRaw

@admin.register(BotSettings)
class BotSettingsAdmin(admin.ModelAdmin):
    list_display = ['is_active', 'updated_at']
    list_filter = ['is_active']
    search_fields = ['maintenance_message']

@admin.register(BroadcastMessage)
class BroadcastMessageAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_sent', 'created_at']
    list_filter = ['is_sent', 'created_at']
    search_fields = ['title', 'message']
    readonly_fields = ['sent_at', 'created_at']

@admin.register(BankSettings)
class BankSettingsAdmin(admin.ModelAdmin):
    list_display = ['bank_name', 'bank_code', 'is_enabled_deposit', 'is_enabled_withdraw', 'updated_at']
    list_filter = ['is_enabled_deposit', 'is_enabled_withdraw', 'bank_code']
    search_fields = ['bank_name', 'bank_code']
    list_editable = ['is_enabled_deposit', 'is_enabled_withdraw']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('bank_code', 'bank_name', 'icon')
        }),
        ('Настройки', {
            'fields': ('is_enabled_deposit', 'is_enabled_withdraw', 'url_template')
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(QRHash)
class QRHashAdmin(admin.ModelAdmin):
    list_display = ['account_name', 'hash_preview', 'is_main', 'is_active', 'gmail_email', 'created_at']
    list_filter = ['is_main', 'is_active', 'created_at']
    search_fields = ['account_name', 'gmail_email', 'hash_value']
    list_editable = ['is_main', 'is_active']
    readonly_fields = ['created_at', 'updated_at', 'hash_preview']
    actions = ['make_main', 'activate_all', 'deactivate_all']
    
    fieldsets = (
        ('Информация об аккаунте', {
            'fields': ('account_name', 'hash_value', 'hash_preview', 'is_main', 'is_active'),
            'description': 'Основная информация об аккаунте Демирбанка'
        }),
        ('Настройки Email', {
            'fields': ('gmail_email', 'gmail_password'),
            'description': 'Настройки для мониторинга уведомлений от info@demirbank.kg'
        }),
        ('Паттерны парсинга', {
            'fields': ('amount_pattern', 'date_pattern'),
            'description': 'Регулярные выражения для извлечения данных из уведомлений'
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def hash_preview(self, obj):
        """Показывает превью хеша"""
        if obj.hash_value:
            return f"{obj.hash_value[:30]}...{obj.hash_value[-10:]}"
        return "Нет хеша"
    hash_preview.short_description = "Превью хеша"
    
    def make_main(self, request, queryset):
        """Делает выбранный хеш основным"""
        if queryset.count() > 1:
            self.message_user(request, "❌ Выберите только один хеш для установки как основной", level='ERROR')
            return
        
        # Убираем флаг основного с всех хешей
        QRHash.objects.filter(is_main=True).update(is_main=False)
        
        # Устанавливаем выбранный как основной
        queryset.update(is_main=True, is_active=True)
        
        self.message_user(request, f"✅ Хеш '{queryset.first().account_name}' установлен как основной")
    make_main.short_description = "Сделать основным"
    
    def activate_all(self, request, queryset):
        """Активирует все выбранные хеши"""
        count = queryset.update(is_active=True)
        self.message_user(request, f"✅ Активировано {count} хешей")
    activate_all.short_description = "Активировать выбранные"
    
    def deactivate_all(self, request, queryset):
        """Деактивирует все выбранные хеши"""
        count = queryset.update(is_active=False)
    deactivate_all.short_description = "Деактивировать выбранные"
    
    def get_queryset(self, request):
        return super().get_queryset(request).order_by('-is_main', '-created_at')


@admin.register(BotDepositRequest)
class BotDepositRequestAdmin(admin.ModelAdmin):
    list_display = ['user_id', 'username', 'bookmaker', 'account_id', 'amount', 'bank', 'status', 'created_at']
    list_filter = ['status', 'bookmaker', 'bank', 'created_at']
    search_fields = ['user_id', 'username', 'account_id', 'first_name', 'last_name']
    readonly_fields = ['created_at', 'updated_at', 'processed_at']
    actions = ['mark_completed', 'mark_rejected', 'mark_processing']
    
    fieldsets = (
        ('Информация о пользователе', {
            'fields': ('user_id', 'username', 'first_name', 'last_name')
        }),
        ('Детали заявки', {
            'fields': ('bookmaker', 'account_id', 'amount', 'bank', 'receipt_photo')
        }),
        ('Статус', {
            'fields': ('status', 'processed_at')
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def mark_completed(self, request, queryset):
        from django.utils import timezone
        count = queryset.update(status='completed', processed_at=timezone.now())
        self.message_user(request, f"✅ {count} заявок отмечено как завершенные")
    mark_completed.short_description = "Отметить как завершенные"
    
    def mark_rejected(self, request, queryset):
        from django.utils import timezone
        count = queryset.update(status='rejected', processed_at=timezone.now())
        self.message_user(request, f"❌ {count} заявок отмечено как отклоненные")
    mark_rejected.short_description = "Отметить как отклоненные"
    
    fieldsets = (
        ('Информация о пользователе', {
            'fields': ('user_id', 'username', 'first_name', 'last_name')
        }),
        ('Детали заявки', {
            'fields': ('bookmaker', 'account_id', 'amount', 'bank', 'withdrawal_code', 'qr_photo')
        }),
        ('Статус', {
            'fields': ('status', 'processed_at')
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def mark_completed(self, request, queryset):
        from django.utils import timezone
        count = queryset.update(status='completed', processed_at=timezone.now())
        self.message_user(request, f"✅ {count} заявок отмечено как завершенные")
    mark_completed.short_description = "Отметить как завершенные"
    
    def mark_rejected(self, request, queryset):
        from django.utils import timezone
        count = queryset.update(status='rejected', processed_at=timezone.now())
        self.message_user(request, f"❌ {count} заявок отмечено как отклоненные")
    mark_rejected.short_description = "Отметить как отклоненные"
    
    def mark_processing(self, request, queryset):
        count = queryset.update(status='processing')
        self.message_user(request, f"⏳ {count} заявок отмечено как обрабатываемые")
    mark_processing.short_description = "Отметить как обрабатываемые"



@admin.register(ReferralWithdrawalRequest)
class ReferralWithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_id', 'username', 'bookmaker', 'bookmaker_account_id', 'amount',
        'status', 'created_at', 'processed_at', 'confirm_button'
    ]
    list_filter = ['status', 'bookmaker', 'payment_method', 'created_at']
    search_fields = ['user_id', 'username', 'first_name', 'last_name', 'bookmaker_account_id']
    readonly_fields = ['created_at', 'updated_at', 'processed_at']
    actions = ['approve_selected', 'reject_selected', 'mark_processing']

    fieldsets = (
        ('Пользователь', {
            'fields': ('user_id', 'username', 'first_name', 'last_name', 'phone_number')
        }),
        ('Вывод', {
            'fields': ('amount', 'currency', 'bookmaker', 'bookmaker_account_id', 'payment_method', 'wallet_details')
        }),
        ('Статус', {
            'fields': ('status', 'admin_comment', 'processed_at')
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def _fake_bookmaker_api(self, obj) -> bool:
        """Call a fake bookmaker API endpoint. Returns True on success."""
        url = getattr(settings, 'FAKE_BOOKMAKER_API_URL', 'https://httpbin.org/status/200')
        payload = {
            'bookmaker': obj.bookmaker,
            'account_id': obj.bookmaker_account_id,
            'amount': float(obj.amount),
            'currency': obj.currency,
            'user_id': obj.user_id,
        }
        try:
            resp = requests.post(url, json=payload, timeout=8)
            if 200 <= resp.status_code < 300:
                return True
            logging.error("Fake bookmaker API error: %s %s", resp.status_code, resp.text)
            return False
        except Exception as e:
            logging.exception("Fake bookmaker API exception: %s", e)
            return False

    def approve_selected(self, request, queryset):
        ok, fail = 0, 0
        for obj in queryset:
            try:
                if obj.status in ('completed', 'rejected'):
                    continue
                # mark processing first
                obj.status = 'processing'
                obj.save()
                if self._fake_bookmaker_api(obj):
                    obj.status = 'completed'
                    obj.processed_at = timezone.now()
                    obj.save()
                    ok += 1
                else:
                    fail += 1
            except Exception as e:
                logging.exception("Approve failed for id=%s: %s", obj.id, e)
                fail += 1
        if ok:
            self.message_user(request, f"✅ Успешно подтверждено: {ok}")
        if fail:
            self.message_user(request, f"❌ С ошибкой: {fail}", level=messages.ERROR)
    approve_selected.short_description = "✅ Подтвердить выбранные"

    def reject_selected(self, request, queryset):
        count = queryset.exclude(status='completed').update(status='rejected', processed_at=timezone.now())
        self.message_user(request, f"❌ Отклонено: {count}")
    reject_selected.short_description = "❌ Отклонить выбранные"

    def mark_processing(self, request, queryset):
        count = queryset.exclude(status__in=['completed', 'rejected']).update(status='processing')
        self.message_user(request, f"⏳ В обработке: {count}")
    mark_processing.short_description = "⏳ Отметить как обрабатываемые"

    # --- Custom per-row confirm button and view ---
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('<int:object_id>/confirm/', self.admin_site.admin_view(self.confirm_view), name='bot_control_referralwithdrawalrequest_confirm'),
        ]
        return custom_urls + urls

    def confirm_button(self, obj):
        if obj.status in ('completed', 'rejected'):
            return '—'
        url = reverse('admin:bot_control_referralwithdrawalrequest_confirm', args=[obj.pk])
        return format_html('<a class="button" href="{}" title="Подтвердить">✅</a>', url)
    confirm_button.short_description = "Подтвердить"

    def confirm_view(self, request, object_id, *args, **kwargs):
        try:
            obj = ReferralWithdrawalRequest.objects.get(pk=object_id)
        except ReferralWithdrawalRequest.DoesNotExist:
            self.message_user(request, "Заявка не найдена", level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:bot_control_referralwithdrawalrequest_changelist'))

        try:
            if obj.status in ('completed', 'rejected'):
                self.message_user(request, "Заявка уже обработана", level=messages.WARNING)
            else:
                obj.status = 'processing'
                obj.save()
                if self._fake_bookmaker_api(obj):
                    obj.status = 'completed'
                    obj.processed_at = timezone.now()
                    obj.save()
                    self.message_user(request, "✅ Заявка подтверждена")
                else:
                    self.message_user(request, "❌ Ошибка подтверждения через API", level=messages.ERROR)
        except Exception as e:
            logging.exception("Single approve failed for id=%s: %s", object_id, e)
            self.message_user(request, "❌ Внутренняя ошибка при подтверждении", level=messages.ERROR)

        # Redirect back to the changelist
        return HttpResponseRedirect(reverse('admin:bot_control_referralwithdrawalrequest_changelist'))

