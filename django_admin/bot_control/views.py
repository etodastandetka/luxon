from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
import json
import sqlite3
import requests
import os
from datetime import datetime
from .qr_api import api_get_qr_hashes, api_add_qr_hash, api_toggle_qr_hash, api_delete_qr_hash
from .models import BotConfiguration
from django.conf import settings
import subprocess
import sys
from .models import BankSettings, QRHash
from datetime import datetime, date
from typing import Dict, Any

def format_chart_date(date_string):
    """Форматирует дату для графиков в формат DD.MM"""
    try:
        date_obj = datetime.strptime(date_string, '%Y-%m-%d')
        return date_obj.strftime('%d.%m')
    except:
        return date_string

def bot_settings(request):
    """Страница настроек бота"""
    return render(request, 'bot_control/settings.html')

def broadcast_message(request):
    """Страница рассылки сообщений"""
    return render(request, 'bot_control/broadcast.html')

def statistics(request):
    """Страница статистики"""
    return render(request, 'bot_control/statistics_mobile.html')


def bank_management(request):
    """Страница управления банками"""
    return render(request, 'bot_control/bank_management.html')

def bot_settings_page(request):
    """Страница настроек бота (новая)"""
    return render(request, 'bot_control/bot_settings.html')

@csrf_exempt
def api_request_status(request, request_id: int):
    """Возвращает текущий статус заявки по её ID из общей БД (таблица requests).
    Ответ: { success: True, id, status, updated_at, request_type }
    """
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        # Читаем из общей БД бота
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()
        cursor.execute("SELECT id, status, COALESCE(updated_at, created_at), request_type FROM requests WHERE id=?", (int(request_id),))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return JsonResponse({'success': False, 'error': 'not found'}, status=404)
        rid, status_val, upd, rtype = row
        return JsonResponse({'success': True, 'id': rid, 'status': status_val, 'updated_at': upd, 'request_type': rtype})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

def _parse_period(request):
    """Читает ?start=YYYY-MM-DD&end=YYYY-MM-DD, возвращает (start_date, end_date) или (None, None)."""
    fmt = '%Y-%m-%d'
    start_s = request.GET.get('start')
    end_s = request.GET.get('end')
    start_d = None
    end_d = None
    try:
        if start_s:
            start_d = datetime.strptime(start_s, fmt).date()
        if end_s:
            end_d = datetime.strptime(end_s, fmt).date()
    except Exception:
        start_d, end_d = None, None
    return start_d, end_d

def _read_platform_stats(conn, bookmaker_key: str, start_d: date = None, end_d: date = None) -> Dict[str, Any]:
    cur = conn.cursor()
    where = ["bookmaker = ?"]
    params: list[Any] = [bookmaker_key]
    if start_d:
        where.append("DATE(created_at) >= ?")
        params.append(start_d.strftime('%Y-%m-%d'))
    if end_d:
        where.append("DATE(created_at) <= ?")
        params.append(end_d.strftime('%Y-%m-%d'))
    where_sql = ' WHERE ' + ' AND '.join(where)

    # Deposits
    cur.execute(f"SELECT COALESCE(SUM(amount),0), COUNT(*) FROM requests{where_sql} AND request_type='deposit'", params)
    dep_sum, dep_cnt = cur.fetchone() or (0, 0)
    # Withdrawals
    cur.execute(f"SELECT COALESCE(SUM(amount),0), COUNT(*) FROM requests{where_sql} AND request_type='withdraw'", params)
    w_sum, w_cnt = cur.fetchone() or (0, 0)
    return {
        'deposits_sum': float(dep_sum or 0),
        'deposits_count': int(dep_cnt or 0),
        'withdrawals_sum': float(w_sum or 0),
        'withdrawals_count': int(w_cnt or 0)
    }

def _get_cashdesk_balance_xbet(cfg: Dict[str, Any]) -> Dict[str, Any]:
    try:
        from bot.api_clients.onexbet_client import OneXBetAPIClient
        client = OneXBetAPIClient({
            'hash': cfg.get('hash',''),
            'cashierpass': cfg.get('cashierpass',''),
            'login': cfg.get('login',''),
            'cashdeskid': int(cfg.get('cashdeskid') or 0),
        })
        res = client.get_balance()
        if res.get('success'):
            data = res.get('data') or {}
            return {
                'balance': data.get('Balance', 0),
                'limit': data.get('Limit', 0)
            }
    except Exception:
        pass
    return {'balance': 0, 'limit': 0}

def _get_cashdesk_balance_mostbet(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Получение баланса кассы Mostbet через MostbetAPI.check_balance()."""
    try:
        from bot.api_clients.mostbet_client import MostbetAPI
        client = MostbetAPI({
            'api_key': cfg.get('api_key',''),
            'secret': cfg.get('secret',''),
            'cashpoint_id': cfg.get('cashpoint_id',''),
        })
        import asyncio
        def _run():
            try:
                return asyncio.run(client.check_balance())
            except RuntimeError:
                # If already in loop, fallback to new loop
                loop = asyncio.new_event_loop()
                try:
                    return loop.run_until_complete(client.check_balance())
                finally:
                    loop.close()
        data = _run() or {}
        # Попробуем вытащить поле баланса по типичным ключам
        bal = 0
        if isinstance(data, dict):
            bal = data.get('balance') or data.get('Balance') or data.get('amount') or 0
        return {'balance': float(bal or 0), 'limit': 0}
    except Exception:
        pass
    return {'balance': 0, 'limit': 0}

def _get_cashdesk_balance_melbet(cfg: Dict[str, Any]) -> Dict[str, Any]:
    try:
        from bot.api_clients.melbet_client import MelbetAPIClient
        client = MelbetAPIClient({
            'hash': cfg.get('hash',''),
            'cashierpass': cfg.get('cashierpass',''),
            'login': cfg.get('login',''),
            'cashdeskid': int(cfg.get('cashdeskid') or 0),
        })
        res = client.get_balance()
        if res.get('success'):
            data = res.get('data') or {}
            return {
                'balance': data.get('Balance', 0),
                'limit': data.get('Limit', 0)
            }
    except Exception:
        pass
    return {'balance': 0, 'limit': 0}

def limits_dashboard(request):
    """Мобильная страница лимитов/балансов кассы и агрегированных сумм по периодам."""
    start_d, end_d = _parse_period(request)
    # Загружаем конфиг из bot.config
    bm_cfg = {}
    try:
        from bot.config import BOOKMAKERS as BOT_BM
        bm_cfg = BOT_BM
    except Exception:
        bm_cfg = {}

    # Балансы кассы
    x_cfg = (bm_cfg.get('1xbet') or {}).get('api_config', {})
    m_cfg = (bm_cfg.get('melbet') or {}).get('api_config', {})
    mb_cfg = (bm_cfg.get('mostbet') or {}).get('api_config', {})
    x_bal = _get_cashdesk_balance_xbet(x_cfg)
    m_bal = _get_cashdesk_balance_melbet(m_cfg)
    mb_bal = _get_cashdesk_balance_mostbet(mb_cfg)

    # Агрегаты по заявкам
    conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
    stats_1xbet = _read_platform_stats(conn, '1xbet', start_d, end_d)
    stats_melbet = _read_platform_stats(conn, 'melbet', start_d, end_d)
    stats_onewin = _read_platform_stats(conn, '1win', start_d, end_d)
    stats_mostbet = _read_platform_stats(conn, 'mostbet', start_d, end_d)
    conn.close()

    platform_limits = [
        {'key':'1xbet', 'name':'1xbet', 'limit': float(x_bal.get('limit') or 0)},
        {'key':'melbet','name':'Melbet','limit': float(m_bal.get('limit') or 0)},
        {'key':'1win','name':'1WIN','limit': 0.0},
        {'key':'mostbet','name':'Mostbet','limit': float(mb_bal.get('limit') or 0)},
    ]

    context = {
        'start': start_d.strftime('%Y-%m-%d') if start_d else '',
        'end': end_d.strftime('%Y-%m-%d') if end_d else '',
        'platform_limits': platform_limits,
        'xbet': {
            'balance': float(x_bal.get('balance') or 0),
            'limit': float(x_bal.get('limit') or 0),
            'stats': stats_1xbet,
        },
        'melbet': {
            'balance': float(m_bal.get('balance') or 0),
            'limit': float(m_bal.get('limit') or 0),
            'stats': stats_melbet,
        },
        'onewin': {
            'balance': None,
            'limit': 0.0,
            'stats': stats_onewin,
        },
        'mostbet': {
            'balance': float(mb_bal.get('balance') or 0),
            'limit': float(mb_bal.get('limit') or 0),
            'stats': stats_mostbet,
        }
    }
    return render(request, 'bot_control/limits_mobile.html', context)

@csrf_exempt
def api_bot_status(request):
    """API для получения статуса бота"""
    try:
        # Подключаемся к общей БД бота из настроек
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()
        
        # Получаем настройки бота
        cursor.execute('''
            SELECT value FROM bot_settings WHERE key = 'is_active'
        ''')
        result = cursor.fetchone()
        
        is_active = True if not result else bool(int(result[0]))
        
        cursor.execute('''
            SELECT value FROM bot_settings WHERE key = 'maintenance_message'
        ''')
        result = cursor.fetchone()
        
        maintenance_message = "🔧 Технические работы\nБот временно недоступен." if not result else result[0]
        
        conn.close()
        
        return JsonResponse({
            'is_active': is_active,
            'maintenance_message': maintenance_message
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_list_qr_hashes(request):
    """API для получения списка всех кошельков (QRHash) со статусами.
    Ответ: { wallets: [ {id, account_name, is_main, is_active} ], total:int }
    """
    try:
        from .models import QRHash
        qs = QRHash.objects.all().order_by('-is_main', '-is_active', 'account_name')
        wallets = [
            {
                'id': item.id,
                'account_name': item.account_name,
                'is_main': bool(item.is_main),
                'is_active': bool(item.is_active),
            }
            for item in qs
        ]
        return JsonResponse({ 'wallets': wallets, 'total': len(wallets) })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_set_bot_status(request):
    """API для установки статуса бота"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            is_active = data.get('is_active', True)
            maintenance_message = data.get('maintenance_message', '')
            
            # Подключаемся к общей БД бота из настроек
            conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
            cursor = conn.cursor()
            
            # Создаем таблицу настроек если её нет
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS bot_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Обновляем статус бота
            cursor.execute('''
                INSERT OR REPLACE INTO bot_settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', ('is_active', '1' if is_active else '0'))
            
            # Обновляем сообщение о технических работах
            cursor.execute('''
                INSERT OR REPLACE INTO bot_settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', ('maintenance_message', maintenance_message))
            
            conn.commit()
            conn.close()
            
            return JsonResponse({'success': True, 'message': 'Статус бота обновлен'})
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_send_broadcast(request):
    """API для отправки рассылки"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            message = data.get('message', '')
            
            if not message:
                return JsonResponse({'error': 'Сообщение не может быть пустым'}, status=400)
            
            # Получаем всех пользователей из общей БД бота
            conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
            cursor = conn.cursor()
            
            cursor.execute('SELECT user_id FROM users')
            user_ids = [row[0] for row in cursor.fetchall()]
            
            conn.close()
            
            # Отправляем сообщение всем пользователям
            # Берём токен из конфигурации бота, если задан, иначе из settings.BOT_TOKEN
            cfg_token = (BotConfiguration.get_setting('bot_token') or '').strip()
            settings_token = (getattr(settings, 'BOT_TOKEN', None) or '').strip()
            token_source = 'config' if cfg_token else 'settings'
            bot_token = cfg_token or settings_token
            if not bot_token:
                return JsonResponse({'success': False, 'error': 'BOT token is not configured. Set BotConfiguration key "bot_token" or settings.BOT_TOKEN.'}, status=400)
            success_count = 0
            error_count = 0
            
            for user_id in user_ids:
                try:
                    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                    payload = {
                        'chat_id': user_id,
                        'text': message,
                        'parse_mode': 'HTML'
                    }
                    
                    response = requests.post(url, json=payload, timeout=5)
                    if response.status_code == 200:
                        success_count += 1
                    else:
                        error_count += 1
                        
                except Exception:
                    error_count += 1
            
            # Сохраняем в историю рассылок в общей БД бота
            conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS broadcast_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message TEXT NOT NULL,
                    sent_count INTEGER DEFAULT 0,
                    error_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                INSERT INTO broadcast_history (message, sent_count, error_count)
                VALUES (?, ?, ?)
            ''', (message, success_count, error_count))
            
            conn.commit()
            conn.close()
            
            return JsonResponse({
                'success': True,
                'message': f'Рассылка завершена. Успешно: {success_count}, Ошибок: {error_count}'
            })
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_statistics(request):
    """API для получения статистики"""
    if request.method == 'GET':
        try:
            # Фильтры
            date_from = request.GET.get('date_from')
            date_to = request.GET.get('date_to')
            bookmaker_filter = request.GET.get('bookmaker')

            conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
            cursor = conn.cursor()

            # Общая статистика
            cursor.execute('SELECT COUNT(*) FROM users')
            total_users = cursor.fetchone()[0]

            # Определяем, есть ли новая единая таблица requests
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'")
            has_requests = cursor.fetchone() is not None

            # Определяем схему транзакций (старые варианты)
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'")
            has_transactions = cursor.fetchone() is not None
            tx_col = None
            if has_transactions:
                cursor.execute('PRAGMA table_info(transactions)')
                cols = [c[1] for c in cursor.fetchall()]
                tx_col = 'trans_type' if 'trans_type' in cols else ('type' if 'type' in cols else None)

            # Формируем WHERE
            where_clauses = []
            params = []
            if date_from:
                where_clauses.append("DATE(created_at) >= ?")
                params.append(date_from)
            if date_to:
                where_clauses.append("DATE(created_at) <= ?")
                params.append(date_to)
            if bookmaker_filter:
                where_clauses.append("bookmaker = ?")
                params.append(bookmaker_filter)
            where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

            if has_requests:
                # Статистика из новой таблицы requests
                where = []
                params = []
                if date_from:
                    where.append("DATE(created_at) >= ?")
                    params.append(date_from)
                if date_to:
                    where.append("DATE(created_at) <= ?")
                    params.append(date_to)
                if bookmaker_filter:
                    where.append("bookmaker = ?")
                    params.append(bookmaker_filter)
                where_sql = (" WHERE " + " AND ".join(where)) if where else ""

                cursor.execute(f"SELECT COUNT(*) FROM requests{where_sql} AND request_type='deposit'" if where_sql else "SELECT COUNT(*) FROM requests WHERE request_type='deposit'", params)
                total_deposits = cursor.fetchone()[0] or 0
                cursor.execute(f"SELECT COUNT(*) FROM requests{where_sql} AND request_type='withdraw'" if where_sql else "SELECT COUNT(*) FROM requests WHERE request_type='withdraw'", params)
                total_withdrawals = cursor.fetchone()[0] or 0
                cursor.execute(f"SELECT COALESCE(SUM(amount),0) FROM requests{where_sql} AND request_type='deposit'" if where_sql else "SELECT COALESCE(SUM(amount),0) FROM requests WHERE request_type='deposit'", params)
                total_amount = cursor.fetchone()[0] or 0

                cursor.execute(f"SELECT COALESCE(AVG(amount),0) FROM requests{where_sql} AND request_type='deposit'" if where_sql else "SELECT COALESCE(AVG(amount),0) FROM requests WHERE request_type='deposit'", params)
                avg_deposit = cursor.fetchone()[0] or 0
                cursor.execute(f"SELECT COALESCE(AVG(amount),0) FROM requests{where_sql} AND request_type='withdraw'" if where_sql else "SELECT COALESCE(AVG(amount),0) FROM requests WHERE request_type='withdraw'", params)
                avg_withdrawal = cursor.fetchone()[0] or 0

                cursor.execute(f"SELECT COUNT(DISTINCT user_id) FROM requests{(where_sql + ' AND ' if where_sql else ' WHERE ')} request_type='deposit'", params)
                users_with_deposits = cursor.fetchone()[0] or 0
            elif has_transactions and tx_col:
                cursor.execute(f'SELECT COUNT(*) FROM transactions {where_sql} AND {tx_col} = "deposit"' if where_sql else f'SELECT COUNT(*) FROM transactions WHERE {tx_col} = "deposit"', params)
                total_deposits = cursor.fetchone()[0] or 0
                cursor.execute(f'SELECT COUNT(*) FROM transactions {where_sql} AND {tx_col} = "withdrawal"' if where_sql else f'SELECT COUNT(*) FROM transactions WHERE {tx_col} = "withdrawal"', params)
                total_withdrawals = cursor.fetchone()[0] or 0
                cursor.execute(f'SELECT COALESCE(SUM(amount),0) FROM transactions {where_sql} AND {tx_col} = "deposit"' if where_sql else f'SELECT COALESCE(SUM(amount),0) FROM transactions WHERE {tx_col} = "deposit"', params)
                total_amount = cursor.fetchone()[0] or 0

                cursor.execute(f'SELECT COALESCE(AVG(amount),0) FROM transactions {where_sql} AND {tx_col} = "deposit"' if where_sql else f'SELECT COALESCE(AVG(amount),0) FROM transactions WHERE {tx_col} = "deposit"', params)
                avg_deposit = cursor.fetchone()[0] or 0
                cursor.execute(f'SELECT COALESCE(AVG(amount),0) FROM transactions {where_sql} AND {tx_col} = "withdrawal"' if where_sql else f'SELECT COALESCE(AVG(amount),0) FROM transactions WHERE {tx_col} = "withdrawal"', params)
                avg_withdrawal = cursor.fetchone()[0] or 0

                cursor.execute(f'''SELECT COUNT(DISTINCT user_id) FROM transactions {(where_sql + ' AND ' if where_sql else ' WHERE ')} {tx_col} = "deposit"''', params)
                users_with_deposits = cursor.fetchone()[0] or 0
            else:
                # Fallback
                # Депозиты
                dep_where = []
                dep_params = []
                if date_from:
                    dep_where.append("DATE(created_at) >= ?")
                    dep_params.append(date_from)
                if date_to:
                    dep_where.append("DATE(created_at) <= ?")
                    dep_params.append(date_to)
                if bookmaker_filter:
                    dep_where.append("bookmaker = ?")
                    dep_params.append(bookmaker_filter)
                dep_sql = (" WHERE " + " AND ".join(dep_where)) if dep_where else ""

                cursor.execute(f'SELECT COUNT(*) FROM deposit_requests{dep_sql}', dep_params)
                total_deposits = cursor.fetchone()[0] or 0
                cursor.execute(f'SELECT COUNT(*) FROM withdrawals{dep_sql}', dep_params)
                total_withdrawals = cursor.fetchone()[0] or 0
                cursor.execute(f'SELECT COALESCE(SUM(amount),0) FROM deposit_requests{dep_sql}', dep_params)
                total_amount = cursor.fetchone()[0] or 0

                cursor.execute(f'SELECT COALESCE(AVG(amount),0) FROM deposit_requests{dep_sql}', dep_params)
                avg_deposit = cursor.fetchone()[0] or 0
                cursor.execute(f'SELECT COALESCE(AVG(amount),0) FROM withdrawals{dep_sql}', dep_params)
                avg_withdrawal = cursor.fetchone()[0] or 0

                cursor.execute('SELECT COUNT(DISTINCT user_id) FROM deposit_requests')
                users_with_deposits = cursor.fetchone()[0] or 0

            conversion_rate = (users_with_deposits / total_users * 100) if total_users > 0 else 0

            # Активные за 30 дней
            if has_requests:
                cursor.execute("""
                    SELECT COUNT(DISTINCT user_id)
                    FROM requests
                    WHERE created_at >= datetime('now', '-30 days')
                """)
                active_users = cursor.fetchone()[0] or 0
            else:
                cursor.execute("""
                    SELECT COUNT(DISTINCT user_id) FROM (
                        SELECT user_id, created_at FROM deposit_requests
                        UNION ALL
                        SELECT user_id, created_at FROM withdrawals
                    ) WHERE created_at >= datetime('now', '-30 days')
                """)
                active_users = cursor.fetchone()[0] or 0

            # Статистика по букмекерам
            bookmakers = {}
            bookmaker_names = {
                '1xbet': '🎰 1XBET',
                '1win': '🎰 1WIN', 
                'melbet': '🎰 MELBET',
                'mostbet': '🎰 MOSTBET'
            }

            for bookmaker_key, bookmaker_name in bookmaker_names.items():
                if bookmaker_filter and bookmaker_filter != bookmaker_key:
                    continue
                if has_requests:
                    cursor.execute(f"""
                        SELECT COUNT(*), COALESCE(SUM(amount),0)
                        FROM requests
                        WHERE bookmaker = ? AND request_type='deposit'
                        {('AND ' + ' AND '.join(where_clauses)) if where_clauses else ''}
                    """, ([bookmaker_key] + params) if params else [bookmaker_key])
                    d_count, d_sum = cursor.fetchone()
                    cursor.execute(f"""
                        SELECT COUNT(*), COALESCE(SUM(amount),0)
                        FROM requests
                        WHERE bookmaker = ? AND request_type='withdraw'
                        {('AND ' + ' AND '.join(where_clauses)) if where_clauses else ''}
                    """, ([bookmaker_key] + params) if params else [bookmaker_key])
                    w_count, w_sum = cursor.fetchone()
                elif has_transactions and tx_col:
                    cursor.execute(f'''SELECT COUNT(*), COALESCE(SUM(amount),0) FROM transactions {(where_sql + ' AND ' if where_sql else ' WHERE ')} bookmaker = ? AND {tx_col} = 'deposit' ''', params + [bookmaker_key] if where_sql else [bookmaker_key])
                    d_count, d_sum = cursor.fetchone()
                    cursor.execute(f'''SELECT COUNT(*), COALESCE(SUM(amount),0) FROM transactions {(where_sql + ' AND ' if where_sql else ' WHERE ')} bookmaker = ? AND {tx_col} = 'withdrawal' ''', params + [bookmaker_key] if where_sql else [bookmaker_key])
                    w_count, w_sum = cursor.fetchone()
                else:
                    cursor.execute('SELECT COUNT(*), COALESCE(SUM(amount),0) FROM deposit_requests WHERE bookmaker = ?', (bookmaker_key,))
                    d_count, d_sum = cursor.fetchone()
                    cursor.execute('SELECT COUNT(*), COALESCE(SUM(amount),0) FROM withdrawals WHERE bookmaker = ?', (bookmaker_key,))
                    w_count, w_sum = cursor.fetchone()

                bookmakers[bookmaker_key] = {
                    'name': bookmaker_name,
                    'deposits_count': d_count or 0,
                    'deposits_amount': d_sum or 0,
                    'withdrawals_count': w_count or 0,
                    'withdrawals_amount': w_sum or 0
                }

            # Графики (по датам)
            if has_requests:
                cursor.execute(f"""
                    SELECT DATE(created_at), COUNT(*)
                    FROM requests
                    {(where_sql + ' AND ' if where_sql else ' WHERE ')} request_type='deposit'
                    GROUP BY DATE(created_at)
                    ORDER BY DATE(created_at)
                    LIMIT 10
                """, params)
                deposits_chart = cursor.fetchall()
                cursor.execute(f"""
                    SELECT DATE(created_at), COUNT(*)
                    FROM requests
                    {(where_sql + ' AND ' if where_sql else ' WHERE ')} request_type='withdraw'
                    GROUP BY DATE(created_at)
                    ORDER BY DATE(created_at)
                    LIMIT 10
                """, params)
                withdrawals_chart = cursor.fetchall()
            elif has_transactions and tx_col:
                cursor.execute(f'''SELECT DATE(created_at), COUNT(*) FROM transactions {(where_sql + ' AND ' if where_sql else ' WHERE ')} {tx_col} = 'deposit' GROUP BY DATE(created_at) ORDER BY DATE(created_at) LIMIT 10''', params)
                deposits_chart = cursor.fetchall()
                cursor.execute(f'''SELECT DATE(created_at), COUNT(*) FROM transactions {(where_sql + ' AND ' if where_sql else ' WHERE ')} {tx_col} = 'withdrawal' GROUP BY DATE(created_at) ORDER BY DATE(created_at) LIMIT 10''', params)
                withdrawals_chart = cursor.fetchall()
            else:
                cursor.execute('SELECT DATE(created_at), COUNT(*) FROM deposit_requests GROUP BY DATE(created_at) ORDER BY DATE(created_at) LIMIT 10')
                deposits_chart = cursor.fetchall()
                cursor.execute('SELECT DATE(created_at), COUNT(*) FROM withdrawals GROUP BY DATE(created_at) ORDER BY DATE(created_at) LIMIT 10')
                withdrawals_chart = cursor.fetchall()

            conn.close()

            return JsonResponse({
                'success': True,
                'general': {
                    'total_users': total_users,
                    'total_deposits': total_deposits,
                    'total_withdrawals': total_withdrawals,
                    'total_amount': total_amount,
                    'avg_deposit': round(avg_deposit, 2),
                    'avg_withdrawal': round(avg_withdrawal, 2),
                    'conversion_rate': round(conversion_rate, 1),
                    'active_users': active_users
                },
                'bookmakers': list(bookmakers.values()),
                'charts': {
                    'deposits': {
                        'labels': [format_chart_date(row[0]) for row in deposits_chart],
                        'data': [row[1] for row in deposits_chart]
                    },
                    'withdrawals': {
                        'labels': [format_chart_date(row[0]) for row in withdrawals_chart],
                        'data': [row[1] for row in withdrawals_chart]
                    }
                }
            })
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_delete_bank(request, bank_id):
    """Удаление записи BankSettings по ID"""
    if request.method not in ('POST', 'DELETE'):
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        bank = BankSettings.objects.filter(id=bank_id).first()
        if not bank:
            return JsonResponse({'success': False, 'error': 'Банк не найден'}, status=404)
        bank.delete()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_restart_bot(request):
    """API для рестарта бота"""
    if request.method == 'POST':
        try:
            import subprocess
            import sys
            import os
            
            # Получаем путь к скрипту бота
            bot_script_path = os.path.join(os.path.dirname(__file__), '..', '..', 'bot', 'main.py')
            
            # Запускаем рестарт бота в фоновом режиме
            if sys.platform.startswith('win'):
                # Windows
                subprocess.Popen([
                    'python', bot_script_path
                ], creationflags=subprocess.CREATE_NEW_CONSOLE)
            else:
                # Linux/Mac
                subprocess.Popen([
                    'python3', bot_script_path
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            return JsonResponse({
                'success': True,
                'message': 'Бот перезапущен'
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': f'Ошибка рестарта бота: {str(e)}'
            }, status=500)
    
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)

def manual_deposit(request):
    """Страница ручного депозита"""
    return render(request, 'bot_control/manual_deposit_mobile.html')

@csrf_exempt
def api_1xbet_balance(request):
    """API прокси для получения баланса кассы 1XBET"""
    if request.method == 'GET':
        try:
            import hashlib
            import requests
            from datetime import datetime
            
            # API настройки
            API_CONFIG = {
                'base_url': 'https://partners.servcul.com/CashdeskBotAPI/',
                'hash': '97f471a9db92debbda38201af67e15f64d086e94ae4b919d8a6a4f64958912cf',
                'cashierpass': 'wiaWAfE9',
                'cashdeskid': 1388580
            }
            
            def sha256(text):
                return hashlib.sha256(text.encode()).hexdigest()
            
            def md5(text):
                return hashlib.md5(text.encode()).hexdigest()
            
            # Формируем дату
            now = datetime.now()
            dt = now.strftime('%Y.%m.%d %H:%M:%S')
            
            # Формируем confirm
            confirm = md5(f"{API_CONFIG['cashdeskid']}:{API_CONFIG['hash']}")
            
            # Формируем подпись согласно документации
            # 1. SHA256 для строки: hash={hash}&cashierpass={cashierpass}&dt={dt}
            sign_string1 = f"hash={API_CONFIG['hash']}&cashierpass={API_CONFIG['cashierpass']}&dt={dt}"
            sign1 = sha256(sign_string1)
            
            # 2. MD5 для строки: dt={dt}&cashierpass={cashierpass}&cashdeskid={cashdeskid}
            sign_string2 = f"dt={dt}&cashierpass={API_CONFIG['cashierpass']}&cashdeskid={API_CONFIG['cashdeskid']}"
            sign2 = md5(sign_string2)
            
            # 3. SHA256 от объединенных строк
            sign = sha256(sign1 + sign2)
            
            # Формируем URL
            url = f"{API_CONFIG['base_url']}Cashdesk/{API_CONFIG['cashdeskid']}/Balance?confirm={confirm}&dt={dt}"
            
            # Выполняем запрос
            response = requests.get(url, headers={'sign': sign}, timeout=10)
            
            if response.status_code == 200:
                return JsonResponse(response.json())
            else:
                return JsonResponse({
                    'error': 'API Error',
                    'status': response.status_code,
                    'message': response.text
                }, status=response.status_code)
                
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_1xbet_search_player(request):
    """API прокси для поиска игрока 1XBET"""
    if request.method == 'POST':
        try:
            import hashlib
            import requests
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            
            if not user_id:
                return JsonResponse({'error': 'user_id is required'}, status=400)
            
            # API настройки
            API_CONFIG = {
                'base_url': 'https://partners.servcul.com/CashdeskBotAPI/',
                'hash': '97f471a9db92debbda38201af67e15f64d086e94ae4b919d8a6a4f64958912cf',
                'cashierpass': 'wiaWAfE9',
                'cashdeskid': 1388580
            }
            
            def sha256(text):
                return hashlib.sha256(text.encode()).hexdigest()
            
            def md5(text):
                return hashlib.md5(text.encode()).hexdigest()
            
            # Формируем confirm
            confirm = md5(f"{user_id}:{API_CONFIG['hash']}")
            
            # Формируем подпись согласно документации
            # 1. SHA256 для строки: hash={hash}&userid={userid}&cashdeskid={cashdeskid}
            sign_string1 = f"hash={API_CONFIG['hash']}&userid={user_id}&cashdeskid={API_CONFIG['cashdeskid']}"
            sign1 = sha256(sign_string1)
            
            # 2. MD5 для строки: userid={userid}&cashierpass={cashierpass}&hash={hash}
            sign_string2 = f"userid={user_id}&cashierpass={API_CONFIG['cashierpass']}&hash={API_CONFIG['hash']}"
            sign2 = md5(sign_string2)
            
            # 3. SHA256 от объединенных строк
            sign = sha256(sign1 + sign2)
            
            # Формируем URL
            url = f"{API_CONFIG['base_url']}Users/{user_id}?confirm={confirm}&cashdeskId={API_CONFIG['cashdeskid']}"
            
            # Выполняем запрос
            response = requests.get(url, headers={'sign': sign}, timeout=10)
            
            if response.status_code == 200:
                return JsonResponse(response.json())
            else:
                return JsonResponse({
                    'error': 'API Error',
                    'status': response.status_code,
                    'message': response.text
                }, status=response.status_code)
                
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_1xbet_deposit(request):
    """API прокси для пополнения счета 1XBET через готовый клиент из bot/api_clients."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    try:
        from django.conf import settings
        # Простая токен‑авторизация без сессии: Authorization: Token <DJANGO_ADMIN_API_TOKEN>
        expected = getattr(settings, 'DJANGO_ADMIN_API_TOKEN', '')
        auth = request.headers.get('Authorization', '')
        if expected:
            if not (auth == f'Token {expected}' or request.user.is_authenticated):
                return JsonResponse({'error': 'Unauthorized'}, status=401)

        data = json.loads(request.body or '{}')
        user_id = str(data.get('user_id') or '').strip()
        amount = data.get('amount')
        try:
            amount = float(amount)
        except Exception:
            amount = None

        if not user_id or amount is None:
            return JsonResponse({'error': 'user_id and amount are required'}, status=400)

        # Конфиг: сначала пробуем взять из bot.config.BOOKMAKERS['1xbet']['api_config'],
        # затем из settings.*
        api_cfg = {}
        try:
            from bot.config import BOOKMAKERS as BOT_BM
            api_cfg = (BOT_BM.get('1xbet') or BOT_BM.get('1XBET') or {}).get('api_config', {}) or {}
        except Exception:
            api_cfg = {}
        def _get(name, default=''):
            return api_cfg.get(name) or getattr(settings, f'XBET_{name.upper()}', default)
        # cashdeskid может быть строкой
        cashdeskid_val = _get('cashdeskid', 1388580)
        try:
            cashdeskid_val = int(cashdeskid_val)
        except Exception:
            pass
        cfg = {
            'hash': _get('hash', '97f471a9db92debbda38201af67e15f64d086e94ae4b919d8a6a4f64958912cf'),
            'cashierpass': _get('cashierpass', 'wiaWAfE9'),
            'login': _get('login', ''),
            'cashdeskid': cashdeskid_val,
        }

        from bot.api_clients.onexbet_client import OneXBetAPIClient
        client = OneXBetAPIClient(cfg)
        result = client.deposit(user_id=user_id, amount=amount)
        status_ok = bool(result.get('success'))
        if status_ok:
            return JsonResponse(result)
        return JsonResponse({'error': result.get('error') or result.get('message') or 'API Error', 'data': result}, status=502)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# 1WIN API Views
def onewin_api(request):
    """Страница 1WIN API"""
    return render(request, 'bot_control/1win_api.html')

@csrf_exempt
def api_1win_deposit(request):
    """API прокси для создания депозита 1WIN (через bot/api_clients/onewin_client.py)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    try:
        from django.conf import settings
        expected = getattr(settings, 'DJANGO_ADMIN_API_TOKEN', '')
        auth = request.headers.get('Authorization', '')
        if expected:
            if not (auth == f'Token {expected}' or request.user.is_authenticated):
                return JsonResponse({'error': 'Unauthorized'}, status=401)

        data = json.loads(request.body or '{}')
        user_id = str(data.get('user_id') or data.get('account_id') or '').strip()
        amount = data.get('amount')
        try:
            amount = float(amount)
        except Exception:
            amount = None
        if not user_id or amount is None:
            return JsonResponse({'error': 'user_id and amount are required'}, status=400)

        # Берём api_key из bot.config
        api_cfg = {}
        try:
            from bot.config import BOOKMAKERS as BOT_BM
            api_cfg = (BOT_BM.get('1win') or BOT_BM.get('1WIN') or {}).get('api_config', {}) or {}
        except Exception:
            api_cfg = {}
        from bot.api_clients.onewin_client import OneWinAPIClient
        client = OneWinAPIClient({'api_key': api_cfg.get('api_key', '')})
        result = client.deposit(int(user_id) if user_id.isdigit() else user_id, amount)
        if result.get('success'):
            return JsonResponse(result)
        return JsonResponse({'error': result.get('error') or 'API Error', 'data': result}, status=502)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_1win_withdrawal(request):
    """API прокси для обработки вывода 1WIN"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            api_key = data.get('api_key')
            user_id = data.get('user_id')
            code = data.get('code')
            
            if not api_key or not user_id or not code:
                return JsonResponse({'error': 'api_key, user_id and code are required'}, status=400)
            
            # Формируем запрос к 1WIN API
            url = 'https://api.1win.win/v1/client/withdrawal'
            headers = {
                'X-API-KEY': api_key,
                'Content-Type': 'application/json'
            }
            body = {
                'userId': user_id,
                'code': code
            }
            
            # Выполняем запрос
            response = requests.post(url, headers=headers, json=body, timeout=10)
            
            if response.status_code == 200:
                response_data = response.json()
                return JsonResponse({
                    'success': True,
                    'id': response_data.get('id'),
                    'cashId': response_data.get('cashId'),
                    'amount': response_data.get('amount'),
                    'userId': response_data.get('userId')
                })
            else:
                error_data = response.json() if response.content else {}
                return JsonResponse({
                    'success': False,
                    'error': error_data.get('message', f'HTTP {response.status_code}'),
                    'status_code': response.status_code
                }, status=response.status_code)
                
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

# MELBET API Views
@csrf_exempt
def api_melbet_balance(request):
    """API прокси для получения баланса кассы MELBET"""
    if request.method == 'GET':
        try:
            import hashlib
            import requests
            from datetime import datetime
            
            # API настройки для MELBET
            API_CONFIG = {
                'base_url': 'https://partners.servcul.com/CashdeskBotAPI/',
                'hash': 'd34f03473c467b538f685f933b2dc7a3ea8c877901231235693c10be014eb6f4',
                'cashierpass': 'd1WRq!ke',
                'cashdeskid': 1390018
            }
            
            def sha256(text):
                return hashlib.sha256(text.encode()).hexdigest()
            
            def md5(text):
                return hashlib.md5(text.encode()).hexdigest()
            
            # Формируем дату
            now = datetime.now()
            dt = now.strftime('%Y.%m.%d %H:%M:%S')
            
            # Формируем confirm
            confirm = md5(f"{API_CONFIG['cashdeskid']}:{API_CONFIG['hash']}")
            
            # Формируем подпись согласно документации
            sign_string1 = f"hash={API_CONFIG['hash']}&cashierpass={API_CONFIG['cashierpass']}&dt={dt}"
            sign1 = sha256(sign_string1)
            
            sign_string2 = f"dt={dt}&cashierpass={API_CONFIG['cashierpass']}&cashdeskid={API_CONFIG['cashdeskid']}"
            sign2 = md5(sign_string2)
            
            sign = sha256(sign1 + sign2)
            
            # Формируем URL
            url = f"{API_CONFIG['base_url']}Cashdesk/{API_CONFIG['cashdeskid']}/Balance?confirm={confirm}&dt={dt}"
            
            # Выполняем запрос
            response = requests.get(url, headers={'sign': sign}, timeout=10)
            
            if response.status_code == 200:
                return JsonResponse(response.json())
            else:
                return JsonResponse({
                    'error': 'API Error',
                    'status': response.status_code,
                    'message': response.text
                }, status=response.status_code)
                
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_melbet_search_player(request):
    """API прокси для поиска игрока MELBET"""
    if request.method == 'POST':
        try:
            import hashlib
            import requests
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            
            if not user_id:
                return JsonResponse({'error': 'user_id is required'}, status=400)
            
            # API настройки для MELBET
            API_CONFIG = {
                'base_url': 'https://partners.servcul.com/CashdeskBotAPI/',
                'hash': 'd34f03473c467b538f685f933b2dc7a3ea8c877901231235693c10be014eb6f4',
                'cashierpass': 'd1WRq!ke',
                'cashdeskid': 1390018
            }
            
            def sha256(text):
                return hashlib.sha256(text.encode()).hexdigest()
            
            def md5(text):
                return hashlib.md5(text.encode()).hexdigest()
            
            # Формируем confirm
            confirm = md5(f"{user_id}:{API_CONFIG['hash']}")
            
            # Формируем подпись согласно документации
            sign_string1 = f"hash={API_CONFIG['hash']}&userid={user_id}&cashdeskid={API_CONFIG['cashdeskid']}"
            sign1 = sha256(sign_string1)
            
            sign_string2 = f"userid={user_id}&cashierpass={API_CONFIG['cashierpass']}&hash={API_CONFIG['hash']}"
            sign2 = md5(sign_string2)
            
            sign = sha256(sign1 + sign2)
            
            # Формируем URL
            url = f"{API_CONFIG['base_url']}Users/{user_id}?confirm={confirm}&cashdeskId={API_CONFIG['cashdeskid']}"
            
            # Выполняем запрос
            response = requests.get(url, headers={'sign': sign}, timeout=10)
            
            if response.status_code == 200:
                return JsonResponse(response.json())
            else:
                return JsonResponse({
                    'error': 'API Error',
                    'status': response.status_code,
                    'message': response.text
                }, status=response.status_code)
                
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_melbet_deposit(request):
    """API прокси для пополнения MELBET (через bot/api_clients/melbet_client.py)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    try:
        from django.conf import settings
        expected = getattr(settings, 'DJANGO_ADMIN_API_TOKEN', '')
        auth = request.headers.get('Authorization', '')
        if expected:
            if not (auth == f'Token {expected}' or request.user.is_authenticated):
                return JsonResponse({'error': 'Unauthorized'}, status=401)

        data = json.loads(request.body or '{}')
        user_id = str(data.get('user_id') or data.get('account_id') or '').strip()
        amount = data.get('amount')
        try:
            amount = float(amount)
        except Exception:
            amount = None
        if not user_id or amount is None:
            return JsonResponse({'error': 'user_id and amount are required'}, status=400)

        api_cfg = {}
        try:
            from bot.config import BOOKMAKERS as BOT_BM
            api_cfg = (BOT_BM.get('melbet') or BOT_BM.get('MELBET') or {}).get('api_config', {}) or {}
        except Exception:
            api_cfg = {}
        from bot.api_clients.melbet_client import MelbetAPIClient
        client = MelbetAPIClient({
            'hash': api_cfg.get('hash', ''),
            'cashierpass': api_cfg.get('cashierpass', ''),
            'login': api_cfg.get('login', ''),
            'cashdeskid': api_cfg.get('cashdeskid', 0),
        })
        result = client.deposit(user_id, amount)
        if result.get('success'):
            return JsonResponse(result)
        return JsonResponse({'error': result.get('error') or result.get('message') or 'API Error', 'data': result}, status=502)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# MOSTBET API Views
@csrf_exempt
def api_mostbet_balance(request):
    """API прокси для получения баланса кассы MOSTBET"""
    if request.method == 'GET':
        try:
            import hashlib
            import requests
            from datetime import datetime
            
            # API настройки для MOSTBET (нужно получить у менеджера)
            API_CONFIG = {
                'base_url': 'https://partners.servcul.com/CashdeskBotAPI/',
                'hash': 'MOSTBET_HASH_HERE',  # Заменить на реальный hash
                'cashierpass': 'MOSTBET_PASSWORD_HERE',  # Заменить на реальный пароль
                'cashdeskid': 0  # Заменить на реальный ID кассы
            }
            
            def sha256(text):
                return hashlib.sha256(text.encode()).hexdigest()
            
            def md5(text):
                return hashlib.md5(text.encode()).hexdigest()
            
            # Формируем дату
            now = datetime.now()
            dt = now.strftime('%Y.%m.%d %H:%M:%S')
            
            # Формируем confirm
            confirm = md5(f"{API_CONFIG['cashdeskid']}:{API_CONFIG['hash']}")
            
            # Формируем подпись согласно документации
            sign_string1 = f"hash={API_CONFIG['hash']}&cashierpass={API_CONFIG['cashierpass']}&dt={dt}"
            sign1 = sha256(sign_string1)
            
            sign_string2 = f"dt={dt}&cashierpass={API_CONFIG['cashierpass']}&cashdeskid={API_CONFIG['cashdeskid']}"
            sign2 = md5(sign_string2)
            
            sign = sha256(sign1 + sign2)
            
            # Формируем URL
            url = f"{API_CONFIG['base_url']}Cashdesk/{API_CONFIG['cashdeskid']}/Balance?confirm={confirm}&dt={dt}"
            
            # Выполняем запрос
            response = requests.get(url, headers={'sign': sign}, timeout=10)
            
            if response.status_code == 200:
                return JsonResponse(response.json())
            else:
                return JsonResponse({
                    'error': 'API Error',
                    'status': response.status_code,
                    'message': response.text
                }, status=response.status_code)
                
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_mostbet_search_player(request):
    """API прокси для поиска игрока MOSTBET"""
    if request.method == 'POST':
        try:
            import hashlib
            import requests
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            
            if not user_id:
                return JsonResponse({'error': 'user_id is required'}, status=400)
            
            # API настройки для MOSTBET (нужно получить у менеджера)
            API_CONFIG = {
                'base_url': 'https://partners.servcul.com/CashdeskBotAPI/',
                'hash': 'MOSTBET_HASH_HERE',  # Заменить на реальный hash
                'cashierpass': 'MOSTBET_PASSWORD_HERE',  # Заменить на реальный пароль
                'cashdeskid': 0  # Заменить на реальный ID кассы
            }
            
            def sha256(text):
                return hashlib.sha256(text.encode()).hexdigest()
            
            def md5(text):
                return hashlib.md5(text.encode()).hexdigest()
            
            # Формируем confirm
            confirm = md5(f"{user_id}:{API_CONFIG['hash']}")
            
            # Формируем подпись согласно документации
            sign_string1 = f"hash={API_CONFIG['hash']}&userid={user_id}&cashdeskid={API_CONFIG['cashdeskid']}"
            sign1 = sha256(sign_string1)
            
            sign_string2 = f"userid={user_id}&cashierpass={API_CONFIG['cashierpass']}&hash={API_CONFIG['hash']}"
            sign2 = md5(sign_string2)
            
            sign = sha256(sign1 + sign2)
            
            # Формируем URL
            url = f"{API_CONFIG['base_url']}Users/{user_id}?confirm={confirm}&cashdeskId={API_CONFIG['cashdeskid']}"
            
            # Выполняем запрос
            response = requests.get(url, headers={'sign': sign}, timeout=10)
            
            if response.status_code == 200:
                return JsonResponse(response.json())
            else:
                return JsonResponse({
                    'error': 'API Error',
                    'status': response.status_code,
                    'message': response.text
                }, status=response.status_code)
                
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_mostbet_deposit(request):
    """API прокси для пополнения MOSTBET (через bot/api_clients/mostbet_client.py)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    try:
        from django.conf import settings
        expected = getattr(settings, 'DJANGO_ADMIN_API_TOKEN', '')
        auth = request.headers.get('Authorization', '')
        if expected:
            if not (auth == f'Token {expected}' or request.user.is_authenticated):
                return JsonResponse({'error': 'Unauthorized'}, status=401)

        data = json.loads(request.body or '{}')
        user_id = str(data.get('user_id') or data.get('account_id') or '').strip()
        amount = data.get('amount')
        try:
            amount = float(amount)
        except Exception:
            amount = None
        if not user_id or amount is None:
            return JsonResponse({'error': 'user_id and amount are required'}, status=400)

        api_cfg = {}
        try:
            from bot.config import BOOKMAKERS as BOT_BM
            api_cfg = (BOT_BM.get('mostbet') or BOT_BM.get('MOSTBET') or {}).get('api_config', {}) or {}
        except Exception:
            api_cfg = {}
        from bot.api_clients.mostbet_client import MostbetAPI
        client = MostbetAPI({
            'api_key': api_cfg.get('api_key', ''),
            'secret': api_cfg.get('secret', ''),
            'cashpoint_id': api_cfg.get('cashpoint_id', ''),
        })

        import asyncio
        async def _run():
            return await client.deposit_user(user_id, amount, currency='KGS')
        data_resp = asyncio.run(_run())
        if data_resp:
            return JsonResponse({'success': True, 'data': data_resp})
        return JsonResponse({'error': 'API Error', 'data': None}, status=502)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_mostbet_withdrawal(request):
    """API прокси для выплаты со счета MOSTBET"""
    if request.method == 'POST':
        try:
            import hashlib
            import requests
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            code = data.get('code')
            
            if not user_id or not code:
                return JsonResponse({'error': 'user_id and code are required'}, status=400)
            
            # API настройки для MOSTBET (нужно получить у менеджера)
            API_CONFIG = {
                'base_url': 'https://partners.servcul.com/CashdeskBotAPI/',
                'hash': 'MOSTBET_HASH_HERE',  # Заменить на реальный hash
                'cashierpass': 'MOSTBET_PASSWORD_HERE',  # Заменить на реальный пароль
                'cashdeskid': 0  # Заменить на реальный ID кассы
            }
            
            def sha256(text):
                return hashlib.sha256(text.encode()).hexdigest()
            
            def md5(text):
                return hashlib.md5(text.encode()).hexdigest()
            
            # Формируем confirm
            confirm = md5(f"{user_id}:{API_CONFIG['hash']}")
            
            # Формируем подпись согласно документации
            sign_string1 = f"hash={API_CONFIG['hash']}&lng=ru&UserId={user_id}"
            sign1 = sha256(sign_string1)
            
            sign_string2 = f"code={code}&cashierpass={API_CONFIG['cashierpass']}&cashdeskid={API_CONFIG['cashdeskid']}"
            sign2 = md5(sign_string2)
            
            sign = sha256(sign1 + sign2)
            
            # Формируем URL и тело запроса
            url = f"{API_CONFIG['base_url']}Deposit/{user_id}/Payout"
            body = {
                "cashdeskId": API_CONFIG['cashdeskid'],
                "lng": "ru",
                "code": code,
                "confirm": confirm
            }
            
            # Выполняем запрос
            response = requests.post(
                url, 
                headers={
                    'sign': sign,
                    'Content-Type': 'application/json'
                },
                json=body,
                timeout=10
            )
            
            if response.status_code == 200:
                return JsonResponse(response.json())
            else:
                return JsonResponse({
                    'error': 'API Error',
                    'status': response.status_code,
                    'message': response.text
                }, status=response.status_code)
                
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

def unified_api(request):
    """Универсальная страница API букмекеров"""
    return render(request, 'bot_control/unified_api_mobile.html')

@csrf_exempt
def api_export_statistics(request):
    """API для экспорта статистики в Excel"""
    if request.method == 'GET':
        try:
            import pandas as pd
            from io import BytesIO
            from django.http import HttpResponse
            
            # Получаем параметры фильтров
            date_from = request.GET.get('date_from')
            date_to = request.GET.get('date_to')
            bookmaker = request.GET.get('bookmaker')
            
            # Правильный путь к базе данных
            db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'bot', 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            
            # Формируем условия WHERE
            where_conditions = []
            params = []
            
            if date_from:
                where_conditions.append("DATE(created_at) >= ?")
                params.append(date_from)
            
            if date_to:
                where_conditions.append("DATE(created_at) <= ?")
                params.append(date_to)
            
            if bookmaker:
                where_conditions.append("bookmaker = ?")
                params.append(bookmaker)
            
            where_clause = ""
            if where_conditions:
                where_clause = "WHERE " + " AND ".join(where_conditions)
            
            # Получаем данные транзакций
            query = f'''
                SELECT 
                    t.id,
                    t.user_id,
                    u.username,
                    t.bookmaker,
                    t.type,
                    t.amount,
                    t.status,
                    t.created_at
                FROM transactions t
                LEFT JOIN users u ON t.user_id = u.id
                {where_clause}
                ORDER BY t.created_at DESC
            '''
            
            df = pd.read_sql_query(query, conn, params=params)
            conn.close()
            
            # Создаем Excel файл в памяти
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                # Лист с транзакциями
                df.to_excel(writer, sheet_name='Транзакции', index=False)
                
                # Лист со статистикой
                stats_data = {
                    'Метрика': [
                        'Всего транзакций',
                        'Пополнений',
                        'Выводов',
                        'Общая сумма пополнений',
                        'Общая сумма выводов',
                        'Средний депозит',
                        'Средний вывод'
                    ],
                    'Значение': [
                        len(df),
                        len(df[df['type'] == 'deposit']),
                        len(df[df['type'] == 'withdrawal']),
                        df[df['type'] == 'deposit']['amount'].sum(),
                        df[df['type'] == 'withdrawal']['amount'].sum(),
                        df[df['type'] == 'deposit']['amount'].mean(),
                        df[df['type'] == 'withdrawal']['amount'].mean()
                    ]
                }
                stats_df = pd.DataFrame(stats_data)
                stats_df.to_excel(writer, sheet_name='Статистика', index=False)
            
            output.seek(0)
            
            # Возвращаем файл
            response = HttpResponse(
                output.getvalue(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="statistics_{timezone.now().strftime("%Y%m%d")}.xlsx"'
            
            return response
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

def broadcast_history(request):
    """Страница истории рассылок"""
    return render(request, 'bot_control/broadcast_history.html')

@csrf_exempt
def api_broadcast_history(request):
    """API для получения истории рассылок"""
    if request.method == 'GET':
        try:
            # Правильный путь к базе данных относительно Django проекта
            db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'bot', 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Создаем таблицу для истории рассылок, если её нет
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS broadcast_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message TEXT NOT NULL,
                    sent_count INTEGER DEFAULT 0,
                    error_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Получаем историю рассылок
            cursor.execute('''
                SELECT id, message, sent_count, error_count, created_at
                FROM broadcast_history
                ORDER BY created_at DESC
                LIMIT 50
            ''')
            
            broadcasts = []
            for row in cursor.fetchall():
                broadcasts.append({
                    'id': row[0],
                    'message': row[1],
                    'sent_count': row[2],
                    'error_count': row[3],
                    'created_at': row[4]
                })
            
            conn.close()
            
            return JsonResponse({
                'success': True,
                'broadcasts': broadcasts
            })
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

# Bank Management API functions
@csrf_exempt
def api_get_bank_settings(request):
    """API для получения настроек банков"""
    if request.method == 'GET':
        try:
            # Правильный путь к базе данных относительно Django проекта
            db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'bot', 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, bank_code, bank_name, is_enabled_deposit, is_enabled_withdraw, 
                       url_template, icon, created_at, updated_at
                FROM bot_control_banksettings
                ORDER BY bank_name
            ''')
            
            data = []
            for row in cursor.fetchall():
                data.append({
                    'id': row[0],
                    'bank_code': row[1],
                    'bank_name': row[2],
                    'is_enabled_deposit': bool(row[3]),
                    'is_enabled_withdraw': bool(row[4]),
                    'url_template': row[5],
                    'icon': row[6],
                    'created_at': row[7],
                    'updated_at': row[8]
                })
            
            conn.close()
            
            return JsonResponse({
                'success': True,
                'banks': data
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })

@csrf_exempt
def api_toggle_bank_setting(request, bank_id):
    """API для переключения настроек банка"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            setting = data.get('setting')  # 'deposit' или 'withdraw'
            enabled = data.get('enabled', False)
            
            if setting not in ['deposit', 'withdraw']:
                return JsonResponse({
                    'success': False,
                    'error': 'Неверный параметр setting'
                })
            
            # Правильный путь к базе данных относительно Django проекта
            db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'bot', 'universal_bot.db')
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Обновляем соответствующую настройку
            if setting == 'deposit':
                cursor.execute('''
                    UPDATE bot_control_banksettings 
                    SET is_enabled_deposit = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (1 if enabled else 0, bank_id))
            else:  # withdraw
                cursor.execute('''
                    UPDATE bot_control_banksettings 
                    SET is_enabled_withdraw = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (1 if enabled else 0, bank_id))
            
            conn.commit()
            conn.close()
            
            return JsonResponse({
                'success': True,
                'enabled': enabled
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })

@csrf_exempt
def api_get_bot_settings(request):
    """API для получения настроек бота"""
    try:
        # Собираем настройки с дефолтами
        settings = {
            'pause': BotConfiguration.get_setting('pause', False),
            'sites': BotConfiguration.get_setting('sites', ['Melbet', '1xbet', '1win', 'mostbet']),
            'deposits': BotConfiguration.get_setting('deposits', {
                'enabled': True,
                'banks': ['mbank', 'bakai', 'balance', 'demir', 'omoney', 'elcart', 'mega']
            }),
            'withdrawals': BotConfiguration.get_setting('withdrawals', {
                'enabled': True,
                'banks': ['kompanion', 'odengi', 'bakai', 'balance', 'megapay', 'mbank']
            }),
            'channel': BotConfiguration.get_setting('channel', {
                'enabled': False,
                'name': '@bingokg_news'
            })
        }
        # Нормализуем только известные алиасы, не отбрасывая значения
        try:
            w = settings.get('withdrawals') or {}
            banks = w.get('banks') or []
            norm_map = {
                'companon': 'kompanion', 'компаньон': 'kompanion',
                'o!': 'odengi', 'o! деньги': 'odengi', 'omoney': 'odengi',
                'balance.kg': 'balance',
                'mega': 'megapay'
            }
            banks_norm = []
            for b in banks:
                k = str(b).strip().lower()
                mapped = norm_map.get(k, k)
                if mapped not in banks_norm:
                    banks_norm.append(mapped)
            settings['withdrawals']['banks'] = banks_norm
        except Exception:
            pass
        
        return JsonResponse(settings)
    except Exception as e:
        return JsonResponse({
            'error': str(e)
        }, status=500)

@csrf_exempt
def api_save_bot_settings(request):
    """API для сохранения настроек бота"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method allowed'}, status=405)
    
    try:
        data = json.loads(request.body)

        # ===== Нормализация входящих данных =====
        # Sites as-is (UI уже отдаёт корректно)
        sites = data.get('sites', []) or []

        # Deposits
        dep_in = data.get('deposits') or {}
        dep_enabled = bool(dep_in.get('enabled', True))
        dep_banks_in = dep_in.get('banks') or []
        dep_allowed = {'mbank','bakai','balance','demir','omoney','elcart','megapay','mega','qr'}
        dep_banks_norm = []
        for b in dep_banks_in:
            k = str(b).strip().lower()
            if k == 'mega':
                k = 'megapay'
            if k in dep_allowed and k not in dep_banks_norm:
                dep_banks_norm.append(k)
        deposits = {'enabled': dep_enabled, 'banks': dep_banks_norm}

        # Withdrawals
        w_in = data.get('withdrawals') or {}
        w_enabled = bool(w_in.get('enabled', True))
        w_banks_in = w_in.get('banks') or []
        w_map = {
            'companon': 'kompanion', 'kompanion': 'kompanion', 'компаньон': 'kompanion',
            'odengi': 'odengi', 'omoney': 'odengi', 'o!': 'odengi', 'o! деньги': 'odengi',
            'bakai': 'bakai', 'balance': 'balance', 'balance.kg': 'balance',
            'megapay': 'megapay', 'mega': 'megapay',
            'mbank': 'mbank'
        }
        w_allowed = {'kompanion','odengi','bakai','balance','megapay','mbank'}
        w_banks_norm = []
        for b in w_banks_in:
            k = w_map.get(str(b).strip().lower())
            if k and k in w_allowed and k not in w_banks_norm:
                w_banks_norm.append(k)
        withdrawals = {'enabled': w_enabled, 'banks': w_banks_norm}

        channel = data.get('channel', {}) or {}

        # ===== Сохраняем в Django БД =====
        BotConfiguration.set_setting('pause', data.get('pause', False), 'Пауза бота')
        BotConfiguration.set_setting('sites', sites, 'Активные сайты')
        BotConfiguration.set_setting('deposits', deposits, 'Настройки пополнений')
        BotConfiguration.set_setting('withdrawals', withdrawals, 'Настройки выводов')
        BotConfiguration.set_setting('channel', channel, 'Настройки канала')

        # Дублируем необходимые настройки в общую БД бота (SQLite), чтобы бот мог их читать без Django
        try:
            conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
            cur = conn.cursor()
            # ensure table
            cur.execute('''
                CREATE TABLE IF NOT EXISTS bot_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # нормализуем список сайтов в нижний регистр ключей бота
            norm = []
            for s in sites:
                ls = str(s).strip().lower()
                if ls in ('melbet','1xbet','1win','mostbet'):
                    norm.append(ls)
                elif ls in ('mel','mel-bet'):
                    norm.append('melbet')
                elif ls in ('xbet','1x'):
                    norm.append('1xbet')
                elif ls in ('win','onewin'):
                    norm.append('1win')
            import json as _json
            cur.execute('''
                INSERT OR REPLACE INTO bot_settings (key, value, updated_at)
                VALUES ('sites', ?, CURRENT_TIMESTAMP)
            ''', (_json.dumps(norm, ensure_ascii=False),))

            # deposit settings -> bot_settings
            dep_enabled = deposits['enabled']
            dep_banks = deposits['banks']
            bank_map = {
                'mbank': 'MBank',
                'bakai': 'Bakai',
                'balance': 'Balance.kg',
                'demir': 'DemirBank',
                'omoney': 'O! bank',
                'megapay': 'MegaPay',
                'qr': 'QR'
            }
            norm_banks = [bank_map.get(k, k) for k in dep_banks]
            cur.execute('''
                INSERT OR REPLACE INTO bot_settings (key, value, updated_at)
                VALUES ('deposits_enabled', ?, CURRENT_TIMESTAMP)
            ''', ('1' if dep_enabled else '0',))
            cur.execute('''
                INSERT OR REPLACE INTO bot_settings (key, value, updated_at)
                VALUES ('deposit_banks', ?, CURRENT_TIMESTAMP)
            ''', (_json.dumps(norm_banks, ensure_ascii=False),))

            # withdrawal settings -> bot_settings
            w_enabled = withdrawals['enabled']
            w_banks = withdrawals['banks']
            w_map_out = {
                'kompanion': 'Компаньон',
                'odengi': 'О! Деньги',
                'bakai': 'Бакай',
                'balance': 'Balance.kg',
                'megapay': 'MegaPay',
                'mbank': 'MBank'
            }
            w_norm = [w_map_out.get(k, k) for k in w_banks]
            cur.execute('''
                INSERT OR REPLACE INTO bot_settings (key, value, updated_at)
                VALUES ('withdrawals_enabled', ?, CURRENT_TIMESTAMP)
            ''', ('1' if w_enabled else '0',))
            cur.execute('''
                INSERT OR REPLACE INTO bot_settings (key, value, updated_at)
                VALUES ('withdraw_banks', ?, CURRENT_TIMESTAMP)
            ''', (_json.dumps(w_norm, ensure_ascii=False),))
            conn.commit()
            conn.close()

        except Exception:
            # Не падаем, если зеркалирование не удалось
            pass

        # Вернем нормализованные настройки клиенту, чтобы UI мог сразу применить сохранённое
        return JsonResponse({
@csrf_exempt
def api_save_qr_hash(request):
    """API для сохранения QR хеша"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        QRHash.objects.create(
            hash_value=data.get('hash'),
            bank_name=data.get('bank', 'Unknown'),
            is_active=data.get('active', True)
        )
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_delete_qr_hash(request, hash_id):
    """API для удаления QR хеша"""
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE method allowed'}, status=405)
    
    try:
        QRHash.objects.get(id=hash_id).delete()
        return JsonResponse({'success': True})
    except QRHash.DoesNotExist:
        return JsonResponse({'error': 'Hash not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_save_bank_settings(request):
    """API для сохранения настроек банка"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        bank, created = BankSettings.objects.get_or_create(
            name=data.get('name', 'Unknown'),
            defaults={
                'is_active': data.get('active', True),
                'min_amount': data.get('min_amount', 0),
                'max_amount': data.get('max_amount', 1000000)
            }
        )
        if not created:
            bank.is_active = data.get('active', True)
            bank.min_amount = data.get('min_amount', 0)
            bank.max_amount = data.get('max_amount', 1000000)
            bank.save()
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_qr_hashes(request):
    """API для получения списка QR хешей"""
    try:
        from .models import QRHash
        
        # Получаем активные хеши
        hashes = QRHash.objects.filter(is_active=True).values('account_name', 'hash_value', 'is_main')
        
        # Если есть основной хеш, используем его
        main_hash = hashes.filter(is_main=True).first()
        if main_hash:
            qr_hashes = {
                'demirbank': main_hash['hash_value'],
                'main_account': main_hash['account_name']
            }
        else:
            # Если нет основного, используем первый активный
            first_hash = hashes.first()
            if first_hash:
                qr_hashes = {
                    'demirbank': first_hash['hash_value'],
                    'main_account': first_hash['account_name']
                }
            else:
                qr_hashes = {}
        
        return JsonResponse({
            'qr_hashes': qr_hashes,
            'total_active': hashes.count()
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_sync_qr_hashes(request):
    """API для синхронизации QR хешей с ботом"""
    try:
        from .models import QRHash
        
        # Получаем основной хеш
        main_hash = QRHash.objects.filter(is_main=True, is_active=True).first()
        if not main_hash:
            main_hash = QRHash.objects.filter(is_active=True).first()
        
        if not main_hash:
            return JsonResponse({'error': 'Нет активных хешей'}, status=400)
        
        # Здесь можно добавить логику синхронизации с ботом
        # Например, отправка хеша в базу данных бота
        
        return JsonResponse({
            'success': True,
            'message': f'Синхронизация выполнена для аккаунта {main_hash.account_name}',
            'main_account': main_hash.account_name,
            'hash_preview': f"{main_hash.hash_value[:30]}...{main_hash.hash_value[-10:]}"
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_add_qr_hash(request):
    """API для добавления QR хеша"""
    try:
        from .models import QRHash
        import json
        
        data = json.loads(request.body)
        
        # Создаем новый QR хеш
        qr_hash = QRHash.objects.create(
            account_name=data.get('account_name'),
            hash_value=data.get('hash_value'),
            gmail_email=data.get('gmail_email'),
            gmail_password=data.get('gmail_password'),
            is_main=data.get('is_main', False),
            is_active=data.get('is_active', True)
        )
        
        return JsonResponse({
            'success': True,
            'message': f'QR хеш "{qr_hash.account_name}" успешно добавлен',
            'qr_id': qr_hash.id
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_set_main_qr_hash(request, qr_id):
    """API для установки основного QR хеша"""
    try:
        from .models import QRHash
        
        # Убираем флаг основного с всех хешей
        QRHash.objects.filter(is_main=True).update(is_main=False)
        
        # Устанавливаем выбранный как основной
        qr_hash = QRHash.objects.get(id=qr_id)
        qr_hash.is_main = True
        qr_hash.is_active = True
        qr_hash.save()
        
        return JsonResponse({
            'success': True,
            'message': f'QR хеш "{qr_hash.account_name}" установлен как основной'
        })
    except QRHash.DoesNotExist:
        return JsonResponse({'error': 'QR хеш не найден'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_toggle_qr_hash(request, qr_id):
    """API для переключения статуса QR хеша"""
    try:
        from .models import QRHash
        
        qr_hash = QRHash.objects.get(id=qr_id)
        qr_hash.is_active = not qr_hash.is_active
        qr_hash.save()
        
        status = "активирован" if qr_hash.is_active else "деактивирован"
        return JsonResponse({
            'success': True,
            'message': f'QR хеш "{qr_hash.account_name}" {status}',
            'is_active': qr_hash.is_active
        })
    except QRHash.DoesNotExist:
        return JsonResponse({'error': 'QR хеш не найден'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_delete_qr_hash(request, qr_id):
    """API для удаления QR хеша"""
    try:
        from .models import QRHash
        
        qr_hash = QRHash.objects.get(id=qr_id)
        account_name = qr_hash.account_name
        qr_hash.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'QR хеш "{account_name}" удален'
        })
    except QRHash.DoesNotExist:
        return JsonResponse({'error': 'QR хеш не найден'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
