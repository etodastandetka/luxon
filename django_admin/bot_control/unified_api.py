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
        
        from django.conf import settings
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()
        
        # Создание заявки
        cursor.execute('''
            INSERT INTO requests (
                user_id, request_type, amount, status, created_at,
                bookmaker, bank, account_id, phone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['user_id'],
            data['request_type'],
            data['amount'],
            'pending',  # Статус по умолчанию
            datetime.now().isoformat(),
            data.get('bookmaker', ''),
            data.get('bank', ''),
            data.get('account_id', ''),
            data.get('phone', '')
        ))
        
        request_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return JsonResponse({
            'success': True,
            'request_id': request_id,
            'message': 'Request created successfully'
        })
        
    except Exception as e:
        logger.error(f"Error in create_request: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST", "PUT", "PATCH"])
def update_request_status(request, request_id):
    """
    Обновление статуса заявки
    """
    try:
        data = json.loads(request.body)
        new_status = data.get('status')
        
        if not new_status:
            return JsonResponse({'error': 'Status is required'}, status=400)
        
        if new_status not in REQUEST_STATUSES:
            return JsonResponse({'error': 'Invalid status'}, status=400)
        
        from django.conf import settings
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()
        
        # Обновляем статус
        cursor.execute('''
            UPDATE requests 
            SET status = ?, updated_at = ?
            WHERE id = ?
        ''', (new_status, datetime.now().isoformat(), request_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return JsonResponse({'error': 'Request not found'}, status=404)
        
        conn.commit()
        conn.close()
        
        return JsonResponse({
            'success': True,
            'message': f'Request status updated to {new_status}'
        })
        
    except Exception as e:
        logger.error(f"Error in update_request_status: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["GET"])
def get_request_detail(request, request_id):
    """
    Получение детальной информации о заявке
    """
    try:
        from django.conf import settings
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                r.*, u.username, u.first_name, u.last_name
            FROM requests r
            LEFT JOIN users u ON r.user_id = u.telegram_id
            WHERE r.id = ?
        ''', (request_id,))
        
        row = cursor.fetchone()
        if not row:
            conn.close()
            return JsonResponse({'error': 'Request not found'}, status=404)
        
        # Получаем историю действий
        cursor.execute('''
            SELECT * FROM user_actions
            WHERE data LIKE ? AND action LIKE '%request%'
            ORDER BY timestamp DESC
        ''', (f'%{request_id}%',))
        
        actions = [dict(action) for action in cursor.fetchall()]
        
        conn.close()
        
        return JsonResponse({
            'success': True,
            'request': {
                'id': row['id'],
                'user_id': row['user_id'],
                'type': row['request_type'],
                'amount': row['amount'],
                'status': row['status'],
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
                'bookmaker': row['bookmaker'],
                'bank': row['bank'],
                'account_id': row['account_id'],
                'phone': row['phone'],
                'user': {
                    'username': row['username'],
                    'first_name': row['first_name'],
                    'last_name': row['last_name']
                }
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
