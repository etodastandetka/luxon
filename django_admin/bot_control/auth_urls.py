"""
URL конфигурация для аутентификации
"""

from django.urls import path
from . import auth_views

urlpatterns = [
    path('login/', auth_views.login_view, name='login'),
    path('admin/login/', auth_views.login_view, name='admin_login'),
    path('logout/', auth_views.logout_view, name='logout'),
    path('admin/logout/', auth_views.logout_view, name='admin_logout'),
    path('2fa-verify/', auth_views.verify_2fa, name='2fa_verify'),
    path('admin/2fa-verify/', auth_views.verify_2fa, name='admin_2fa_verify'),
    path('2fa-setup/', auth_views.setup_2fa, name='2fa_setup'),
    path('admin/2fa-setup/', auth_views.setup_2fa, name='admin_2fa_setup'),
    path('profile/', auth_views.profile_view, name='profile'),
]
