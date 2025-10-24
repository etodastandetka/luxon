"""
Унифицированные URL patterns для API
"""
from django.urls import path
from . import unified_api

# app_name убран, так как используется namespace в основном urls.py

urlpatterns = [
    # Основные API endpoints
    path('requests/<int:request_id>/status/', unified_api.update_request_status, name='update_status'),
    path('requests/<int:request_id>/', unified_api.get_request_detail, name='request_detail'),
    path('requests/', unified_api.unified_requests_api, name='requests'),
    path('statistics/', unified_api.get_statistics, name='statistics'),
]
