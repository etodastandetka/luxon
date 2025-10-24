from django.contrib import admin
from django.urls import path, include
from bot_control import referral_admin_views

urlpatterns = [
    path('admin/', admin.site.urls),
    # Аутентификация
    path('', include('bot_control.auth_urls')),
    # API для интеграции с сайтом
    path('api/', include('bot_control.api_urls')),
    # ВАЖНО: ставим алиас ДО include('dashboard.urls'), чтобы он не перекрывался.
    # path('api/pending-requests/', api_views.pending_requests, name='pending_requests_root'),
    # path('api/transaction-history/', api_views.transaction_history, name='transaction_history_root'),
    path('', include('dashboard.urls')),
    path('bot/', include('bot_control.urls')),
    # Публичная страница по типу /history (не в админке)
    path('history/', referral_admin_views.referral_history, name='referral_history_root'),
]

