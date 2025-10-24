"""
API Views для бота
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

@csrf_exempt
@require_http_methods(["GET"])
def api_bot_settings(request):
    """API для получения настроек бота"""
    try:
        # Возвращаем базовые настройки
        settings_data = {
            'success': True,
            'settings': {
                'bot_name': 'LUXON',
                'welcome_message': 'Добро пожаловать!',
                'platform_description': 'Платформа для пополнения и вывода средств в казино',
                'supported_bookmakers': ['1xBet', 'Melbet', 'Mostbet', '1Win'],
                'supported_banks': ['DemirBank', 'O! bank', 'Balance.kg', 'Bakai', 'MegaPay', 'MBank'],
                'min_deposit': 35,
                'max_deposit': 100000,
                'min_withdraw': 100,
                'max_withdraw': 50000,
                'referral_percentage': 5,
                'support_contact': '@luxon_support'
            }
        }
        return JsonResponse(settings_data)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_requisites_list(request):
    """API для получения списка реквизитов"""
    try:
        # Возвращаем тестовые реквизиты
        requisites_data = {
            'success': True,
            'active_id': 1,
            'requisites': [
                {
                    'id': 1,
                    'bank_name': 'DemirBank',
                    'account_name': 'Test Account',
                    'account_number': '1234567890123456',
                    'is_active': True
                }
            ]
        }
        return JsonResponse(requisites_data)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_referral_data(request):
    """API для получения данных рефералов"""
    try:
        user_id = request.GET.get('user_id', 'test_user')
        
        # Возвращаем тестовые данные рефералов
        referral_data = {
            'success': True,
            'earned': 0,
            'referral_count': 0,
            'top_players': [
                {'id': 1, 'username': 'player1', 'referrals': 5, 'earned': 1000},
                {'id': 2, 'username': 'player2', 'referrals': 3, 'earned': 600},
                {'id': 3, 'username': 'player3', 'referrals': 2, 'earned': 400}
            ],
            'user_rank': 0
        }
        return JsonResponse(referral_data)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_transaction_history(request):
    """API для получения истории транзакций"""
    try:
        user_id = request.GET.get('user_id', 'test_user')
        
        # Возвращаем тестовые данные транзакций
        transaction_data = {
            'success': True,
            'transactions': [
                {
                    'id': 1,
                    'type': 'deposit',
                    'amount': 1000,
                    'status': 'completed',
                    'bookmaker': '1xBet',
                    'created_at': '2025-01-24T10:00:00Z'
                }
            ]
        }
        return JsonResponse(transaction_data)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)