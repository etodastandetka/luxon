"""
Mostbet Cash API views
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from bot_control.mostbet_api import MostbetAPI
from bot_control.casino_api_config import MOSTBET_CONFIG
import json
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
def api_mostbet_balance(request):
    """API для получения баланса кассы через Mostbet Cash API"""
    if request.method == 'GET':
        try:
            api = MostbetAPI(
                api_key=MOSTBET_CONFIG['api_key'],
                secret=MOSTBET_CONFIG['secret'],
                cashpoint_id=MOSTBET_CONFIG['cashpoint_id']
            )
            
            result = api.get_balance()
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_mostbet_balance: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_mostbet_deposit(request):
    """API для пополнения через Mostbet Cash API"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            player_id = data.get('player_id')
            amount = data.get('amount')
            currency = data.get('currency', 'RUB')
            brand_id = data.get('brand_id', 1)
            
            if not player_id or not amount:
                return JsonResponse({'error': 'player_id and amount are required'}, status=400)
            
            api = MostbetAPI(
                api_key=MOSTBET_CONFIG['api_key'],
                secret=MOSTBET_CONFIG['secret'],
                cashpoint_id=MOSTBET_CONFIG['cashpoint_id']
            )
            
            result = api.deposit(str(player_id), float(amount), currency, brand_id)
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_mostbet_deposit: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_mostbet_cashout_list(request):
    """API для получения списка заявок на вывод через Mostbet Cash API"""
    if request.method == 'GET':
        try:
            page = int(request.GET.get('page', 0))
            size = int(request.GET.get('size', 10))
            search_string = request.GET.get('search_string')
            
            api = MostbetAPI(
                api_key=MOSTBET_CONFIG['api_key'],
                secret=MOSTBET_CONFIG['secret'],
                cashpoint_id=MOSTBET_CONFIG['cashpoint_id']
            )
            
            result = api.get_cashout_list(page, size, search_string)
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_mostbet_cashout_list: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_mostbet_confirm_cashout(request):
    """API для подтверждения вывода через Mostbet Cash API"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            transaction_id = data.get('transaction_id')
            code = data.get('code')
            
            if not transaction_id or not code:
                return JsonResponse({'error': 'transaction_id and code are required'}, status=400)
            
            api = MostbetAPI(
                api_key=MOSTBET_CONFIG['api_key'],
                secret=MOSTBET_CONFIG['secret'],
                cashpoint_id=MOSTBET_CONFIG['cashpoint_id']
            )
            
            result = api.confirm_cashout(int(transaction_id), code)
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_mostbet_confirm_cashout: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_mostbet_transactions(request):
    """API для получения истории транзакций через Mostbet Cash API"""
    if request.method == 'GET':
        try:
            date_start = request.GET.get('date_start')
            date_end = request.GET.get('date_end')
            brand_id = request.GET.get('brand_id')
            player_id = request.GET.get('player_id')
            transaction_id = request.GET.get('transaction_id')
            
            if not date_start or not date_end:
                return JsonResponse({'error': 'date_start and date_end are required'}, status=400)
            
            api = MostbetAPI(
                api_key=MOSTBET_CONFIG['api_key'],
                secret=MOSTBET_CONFIG['secret'],
                cashpoint_id=MOSTBET_CONFIG['cashpoint_id']
            )
            
            result = api.get_transactions(
                date_start,
                date_end,
                int(brand_id) if brand_id else None,
                player_id,
                int(transaction_id) if transaction_id else None
            )
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_mostbet_transactions: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)
