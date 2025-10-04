from django.contrib import admin
from django.urls import path, include
from bot_control import referral_admin_views, api_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('dashboard.urls')),
    path('bot/', include('bot_control.urls')),
    # Публичная страница по типу /history (не в админке)
    path('history/', referral_admin_views.referral_history, name='referral_history_root'),
    # Alias for frontend expecting /api/pending-requests/
    path('api/pending-requests/', api_views.pending_requests, name='pending_requests_root'),
]

