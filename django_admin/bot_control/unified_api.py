"""
Унифицированный API для интеграции между сайтом и админкой
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import sqlite3
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Стандартные статусы для заявок
REQUEST_STATUSES = {
    'pending': 'Ожидает обработки',
    'processing': 'В обработке', 
    'completed': 'Завершено',
    'rejected': 'Отклонено',
    'cancelled': 'Отменено'
}

# Стандартные типы заявок
REQUEST_TYPES = {
    'deposit': 'Пополнение',
    'withdraw': 'Вывод'
}

@csrf_exempt
@require_http_methods(["GET", "POST"])
def unified_requests_api(request):
    """
    Унифицированный API для работы с заявками
    GET - получение списка заявок
    POST - создание новой заявки
    """
    try:
        if request.method == 'GET':
            return get_requests(request)
        elif request.method == 'POST':
            logger.info(f"Creating request with data: {request.body}")
            return create_request(request)
    except Exception as e:
        logger.error(f"Error in unified_requests_api: {str(e)}")
        return JsonResponse({'error': 'Internal server error'}, status=500)

def get_requests(request):
    """Получение списка заявок с фильтрацией"""
    try:
        from bot_control.models import Request
        
        # Параметры фильтрации
        status = request.GET.get('status', '')
        request_type = request.GET.get('type', '')
        limit = int(request.GET.get('limit', 50))
        offset = int(request.GET.get('offset', 0))
        
        # Построение фильтров для Django ORM
        filters = {}
        if status:
            filters['status'] = status
        if request_type:
            filters['request_type'] = request_type
        
        # Получаем заявки через Django ORM
        requests_queryset = Request.objects.filter(**filters).order_by('-created_at')[offset:offset+limit]
        
        requests_list = []
        for req in requests_queryset:
            requests_list.append({
                'id': req.id,
                'user_id': req.user_id,
                'type': req.request_type,
                'amount': float(req.amount) if req.amount else 0,
                'status': req.status,
                'created_at': req.created_at.isoformat() if req.created_at else '',
                'bookmaker': req.bookmaker or '',
                'bank': req.bank or '',
                'account_id': req.account_id or '',
                'phone': req.phone or '',
                'user': {
                    'username': req.username or '',
                    'first_name': req.first_name or '',
                    'last_name': req.last_name or ''
                }
            })
        
        # Получаем общее количество через Django ORM
        total_count = Request.objects.filter(**filters).count()
        
        return JsonResponse({
            'success': True,
            'requests': requests_list,
            'total': total_count,
            'limit': limit,
            'offset': offset
        })
        
    except Exception as e:
        logger.error(f"Error in get_requests: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

def create_request(request):
    """Создание новой заявки"""
    try:
        data = json.loads(request.body)
        logger.info(f"Creating request with data: {data}")
        
        # Валидация обязательных полей
        required_fields = ['user_id', 'request_type', 'amount']
        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field: {field}")
                return JsonResponse({'error': f'Missing required field: {field}'}, status=400)
        
        # Валидация типа заявки
        if data['request_type'] not in REQUEST_TYPES:
            return JsonResponse({'error': 'Invalid request type'}, status=400)
        
        # Создание заявки через Django ORM
        from bot_control.models import Request
        request_obj = Request.objects.create(
            user_id=data['user_id'],
            request_type=data['request_type'],
            amount=data['amount'],
            status='pending',
            bookmaker=data.get('bookmaker', ''),
            bank=data.get('bank', ''),
            account_id=data.get('account_id', ''),
            phone=data.get('phone', '')
        )
        request_id = request_obj.id
        
        return JsonResponse({
            'success': True,
            'request_id': request_id,
            'message': 'Request created successfully'
        })
        
    except Exception as e:
        logger.error(f"Error in create_request: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET", "POST", "PUT", "PATCH"])
def update_request_status(request, request_id):
    """
    Обновление статуса заявки
    """
    try:
        # GET: вернуть текущий статус
        if request.method == 'GET':
            try:
                from bot_control.models import Request
                req = Request.objects.get(id=request_id)
                return JsonResponse({'success': True, 'status': req.status})
            except Exception:
                return JsonResponse({'success': False, 'error': 'Request not found'}, status=404)

        data = json.loads(request.body)
        new_status = data.get('status')
        
        if not new_status:
            return JsonResponse({'error': 'Status is required'}, status=400)
        
        if new_status not in REQUEST_STATUSES:
            return JsonResponse({'error': 'Invalid status'}, status=400)
        
        from bot_control.models import Request
        from django.utils import timezone
        
        # Обновляем статус через Django ORM
        try:
            req = Request.objects.get(id=request_id)
            req.status = new_status
            req.updated_at = timezone.now()
            
            # Если статус завершающий, устанавливаем processed_at
            if new_status in ['completed', 'rejected', 'approved', 'auto_completed']:
                req.processed_at = timezone.now()
            
            req.save()
            
            return JsonResponse({
                'success': True,
                'message': f'Request status updated to {new_status}'
            })
            
        except Request.DoesNotExist:
            return JsonResponse({'error': 'Request not found'}, status=404)
        
    except Exception as e:
        logger.error(f"Error in update_request_status: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["GET"])
def get_request_detail(request, request_id):
    """
    Получение детальной информации о заявке
    """
    try:
        from bot_control.models import Request, BotUser
        
        try:
            request_obj = Request.objects.get(id=request_id)
        except Request.DoesNotExist:
            return JsonResponse({'error': 'Request not found'}, status=404)
        
        # Получаем данные пользователя, если есть
        user_data = {}
        try:
            user = BotUser.objects.get(user_id=request_obj.user_id)
            user_data = {
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name
            }
        except BotUser.DoesNotExist:
            pass
        
        # История действий - пока пустой список (можно добавить отдельную модель если нужно)
        actions = []
        
        return JsonResponse({
            'success': True,
            'request': {
                'id': request_obj.id,
                'user_id': request_obj.user_id,
                'type': request_obj.request_type,
                'amount': float(request_obj.amount) if request_obj.amount else 0,
                'status': request_obj.status,
                'created_at': request_obj.created_at.isoformat() if request_obj.created_at else '',
                'updated_at': request_obj.updated_at.isoformat() if request_obj.updated_at else '',
                'bookmaker': request_obj.bookmaker or '',
                'bank': request_obj.bank or '',
                'account_id': request_obj.account_id or '',
                'phone': request_obj.phone or '',
                'user': user_data
            },
            'actions': actions
        })
        
    except Exception as e:
        logger.error(f"Error in get_request_detail: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["GET"])
def get_statistics(request):
    """
    Получение статистики
    """
    try:
        from bot_control.models import Request
        from django.db.models import Sum, Count
        
        # Общая статистика через Django ORM
        total_requests = Request.objects.count()
        completed_requests = Request.objects.filter(status='completed').count()
        pending_requests = Request.objects.filter(status='pending').count()
        total_amount = Request.objects.filter(status='completed').aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        # Статистика по типам через Django ORM
        type_stats = {}
        for request_type in ['deposit', 'withdraw']:
            stats = Request.objects.filter(
                status='completed',
                request_type=request_type
            ).aggregate(
                count=Count('id'),
                total=Sum('amount')
            )
            type_stats[request_type] = {
                'count': stats['count'] or 0,
                'total': stats['total'] or 0
            }
        
        return JsonResponse({
            'success': True,
            'statistics': {
                'total_requests': total_requests,
                'completed_requests': completed_requests,
                'pending_requests': pending_requests,
                'total_amount': total_amount,
                'by_type': type_stats
            }
        })
        
    except Exception as e:
        logger.error(f"Error in get_statistics: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)
