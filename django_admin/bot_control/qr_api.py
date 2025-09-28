from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import sqlite3
import os

def get_db_connection():
    """Получает соединение с базой данных"""
    db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'bot', 'universal_bot.db')
    return sqlite3.connect(db_path)

@csrf_exempt
def api_get_qr_hashes(request):
    """API для получения списка QR хешей"""
    if request.method == 'GET':
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, bank_code, hash_value, is_active, created_at
                FROM bot_control_qrhash
                ORDER BY bank_code, created_at DESC
            ''')
            
            data = []
            for row in cursor.fetchall():
                data.append({
                    'id': row[0],
                    'bank_code': row[1],
                    'hash_value': row[2],
                    'is_active': bool(row[3]),
                    'created_at': row[4]
                })
            
            conn.close()
            
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
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Если активируем, деактивируем все остальные для этого банка
            if is_active:
                cursor.execute('''
                    UPDATE bot_control_qrhash 
                    SET is_active = 0 
                    WHERE bank_code = ?
                ''', (bank_code,))
            
            # Добавляем новый QR хеш
            cursor.execute('''
                INSERT INTO bot_control_qrhash (bank_code, hash_value, is_active)
                VALUES (?, ?, ?)
            ''', (bank_code, hash_value, 1 if is_active else 0))
            
            qr_hash_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
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
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Получаем текущий статус и банк
            cursor.execute('''
                SELECT is_active, bank_code FROM bot_control_qrhash WHERE id = ?
            ''', (qr_id,))
            
            result = cursor.fetchone()
            if not result:
                conn.close()
                return JsonResponse({
                    'success': False,
                    'error': 'QR хеш не найден'
                })
            
            current_status, bank_code = result
            new_status = not bool(current_status)
            
            # Если активируем, деактивируем все остальные для этого банка
            if new_status:
                cursor.execute('''
                    UPDATE bot_control_qrhash 
                    SET is_active = 0 
                    WHERE bank_code = ? AND id != ?
                ''', (bank_code, qr_id))
            
            # Переключаем статус
            cursor.execute('''
                UPDATE bot_control_qrhash 
                SET is_active = ? 
                WHERE id = ?
            ''', (1 if new_status else 0, qr_id))
            
            conn.commit()
            conn.close()
            
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
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Проверяем, существует ли QR хеш
            cursor.execute('SELECT id FROM bot_control_qrhash WHERE id = ?', (qr_id,))
            if not cursor.fetchone():
                conn.close()
                return JsonResponse({
                    'success': False,
                    'error': 'QR хеш не найден'
                })
            
            # Удаляем QR хеш
            cursor.execute('DELETE FROM bot_control_qrhash WHERE id = ?', (qr_id,))
            conn.commit()
            conn.close()
            
            return JsonResponse({
                'success': True
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })
