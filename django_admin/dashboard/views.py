from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import sqlite3
import json
import os
from datetime import datetime, timedelta
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt

def dashboard(request):
    """Главная страница дашборда"""
    return render(request, 'dashboard/dashboard_mobile.html')

def history(request):
    """Страница истории транзакций"""
    return render(request, 'dashboard/history_mobile.html')

def wallet(request):
    """Страница кошелька"""
    from bot_control.models import BankSettings, QRHash
    
    banks = BankSettings.objects.all()
    qr_codes = QRHash.objects.all()

    # Читаем реквизиты из bot/universal_bot.db
    requisites = []
    try:
        # используем qr_utils.ensure_requisites_table для уверенности
        try:
            from bot.qr_utils import ensure_requisites_table
            ensure_requisites_table()
        except Exception:
            pass

        # Закрываем соединение после всех выборок
        try:
            conn.close()
        except Exception:
            pass
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cur = conn.cursor()
        # Локальный DDL на случай, если импорт не сработал
        cur.execute('''
            CREATE TABLE IF NOT EXISTS requisites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                value TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                name TEXT,
                email TEXT,
                password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cur.execute('''
            SELECT id, value, COALESCE(is_active,0), COALESCE(created_at,'')
            FROM requisites
            ORDER BY id DESC
        ''')
        for rid, value, is_active, created_at in cur.fetchall():
            requisites.append({
                'id': rid,
                'value': value,
                'is_active': bool(is_active),
                'created_at': created_at,
            })
        conn.close()
    except Exception:
        requisites = []
    
    context = {
        'banks': banks,
        'banks_count': banks.count(),
        'qr_codes_count': qr_codes.count(),
        'requisites': requisites,
        'requisites_count': len(requisites),
    }
    
    return render(request, 'dashboard/wallet_mobile.html', context)


def menu(request):
    """Страница меню"""
    from bot_control.models import BankSettings, QRHash, AutoDepositRequest
    
    total_requests = AutoDepositRequest.objects.count()
    pending_requests = AutoDepositRequest.objects.filter(status='pending').count()
    banks_count = BankSettings.objects.count()
    qr_codes_count = QRHash.objects.count()
    
    context = {
        'total_requests': total_requests,
        'pending_requests': pending_requests,
        'banks_count': banks_count,
        'qr_codes_count': qr_codes_count,
    }
    
    return render(request, 'dashboard/menu_mobile.html', context)

def database(request):
    """Заглушка страницы управления базой данных"""
    return render(request, 'dashboard/database_mobile.html')

def about(request):
    """Страница "О приложении"""
    return render(request, 'dashboard/about_mobile.html')

def request_detail(request, req_id: int):
    """Редирект на каноническую страницу деталей (Lux): /bot/transactions/<id>/"""
    try:
        return redirect('bot_control:transaction_detail', trans_id=req_id)
    except Exception:
        from django.http import HttpResponseRedirect
        return HttpResponseRedirect(f'/bot/transactions/{req_id}/')

def api_stats(request):
    """API для получения статистики"""
    try:
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()

        stats = {}

        # Общее количество пользователей
        cursor.execute('SELECT COUNT(*) FROM users')
        stats['total_users'] = cursor.fetchone()[0]

        # Определяем схему транзакций
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'")
        has_transactions = cursor.fetchone() is not None
        type_col = None
        if has_transactions:
            cursor.execute('PRAGMA table_info(transactions)')
            cols = [c[1] for c in cursor.fetchall()]
            type_col = 'trans_type' if 'trans_type' in cols else ('type' if 'type' in cols else None)

        if has_transactions and type_col:
            cursor.execute(f'SELECT COUNT(*) FROM transactions WHERE status = "pending" AND {type_col} = "deposit"')
            stats['pending_deposits'] = cursor.fetchone()[0]
            cursor.execute(f'SELECT COUNT(*) FROM transactions WHERE status = "pending" AND {type_col} = "withdrawal"')
            stats['pending_withdrawals'] = cursor.fetchone()[0]
        else:
            # Fallback по таблицам заявок
            try:
                cursor.execute('SELECT COUNT(*) FROM deposit_requests WHERE status = "pending"')
                stats['pending_deposits'] = cursor.fetchone()[0]
            except Exception:
                stats['pending_deposits'] = 0
            try:
                cursor.execute('SELECT COUNT(*) FROM withdrawals WHERE status = "pending"')
                stats['pending_withdrawals'] = cursor.fetchone()[0]
            except Exception:
                stats['pending_withdrawals'] = 0
        
        # Статус бота
        cursor.execute('SELECT value FROM bot_settings WHERE key = "is_active"')
        bot_active_row = cursor.fetchone()
        stats['bot_active'] = bot_active_row[0] == '1' if bot_active_row else True
        
        # Статистика по букмекерам
        bookmakers = ['1xbet', '1win', 'melbet', 'mostbet']
        stats['bookmakers'] = {}
        
        for bookmaker in bookmakers:
            if has_transactions and type_col:
                cursor.execute(f'''
                    SELECT COUNT(*), COALESCE(SUM(amount), 0)
                    FROM transactions 
                    WHERE bookmaker = ? AND {type_col} = 'deposit'
                ''', (bookmaker,))
                deposit_count, deposit_amount = cursor.fetchone()
                cursor.execute(f'''
                    SELECT COUNT(*), COALESCE(SUM(amount), 0)
                    FROM transactions 
                    WHERE bookmaker = ? AND {type_col} = 'withdrawal'
                ''', (bookmaker,))
                withdraw_count, withdraw_amount = cursor.fetchone()
            else:
                # Fallback из отдельных таблиц
                cursor.execute('''
                    SELECT COUNT(*), COALESCE(SUM(amount), 0)
                    FROM deposit_requests
                    WHERE bookmaker = ?
                ''', (bookmaker,))
                deposit_count, deposit_amount = cursor.fetchone()
                cursor.execute('''
                    SELECT COUNT(*), COALESCE(SUM(amount), 0)
                    FROM withdrawals
                    WHERE bookmaker = ?
                ''', (bookmaker,))
                withdraw_count, withdraw_amount = cursor.fetchone()
            
            stats['bookmakers'][bookmaker] = {
                'deposits': {'count': deposit_count, 'amount': deposit_amount},
                'withdrawals': {'count': withdraw_count, 'amount': withdraw_amount}
            }
        
        conn.close()
        return JsonResponse(stats)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def api_transactions(request):
    """API для получения последних транзакций"""
    try:
        # Подключаемся к общей БД бота
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cursor = conn.cursor()
        
        limit = int(request.GET.get('limit', 50))
        
        cursor.execute('''
            SELECT 
                t.id, t.user_id, t.bookmaker, t.trans_type, t.amount, t.status, t.created_at,
                u.username, u.first_name, u.last_name
            FROM transactions t
            JOIN users u ON t.user_id = u.user_id
            ORDER BY t.created_at DESC
            LIMIT ?
        ''', (limit,))
        
        transactions = []
        for row in cursor.fetchall():
            trans_id, user_id, bookmaker, trans_type, amount, status, created_at, username, first_name, last_name = row
            transactions.append({
                'id': trans_id,
                'user_id': user_id,
                'username': username or f"{first_name or ''} {last_name or ''}".strip() or 'Unknown',
                'bookmaker': bookmaker,
                'type': trans_type,
                'amount': amount,
                'status': status,
                'created_at': created_at
            })
        
        conn.close()
        return JsonResponse(transactions, safe=False)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_pending_requests(request):
    """API для получения ожидающих заявок"""
    if request.method == 'GET':
        try:
            # Подключаемся к общей БД бота
            conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
            cursor = conn.cursor()

            # Авто-перенос в "оставленные":
            # если заявка в pending/processing, ей больше 10 минут и она не обработана — переводим в awaiting_manual
            try:
                cursor.execute('''
                    UPDATE requests
                    SET status = 'awaiting_manual', updated_at = CURRENT_TIMESTAMP
                    WHERE status IN ('pending','processing')
                      AND (processed_at IS NULL OR processed_at = '')
                      AND created_at IS NOT NULL
                      AND datetime(created_at) <= datetime('now','-10 minutes')
                ''')
                conn.commit()
            except Exception:
                # Не мешаем основному ответу API
                pass

            # Единая таблица requests: показываем только ожидающие (pending/processing/awaiting_manual)
            try:
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'")
                if cursor.fetchone() is None:
                    conn.close()
                    return JsonResponse({'success': True, 'requests': []})
            except Exception:
                conn.close()
                return JsonResponse({'success': True, 'requests': []})

            cursor.execute('''
                SELECT 
                    r.id, r.user_id, COALESCE(r.bookmaker,''), COALESCE(r.request_type,''),
                    COALESCE(r.amount,0), COALESCE(r.status,'pending'), COALESCE(r.created_at,''),
                    COALESCE(u.username,''), COALESCE(u.first_name,''), COALESCE(u.last_name,''),
                    COALESCE(r.account_id,''), COALESCE(r.bank,''), COALESCE(r.photo_file_url,'')
                FROM requests r
                LEFT JOIN users u ON r.user_id = u.user_id
                WHERE r.status IN ('pending','processing','awaiting_manual')
                ORDER BY datetime(COALESCE(r.created_at,'1970-01-01')) DESC
                LIMIT 50
            ''')

            requests_list = []
            for row in cursor.fetchall():
                rid, user_id, bookmaker, rtype, amount, status, created_at, username, first_name, last_name, account_id, bank, photo_url = row
                requests_list.append({
                    'id': rid,
                    'user_id': user_id,
                    'username': username or f"{first_name or ''} {last_name or ''}".strip() or 'Unknown',
                    'bookmaker': bookmaker,
                    'type': (rtype or 'deposit'),
                    'amount': amount,
                    'status': status,
                    'created_at': created_at,
                    'account_id': account_id,
                    'bank': bank,
                    'photo_url': photo_url
                })

            conn.close()
            return JsonResponse({'success': True, 'requests': requests_list})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_update_amount(request):
    """Обновляет amount у заявки из таблицы requests (ручной апдейт со страницы деталей).
    Принимает JSON: {request_id:int, amount:float}
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        data = json.loads(request.body or '{}')
        req_id = int(data.get('request_id') or 0)
        amount = float(data.get('amount') or 0)
        if not req_id:
            return JsonResponse({'success': False, 'error': 'request_id required'}, status=400)
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cur = conn.cursor()
        cur.execute('UPDATE requests SET amount=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', (amount, req_id))
        if cur.rowcount == 0:
            conn.close()
            return JsonResponse({'success': False, 'error': 'Заявка не найдена'}, status=404)
        conn.commit()
        conn.close()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

def api_requisites_list(request):
    """GET: вернуть список реквизитов из bot/universal_bot.db
    Ответ: {success: True, requisites: [{id, value, is_active, created_at}], active_id}
    """
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        # ensure table
        try:
            from bot.qr_utils import ensure_requisites_table
            ensure_requisites_table()
        except Exception:
            pass

        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS requisites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                value TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                name TEXT,
                email TEXT,
                password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cur.execute('''
            SELECT id, value, COALESCE(is_active,0), COALESCE(created_at,'')
            FROM requisites
            ORDER BY is_active DESC, id DESC
        ''')
        items = []
        active_id = None
        for rid, value, is_active, created_at in cur.fetchall():
            if is_active and active_id is None:
                active_id = rid
            items.append({
                'id': rid,
                'value': value,
                'is_active': bool(is_active),
                'created_at': created_at,
            })
        conn.close()
        return JsonResponse({'success': True, 'requisites': items, 'active_id': active_id})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ===== Requisites API (bot/universal_bot.db) =====
@csrf_exempt
def api_requisites(request):
    """POST: добавить реквизит (value 14-значный, начинается с 11). Опционально name/email/password, is_active."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        data = json.loads(request.body or '{}')
        value = str(data.get('value', '')).strip()
        name = str(data.get('name', '') or '').strip()
        email = str(data.get('email', '') or '').strip()
        password = str(data.get('password', '') or '').strip()
        is_active = bool(data.get('is_active', False))

        if not (len(value) == 16 and value.isdigit()):
            return JsonResponse({'success': False, 'error': 'Реквизит должен быть 16-значным числом'}, status=400)

        # ensure table
        try:
            from bot.qr_utils import ensure_requisites_table
            ensure_requisites_table()
        except Exception:
            pass

        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS requisites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                value TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                name TEXT,
                email TEXT,
                password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        if is_active:
            cur.execute('UPDATE requisites SET is_active = 0 WHERE is_active = 1')
        cur.execute('INSERT INTO requisites (value, is_active, name, email, password) VALUES (?, ?, ?, ?, ?)',
                    (value, 1 if is_active else 0, name, email, password))
        conn.commit()
        conn.close()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_requisites_set_active(request, rid: int):
    """POST: сделать реквизит активным."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        # ensure table
        try:
            from bot.qr_utils import ensure_requisites_table
            ensure_requisites_table()
        except Exception:
            pass
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS requisites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                value TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                name TEXT,
                email TEXT,
                password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cur.execute('UPDATE requisites SET is_active = 0 WHERE is_active = 1')
        cur.execute('UPDATE requisites SET is_active = 1 WHERE id = ?', (rid,))
        conn.commit()
        conn.close()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_requisites_delete(request, rid: int):
    """DELETE: удалить реквизит."""
    if request.method != 'DELETE':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS requisites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                value TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                name TEXT,
                email TEXT,
                password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cur.execute('DELETE FROM requisites WHERE id = ?', (rid,))
        conn.commit()
        conn.close()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def api_handle_request(request):
    """API для обработки заявки (подтвердить/отклонить)"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            request_id = data.get('request_id')
            action = data.get('action')  # 'approve' или 'reject'
            
            if not request_id or not action:
                return JsonResponse({'success': False, 'error': 'Неверные параметры'}, status=400)
            
            # Подключаемся к общей БД бота
            conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
            cursor = conn.cursor()
            
            # Обновляем статус в единой таблице requests (transactions может быть вью и не модифицироваться)
            new_status = 'completed' if action == 'approve' else 'rejected'
            cursor.execute('''
                UPDATE requests
                SET status = ?,
                    updated_at = CURRENT_TIMESTAMP,
                    processed_at = CASE WHEN ? IN ('completed','rejected','approved','auto_completed') THEN CURRENT_TIMESTAMP ELSE processed_at END
                WHERE id = ?
            ''', (new_status, new_status, request_id))
            if cursor.rowcount == 0:
                # Нет строки в requests — вернём 404
                conn.close()
                return JsonResponse({'success': False, 'error': 'Заявка не найдена'}, status=404)
            
            conn.commit()
            conn.close()
            
            action_text = 'подтверждена' if action == 'approve' else 'отклонена'
            return JsonResponse({
                'success': True, 
                'message': f'Заявка {action_text} успешно'
            })
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_transaction_history(request):
    """API для получения истории транзакций из БД бота"""
    if request.method == 'GET':
        try:
            conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
            cursor = conn.cursor()

            tx_type = request.GET.get('type', 'all')  # all | deposits | withdrawals

            # Новая единая таблица requests
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'")
            if cursor.fetchone() is None:
                conn.close()
                return JsonResponse({'success': True, 'transactions': []})

            # История: показываем только завершённые заявки (подтверждено/отклонено/автопополнено)
            where = ["TRIM(COALESCE(status,'')) IN ('completed','rejected','auto_completed','approved')"]
            params = []
            if tx_type == 'deposits':
                where.append("TRIM(COALESCE(request_type,''))='deposit'")
            elif tx_type == 'withdrawals':
                where.append("TRIM(COALESCE(request_type,''))='withdraw'")

            where_sql = ' WHERE ' + ' AND '.join(where)
            sql = f'''
                SELECT id, user_id, COALESCE(bookmaker,''), COALESCE(request_type,''),
                       COALESCE(amount,0), COALESCE(status,'pending'), COALESCE(created_at,''),
                       COALESCE(username,''), COALESCE(first_name,''), COALESCE(last_name,''),
                       COALESCE(photo_file_url,''), COALESCE(receipt_photo_url,''), COALESCE(qr_photo_url,''),
                       COALESCE(screenshot_url,''), COALESCE(photo_url,'')
                FROM requests
                {where_sql}
                ORDER BY datetime(COALESCE(created_at,'1970-01-01')) DESC
                LIMIT 200
            '''
            cursor.execute(sql, params)
            transactions = []
            rows = cursor.fetchall()
            # Fallbacks if unified requests has no finalized rows in this DB
            if not rows:
                try:
                    # Legacy single table: transactions
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'")
                    if cursor.fetchone() is not None:
                        tx_where = ["TRIM(COALESCE(status,'')) IN ('completed','rejected')"]
                        if tx_type == 'deposits':
                            tx_where.append("TRIM(COALESCE(trans_type,''))='deposit'")
                        elif tx_type == 'withdrawals':
                            tx_where.append("TRIM(COALESCE(trans_type,''))='withdrawal'")
                        tx_where_sql = ' WHERE ' + ' AND '.join(tx_where)
                        cursor.execute(f'''
                            SELECT id, user_id, COALESCE(bookmaker,''), COALESCE(trans_type,''),
                                   COALESCE(amount,0), COALESCE(status,''), COALESCE(created_at,''),
                                   '' AS username, '' AS first_name, '' AS last_name,
                                   '' AS photo_file_url, '' AS receipt_photo_url, '' AS qr_photo_url,
                                   '' AS screenshot_url, '' AS photo_url
                            FROM transactions
                            {tx_where_sql}
                            ORDER BY datetime(COALESCE(created_at,'1970-01-01')) DESC
                            LIMIT 200
                        ''')
                        rows = cursor.fetchall()
                except Exception:
                    rows = rows or []
                if not rows:
                    # Legacy split tables: deposit_requests + withdrawals
                    try:
                        merged = []
                        # deposits
                        cursor.execute('''
                            SELECT id, user_id, COALESCE(bookmaker,''), 'deposit' AS rtype,
                                   COALESCE(amount,0), COALESCE(status,''), COALESCE(created_at,''),
                                   '' AS username, '' AS first_name, '' AS last_name,
                                   COALESCE(receipt_photo_url,''), '' AS receipt2, '' AS qr,
                                   '' AS screenshot, '' AS photo_generic
                            FROM deposit_requests
                            WHERE TRIM(COALESCE(status,'')) IN ('completed','rejected')
                            ORDER BY datetime(COALESCE(created_at,'1970-01-01')) DESC
                            LIMIT 200
                        ''')
                        merged.extend(cursor.fetchall())
                        # withdrawals
                        cursor.execute('''
                            SELECT id, user_id, COALESCE(bookmaker,''), 'withdraw' AS rtype,
                                   COALESCE(amount,0), COALESCE(status,''), COALESCE(created_at,''),
                                   '' AS username, '' AS first_name, '' AS last_name,
                                   COALESCE(qr_photo_url,''), '' AS receipt2, '' AS qr,
                                   '' AS screenshot, '' AS photo_generic
                            FROM withdrawals
                            WHERE TRIM(COALESCE(status,'')) IN ('completed','rejected')
                            ORDER BY datetime(COALESCE(created_at,'1970-01-01')) DESC
                            LIMIT 200
                        ''')
                        merged.extend(cursor.fetchall())
                        rows = merged
                    except Exception:
                        rows = rows or []

            for rid, user_id, bookmaker, rtype, amount, status, created_at, username, first_name, last_name, p_file, p_receipt, p_qr, p_screen, p_generic in rows:
                user_name = username or f"{first_name or ''} {last_name or ''}".strip() or f"Пользователь {user_id}"
                # Resolve photo url similar to transaction_detail
                photo_url = p_file or p_receipt or p_qr or p_generic or p_screen or ''
                try:
                    if photo_url and not (str(photo_url).startswith('http://') or str(photo_url).startswith('https://')):
                        media_url = getattr(settings, 'MEDIA_URL', '/media/')
                        # strip leading slash to avoid //
                        photo_url = str(photo_url).lstrip('/')
                        photo_url = request.build_absolute_uri(f"{media_url}{photo_url}")
                except Exception:
                    pass
                transactions.append({
                    'id': rid,
                    'user_id': user_id,
                    'user_name': user_name,
                    'bookmaker': bookmaker,
                    'type': 'deposit' if rtype == 'deposit' else 'withdrawal',
                    'amount': float(amount) if amount is not None else 0.0,
                    'status': status,
                    'created_at': created_at,
                    'description': bookmaker,
                    'photo_url': photo_url
                })

            conn.close()
            return JsonResponse({'success': True, 'transactions': transactions})

        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)