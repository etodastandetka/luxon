from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
import sqlite3
import json
import os
from datetime import datetime, timedelta
from django.conf import settings

def home_redirect(request):
    """Главная страница - редирект на логин или дашборд"""
    if request.user.is_authenticated:
        return redirect('/dashboard/')
    else:
        return redirect('/auth/login/')

def dashboard(request):
    """Главная страница дашборда"""
    return render(request, 'dashboard/dashboard_mobile.html')

@login_required
def main_dashboard(request):
    """Главная страница с заявками после входа в админку"""
    # Перенаправляем на существующую страницу с заявками
    return redirect('/bot/requests/')

def history(request):
    """Страница истории транзакций"""
    from bot_control.auto_deposit_models import AutoDepositRequest
    from bot_control.models import BotDepositRequest, BotWithdrawRequest
    
    # Получаем реальные данные из базы
    deposit_requests = BotDepositRequest.objects.all().order_by('-created_at')[:20]
    withdraw_requests = BotWithdrawRequest.objects.all().order_by('-created_at')[:20]
    auto_deposit_requests = AutoDepositRequest.objects.all().order_by('-created_at')[:20]
    
    # Объединяем все транзакции в один список
    all_transactions = []
    
    # Добавляем депозиты
    for req in deposit_requests:
        all_transactions.append({
            'type': 'deposit',
            'id': req.id,
            'user_id': req.user_id,
            'username': req.username,
            'bookmaker': req.bookmaker,
            'amount': float(req.amount),
            'bank': req.bank,
            'status': req.status,
            'created_at': req.created_at,
            'status_text': 'Завершено' if req.status == 'approved' else 'Ожидает' if req.status == 'pending' else 'Отклонено'
        })
    
    # Добавляем выводы
    for req in withdraw_requests:
        all_transactions.append({
            'type': 'withdraw',
            'id': req.id,
            'user_id': req.user_id,
            'username': 'Пользователь',
            'bookmaker': 'Система',
            'amount': float(req.amount),
            'bank': 'Вывод',
            'status': req.status,
            'created_at': req.created_at,
            'status_text': 'Завершено' if req.status == 'approved' else 'Ожидает' if req.status == 'pending' else 'Отклонено'
        })
    
    # Добавляем автодепозиты
    for req in auto_deposit_requests:
        all_transactions.append({
            'type': 'auto_deposit',
            'id': req.id,
            'user_id': req.user_id,
            'username': req.username,
            'bookmaker': req.bookmaker,
            'amount': float(req.amount),
            'bank': req.bank,
            'status': req.status,
            'created_at': req.created_at,
            'status_text': 'Завершено' if req.status == 'approved' else 'Ожидает' if req.status == 'pending' else 'Отклонено'
        })
    
    # Сортируем по дате (новые сверху)
    all_transactions.sort(key=lambda x: x['created_at'], reverse=True)
    
    # Ограничиваем до 30 записей
    all_transactions = all_transactions[:30]
    
    context = {
        'transactions': all_transactions,
        'total_count': len(all_transactions)
    }
    
    return render(request, 'dashboard/history_mobile.html', context)

@csrf_exempt
def api_transaction_history(request):
    """API для получения истории транзакций для Next.js"""
    try:
        from bot_control.auto_deposit_models import AutoDepositRequest
        from bot_control.models import BotDepositRequest, BotWithdrawRequest
        
        # Получаем user_id из параметров запроса
        user_id = request.GET.get('user_id')
        
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'User ID is required'
            })
        
        # Получаем реальные данные из базы для конкретного пользователя
        deposit_requests = BotDepositRequest.objects.filter(user_id=user_id).order_by('-created_at')[:20]
        withdraw_requests = BotWithdrawRequest.objects.filter(user_id=user_id).order_by('-created_at')[:20]
        auto_deposit_requests = AutoDepositRequest.objects.filter(user_id=user_id).order_by('-created_at')[:20]
        
        # Объединяем все транзакции в один список
        all_transactions = []
        
        # Добавляем депозиты
        for req in deposit_requests:
            all_transactions.append({
                'id': str(req.id),
                'type': 'deposit',
                'user_id': req.user_id,
                'username': req.username,
                'bookmaker': req.bookmaker,
                'amount': float(req.amount),
                'bank': req.bank,
                'status': 'completed' if req.status == 'approved' else 'pending' if req.status == 'pending' else 'failed',
                'date': req.created_at.strftime('%Y-%m-%d %H:%M') if req.created_at else '',
                'status_text': 'Завершено' if req.status == 'approved' else 'Ожидает' if req.status == 'pending' else 'Отклонено'
            })
        
        # Добавляем выводы
        for req in withdraw_requests:
            all_transactions.append({
                'id': str(req.id),
                'type': 'withdraw',
                'user_id': req.user_id,
                'username': 'Пользователь',
                'bookmaker': 'Система',
                'amount': float(req.amount),
                'bank': 'Вывод',
                'status': 'completed' if req.status == 'approved' else 'pending' if req.status == 'pending' else 'failed',
                'date': req.created_at.strftime('%Y-%m-%d %H:%M') if req.created_at else '',
                'status_text': 'Завершено' if req.status == 'approved' else 'Ожидает' if req.status == 'pending' else 'Отклонено'
            })
        
        # Добавляем автодепозиты
        for req in auto_deposit_requests:
            all_transactions.append({
                'id': str(req.id),
                'type': 'deposit',
                'user_id': req.user_id,
                'username': req.username,
                'bookmaker': req.bookmaker,
                'amount': float(req.amount),
                'bank': req.bank,
                'status': 'completed' if req.status == 'approved' else 'pending' if req.status == 'pending' else 'failed',
                'date': req.created_at.strftime('%Y-%m-%d %H:%M') if req.created_at else '',
                'status_text': 'Завершено' if req.status == 'approved' else 'Ожидает' if req.status == 'pending' else 'Отклонено'
            })
        
        # Сортируем по дате (новые сверху)
        all_transactions.sort(key=lambda x: x['date'], reverse=True)
        
        # Ограничиваем до 30 записей
        all_transactions = all_transactions[:30]
        
        return JsonResponse({
            'success': True,
            'transactions': all_transactions,
            'total_count': len(all_transactions)
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@csrf_exempt
def api_referral_data(request):
    """API для получения данных реферальной программы"""
    try:
        from bot_control.auto_deposit_models import AutoDepositRequest
        from bot_control.models import BotDepositRequest, BotWithdrawRequest
        
        # Получаем user_id из параметров запроса
        user_id = request.GET.get('user_id')
        
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'User ID is required'
            })
        
        # Получаем данные пользователя
        user_deposits = BotDepositRequest.objects.filter(user_id=user_id)
        user_auto_deposits = AutoDepositRequest.objects.filter(user_id=user_id)
        
        # Считаем заработанное (5% от пополнений)
        total_deposits = sum(float(dep.amount) for dep in user_deposits) + sum(float(dep.amount) for dep in user_auto_deposits)
        earned = total_deposits * 0.05  # 5% комиссия
        
        # Считаем количество рефералов (пока заглушка)
        referral_count = 0
        
        # Получаем топ игроков по сумме пополнений рефералов
        all_users = {}
        
        # Собираем данные всех пользователей
        for deposit in BotDepositRequest.objects.all():
            if deposit.user_id not in all_users:
                all_users[deposit.user_id] = {
                    'id': deposit.user_id,
                    'username': deposit.username or f'Игрок #{deposit.user_id}',
                    'total_deposits': 0,
                    'referral_count': 0
                }
            all_users[deposit.user_id]['total_deposits'] += float(deposit.amount)
        
        for deposit in AutoDepositRequest.objects.all():
            if deposit.user_id not in all_users:
                all_users[deposit.user_id] = {
                    'id': deposit.user_id,
                    'username': deposit.username or f'Игрок #{deposit.user_id}',
                    'total_deposits': 0,
                    'referral_count': 0
                }
            all_users[deposit.user_id]['total_deposits'] += float(deposit.amount)
        
        # Сортируем по сумме пополнений и берем только топ-3
        top_players = sorted(all_users.values(), key=lambda x: x['total_deposits'], reverse=True)[:3]
        
        # Находим место пользователя
        user_rank = 0
        for i, player in enumerate(top_players):
            if player['id'] == user_id:
                user_rank = i + 1
                break
        
        return JsonResponse({
            'success': True,
            'earned': earned,
            'referral_count': referral_count,
            'top_players': top_players,
            'user_rank': user_rank
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

def wallet(request):
    """Страница кошелька"""
    from bot_control.models import BankSettings, QRHash, BankWallet
    banks = BankSettings.objects.all()
    qr_codes = QRHash.objects.all()
    bank_wallets = BankWallet.objects.all().order_by('bank_name', '-is_active', '-created_at')

    # Читаем реквизиты из bot/universal_bot.db
    requisites = []
    try:
        # используем qr_utils.ensure_requisites_table для уверенности (best-effort)
        try:
            from bot.qr_utils import ensure_requisites_table
            ensure_requisites_table()
        except Exception:
            pass

        # Открываем соединение один раз и работаем с ним
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
        # Читаем список
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
        'bank_wallets': bank_wallets,
        'requisites': requisites,
        'requisites_count': len(requisites),
    }
    
    return render(request, 'dashboard/wallet_mobile.html', context)


def menu(request):
    """Страница меню"""
    from bot_control.models import BankSettings, QRHash
    from bot_control.auto_deposit_models import AutoDepositRequest
    
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
        
        # Статус бота (упрощенная версия)
        stats['bot_active'] = True
        
        # Статистика по букмекерам (упрощенная версия)
        bookmakers = ['1xbet', '1win', 'melbet', 'mostbet']
        stats['bookmakers'] = {}
        
        for bookmaker in bookmakers:
            try:
                # Статистика по депозитам
                cursor.execute('''
                    SELECT COUNT(*), COALESCE(SUM(amount), 0)
                    FROM deposit_requests
                    WHERE bookmaker = ?
                ''', (bookmaker,))
                deposit_count, deposit_amount = cursor.fetchone()
                
                # Статистика по выводам
                cursor.execute('''
                    SELECT COUNT(*), COALESCE(SUM(amount), 0)
                    FROM withdrawals
                    WHERE bookmaker = ?
                ''', (bookmaker,))
                withdraw_count, withdraw_amount = cursor.fetchone()
                
                stats['bookmakers'][bookmaker] = {
                    'deposits': {'count': deposit_count or 0, 'amount': deposit_amount or 0},
                    'withdrawals': {'count': withdraw_count or 0, 'amount': withdraw_amount or 0}
                }
            except Exception:
                stats['bookmakers'][bookmaker] = {
                    'deposits': {'count': 0, 'amount': 0},
                    'withdrawals': {'count': 0, 'amount': 0}
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
                LEFT JOIN users u ON r.user_id = u.telegram_id
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
        # Сделать выбранный реквизит единственным активным
        cur.execute('UPDATE requisites SET is_active = 0 WHERE is_active = 1')
        cur.execute('UPDATE requisites SET is_active = 1 WHERE id = ?', (rid,))
        conn.commit()
        conn.close()

        # Взаимоисключаемость: выключаем все QR и банковские кошельки
        try:
            from bot_control.models import QRHash, BankWallet
            QRHash.objects.filter(is_active=True).update(is_active=False)
            BankWallet.objects.filter(is_active=True).update(is_active=False)
        except Exception:
            pass
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def api_requisites_delete(request, rid: int):
    """DELETE: удалить реквизит из SQLite таблицы requisites."""
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
            user_id = request.GET.get('user_id')  # ID пользователя для фильтрации

            # Новая единая таблица requests
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'")
            if cursor.fetchone() is None:
                conn.close()
                return JsonResponse({'success': True, 'transactions': []})

            # История = завершённые/отклонённые. Учитываем также 'approved' и 'auto_completed'.
            where = ["r.status IN ('completed','rejected','approved','auto_completed')"]
            params = []
            
            # Фильтр по пользователю
            if user_id:
                where.append("r.user_id = ?")
                params.append(user_id)
            
            if tx_type == 'deposits':
                where.append("r.request_type='deposit'")
            elif tx_type == 'withdrawals':
                where.append("r.request_type='withdraw'")

            where_sql = ' WHERE ' + ' AND '.join(where)
            sql = f'''
                SELECT r.id, r.user_id, COALESCE(r.bookmaker,''), COALESCE(r.request_type,''),
                       COALESCE(r.amount,0), COALESCE(r.status,'pending'), COALESCE(r.created_at,''),
                       COALESCE(u.username,''), COALESCE(u.first_name,''), COALESCE(u.last_name,'')
                FROM requests r
                LEFT JOIN users u ON r.user_id = u.telegram_id
                {where_sql}
                ORDER BY datetime(COALESCE(r.created_at,'1970-01-01')) DESC
                LIMIT 200
            '''
            cursor.execute(sql, params)
            transactions = []
            for rid, user_id, bookmaker, rtype, amount, status, created_at, username, first_name, last_name in cursor.fetchall():
                user_name = username or f"{first_name or ''} {last_name or ''}".strip() or f"Пользователь {user_id}"
                transactions.append({
                    'id': rid,
                    'user_id': user_id,
                    'user_name': user_name,
                    'bookmaker': bookmaker,
                    'type': 'deposit' if rtype == 'deposit' else 'withdrawal',
                    'amount': float(amount) if amount is not None else 0.0,
                    'status': status,
                    'created_at': created_at,
                    'description': bookmaker
                })

            conn.close()
            return JsonResponse({'success': True, 'transactions': transactions})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)

def users(request):
    """Страница пользователей"""
    return render(request, 'dashboard/users_mobile.html')

def referrals(request):
    """Страница рефералов"""
    return render(request, 'dashboard/referrals_mobile.html')

def logs(request):
    """Страница логов"""
    return render(request, 'dashboard/logs_mobile.html')