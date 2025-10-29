from django.urls import path
from . import api_views

app_name = 'api'

urlpatterns = [
    # API для настроек бота
    path('bot-settings/', api_views.api_bot_settings, name='api_bot_settings'),
    
    # API для реквизитов
    path('requisites/list/', api_views.api_requisites_list, name='api_requisites_list'),
    
    # API для рефералов
    path('referral-data/', api_views.api_referral_data, name='api_referral_data'),
    
    # API для истории транзакций
    path('transaction-history/', api_views.api_transaction_history, name='api_transaction_history'),
    
    # API для поиска поступлений
    path('payments/search/', api_views.api_search_payments, name='api_search_payments'),
]