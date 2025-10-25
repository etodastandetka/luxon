from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.custom_login, name='custom_login'),
    path('logout/', views.custom_logout, name='custom_logout'),
    path('2fa-verify/', views.verify_2fa, name='verify_2fa'),
    path('setup-2fa/', views.setup_2fa, name='setup_2fa'),
    path('api/verify-2fa/', views.api_verify_2fa, name='api_verify_2fa'),
    # CSRF тестирование
    path('csrf-test/', views.csrf_test, name='csrf_test'),
    path('csrf-test-api/', views.csrf_api_test, name='csrf_api_test'),
]
