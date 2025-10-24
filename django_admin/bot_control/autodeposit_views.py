#!/usr/bin/env python3
"""
Views for auto-deposit settings management
"""
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import sqlite3
import os
from django.conf import settings

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
        # Путь к базе данных бота
        db_path = os.path.join(settings.BASE_DIR, '..', 'bot2', 'bot_data.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Получаем настройки
        settings_keys = [
            'autodeposit_enabled',
            'autodeposit_imap',
            'autodeposit_email',
            'autodeposit_password',
            'autodeposit_folder',
            'autodeposit_bank',
            'autodeposit_interval_sec'
        ]
        
        settings_dict = {}
        for key in settings_keys:
            cursor.execute("SELECT value FROM bot_settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            settings_dict[key] = row[0] if row else get_default_setting(key)
        
        # Получаем статистику
        cursor.execute("""
            SELECT COUNT(*) FROM autodeposit_logs 
            WHERE processed_at >= datetime('now', '-24 hours')
        """)
        processed_24h = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM autodeposit_logs")
        total_processed = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM deposit_requests 
            WHERE status = 'pending'
        """)
        pending_requests = cursor.fetchone()[0]
        
        conn.close()
        
        return JsonResponse({
            'success': True,
            'settings': settings_dict,
            'stats': {
                'processed_24h': processed_24h,
                'total_processed': total_processed,
                'pending_requests': pending_requests
            }
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
        
        # Путь к базе данных бота
        db_path = os.path.join(settings.BASE_DIR, '..', 'bot2', 'bot_data.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Сохраняем настройки
        for key, value in data.items():
            if key.startswith('autodeposit_'):
                cursor.execute("""
                    INSERT OR REPLACE INTO bot_settings (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                """, (key, str(value)))
        
        conn.commit()
        conn.close()
        
        return JsonResponse({
            'success': True,
            'message': 'Настройки сохранены'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

def get_default_setting(key):
    """Получение значения по умолчанию для настройки"""
    defaults = {
        'autodeposit_enabled': '0',
        'autodeposit_imap': 'imap.timeweb.ru',
        'autodeposit_email': '',
        'autodeposit_password': '',
        'autodeposit_folder': 'INBOX',
        'autodeposit_bank': 'DEMIRBANK',
        'autodeposit_interval_sec': '60'
    }
    return defaults.get(key, '')

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
        
        # Импортируем парсеры
        import sys
        sys.path.append(os.path.join(settings.BASE_DIR, '..', 'bot2'))
        from autodeposit.parsers import parse_email_by_bank
        
        # Тестовый текст письма
        test_text = data.get('test_text', '')
        bank = data.get('bank', 'DEMIRBANK')
        
        if not test_text:
            return JsonResponse({
                'success': False,
                'error': 'Тестовый текст не предоставлен'
            }, status=400)
        
        # Парсим тестовый текст
        result = parse_email_by_bank(test_text, bank)
        
        if result:
            amount, datetime_str = result
            return JsonResponse({
                'success': True,
                'parsed': {
                    'amount': amount,
                    'datetime': datetime_str
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
