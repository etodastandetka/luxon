from django.urls import path
from . import views
from bot_control.views_deposits import deposits_list, deposit_detail, withdrawals_list
from bot_control import views as bot_views
from bot_control import api_views

app_name = 'dashboard'

urlpatterns = [
    # Главная страница - редирект на логин или дашборд
    path('', views.home_redirect, name='home'),
    # Главная теперь — общий дашборд, который показывает и депозиты, и выводы
    path('dashboard/', views.dashboard, name='dashboard'),
    path('request/<int:req_id>/', views.request_detail, name='request_detail'),
    # Детали транзакции (совместимость со старыми ссылками из истории)
    path('transactions/<int:req_id>/', views.request_detail, name='transaction_detail'),
    path('api/update-amount/', views.api_update_amount, name='api_update_amount'),
    path('deposits/', deposits_list, name='deposits_list'),
    path('deposits/<int:deposit_id>/', deposit_detail, name='deposit_detail'),
    path('history/', views.history, name='history'),
    path('wallet/', views.wallet, name='wallet'),
    path('menu/', views.menu, name='menu'),
    path('database/', views.database, name='database'),
    path('about/', views.about, name='about'),
    path('withdrawals/', withdrawals_list, name='withdrawals_list'),
    path('users/', views.users, name='users'),
    path('referrals/', views.referrals, name='referrals'),
    path('logs/', views.logs, name='logs'),
    path('api/stats/', views.api_stats, name='api_stats'),
    path('api/transactions/', views.api_transactions, name='api_transactions'),
    path('api/pending-requests/', views.api_pending_requests, name='api_pending_requests'),
    path('api/handle-request/', views.api_handle_request, name='api_handle_request'),
    path('api/transaction-history/', api_views.api_transaction_history, name='api_transaction_history'),
    path('api/referral-data/', views.api_referral_data, name='api_referral_data'),
    # Requisites API
    path('api/requisites/', views.api_requisites, name='api_requisites'),
    path('api/requisites/list/', views.api_requisites_list, name='api_requisites_list'),
    path('api/requisites/<int:rid>/set-active/', views.api_requisites_set_active, name='api_requisites_set_active'),
    path('api/requisites/<int:rid>/delete/', views.api_requisites_delete, name='api_requisites_delete'),
    
    # API для настроек
    path('api/save-qr-hash/', bot_views.api_save_qr_hash, name='api_save_qr_hash'),
    path('api/delete-qr-hash/<int:hash_id>/', bot_views.api_delete_qr_hash, name='api_delete_qr_hash'),
    path('api/qr-hashes/', bot_views.api_qr_hashes, name='api_qr_hashes'),
    path('api/save-bank-settings/', bot_views.api_save_bank_settings, name='api_save_bank_settings'),
    path('api/send-broadcast/', bot_views.api_send_broadcast, name='api_send_broadcast'),
    path('api/broadcast-history/', bot_views.api_broadcast_history, name='api_broadcast_history'),
    path('api/statistics/', bot_views.api_statistics, name='api_statistics'),
    path('api/export-statistics/', bot_views.api_export_statistics, name='api_export_statistics'),
    # API кошельков банков (MBank/Optima/Bakai)
    path('api/bank-wallets/', bot_views.api_bank_wallets, name='api_bank_wallets'),
    path('api/bank-wallets/create/', bot_views.api_bank_wallets_create, name='api_bank_wallets_create'),
    path('api/bank-wallets/<int:wid>/toggle/', bot_views.api_bank_wallets_toggle, name='api_bank_wallets_toggle'),
    path('api/bank-wallets/<int:wid>/set-main/', bot_views.api_bank_wallets_set_main, name='api_bank_wallets_set_main'),
    path('api/bank-wallets/<int:wid>/delete/', bot_views.api_bank_wallets_delete, name='api_bank_wallets_delete'),
    # Алиасы для совместимости со старыми путями фронта (кэш): dashboard/api/...
    path('dashboard/api/bank-wallets/', bot_views.api_bank_wallets),
    path('dashboard/api/bank-wallets/create/', bot_views.api_bank_wallets_create),
    path('dashboard/api/bank-wallets/<int:wid>/toggle/', bot_views.api_bank_wallets_toggle),
    path('dashboard/api/bank-wallets/<int:wid>/set-main/', bot_views.api_bank_wallets_set_main),
    path('dashboard/api/bank-wallets/<int:wid>/delete/', bot_views.api_bank_wallets_delete),
    
    # API для букмекеров
    path('api/1xbet-balance/', bot_views.api_1xbet_balance, name='api_1xbet_balance'),
    path('api/1xbet-search-player/', bot_views.api_1xbet_search_player, name='api_1xbet_search_player'),
    path('api/1xbet-deposit/', bot_views.api_1xbet_deposit, name='api_1xbet_deposit'),
    path('api/1win-deposit/', bot_views.api_1win_deposit, name='api_1win_deposit'),
    path('api/1win-withdrawal/', bot_views.api_1win_withdrawal, name='api_1win_withdrawal'),
    path('api/melbet-balance/', bot_views.api_melbet_balance, name='api_melbet_balance'),
    path('api/melbet-search-player/', bot_views.api_melbet_search_player, name='api_melbet_search_player'),
    path('api/melbet-deposit/', bot_views.api_melbet_deposit, name='api_melbet_deposit'),
    path('api/mostbet-balance/', bot_views.api_mostbet_balance, name='api_mostbet_balance'),
    path('api/mostbet-search-player/', bot_views.api_mostbet_search_player, name='api_mostbet_search_player'),
    path('api/mostbet-deposit/', bot_views.api_mostbet_deposit, name='api_mostbet_deposit'),
    path('api/mostbet-withdrawal/', bot_views.api_mostbet_withdrawal, name='api_mostbet_withdrawal'),
]