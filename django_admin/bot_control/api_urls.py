from django.urls import path
from . import api_views

app_name = 'api'

urlpatterns = [
    # API для транзакций
    path('v1/transactions/', api_views.create_transaction, name='create_transaction'),
    path('v1/transactions/<int:transaction_id>/', api_views.get_transaction, name='get_transaction'),
    path('v1/transactions/<int:transaction_id>/update/', api_views.update_transaction, name='update_transaction'),
    
    # Legacy API (для совместимости)
    path('transactions/', api_views.transaction_api, name='transaction_api'),
    
    # API для настроек бота
    path('bot-settings/', api_views.api_bot_settings, name='api_bot_settings'),
]
