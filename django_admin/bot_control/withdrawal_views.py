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
    """Helper function to get withdrawal request by ID"""
    try:
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT wr.*, 
                   u.username, 
                   u.first_name, 
                   u.phone_number,
                   u.balance as user_balance
            FROM withdrawal_requests wr
            LEFT JOIN users u ON wr.user_id = u.user_id
            WHERE wr.id = ?
        ''', (request_id,))
        
        request_data = cursor.fetchone()
        conn.close()
        
        if not request_data:
            return None
            
        return dict(request_data)
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
        
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()
        
        # Получаем текущий статус заявки
        cursor.execute('SELECT status, user_id, amount FROM withdrawal_requests WHERE id = ?', (request_id,))
        request_data = cursor.fetchone()
        
        if not request_data:
            conn.close()
            return JsonResponse({
                'success': False,
                'error': 'Заявка не найдена'
            }, status=404)
            
        status, user_id, amount = request_data
        
        if status != 'pending':
            conn.close()
            return JsonResponse({
                'success': False,
                'error': 'Невозможно подтвердить заявку с текущим статусом'
            }, status=400)
        
        # Обновляем статус заявки
        cursor.execute('''
            UPDATE withdrawal_requests 
            SET status = 'completed', 
                updated_at = ?, 
                processed_at = ?,
                tx_hash = ?
            WHERE id = ?
        ''', (timezone.now().isoformat(), timezone.now().isoformat(), tx_hash, request_id))
        
        # Обновляем баланс пользователя (вычитаем сумму вывода)
        cursor.execute('''
            UPDATE users 
            SET balance = balance - ? 
            WHERE user_id = ?
        ''', (amount, user_id))
        
        conn.commit()
        conn.close()
        
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
        
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()
        
        # Получаем текущий статус заявки
        cursor.execute('SELECT status FROM withdrawal_requests WHERE id = ?', (request_id,))
        request_data = cursor.fetchone()
        
        if not request_data:
            conn.close()
            return JsonResponse({
                'success': False,
                'error': 'Заявка не найдена'
            }, status=404)
            
        status = request_data[0]
        
        if status != 'pending':
            conn.close()
            return JsonResponse({
                'success': False,
                'error': 'Невозможно отклонить заявку с текущим статусом'
            }, status=400)
        
        # Обновляем статус заявки
        cursor.execute('''
            UPDATE withdrawal_requests 
            SET status = 'rejected', 
                updated_at = ?, 
                processed_at = ?,
                reject_reason = ?
            WHERE id = ?
        ''', (timezone.now().isoformat(), timezone.now().isoformat(), reason, request_id))
        
        conn.commit()
        conn.close()
        
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
    """API endpoint to get withdrawal statistics"""
    try:
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Получаем общую статистику
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM withdrawal_requests
        ''')
        
        stats = dict(cursor.fetchone())
        
        # Получаем статистику по дням за последние 30 дней
        cursor.execute('''
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_amount,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
                SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END) as rejected_amount
            FROM withdrawal_requests
            WHERE created_at >= date('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        ''')
        
        daily_stats = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
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
