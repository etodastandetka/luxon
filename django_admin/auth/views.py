from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from bot_control.models import UserProfile
import pyotp
import qrcode
import qrcode.image.svg
from io import BytesIO
import base64

def custom_login(request):
    """Кастомная страница входа"""
    if request.user.is_authenticated:
        return redirect('/')
    
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        if not username or not password:
            messages.error(request, 'Пожалуйста, заполните все поля')
            return render(request, 'auth/login.html')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            # Проверяем, включена ли 2FA для пользователя
            try:
                profile = UserProfile.objects.get(user=user)
                if profile.two_factor_enabled:
                    # Сохраняем ID пользователя в сессии для 2FA
                    request.session['temp_user_id'] = user.id
                    return redirect('/2fa-verify/')
                else:
                    # Если 2FA отключена, сразу логиним
                    login(request, user)
                    messages.success(request, f'Добро пожаловать, {user.username}!')
                    return redirect('/')
            except UserProfile.DoesNotExist:
                # Если профиля нет, создаем его
                profile = UserProfile.objects.create(user=user)
                login(request, user)
                messages.success(request, f'Добро пожаловать, {user.username}!')
                return redirect('/')
        else:
            messages.error(request, 'Неверное имя пользователя или пароль')
    
    return render(request, 'auth/login.html')

def custom_logout(request):
    """Кастомный выход"""
    logout(request)
    messages.success(request, 'Вы успешно вышли из системы')
    return redirect('/login/')

@login_required
def setup_2fa(request):
    """Настройка 2FA для пользователя"""
    try:
        profile = UserProfile.objects.get(user=request.user)
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user)
    
    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'enable':
            # Генерируем секретный ключ
            secret_key = pyotp.random_base32()
            profile.two_factor_secret = secret_key
            profile.two_factor_enabled = True
            profile.save()
            
            # Генерируем QR код
            totp_uri = pyotp.totp.TOTP(secret_key).provisioning_uri(
                name=request.user.username,
                issuer_name="LUXON Admin"
            )
            
            # Создаем QR код
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(totp_uri)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            qr_code = base64.b64encode(buffer.getvalue()).decode()
            
            return render(request, 'auth/setup_2fa.html', {
                'qr_code': qr_code,
                'secret_key': secret_key,
                'totp_uri': totp_uri
            })
        
        elif action == 'disable':
            profile.two_factor_enabled = False
            profile.two_factor_secret = ''
            profile.save()
            messages.success(request, '2FA отключена')
            return redirect('/')
    
    return render(request, 'auth/setup_2fa.html', {
        'two_factor_enabled': profile.two_factor_enabled
    })

def verify_2fa(request):
    """Проверка 2FA кода"""
    if request.method == 'POST':
        code = request.POST.get('code')
        user_id = request.session.get('temp_user_id')
        
        if not user_id:
            messages.error(request, 'Сессия истекла. Пожалуйста, войдите снова.')
            return redirect('/login/')
        
        try:
            user = User.objects.get(id=user_id)
            profile = UserProfile.objects.get(user=user)
            
            if profile.two_factor_enabled and profile.two_factor_secret:
                totp = pyotp.TOTP(profile.two_factor_secret)
                if totp.verify(code, valid_window=1):
                    # Успешная аутентификация
                    login(request, user)
                    del request.session['temp_user_id']
                    messages.success(request, f'Добро пожаловать, {user.username}!')
                    return redirect('/')
                else:
                    messages.error(request, 'Неверный код аутентификации')
            else:
                messages.error(request, '2FA не настроена для этого пользователя')
                return redirect('/login/')
        except User.DoesNotExist:
            messages.error(request, 'Пользователь не найден')
            return redirect('/login/')
        except UserProfile.DoesNotExist:
            messages.error(request, 'Профиль пользователя не найден')
            return redirect('/login/')
    
    return render(request, 'auth/verify_2fa.html')

@csrf_exempt
def api_verify_2fa(request):
    """API для проверки 2FA кода"""
    if request.method == 'POST':
        import json
        data = json.loads(request.body)
        code = data.get('code')
        user_id = request.session.get('temp_user_id')
        
        if not user_id:
            return JsonResponse({'success': False, 'error': 'Сессия истекла'})
        
        try:
            user = User.objects.get(id=user_id)
            profile = UserProfile.objects.get(user=user)
            
            if profile.two_factor_enabled and profile.two_factor_secret:
                totp = pyotp.TOTP(profile.two_factor_secret)
                if totp.verify(code, valid_window=1):
                    login(request, user)
                    del request.session['temp_user_id']
                    return JsonResponse({'success': True, 'redirect': '/'})
                else:
                    return JsonResponse({'success': False, 'error': 'Неверный код'})
            else:
                return JsonResponse({'success': False, 'error': '2FA не настроена'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Неверный метод запроса'})
