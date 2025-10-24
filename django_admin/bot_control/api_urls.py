from django.urls import path
from . import api_views
from . import test_api

app_name = 'api'

urlpatterns = [
    # Тестовый API
    path('test/', test_api.test_api, name='test_api'),
    
    # API для транзакций
    path('v1/transactions/', api_views.create_transaction, name='create_transaction'),
    path('v1/transactions/<int:transaction_id>/', api_views.get_transaction, name='get_transaction'),
    path('v1/transactions/<int:transaction_id>/update/', api_views.update_transaction, name='update_transaction'),
    
    # Legacy API (для совместимости)
    path('transactions/', api_views.transaction_api, name='transaction_api'),
]
