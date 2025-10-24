"""
Views для аутентификации с 2FA
"""

from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
import pyotp
import qrcode
from io import BytesIO
import base64

def login_view(request):
    """Страница входа"""
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            if user.is_active:
                # Проверяем, включен ли 2FA
                if hasattr(user, 'profile') and user.profile.is_2fa_enabled:
                    # Сохраняем пользователя в сессии для 2FA
                    request.session['temp_user_id'] = user.id
                    # НЕ меняем время жизни сессии - оставляем 30 дней
                    return redirect('/2fa-verify/')
                else:
                    # Обычный вход без 2FA
                    login(request, user)
                    request.session['2fa_verified'] = True
                    return redirect('/admin/')
            else:
                messages.error(request, 'Аккаунт неактивен')
        else:
            messages.error(request, 'Неверный логин или пароль')
    
    return render(request, 'auth/login.html')

def verify_2fa(request):
    """Страница проверки 2FA"""
    if request.method == 'POST':
        token = request.POST.get('token')
        user_id = request.session.get('temp_user_id')
        
        if user_id:
            from django.contrib.auth.models import User
            try:
                user = User.objects.get(id=user_id)
                
                if hasattr(user, 'profile') and user.profile.verify_totp(token):
                    # 2FA успешно пройден
                    login(request, user)
                    request.session['2fa_verified'] = True
                    request.session['temp_user_id'] = None  # Не удаляем, а обнуляем
                    return redirect('/')
                else:
                    messages.error(request, 'Неверный код аутентификатора')
            except User.DoesNotExist:
                messages.error(request, 'Пользователь не найден, войдите заново')
                return redirect('/admin/login/')
        else:
            messages.error(request, 'Сессия истекла, войдите заново')
            return redirect('/admin/login/')
    
    # Проверяем, есть ли temp_user_id в сессии
    if not request.session.get('temp_user_id'):
        messages.error(request, 'Сессия истекла, войдите заново')
        return redirect('/admin/login/')
    
    return render(request, 'auth/2fa_verify.html')

def setup_2fa(request):
    """Настройка 2FA"""
    if not request.user.is_authenticated:
        return redirect('/admin/login/')
    
    if request.method == 'POST':
        token = request.POST.get('token')
        
        if hasattr(request.user, 'profile'):
            if request.user.profile.verify_totp(token):
                request.user.profile.is_2fa_enabled = True
                request.user.profile.save()
                messages.success(request, '2FA успешно включен!')
                return redirect('/admin/')
            else:
                messages.error(request, 'Неверный код аутентификатора')
    
    # Генерируем QR код если его еще нет
    if not hasattr(request.user, 'profile') or not request.user.profile.secret_key:
        from bot_control.models import UserProfile
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        if created or not profile.secret_key:
            profile.generate_secret_key()
    
    totp_uri = request.user.profile.get_totp_uri()
    
    # Создаем QR код
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Конвертируем в base64 для отображения в HTML
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    qr_code_data = base64.b64encode(buffer.getvalue()).decode()
    
    context = {
        'secret_key': request.user.profile.secret_key,
        'qr_code': qr_code_data,
        'totp_uri': totp_uri
    }
    
    return render(request, 'auth/2fa_setup.html', context)

def logout_view(request):
    """Выход из системы"""
    logout(request)
    request.session.flush()
    return redirect('/admin/login/')

@login_required
def profile_view(request):
    """Профиль пользователя"""
    return render(request, 'auth/profile.html')
