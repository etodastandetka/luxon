from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views import View
import json
import sqlite3
from datetime import datetime
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

class TransactionAPIView(View):
    """API для создания и получения транзакций"""
    
    def post(self, request):
        """Создание новой транзакции"""
        try:
            data = json.loads(request.body)
            
            # Валидация данных
            required_fields = ['user_id', 'transaction_type', 'amount', 'bookmaker']
            for field in required_fields:
                if field not in data:
                    return JsonResponse({
                        'error': f'Missing required field: {field}'
                    }, status=400)
            
            # Подключаемся к базе данных бота
            conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
            cursor = conn.cursor()
            
            # Создаем транзакцию в базе данных
            cursor.execute("""
                INSERT INTO deposit_requests 
                (user_id, amount, bookmaker, bank, phone, site_code, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data['user_id'],
                data['amount'],
                data['bookmaker'],
                data.get('bank'),
                data.get('phone'),
                data.get('site_code'),
                'pending',
                datetime.now().isoformat()
            ))
            
            transaction_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return JsonResponse({
                'id': transaction_id,
                'user_id': data['user_id'],
                'transaction_type': data['transaction_type'],
                'amount': data['amount'],
                'bookmaker': data['bookmaker'],
                'status': 'pending',
                'created_at': datetime.now().isoformat()
            }, status=201)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error(f'Transaction creation error: {e}')
            return JsonResponse({'error': 'Internal server error'}, status=500)
    
    def get(self, request):
        """Получение транзакции по ID"""
        try:
            transaction_id = request.GET.get('id')
            if not transaction_id:
                return JsonResponse({'error': 'Transaction ID required'}, status=400)
            
            # Подключаемся к базе данных бота
            conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, user_id, amount, bookmaker, bank, phone, site_code, status, created_at
                FROM deposit_requests 
                WHERE id = ?
            """, (transaction_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if not row:
                return JsonResponse({'error': 'Transaction not found'}, status=404)
            
            return JsonResponse({
                'id': row[0],
                'user_id': row[1],
                'amount': row[2],
                'bookmaker': row[3],
                'bank': row[4],
                'phone': row[5],
                'site_code': row[6],
                'status': row[7],
                'created_at': row[8]
            })
            
        except Exception as e:
            logger.error(f'Transaction retrieval error: {e}')
            return JsonResponse({'error': 'Internal server error'}, status=500)

@csrf_exempt
def transaction_api(request):
    """Wrapper для TransactionAPIView"""
    if request.method == 'POST':
        return TransactionAPIView().post(request)
    elif request.method == 'GET':
        return TransactionAPIView().get(request)
    else:
        return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def create_transaction(request):
    """REST API для создания транзакций"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)

        # Валидация данных
        required_fields = ['user_id', 'transaction_type', 'amount', 'bookmaker']
        for field in required_fields:
            if field not in data:
                return JsonResponse({
                    'error': f'Missing required field: {field}'
                }, status=400)

        # Подключаемся к базе данных бота
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()
        
        # Определяем таблицу в зависимости от типа транзакции
        if data['transaction_type'] == 'deposit':
            table_name = 'deposit_requests'
        elif data['transaction_type'] == 'withdrawal':
            table_name = 'withdrawals'
        else:
                return JsonResponse({
                'error': 'Invalid transaction type'
                }, status=400)
        
        # Создаем транзакцию в базе данных
        cursor.execute(f"""
            INSERT INTO {table_name} 
            (user_id, amount, bookmaker, bank, phone, site_code, qr_photo, request_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data['user_id'],
            data['amount'],
            data['bookmaker'],
            data.get('bank'),
            data.get('phone'),
            data.get('site_code'),
            data.get('qr_photo'),
            data.get('request_id'),
            'pending',
            datetime.now().isoformat()
        ))
        
        transaction_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return JsonResponse({
            'id': transaction_id,
            'user_id': data['user_id'],
            'transaction_type': data['transaction_type'],
            'amount': data['amount'],
            'bookmaker': data['bookmaker'],
            'status': 'pending',
            'created_at': datetime.now().isoformat()
        }, status=201)
        
    except Exception as e:
        logger.error(f'Transaction creation error: {e}')
        print(f'Transaction creation error: {e}')  # Для отладки
        return JsonResponse({
            'error': f'Internal server error: {str(e)}'
        }, status=500)

@api_view(['GET'])
def get_transaction(request, transaction_id):
    """REST API для получения транзакции по ID"""
    try:
        # Подключаемся к базе данных бота
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()
        
        # Ищем в обеих таблицах
        cursor.execute("""
            SELECT id, user_id, amount, bookmaker, bank, phone, site_code, status, created_at, 'deposit' as type
            FROM deposit_requests 
            WHERE id = ?
            UNION ALL
            SELECT id, user_id, amount, bookmaker, bank, phone, site_code, status, created_at, 'withdrawal' as type
            FROM withdrawals 
            WHERE id = ?
        """, (transaction_id, transaction_id))
        
        row = cursor.fetchone()
        conn.close()

        if not row:
            return Response({
                'error': 'Transaction not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'id': row[0],
            'user_id': row[1],
            'amount': row[2],
            'bookmaker': row[3],
            'bank': row[4],
            'phone': row[5],
            'site_code': row[6],
            'status': row[7],
            'created_at': row[8],
            'transaction_type': row[9]
        })
        
    except Exception as e:
        logger.error(f'Transaction retrieval error: {e}')
        return Response({
            'error': 'Internal server error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PUT'])
def update_transaction(request, transaction_id):
    """REST API для обновления статуса транзакции"""
    try:
        data = request.data
        new_status = data.get('status')
        reason = data.get('reason')
        
        if not new_status:
            return Response({
                'error': 'Status is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Подключаемся к базе данных бота
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()
        
        # Определяем тип транзакции и обновляем статус
        cursor.execute("SELECT id FROM deposit_requests WHERE id = ?", (transaction_id,))
        if cursor.fetchone():
            table_name = 'deposit_requests'
        else:
            cursor.execute("SELECT id FROM withdrawals WHERE id = ?", (transaction_id,))
            if cursor.fetchone():
                table_name = 'withdrawals'
            else:
                conn.close()
                return Response({
                    'error': 'Transaction not found'
                }, status=status.HTTP_404_NOT_FOUND)
        
        # Обновляем статус
        cursor.execute(f"""
            UPDATE {table_name} 
            SET status = ?, updated_at = ?
            WHERE id = ?
        """, (new_status, datetime.now().isoformat(), transaction_id))
        
        conn.commit()
        conn.close()
        
        # Отправляем уведомление в Telegram
        sendTelegramNotification(f"""
🔄 Статус заявки изменен
🆔 ID: {transaction_id}
📊 Статус: {'✅ Завершено' if new_status == 'completed' else '❌ Отклонено' if new_status == 'rejected' else new_status}
{f'📝 Причина: {reason}' if reason else ''}
        """)
        
        return Response({
            'success': True,
            'transaction_id': transaction_id,
            'status': new_status,
            'message': 'Transaction status updated successfully'
        })
        
    except Exception as e:
        logger.error(f'Transaction update error: {e}')
        return Response({
            'error': 'Internal server error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)