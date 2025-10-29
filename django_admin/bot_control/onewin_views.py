"""
1WIN API views
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from bot_control.onewin_api import OnewinAPI
import json
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
def api_onewin_deposit(request):
    """API для создания депозита через 1WIN API"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('userId') or data.get('user_id')
            amount = data.get('amount')
            
            if not user_id or not amount:
                return JsonResponse({'error': 'userId and amount are required'}, status=400)
            
            # TODO: Получать из настроек
            config = {
                'api_key': 'YOUR_1WIN_API_KEY'
            }
            
            api = OnewinAPI(api_key=config['api_key'])
            
            result = api.deposit(int(user_id), float(amount))
            
            # Если есть ошибка, возвращаем соответствующий статус
            if result.get('error'):
                status_code = result.get('status_code', 500)
                return JsonResponse(result, status=status_code)
            
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_onewin_deposit: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_onewin_withdrawal(request):
    """API для подтверждения вывода через 1WIN API"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('userId') or data.get('user_id')
            code = data.get('code')
            
            if not user_id or not code:
                return JsonResponse({'error': 'userId and code are required'}, status=400)
            
            # TODO: Получать из настроек
            config = {
                'api_key': 'YOUR_1WIN_API_KEY'
            }
            
            api = OnewinAPI(api_key=config['api_key'])
            
            result = api.withdrawal(int(user_id), int(code))
            
            # Если есть ошибка, возвращаем соответствующий статус
            if result.get('error'):
                status_code = result.get('status_code', 500)
                return JsonResponse(result, status=status_code)
            
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f"Error in api_onewin_withdrawal: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)
