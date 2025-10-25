"""
Middleware для проверки аутентификации и 2FA
"""

from django.shortcuts import redirect
from django.urls import reverse
from django.contrib.auth import logout
from django.contrib import messages
import pyotp

class AuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Исключения - страницы, которые не требуют аутентификации
        public_paths = [
            '/admin/login/',
            '/admin/logout/',
            '/admin/2fa-setup/',
            '/admin/2fa-verify/',
            '/auth/2fa-verify/',
            '/auth/2fa-setup/',
            '/auth/login/',
            '/auth/logout/',
            '/logout/',
            '/static/',
            '/media/',
        ]
        
        # Проверяем, является ли путь публичным
        is_public = any(request.path.startswith(path) for path in public_paths)
        
        # Если путь публичный, пропускаем проверки
        if is_public:
            response = self.get_response(request)
            return response
        
        # Если пользователь не аутентифицирован, перенаправляем на логин
        if not request.user.is_authenticated:
            return redirect('/auth/login/')
        
        # ВСЕГДА требуем 2FA для всех аутентифицированных пользователей
        # Проверяем, прошел ли пользователь 2FA в этой сессии
        if not request.session.get('2fa_verified', False):
            # Если пользователь уже аутентифицирован, но не прошел 2FA,
            # нужно сохранить его ID в сессии для 2FA процесса
            if not request.session.get('temp_user_id'):
                request.session['temp_user_id'] = request.user.id
            
            # Проверяем, что пользователь не уже на странице 2FA
            if not request.path.startswith('/auth/2fa-verify/'):
                return redirect('/auth/2fa-verify/')
        
        response = self.get_response(request)
        return response
