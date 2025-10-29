from django.urls import path, include
from . import views
from . import views_deposits
from . import autodeposit_views_simple as autodeposit_views
from . import referral_views_simple as referral_views
from . import api_views_webapp
from . import api_views
from . import cashdesk_views
from . import mostbet_views
from . import onewin_views

app_name = 'bot_control'

urlpatterns = [
    # Главные страницы
    path('', views_deposits.dashboard, name='dashboard'),
    path('menu/', views_deposits.menu, name='menu'),
    path('deposits/', views_deposits.deposits_list, name='deposits_list'),
    path('withdrawals/', views_deposits.withdrawals_list, name='withdrawals_list'),
    path('limits/', views.limits_dashboard, name='limits_dashboard'),
    path('wallets/', views.wallets_management, name='wallets_management'),
    
    # Управление ботом
    path('bot-management/', views.bot_management, name='bot_management'),
    path('bot-management-v2/', views.bot_management_v2, name='bot_management_v2'),
    path('bot-management-fixed/', views.bot_management_fixed, name='bot_management_fixed'),
    
    # Детали транзакций и заявок
    path('transactions/<int:trans_id>/', views_deposits.transaction_detail, name='transaction_detail'),
    path('request/<int:req_id>/', views_deposits.request_detail, name='request_detail'),
    
    # Профиль и чат пользователя
    path('user/<int:user_id>/profile/', views_deposits.user_profile, name='user_profile'),
    path('user/<int:user_id>/chat/', views_deposits.user_chat, name='user_chat'),
    
    # API для чата
    path('user/<int:user_id>/chat/history/', views_deposits.chat_history, name='chat_history'),
    path('chat/send/', views_deposits.chat_send_from_admin, name='chat_send_from_admin'),
    path('chat/send-media/', views_deposits.chat_send_media_from_admin, name='chat_send_media_from_admin'),
    path('chat/typing/', views_deposits.chat_typing_from_admin, name='chat_typing_from_admin'),
    path('api/save-chat-message/', views_deposits.save_chat_message, name='save_chat_message'),
    
    # Новые страницы
    path('referral/', referral_views.referral_management, name='referral_management'),
    path('autodeposit/', autodeposit_views.autodeposit_settings, name='autodeposit_settings'),
    path('statistics/', views.statistics, name='statistics'),
    path('broadcast/', views.broadcast_message, name='broadcast_message'),
    
    # API для интеграции с мини-приложением
    path('api_sync_webapp/', api_views_webapp.api_sync_webapp, name='api_sync_webapp'),
    path('api_notify_payment_success/', api_views_webapp.api_notify_payment_success, name='api_notify_payment_success'),
    
    # API для рассылки
    path('api/send-broadcast/', views.api_send_broadcast, name='api_send_broadcast'),
    path('api/broadcast-history/', views.api_broadcast_history, name='api_broadcast_history'),
    
    
    # API для настроек
    path('api/bank-settings/', views.api_get_bank_settings, name='api_get_bank_settings'),
    path('api/bank-settings/save/', views.api_save_bank_settings, name='api_save_bank_settings'),
    path('api/deposit-settings/', views.api_get_deposit_settings, name='api_get_deposit_settings'),
    path('api/deposit-settings/save/', views.api_save_deposit_settings, name='api_save_deposit_settings'),
    path('api/withdrawal-settings/', views.api_get_withdrawal_settings, name='api_get_withdrawal_settings'),
    path('api/withdrawal-settings/save/', views.api_save_withdrawal_settings, name='api_save_withdrawal_settings'),
    path('api/bot-control/', views.api_get_bot_control, name='api_get_bot_control'),
    path('api/bot-control/save/', views.api_save_bot_control, name='api_save_bot_control'),
    path('api/channel-settings/', views.api_get_channel_settings, name='api_get_channel_settings'),
    path('api/channel-settings/save/', views.api_save_channel_settings, name='api_save_channel_settings'),
    
    # API для клиентского сайта
    path('api/payment-settings/', views.api_get_payment_settings, name='api_get_payment_settings'),
    
    # API для статуса бота
    path('api/bot-status/', views.api_bot_status, name='api_bot_status'),
    path('api/set-bot-status/', views.api_set_bot_status, name='api_set_bot_status'),
    path('api/restart-bot/', views.api_restart_bot, name='api_restart_bot'),
    
    # API для настроек бота (для Next.js)
    path('api/get-bot-settings/', views.api_get_bot_settings, name='api_get_bot_settings'),
    path('api/save-bot-settings/', views.api_save_bot_settings, name='api_save_bot_settings'),
    
    # API для статистики
    path('api/statistics/', views.api_statistics, name='api_statistics'),
    path('api/export-statistics/', views.api_export_statistics, name='api_export_statistics'),
    
    # API для мини-приложения
    path('api/payment/', api_views.payment_api, name='payment_api'),
    path('api/generate-qr/', api_views.generate_qr_api, name='generate_qr_api'),
    path('api/sync-bot/', api_views.sync_bot_api, name='sync_bot_api'),
    
    # Унифицированные API endpoints
    path('api/', include('bot_control.unified_urls')),
    
    # Cashdesk API для Melbet и 1xbet
    path('api/cashdesk/<str:casino>/balance/', cashdesk_views.api_cashdesk_balance, name='api_cashdesk_balance'),
    path('api/cashdesk/<str:casino>/search-player/', cashdesk_views.api_cashdesk_search_player, name='api_cashdesk_search_player'),
    path('api/cashdesk/<str:casino>/deposit/', cashdesk_views.api_cashdesk_deposit, name='api_cashdesk_deposit'),
    path('api/cashdesk/<str:casino>/payout/', cashdesk_views.api_cashdesk_payout, name='api_cashdesk_payout'),
    
    # Mostbet Cash API
    path('api/mostbet/balance/', mostbet_views.api_mostbet_balance, name='api_mostbet_balance'),
    path('api/mostbet/deposit/', mostbet_views.api_mostbet_deposit, name='api_mostbet_deposit'),
    path('api/mostbet/cashout/list/', mostbet_views.api_mostbet_cashout_list, name='api_mostbet_cashout_list'),
    path('api/mostbet/cashout/confirm/', mostbet_views.api_mostbet_confirm_cashout, name='api_mostbet_confirm_cashout'),
    path('api/mostbet/transactions/', mostbet_views.api_mostbet_transactions, name='api_mostbet_transactions'),
    
    # 1WIN API
    path('api/onewin/deposit/', onewin_views.api_onewin_deposit, name='api_onewin_deposit'),
    path('api/onewin/withdrawal/', onewin_views.api_onewin_withdrawal, name='api_onewin_withdrawal'),
]