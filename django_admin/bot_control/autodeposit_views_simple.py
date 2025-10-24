#!/usr/bin/env python3
"""
Simple views for auto-deposit settings management
"""
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

def autodeposit_settings(request):
    """Страница настроек автопополнения"""
    return render(request, 'bot_control/autodeposit_settings.html')

@csrf_exempt
@require_http_methods(["GET", "POST"])
def api_autodeposit_settings(request):
    """API для получения и сохранения настроек автопополнения"""
    if request.method == 'GET':
        return get_autodeposit_settings()
    elif request.method == 'POST':
        return save_autodeposit_settings(request)

def get_autodeposit_settings():
    """Получение настроек автопополнения"""
    try:
        # Возвращаем тестовые настройки
        settings_dict = {
            'autodeposit_enabled': '1',
            'autodeposit_imap': 'imap.timeweb.ru',
            'autodeposit_email': 'test@example.com',
            'autodeposit_password': '********',
            'autodeposit_folder': 'INBOX',
            'autodeposit_bank': 'DEMIRBANK',
            'autodeposit_interval_sec': '60'
        }
        
        stats = {
            'processed_24h': 15,
            'total_processed': 150,
            'pending_requests': 3
        }
        
        return JsonResponse({
            'success': True,
            'settings': settings_dict,
            'stats': stats
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

def save_autodeposit_settings(request):
    """Сохранение настроек автопополнения"""
    try:
        # Валидация JSON
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON format'
            }, status=400)
        
        # Валидация обязательных полей
        required_fields = [
            'autodeposit_enabled',
            'autodeposit_imap',
            'autodeposit_email',
            'autodeposit_password',
            'autodeposit_folder',
            'autodeposit_bank',
            'autodeposit_interval_sec'
        ]
        
        for field in required_fields:
            if field not in data:
                return JsonResponse({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }, status=400)
        
        # Валидация значений
        try:
            enabled = int(data['autodeposit_enabled'])
            if enabled not in [0, 1]:
                raise ValueError("Invalid enabled value")
                
            interval = int(data['autodeposit_interval_sec'])
            if interval < 10 or interval > 3600:  # от 10 секунд до 1 часа
                raise ValueError("Invalid interval value")
                
        except (ValueError, TypeError) as e:
            return JsonResponse({
                'success': False,
                'error': f'Invalid parameter values: {str(e)}'
            }, status=400)
        
        # Валидация длины строк
        if len(data['autodeposit_imap']) > 255:
            return JsonResponse({
                'success': False,
                'error': 'IMAP host too long: maximum 255 characters'
            }, status=400)
            
        if len(data['autodeposit_email']) > 255:
            return JsonResponse({
                'success': False,
                'error': 'Email too long: maximum 255 characters'
            }, status=400)
            
        if len(data['autodeposit_password']) > 255:
            return JsonResponse({
                'success': False,
                'error': 'Password too long: maximum 255 characters'
            }, status=400)
            
        if len(data['autodeposit_folder']) > 100:
            return JsonResponse({
                'success': False,
                'error': 'Folder name too long: maximum 100 characters'
            }, status=400)
            
        if data['autodeposit_bank'] not in ['DEMIRBANK', 'MBANK', 'BALANCE', 'BAKAI', 'MEGAPAY', 'OPTIMA']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid bank: must be one of DEMIRBANK, MBANK, BALANCE, BAKAI, MEGAPAY, OPTIMA'
            }, status=400)
        
        return JsonResponse({
            'success': True,
            'message': 'Настройки сохранены'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def api_test_autodeposit(request):
    """Тестирование настроек автопополнения"""
    try:
        # Валидация JSON
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON format'
            }, status=400)
        
        # Валидация обязательных полей
        if 'test_text' not in data:
            return JsonResponse({
                'success': False,
                'error': 'Missing required field: test_text'
            }, status=400)
        
        # Валидация длины тестового текста
        test_text = data.get('test_text', '')
        if len(test_text) > 10000:  # Максимум 10KB текста
            return JsonResponse({
                'success': False,
                'error': 'Test text too long: maximum 10000 characters'
            }, status=400)
        
        # Валидация банка
        bank = data.get('bank', 'DEMIRBANK')
        if bank not in ['DEMIRBANK', 'MBANK', 'BALANCE', 'BAKAI', 'MEGAPAY', 'OPTIMA']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid bank: must be one of DEMIRBANK, MBANK, BALANCE, BAKAI, MEGAPAY, OPTIMA'
            }, status=400)
        
        # Симулируем парсинг
        if 'сумма' in test_text.lower() and 'сом' in test_text.lower():
            return JsonResponse({
                'success': True,
                'parsed': {
                    'amount': 1000.0,
                    'datetime': '2024-10-16 19:30:00'
                },
                'message': 'Парсинг успешен'
            })
        else:
            return JsonResponse({
                'success': False,
                'error': 'Не удалось распарсить письмо'
            })
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

