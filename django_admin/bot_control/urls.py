from django.urls import path
from . import views
from . import views_referral
from . import auto_deposit_api, auto_deposit_processor, views_deposits, api_views, withdrawal_views
from .referral_admin_views import referral_history

app_name = 'bot_control'

urlpatterns = [
    # Главные страницы (показываются в меню)
    path('', views_deposits.dashboard, name='dashboard'),
    path('deposits/', views_deposits.deposits_list, name='deposits_list'),
    path('deposits/<int:deposit_id>/', views_deposits.deposit_detail, name='deposit_detail'),
    path('transactions/<int:trans_id>/', views_deposits.transaction_detail, name='transaction_detail'),
    path('user/<int:user_id>/', views_deposits.user_profile, name='user_profile'),
    path('chat/<int:user_id>/', views_deposits.user_chat, name='user_chat'),
    path('withdrawals/', views_deposits.withdrawals_list, name='withdrawals_list'),
    path('unified-api/', views.unified_api, name='unified_api'),
    path('limits/', views.limits_dashboard, name='limits_dashboard'),
    
    # Настройки (в меню оверлей)
    path('settings/', views.bot_settings, name='bot_settings'),
    path('bot-settings/', views.bot_settings_page, name='bot_settings_page'),
    path('broadcast/', views.broadcast_message, name='broadcast_message'),
    path('statistics/', views.statistics, name='statistics'),
    
    # API для автоматического пополнения
    path('api/bank-notification/', auto_deposit_processor.receive_bank_notification, name='receive_bank_notification'),
    path('api/player-balance/<int:user_id>/', auto_deposit_processor.get_player_balance, name='get_player_balance'),
    path('api/check-auto-deposit/<int:user_id>/', auto_deposit_processor.check_auto_deposit_status, name='check_auto_deposit_status'),
    path('api/manual-deposit/', auto_deposit_processor.manual_deposit, name='manual_deposit_api'),
    
    # API для заявок
    path('api/deposit-status/<int:deposit_id>/', views_deposits.api_deposit_status, name='api_deposit_status'),
    path('api/auto-deposit/', views_deposits.auto_deposit_api, name='auto_deposit_api'),
    
    # API для настроек
    path('api/bot-status/', views.api_bot_status, name='api_bot_status'),
    path('api/request-status/<int:request_id>/', views.api_request_status, name='api_request_status'),
    path('api/set-bot-status/', views.api_set_bot_status, name='api_set_bot_status'),
    path('api/restart-bot/', views.api_restart_bot, name='api_restart_bot'),
    path('api/save-bot-settings/', views.api_save_bot_settings, name='api_save_bot_settings'),
    path('api/get-bot-settings/', views.api_get_bot_settings, name='api_get_bot_settings'),
    path('api/save-qr-hash/', views.api_save_qr_hash, name='api_save_qr_hash'),
    path('api/delete-qr-hash/<int:hash_id>/', views.api_delete_qr_hash, name='api_delete_qr_hash'),
    path('api/qr-hashes/', views.api_qr_hashes, name='api_qr_hashes'),
    path('api/qr-hashes/list/', views.api_list_qr_hashes, name='api_list_qr_hashes'),
    path('api/qr-hashes/', views.api_add_qr_hash, name='api_add_qr_hash'),
    path('api/qr-hashes/<int:qr_id>/set-main/', views.api_set_main_qr_hash, name='api_set_main_qr_hash'),
    path('api/qr-hashes/<int:qr_id>/toggle/', views.api_toggle_qr_hash, name='api_toggle_qr_hash'),
    path('api/qr-hashes/<int:qr_id>/delete/', views.api_delete_qr_hash, name='api_delete_qr_hash'),
    path('api/sync-qr-hashes/', views.api_sync_qr_hashes, name='api_sync_qr_hashes'),
    path('api/save-bank-settings/', views.api_save_bank_settings, name='api_save_bank_settings'),
    path('api/banks/<int:bank_id>/delete/', views.api_delete_bank, name='api_delete_bank'),
    path('api/send-broadcast/', views.api_send_broadcast, name='api_send_broadcast'),
    path('api/broadcast-history/', views.api_broadcast_history, name='api_broadcast_history'),
    path('api/statistics/', views.api_statistics, name='api_statistics'),
    path('api/export-statistics/', views.api_export_statistics, name='api_export_statistics'),
    
    # API для букмекеров
    path('api/1xbet-balance/', views.api_1xbet_balance, name='api_1xbet_balance'),
    path('api/1xbet-search-player/', views.api_1xbet_search_player, name='api_1xbet_search_player'),
    path('api/1xbet-deposit/', views.api_1xbet_deposit, name='api_1xbet_deposit'),
    path('api/1win-deposit/', views.api_1win_deposit, name='api_1win_deposit'),
    path('api/1win-withdrawal/', views.api_1win_withdrawal, name='api_1win_withdrawal'),
    path('api/melbet-balance/', views.api_melbet_balance, name='api_melbet_balance'),
    path('api/melbet-search-player/', views.api_melbet_search_player, name='api_melbet_search_player'),
    path('api/melbet-deposit/', views.api_melbet_deposit, name='api_melbet_deposit'),
    path('api/mostbet-balance/', views.api_mostbet_balance, name='api_mostbet_balance'),
    path('api/mostbet-search-player/', views.api_mostbet_search_player, name='api_mostbet_search_player'),
    path('api/mostbet-deposit/', views.api_mostbet_deposit, name='api_mostbet_deposit'),
    path('api/mostbet-withdrawal/', views.api_mostbet_withdrawal, name='api_mostbet_withdrawal'),
    
    # API для интеграции с ботом
    path('api/bot/deposit-request/', api_views.create_deposit_request, name='create_deposit_request'),
    path('api/bot/withdraw-request/', api_views.create_withdraw_request, name='create_withdraw_request'),
    path('api/bot/update-status/', api_views.update_request_status, name='update_request_status'),
    path('api/bot/requests/', api_views.get_requests, name='get_requests'),

    # Chat API (admin <-> user via Telegram relay)
    path('api/chat/history/<int:user_id>/', api_views.chat_history, name='chat_history'),
    path('api/chat/send/', api_views.chat_send_from_admin, name='chat_send_from_admin'),
    path('api/chat/send-media/', api_views.chat_send_media_from_admin, name='chat_send_media_from_admin'),
    path('api/chat/ingest/', api_views.chat_ingest_from_bot, name='chat_ingest_from_bot'),
    path('api/chat/typing/', api_views.chat_typing_from_admin, name='chat_typing_from_admin'),

    # Referral withdrawal API
    path('api/referral/withdraw/create/', api_views.create_referral_withdraw_request, name='referral_withdraw_create'),
    path('api/referral/withdraw/list/', api_views.list_referral_withdraw_requests, name='referral_withdraw_list'),
    path('api/referral/withdraw/<int:req_id>/approve/', api_views.approve_referral_withdraw_request, name='referral_withdraw_approve'),
    path('api/referral/withdraw/<int:req_id>/reject/', api_views.reject_referral_withdraw_request, name='referral_withdraw_reject'),

    # Referral public JSON APIs (for separate site)
    path('api/referral/stats/', api_views.referral_stats, name='referral_stats'),
    path('api/referral/leaderboard/', api_views.referral_leaderboard, name='referral_leaderboard'),
    
    # Public referral dashboard (NOT admin)
    path('referral/', views_referral.referral_dashboard, name='referral_dashboard'),
    # Custom admin-like history page for referral payouts (public route but for admins)
    path('referral/history/', referral_history, name='referral_history'),
    
    # Withdrawal API endpoints
    path('api/withdrawal-requests/<int:request_id>/', withdrawal_views.withdrawal_request_detail, name='withdrawal_request_detail'),
    path('api/withdrawal-requests/<int:request_id>/approve/', withdrawal_views.approve_withdrawal, name='approve_withdrawal'),
    path('api/withdrawal-requests/<int:request_id>/reject/', withdrawal_views.reject_withdrawal, name='reject_withdrawal'),
    path('api/withdrawal-stats/', withdrawal_views.withdrawal_stats, name='withdrawal_stats'),
]


