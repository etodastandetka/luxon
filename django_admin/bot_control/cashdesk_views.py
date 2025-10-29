"""
Cashdesk API views для Melbet и 1xbet
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from bot_control.cashdesk_api import CashdeskAPI
import json
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
def api_cashdesk_balance(request, casino: str):
    """API для получения баланса кассы через Cashdesk API"""
    if request.method == 'GET':
        try:
            # TODO: Получать из настроек
            configs = {
                'melbet': {
                    'hash': 'YOUR_MELBET_HASH',
                    'cashierpass': 'YOUR_CASHIERPASS',
                    'login': 'YOUR_LOGIN',
                    'cashdeskid': 12345
                },
                '1xbet': {
                    'hash': 'YOUR_1XBET_HASH',
                    'cashierpass': 'YOUR_CASHIERPASS',
                    'login': 'YOUR_LOGIN',
                    'cashdeskid': 67890
                }
            }
            
            if casino not in configs:
                return JsonResponse({'error': 'Invalid casino'}, status=400)
            
            config = configs[casino]
            api = CashdeskAPI(
                casino=casino,
                hash_key=config['hash'],
                cashierpass=config['cashierpass'],
                login=config['login'],
                cashdeskid=config['cashdeskid']
            )
            
            result = api.get_balance()
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_cashdesk_balance: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_cashdesk_search_player(request, casino: str):
    """API для поиска игрока через Cashdesk API"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            
            if not user_id:
                return JsonResponse({'error': 'user_id is required'}, status=400)
            
            # TODO: Получать из настроек
            configs = {
                'melbet': {
                    'hash': 'YOUR_MELBET_HASH',
                    'cashierpass': 'YOUR_CASHIERPASS',
                    'login': 'YOUR_LOGIN',
                    'cashdeskid': 12345
                },
                '1xbet': {
                    'hash': 'YOUR_1XBET_HASH',
                    'cashierpass': 'YOUR_CASHIERPASS',
                    'login': 'YOUR_LOGIN',
                    'cashdeskid': 67890
                }
            }
            
            if casino not in configs:
                return JsonResponse({'error': 'Invalid casino'}, status=400)
            
            config = configs[casino]
            api = CashdeskAPI(
                casino=casino,
                hash_key=config['hash'],
                cashierpass=config['cashierpass'],
                login=config['login'],
                cashdeskid=config['cashdeskid']
            )
            
            result = api.search_player(str(user_id))
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_cashdesk_search_player: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_cashdesk_deposit(request, casino: str):
    """API для пополнения через Cashdesk API"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            summa = data.get('summa')
            lng = data.get('lng', 'ru')
            
            if not user_id or not summa:
                return JsonResponse({'error': 'user_id and summa are required'}, status=400)
            
            # TODO: Получать из настроек
            configs = {
                'melbet': {
                    'hash': 'YOUR_MELBET_HASH',
                    'cashierpass': 'YOUR_CASHIERPASS',
                    'login': 'YOUR_LOGIN',
                    'cashdeskid': 12345
                },
                '1xbet': {
                    'hash': 'YOUR_1XBET_HASH',
                    'cashierpass': 'YOUR_CASHIERPASS',
                    'login': 'YOUR_LOGIN',
                    'cashdeskid': 67890
                }
            }
            
            if casino not in configs:
                return JsonResponse({'error': 'Invalid casino'}, status=400)
            
            config = configs[casino]
            api = CashdeskAPI(
                casino=casino,
                hash_key=config['hash'],
                cashierpass=config['cashierpass'],
                login=config['login'],
                cashdeskid=config['cashdeskid']
            )
            
            result = api.deposit(str(user_id), float(summa), lng)
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_cashdesk_deposit: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_cashdesk_payout(request, casino: str):
    """API для выплаты через Cashdesk API"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            code = data.get('code')
            lng = data.get('lng', 'ru')
            
            if not user_id or not code:
                return JsonResponse({'error': 'user_id and code are required'}, status=400)
            
            # TODO: Получать из настроек
            configs = {
                'melbet': {
                    'hash': 'YOUR_MELBET_HASH',
                    'cashierpass': 'YOUR_CASHIERPASS',
                    'login': 'YOUR_LOGIN',
                    'cashdeskid': 12345
                },
                '1xbet': {
                    'hash': 'YOUR_1XBET_HASH',
                    'cashierpass': 'YOUR_CASHIERPASS',
                    'login': 'YOUR_LOGIN',
                    'cashdeskid': 67890
                }
            }
            
            if casino not in configs:
                return JsonResponse({'error': 'Invalid casino'}, status=400)
            
            config = configs[casino]
            api = CashdeskAPI(
                casino=casino,
                hash_key=config['hash'],
                cashierpass=config['cashierpass'],
                login=config['login'],
                cashdeskid=config['cashdeskid']
            )
            
            result = api.payout(str(user_id), code, lng)
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_cashdesk_payout: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)
