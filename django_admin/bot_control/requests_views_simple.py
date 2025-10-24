#!/usr/bin/env python3
"""
Simple views for processing deposit and withdrawal requests
"""
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from datetime import datetime

def requests_management(request):
    """Страница управления заявками"""
    return render(request, 'bot_control/requests_management.html')

@csrf_exempt
@require_http_methods(["GET"])
def api_get_requests(request):
    """API для получения заявок"""
    try:
        # Валидация параметров
        request_type = request.GET.get('type', 'all')
        status = request.GET.get('status', 'all')
        
        # Валидация типа заявки
        if request_type not in ['all', 'deposit', 'withdraw']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid type parameter: must be all, deposit, or withdraw'
            }, status=400)
        
        # Валидация статуса
        if status not in ['all', 'pending', 'completed', 'rejected']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid status parameter: must be all, pending, completed, or rejected'
            }, status=400)
        
        # Валидация лимита и оффсета
        try:
            limit = int(request.GET.get('limit', 50))
            offset = int(request.GET.get('offset', 0))
        except ValueError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid limit or offset: must be integers'
            }, status=400)
        
        if limit <= 0 or limit > 100:
            return JsonResponse({
                'success': False,
                'error': 'Invalid limit: must be between 1 and 100'
            }, status=400)
        
        if offset < 0:
            return JsonResponse({
                'success': False,
                'error': 'Invalid offset: must be non-negative'
            }, status=400)
        
        # Возвращаем тестовые данные
        test_requests = [
            {
                'id': 1,
                'type': 'deposit',
                'user_id': 123456789,
                'first_name': 'Иван',
                'last_name': 'Петров',
                'username': 'ivan_petrov',
                'bookmaker': '1win',
                'player_id': 'test123',
                'amount': 1000.0,
                'bank': 'demirbank',
                'status': 'pending',
                'created_at': '2024-10-16 19:00:00'
            },
            {
                'id': 2,
                'type': 'withdraw',
                'user_id': 987654321,
                'first_name': 'Мария',
                'last_name': 'Сидорова',
                'username': 'maria_sidorova',
                'bookmaker': '1xbet',
                'player_id': 'player456',
                'amount': 2500.0,
                'phone': '+996555123456',
                'site_code': 'ABC123',
                'status': 'pending',
                'created_at': '2024-10-16 18:30:00'
            }
        ]
        
        # Фильтруем по типу
        if request_type != 'all':
            test_requests = [r for r in test_requests if r['type'] == request_type]
        
        # Фильтруем по статусу
        if status != 'all':
            test_requests = [r for r in test_requests if r['status'] == status]
        
        # Применяем пагинацию
        test_requests = test_requests[offset:offset + limit]
        
        # Статистика
        stats = {
            'deposits': {
                'total': 1,
                'pending': 1,
                'completed': 0,
                'rejected': 0,
                'total_amount': 1000.0
            },
            'withdrawals': {
                'total': 1,
                'pending': 1,
                'completed': 0,
                'rejected': 0,
                'total_amount': 2500.0
            }
        }
        
        return JsonResponse({
            'success': True,
            'requests': test_requests,
            'stats': stats,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'has_more': len(test_requests) == limit
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def api_process_request(request):
    """API для обработки заявки (одобрение или отклонение)"""
    try:
        # Валидация JSON
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON format'
            }, status=400)
        
        # Валидация обязательных параметров
        request_id = data.get('request_id')
        request_type = data.get('type')
        action = data.get('action')
        admin_comment = data.get('comment', '')
        
        if not request_id or not request_type or not action:
            return JsonResponse({
                'success': False,
                'error': 'Missing required parameters: request_id, type, action'
            }, status=400)
        
        # Валидация типов данных
        if not isinstance(request_id, int) or request_id <= 0:
            return JsonResponse({
                'success': False,
                'error': 'Invalid request_id: must be positive integer'
            }, status=400)
        
        if request_type not in ['deposit', 'withdraw']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid request_type: must be deposit or withdraw'
            }, status=400)
        
        if action not in ['approve', 'reject']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid action: must be approve or reject'
            }, status=400)
        
        # Валидация длины комментария
        if len(admin_comment) > 500:
            return JsonResponse({
                'success': False,
                'error': 'Comment too long: maximum 500 characters'
            }, status=400)
        
        # Симулируем обработку заявки
        action_text = 'одобрена' if action == 'approve' else 'отклонена'
        return JsonResponse({
            'success': True,
            'message': f'Заявка {request_type} #{request_id} {action_text}'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_request_detail(request, request_id, request_type):
    """API для получения детальной информации о заявке"""
    try:
        # Валидация типа заявки
        if request_type not in ['deposit', 'withdraw']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid request type'
            }, status=400)
        
        # Валидация ID
        if not isinstance(request_id, int) or request_id <= 0:
            return JsonResponse({
                'success': False,
                'error': 'Invalid request ID'
            }, status=400)
        
        # Возвращаем тестовые данные
        test_request = {
            'id': request_id,
            'type': request_type,
            'user_id': 123456789,
            'first_name': 'Иван',
            'last_name': 'Петров',
            'username': 'ivan_petrov',
            'bookmaker': '1win',
            'player_id': 'test123',
            'amount': 1000.0,
            'bank': 'demirbank',
            'status': 'pending',
            'created_at': '2024-10-16 19:00:00',
            'actions': []
        }
        
        if request_type == 'withdraw':
            test_request.update({
                'phone': '+996555123456',
                'site_code': 'ABC123'
            })
        
        return JsonResponse({
            'success': True,
            'request': test_request
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

