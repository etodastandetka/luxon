from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import sqlite3
import os

# get_db_connection больше не нужна - используем Django ORM

@csrf_exempt
def api_get_qr_hashes(request):
    """API для получения списка QR хешей через Django ORM"""
    if request.method == 'GET':
        try:
            from bot_control.models import QRHash
            qr_hashes = QRHash.objects.all().order_by('created_at')
            
            data = []
            for qr in qr_hashes:
                data.append({
                    'id': qr.id,
                    'bank_code': '',  # QRHash не имеет bank_code, это legacy поле
                    'hash_value': qr.hash_value,
                    'is_active': qr.is_active,
                    'created_at': qr.created_at.isoformat() if qr.created_at else ''
                })
            
            return JsonResponse({
                'success': True,
                'qr_hashes': data
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })

@csrf_exempt
def api_add_qr_hash(request):
    """API для добавления нового QR хеша"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            bank_code = data.get('bank_code')
            hash_value = data.get('hash_value')
            is_active = data.get('is_active', False)
            
            if not bank_code or not hash_value:
                return JsonResponse({
                    'success': False,
                    'error': 'Не указан банк или хеш'
                })
            
            from bot_control.models import QRHash
            
            # Если активируем, деактивируем все остальные
            if is_active:
                QRHash.objects.filter(is_active=True).update(is_active=False)
            
            # Добавляем новый QR хеш
            qr_hash = QRHash.objects.create(
                hash_value=hash_value,
                is_active=is_active
            )
            qr_hash_id = qr_hash.id
            
            return JsonResponse({
                'success': True,
                'qr_hash_id': qr_hash_id
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })

@csrf_exempt
def api_toggle_qr_hash(request, qr_id):
    """API для переключения статуса QR хеша"""
    if request.method == 'POST':
        try:
            from bot_control.models import QRHash
            
            try:
                qr_hash = QRHash.objects.get(id=qr_id)
            except QRHash.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'QR хеш не найден'
                })
            
            new_status = not qr_hash.is_active
            
            # Если активируем, деактивируем все остальные
            if new_status:
                QRHash.objects.filter(is_active=True).exclude(id=qr_id).update(is_active=False)
            
            # Переключаем статус
            qr_hash.is_active = new_status
            qr_hash.save()
            
            return JsonResponse({
                'success': True,
                'is_active': new_status
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })

@csrf_exempt
def api_delete_qr_hash(request, qr_id):
    """API для удаления QR хеша"""
    if request.method == 'DELETE':
        try:
            from bot_control.models import QRHash
            
            try:
                qr_hash = QRHash.objects.get(id=qr_id)
                qr_hash.delete()
            except QRHash.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'QR хеш не найден'
                })
            
            return JsonResponse({
                'success': True
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })
