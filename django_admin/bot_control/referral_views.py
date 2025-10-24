#!/usr/bin/env python3
"""
Views for referral system management
"""
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import sqlite3
import os
from django.conf import settings
from datetime import datetime, timedelta

def referral_management(request):
    """Страница управления реферальной системой"""
    return render(request, 'bot_control/referral_management.html')

@csrf_exempt
@require_http_methods(["GET"])
def api_referral_stats(request):
    """API для получения статистики рефералов"""
    try:
        # Путь к базе данных бота
        db_path = os.path.join(settings.BASE_DIR, '..', 'bot2', 'bot_data.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Общая статистика рефералов
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT referrer_id) as active_referrers,
                COUNT(DISTINCT referred_id) as total_referrals,
                COALESCE(SUM(rp.amount), 0) as total_paid,
                COALESCE(SUM(CASE WHEN rp.status = 'pending' THEN rp.amount ELSE 0 END), 0) as pending_payments
            FROM referrals r
            LEFT JOIN referral_payments rp ON r.referrer_id = rp.referrer_id
        """)
        
        row = cursor.fetchone()
        general_stats = {
            'active_referrers': row[0] or 0,
            'total_referrals': row[1] or 0,
            'total_paid': row[2] or 0,
            'pending_payments': row[3] or 0
        }
        
        # Статистика по уровням
        cursor.execute("""
            SELECT 
                level,
                COUNT(*) as count,
                COALESCE(SUM(rp.amount), 0) as total_earnings
            FROM referrals r
            LEFT JOIN referral_payments rp ON r.referrer_id = rp.referrer_id AND r.level = rp.level
            GROUP BY level
            ORDER BY level
        """)
        
        level_stats = {}
        for level, count, earnings in cursor.fetchall():
            level_stats[f'level_{level}'] = {
                'count': count,
                'earnings': earnings
            }
        
        # Топ рефереров
        cursor.execute("""
            SELECT 
                r.referrer_id,
                u.first_name,
                u.last_name,
                u.username,
                COUNT(r.referred_id) as referrals_count,
                COALESCE(SUM(rp.amount), 0) as total_earnings
            FROM referrals r
            LEFT JOIN users u ON r.referrer_id = u.telegram_id
            LEFT JOIN referral_payments rp ON r.referrer_id = rp.referrer_id AND rp.status = 'paid'
            GROUP BY r.referrer_id, u.first_name, u.last_name, u.username
            ORDER BY referrals_count DESC, total_earnings DESC
            LIMIT 10
        """)
        
        columns = [description[0] for description in cursor.description]
        top_referrers = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        # Настройки реферальной системы
        cursor.execute("SELECT key, value FROM referral_settings")
        settings_dict = dict(cursor.fetchall())
        
        conn.close()
        
        return JsonResponse({
            'success': True,
            'general_stats': general_stats,
            'level_stats': level_stats,
            'top_referrers': top_referrers,
            'settings': settings_dict
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def api_update_referral_settings(request):
    """API для обновления настроек реферальной системы"""
    try:
        # Валидация JSON
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON format'
            }, status=400)
        
        # Валидация обязательных полей
        required_fields = [
            'referral_enabled',
            'referral_percentage_level1', 
            'referral_percentage_level2',
            'referral_min_deposit',
            'referral_max_levels',
            'referral_payout_day'
        ]
        
        for field in required_fields:
            if field not in data:
                return JsonResponse({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }, status=400)
        
        # Валидация значений
        try:
            enabled = int(data['referral_enabled'])
            if enabled not in [0, 1]:
                raise ValueError("Invalid enabled value")
                
            percentage1 = float(data['referral_percentage_level1'])
            percentage2 = float(data['referral_percentage_level2'])
            min_deposit = int(data['referral_min_deposit'])
            max_levels = int(data['referral_max_levels'])
            payout_day = int(data['referral_payout_day'])
            
        except (ValueError, TypeError) as e:
            return JsonResponse({
                'success': False,
                'error': f'Invalid parameter values: {str(e)}'
            }, status=400)
        
        # Валидация диапазонов
        if percentage1 < 0 or percentage1 > 100:
            return JsonResponse({
                'success': False,
                'error': 'referral_percentage_level1 must be between 0 and 100'
            }, status=400)
            
        if percentage2 < 0 or percentage2 > 100:
            return JsonResponse({
                'success': False,
                'error': 'referral_percentage_level2 must be between 0 and 100'
            }, status=400)
            
        if min_deposit < 0:
            return JsonResponse({
                'success': False,
                'error': 'referral_min_deposit must be non-negative'
            }, status=400)
            
        if max_levels < 1 or max_levels > 5:
            return JsonResponse({
                'success': False,
                'error': 'referral_max_levels must be between 1 and 5'
            }, status=400)
            
        if payout_day < 1 or payout_day > 31:
            return JsonResponse({
                'success': False,
                'error': 'referral_payout_day must be between 1 and 31'
            }, status=400)
        
        # Путь к базе данных бота
        db_path = os.path.join(settings.BASE_DIR, '..', 'bot2', 'bot_data.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Обновляем настройки
        for key, value in data.items():
            if key.startswith('referral_'):
                cursor.execute("""
                    INSERT OR REPLACE INTO referral_settings (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                """, (key, str(value)))
        
        conn.commit()
        conn.close()
        
        return JsonResponse({
            'success': True,
            'message': 'Настройки реферальной системы обновлены'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def api_process_monthly_payouts(request):
    """API для обработки месячных выплат"""
    try:
        # Импортируем сервис рефералов
        import sys
        sys.path.append(os.path.join(settings.BASE_DIR, '..', 'bot2'))
        from referral_service import get_referral_service
        
        db_path = os.path.join(settings.BASE_DIR, '..', 'bot2', 'bot_data.db')
        referral_service = get_referral_service(db_path)
        
        result = referral_service.process_monthly_payouts()
        
        return JsonResponse(result)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_referral_payments(request):
    """API для получения списка выплат рефералов"""
    try:
        # Путь к базе данных бота
        db_path = os.path.join(settings.BASE_DIR, '..', 'bot2', 'bot_data.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Получаем параметры фильтрации
        status = request.GET.get('status', 'all')
        limit = int(request.GET.get('limit', 50))
        offset = int(request.GET.get('offset', 0))
        
        # Строим запрос
        query = """
            SELECT 
                rp.*,
                u1.first_name as referrer_first_name,
                u1.last_name as referrer_last_name,
                u1.username as referrer_username,
                u2.first_name as referred_first_name,
                u2.last_name as referred_last_name,
                u2.username as referred_username
            FROM referral_payments rp
            LEFT JOIN users u1 ON rp.referrer_id = u1.user_id
            LEFT JOIN users u2 ON rp.referred_id = u2.user_id
            WHERE 1=1
        """
        
        params = []
        if status != 'all':
            query += " AND rp.status = ?"
            params.append(status)
        
        query += " ORDER BY rp.created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        columns = [description[0] for description in cursor.description]
        payments = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        # Получаем общую статистику
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
                COALESCE(SUM(amount), 0) as total_amount
            FROM referral_payments
        """)
        
        stats_row = cursor.fetchone()
        stats = {
            'total': stats_row[0] or 0,
            'pending': stats_row[1] or 0,
            'paid': stats_row[2] or 0,
            'total_amount': stats_row[3] or 0
        }
        
        conn.close()
        
        return JsonResponse({
            'success': True,
            'payments': payments,
            'stats': stats,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'has_more': len(payments) == limit
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
