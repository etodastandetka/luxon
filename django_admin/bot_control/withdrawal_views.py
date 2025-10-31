"""
API views for handling withdrawal requests
"""
import json
import logging
import sqlite3
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

def get_withdrawal_request(request_id):
    """Helper function to get withdrawal request by ID через Django ORM"""
    try:
        from bot_control.models import Request, BotUser
        
        try:
            req = Request.objects.get(id=request_id, request_type='withdraw')
        except Request.DoesNotExist:
            return None
        
        # Получаем данные пользователя
        user_data = {}
        try:
            user = BotUser.objects.get(user_id=req.user_id)
            user_data = {
                'username': user.username or '',
                'first_name': user.first_name or '',
                'phone_number': '',  # нет такого поля в BotUser
                'balance': 0  # нет такого поля в BotUser
            }
        except BotUser.DoesNotExist:
            pass
        
        return {
            'id': req.id,
            'user_id': req.user_id,
            'amount': float(req.amount) if req.amount else 0,
            'status': req.status,
            'created_at': req.created_at.isoformat() if req.created_at else '',
            'updated_at': req.updated_at.isoformat() if req.updated_at else '',
            'bookmaker': req.bookmaker or '',
            'account_id': req.account_id or '',
            **user_data
        }
    except Exception as e:
        logger.error(f"Error getting withdrawal request {request_id}: {str(e)}")
        return None

def withdrawal_request_detail(request, request_id):
    """API endpoint to get withdrawal request details"""
    try:
        request_data = get_withdrawal_request(request_id)
        
        if not request_data:
            return JsonResponse({
                'success': False,
                'error': 'Заявка не найдена'
            }, status=404)
            
        return JsonResponse({
            'success': True,
            'data': request_data
        })
    except Exception as e:
        logger.error(f"Error in withdrawal_request_detail: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': 'Внутренняя ошибка сервера'
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def approve_withdrawal(request, request_id):
    """API endpoint to approve a withdrawal request"""
    try:
        data = json.loads(request.body)
        tx_hash = data.get('tx_hash', '').strip()
        
        from bot_control.models import Request
        
        # Получаем текущий статус заявки через Django ORM
        try:
            req = Request.objects.get(id=request_id, request_type='withdraw')
            request_status = req.status
            user_id = req.user_id
            amount = float(req.amount) if req.amount else 0
        except Request.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Заявка не найдена'
            }, status=404)
        
        if request_status != 'pending':
            return JsonResponse({
                'success': False,
                'error': 'Невозможно подтвердить заявку с текущим статусом'
            }, status=400)
        
        # Обновляем статус заявки через Django ORM
        req.status = 'completed'
        req.processed_at = timezone.now()
        # Сохраняем tx_hash в withdrawal_code или создаем отдельное поле если нужно
        if tx_hash:
            req.withdrawal_code = tx_hash
        req.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Вывод средств успешно подтвержден'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Неверный формат данных'
        }, status=400)
    except Exception as e:
        logger.error(f"Error approving withdrawal {request_id}: {str(e)}", exc_info=True)
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return JsonResponse({
            'success': False,
            'error': 'Внутренняя ошибка сервера'
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def reject_withdrawal(request, request_id):
    """API endpoint to reject a withdrawal request"""
    try:
        data = json.loads(request.body)
        reason = data.get('reason', '').strip()
        
        if not reason:
            return JsonResponse({
                'success': False,
                'error': 'Укажите причину отклонения'
            }, status=400)
        
        from bot_control.models import Request
        
        # Получаем текущий статус заявки через Django ORM
        try:
            req = Request.objects.get(id=request_id, request_type='withdraw')
        except Request.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Заявка не найдена'
            }, status=404)
            
        if req.status != 'pending':
            return JsonResponse({
                'success': False,
                'error': 'Невозможно отклонить заявку с текущим статусом'
            }, status=400)
        
        # Обновляем статус заявки через Django ORM
        req.status = 'rejected'
        req.processed_at = timezone.now()
        # Сохраняем причину в withdrawal_code
        if reason:
            req.withdrawal_code = reason
        req.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Заявка успешно отклонена'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Неверный формат данных'
        }, status=400)
    except Exception as e:
        logger.error(f"Error rejecting withdrawal {request_id}: {str(e)}", exc_info=True)
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return JsonResponse({
            'success': False,
            'error': 'Внутренняя ошибка сервера'
        }, status=500)

def withdrawal_stats(request):
    """API endpoint to get withdrawal statistics через Django ORM"""
    try:
        from bot_control.models import Request
        from django.db.models import Count, Sum, Q
        from django.utils import timezone
        from datetime import timedelta
        
        # Получаем все выводы
        withdrawals = Request.objects.filter(request_type='withdraw')
        
        # Общая статистика
        stats = {
            'total': withdrawals.count(),
            'pending': withdrawals.filter(status='pending').count(),
            'completed': withdrawals.filter(status__in=['completed', 'approved']).count(),
            'rejected': withdrawals.filter(status='rejected').count()
        }
        
        # Статистика по дням за последние 30 дней
        thirty_days_ago = timezone.now() - timedelta(days=30)
        daily_withdrawals = withdrawals.filter(created_at__gte=thirty_days_ago).extra(
            select={'date': "DATE(created_at)"}
        ).values('date').annotate(
            count=Count('id'),
            completed_amount=Sum('amount', filter=Q(status__in=['completed', 'approved'])),
            pending_amount=Sum('amount', filter=Q(status='pending')),
            rejected_amount=Sum('amount', filter=Q(status='rejected'))
        ).order_by('-date')
        
        daily_stats = [{
            'date': item['date'],
            'count': item['count'],
            'completed_amount': float(item['completed_amount'] or 0),
            'pending_amount': float(item['pending_amount'] or 0),
            'rejected_amount': float(item['rejected_amount'] or 0)
        } for item in daily_withdrawals]
        
        return JsonResponse({
            'success': True,
            'stats': stats,
            'daily_stats': daily_stats
        })
        
    except Exception as e:
        logger.error(f"Error getting withdrawal stats: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': 'Внутренняя ошибка сервера'
        }, status=500)
