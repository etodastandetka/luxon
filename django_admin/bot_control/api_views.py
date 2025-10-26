from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
import json
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST", "PUT"])
def payment_api(request):
    """
    API для создания и обновления заявок на пополнение/вывод
    """
    try:
        data = json.loads(request.body)
        
        if request.method == 'POST':
            # Создание новой заявки
            return create_payment_request(data)
        elif request.method == 'PUT':
            # Обновление статуса заявки
            return update_payment_status(data)
            
    except Exception as e:
        logger.error(f"Error in payment_api: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

def create_payment_request(data):
    """Создание заявки на пополнение или вывод"""
    try:
        from bot_control.models import Request
        
        # Валидация обязательных полей
        required_fields = ['type', 'amount', 'userId', 'bookmaker']
        for field in required_fields:
            if field not in data:
                return JsonResponse({'error': f'Missing required field: {field}'}, status=400)
        
        # Создаем заявку через Django ORM
        request_obj = Request.objects.create(
            user_id=data['userId'],
            request_type=data['type'],  # 'deposit' или 'withdraw'
            amount=data['amount'],
            bookmaker=data['bookmaker'],
            bank=data.get('bank', ''),
            account_id=data.get('playerId', ''),
            phone=data.get('phone', ''),
            status='pending',
            created_at=timezone.now()
        )
        
        return JsonResponse({
            'success': True,
            'id': request_obj.id,
            'transactionId': request_obj.id,
            'message': 'Заявка успешно создана'
        })
        
    except Exception as e:
        logger.error(f"Error creating payment request: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

def update_payment_status(data):
    """Обновление статуса заявки"""
    try:
        from bot_control.models import Request
        
        if 'id' not in data:
            return JsonResponse({'error': 'Missing request ID'}, status=400)
        
        try:
            request_obj = Request.objects.get(id=data['id'])
        except Request.DoesNotExist:
            return JsonResponse({'error': 'Request not found'}, status=404)
        
        # Обновляем статус
        if 'status' in data:
            request_obj.status = data['status']
            request_obj.updated_at = timezone.now()
            
            # Если статус завершающий, устанавливаем processed_at
            if data['status'] in ['completed', 'rejected', 'approved', 'auto_completed']:
                request_obj.processed_at = timezone.now()
            
            request_obj.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Статус заявки обновлен'
        })
        
    except Exception as e:
        logger.error(f"Error updating payment status: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def generate_qr_api(request):
    """
    API для генерации QR кода
    """
    try:
        data = json.loads(request.body)
        
        amount = data.get('amount', 0)
        bank = data.get('bank', 'DEMIRBANK')
        player_id = data.get('playerId', '')
        
        # Получаем активный реквизит из админки
        from bot_control.models import BotConfiguration
        
        try:
            requisite_config = BotConfiguration.objects.get(key='active_requisite')
            requisite = requisite_config.value
        except BotConfiguration.DoesNotExist:
            # Fallback реквизит
            requisite = '1234567890123456'
        
        # Генерируем QR код
        amount_cents = int(amount * 100)
        amount_str = str(amount_cents).zfill(5)
        
        # Создаем TLV структуру
        payload = f"00020101021232990015qr.demirbank.kg0108ib_andro10{requisite}1109202111302112021213021211328454d5b3ee5d47c7b61c0a0b07bb939a5204482953034175405{amount_str}5909DEMIRBANK6304"
        
        # Вычисляем SHA256 контрольную сумму
        import hashlib
        checksum = hashlib.sha256(payload.encode()).hexdigest()
        qr_hash = payload + checksum
        
        # Создаем ссылки для всех банков
        bank_links = {
            'demirbank': f"https://retail.demirbank.kg/#{qr_hash}",
            'omoney': f"https://api.dengi.o.kg/ru/qr/#{qr_hash}",
            'balance': f"https://balance.kg/#{qr_hash}",
            'bakai': f"https://bakai24.app/#{qr_hash}",
            'megapay': f"https://megapay.kg/get#{qr_hash}",
            'mbank': f"https://app.mbank.kg/qr/#{qr_hash}"
        }
        
        return JsonResponse({
            'success': True,
            'qr_hash': qr_hash,
            'primary_url': bank_links.get(bank.lower(), bank_links['demirbank']),
            'all_bank_urls': bank_links,
            'settings': {
                'enabled_banks': ['demirbank', 'omoney', 'balance', 'bakai', 'megapay', 'mbank']
            }
        })
        
    except Exception as e:
        logger.error(f"Error generating QR code: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)