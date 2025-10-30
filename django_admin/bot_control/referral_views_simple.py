#!/usr/bin/env python3
"""
Simple views for referral system management
"""
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

# def referral_management(request):
#     """Страница управления реферальной системой"""
#     return render(request, 'bot_control/referral_management.html')

@csrf_exempt
@require_http_methods(["GET"])
def api_referral_stats(request):
    """API для получения статистики рефералов"""
    try:
        # Возвращаем тестовые данные
        general_stats = {
            'active_referrers': 15,
            'total_referrals': 45,
            'total_paid': 12500.0,
            'pending_payments': 2500.0
        }
        
        level_stats = {
            'level_1': {
                'count': 30,
                'earnings': 10000.0
            },
            'level_2': {
                'count': 15,
                'earnings': 2500.0
            }
        }
        
        top_referrers = [
            {
                'referrer_id': 123456789,
                'first_name': 'Иван',
                'last_name': 'Петров',
                'username': 'ivan_petrov',
                'referrals_count': 8,
                'total_earnings': 2500.0
            },
            {
                'referrer_id': 987654321,
                'first_name': 'Мария',
                'last_name': 'Сидорова',
                'username': 'maria_sidorova',
                'referrals_count': 6,
                'total_earnings': 1800.0
            }
        ]
        
        settings_dict = {
            'referral_enabled': '1',
            'referral_percentage_level1': '5.0',
            'referral_percentage_level2': '2.0',
            'referral_min_deposit': '500',
            'referral_max_levels': '2',
            'referral_payout_day': '1'
        }
        
        return JsonResponse({
            'success': True,
            'general_stats': general_stats,
            'level_stats': level_stats,
            'top_referrers': top_referrers,
            'settings': settings_dict
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def api_update_referral_settings(request):
    """API для обновления настроек реферальной системы"""
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
            'referral_enabled',
            'referral_percentage_level1', 
            'referral_percentage_level2',
            'referral_min_deposit',
            'referral_max_levels',
            'referral_payout_day'
        ]
        
        for field in required_fields:
            if field not in data:
                return JsonResponse({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }, status=400)
        
        # Валидация значений
        try:
            enabled = int(data['referral_enabled'])
            if enabled not in [0, 1]:
                raise ValueError("Invalid enabled value")
                
            percentage1 = float(data['referral_percentage_level1'])
            percentage2 = float(data['referral_percentage_level2'])
            min_deposit = int(data['referral_min_deposit'])
            max_levels = int(data['referral_max_levels'])
            payout_day = int(data['referral_payout_day'])
            
        except (ValueError, TypeError) as e:
            return JsonResponse({
                'success': False,
                'error': f'Invalid parameter values: {str(e)}'
            }, status=400)
        
        # Валидация диапазонов
        if percentage1 < 0 or percentage1 > 100:
            return JsonResponse({
                'success': False,
                'error': 'referral_percentage_level1 must be between 0 and 100'
            }, status=400)
            
        if percentage2 < 0 or percentage2 > 100:
            return JsonResponse({
                'success': False,
                'error': 'referral_percentage_level2 must be between 0 and 100'
            }, status=400)
            
        if min_deposit < 0:
            return JsonResponse({
                'success': False,
                'error': 'referral_min_deposit must be non-negative'
            }, status=400)
            
        if max_levels < 1 or max_levels > 5:
            return JsonResponse({
                'success': False,
                'error': 'referral_max_levels must be between 1 and 5'
            }, status=400)
            
        if payout_day < 1 or payout_day > 31:
            return JsonResponse({
                'success': False,
                'error': 'referral_payout_day must be between 1 and 31'
            }, status=400)
        
        return JsonResponse({
            'success': True,
            'message': 'Настройки реферальной системы обновлены'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def api_process_monthly_payouts(request):
    """API для обработки месячных выплат"""
    try:
        # Симулируем обработку выплат
        payouts = [
            {'user_id': 123456789, 'amount': 1500.0},
            {'user_id': 987654321, 'amount': 800.0}
        ]
        
        return JsonResponse({
            'success': True,
            'payouts_count': len(payouts),
            'payouts': payouts
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_referral_payments(request):
    """API для получения списка выплат рефералов"""
    try:
        # Получаем параметры фильтрации
        status = request.GET.get('status', 'all')
        limit = int(request.GET.get('limit', 50))
        offset = int(request.GET.get('offset', 0))
        
        # Валидация статуса
        if status not in ['all', 'pending', 'paid']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid status parameter'
            }, status=400)
        
        # Возвращаем тестовые данные
        test_payments = [
            {
                'id': 1,
                'referrer_id': 123456789,
                'referred_id': 111111111,
                'amount': 250.0,
                'percentage': 5.0,
                'level': 1,
                'status': 'pending',
                'created_at': '2024-10-16 19:00:00',
                'referrer_first_name': 'Иван',
                'referrer_last_name': 'Петров',
                'referrer_username': 'ivan_petrov',
                'referred_first_name': 'Алексей',
                'referred_last_name': 'Иванов',
                'referred_username': 'alex_ivanov'
            },
            {
                'id': 2,
                'referrer_id': 987654321,
                'referred_id': 222222222,
                'amount': 100.0,
                'percentage': 2.0,
                'level': 2,
                'status': 'paid',
                'created_at': '2024-10-15 18:00:00',
                'paid_at': '2024-10-16 10:00:00',
                'referrer_first_name': 'Мария',
                'referrer_last_name': 'Сидорова',
                'referrer_username': 'maria_sidorova',
                'referred_first_name': 'Елена',
                'referred_last_name': 'Петрова',
                'referred_username': 'elena_petrova'
            }
        ]
        
        # Фильтруем по статусу
        if status != 'all':
            test_payments = [p for p in test_payments if p['status'] == status]
        
        # Применяем пагинацию
        test_payments = test_payments[offset:offset + limit]
        
        # Статистика
        stats = {
            'total': 2,
            'pending': 1,
            'paid': 1,
            'total_amount': 350.0
        }
        
        return JsonResponse({
            'success': True,
            'payments': test_payments,
            'stats': stats,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'has_more': len(test_payments) == limit
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

