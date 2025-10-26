"""
Views for deposit and withdrawal requests
"""

from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from datetime import timedelta
import json
import logging
import sqlite3
from django.conf import settings
from .referral_models import ReferralWithdrawalRequest

from .auto_deposit_models import BankNotification, AutoDepositRequest, PlayerBalance
from .bot_models import BotDepositRequestRaw, BotWithdrawRequestRaw

logger = logging.getLogger(__name__)

def deposits_list(request):
    """
    Main page with deposit requests
    """
    try:
        # Get filters
        status_filter = request.GET.get('status', 'all')
        search_query = request.GET.get('search', '')
        page_number = request.GET.get('page', 1)
        
        # Connect to the database
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Base query for deposits
        query = '''
            SELECT r.*
            FROM deposit_requests r
            WHERE 1=1
        '''
        
        params = []
        
        # Filter by status
        if status_filter != 'all':
            query += ' AND r.status = ?'
            params.append(status_filter)
        
        # Search
        if search_query:
            query += ' AND (r.user_id LIKE ? OR r.amount LIKE ? OR r.bookmaker LIKE ? OR r.bank LIKE ?)'
            search_param = f'%{search_query}%'
            params.extend([search_param] * 4)
        
        # Sorting
        query += ' ORDER BY r.created_at DESC'
        
        # Execute query
        cursor.execute(query, params)
        all_deposits = cursor.fetchall()
        
        # Get statistics
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM deposit_requests
        ''')
        
        stats_row = cursor.fetchone()
        stats = {
            'total': stats_row['total'] or 0,
            'pending': stats_row['pending'] or 0,
            'completed': stats_row['completed'] or 0,
            'rejected': stats_row['rejected'] or 0,
        }
        
        # Pagination
        paginator = Paginator(all_deposits, 20)
        page_obj = paginator.get_page(page_number)
        
        # Convert rows to dictionaries
        deposits_list = []
        for row in page_obj.object_list:
            item = dict(row)
            # Если в таблице requests есть флаг auto_completed=1 — помечаем статус для отображения
            try:
                if ('auto_completed' in item and (item['auto_completed'] == 1 or item['auto_completed'] == '1')):
                    item['status'] = 'auto_completed'
            except Exception:
                pass
            deposits_list.append(item)
        
        context = {
            'page_obj': page_obj,
            'deposits': deposits_list,
            'stats': stats,
            'status_filter': status_filter,
            'search_query': search_query,
        }
        
        conn.close()
        return render(request, 'bot_control/deposits_list.html', context)
        
    except Exception as e:
        logger.error(f"Error in deposits_list: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def user_chat(request, user_id: int):
    """Full-page chat for a given user_id."""
    try:
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute('SELECT user_id, username, first_name, last_name FROM users WHERE user_id=?', (user_id,))
        row = cur.fetchone()
        conn.close()
        user = dict(row) if row else {'user_id': user_id, 'username': '', 'first_name': '', 'last_name': ''}
        return render(request, 'bot_control/chat_full.html', {'user': user})
    except Exception as e:
        logger.error(f"Error in user_chat: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def user_profile(request, user_id: int):
    """User profile: aggregates and all requests for a given user_id (from Django DB)."""
    try:
        from bot_control.models import Request
        from django.db.models import Sum, Count
        
        # User info (упрощенно, так как нет таблицы users в Django)
        user = {
            'user_id': user_id, 
            'username': '', 
            'first_name': '', 
            'last_name': ''
        }

        # Aggregates через Django ORM
        def _agg(req_type):
            stats = Request.objects.filter(
                user_id=user_id,
                request_type=req_type,
                status__in=['completed', 'approved', 'auto_completed']
            ).aggregate(
                total_amount=Sum('amount'),
                count=Count('id')
            )
            return float(stats['total_amount'] or 0), int(stats['count'] or 0)

        total_dep, dep_cnt = _agg('deposit')
        total_wdr, wdr_cnt = _agg('withdraw')

        # Requests list (last 300) через Django ORM
        requests_queryset = Request.objects.filter(user_id=user_id).order_by('-created_at')[:300]
        
        items = []
        for req in requests_queryset:
            items.append({
                'id': req.id,
                'type': req.request_type or 'deposit',
                'amount': float(req.amount or 0),
                'status': req.status,
                'created_at': req.created_at.isoformat() if req.created_at else '',
                'bookmaker': req.bookmaker or '',
            })

        # Try to resolve Telegram avatar URL (optional)
        avatar_url = ''
        try:
            bot_token = getattr(settings, 'BOT_TOKEN', '')
            if bot_token and user_id:
                import requests as _req
                api = f"https://api.telegram.org/bot{bot_token}"
                # Get first profile photo
                r = _req.get(f"{api}/getUserProfilePhotos", params={"user_id": user_id, "limit": 1}, timeout=4)
                jr = r.json() if r.ok else {}
                photos = (jr.get('result') or {}).get('photos') or []
                if photos:
                    sizes = photos[0] or []
                    # take the largest size (last)
                    if sizes:
                        file_id = (sizes[-1] or {}).get('file_id')
                        if file_id:
                            rf = _req.get(f"{api}/getFile", params={"file_id": file_id}, timeout=4)
                            jf = rf.json() if rf.ok else {}
                            fp = (jf.get('result') or {}).get('file_path')
                            if fp:
                                avatar_url = f"https://api.telegram.org/file/bot{bot_token}/{fp}"
        except Exception:
            avatar_url = ''

        ctx = {
            'user': user,
            'stats': {
                'total_deposits': total_dep,
                'deposit_count': dep_cnt,
                'total_withdrawals': total_wdr,
                'withdraw_count': wdr_cnt,
                'net': float((total_dep or 0) - (total_wdr or 0)),
            },
            'requests': items,
            'avatar_url': avatar_url,
        }
        return render(request, 'bot_control/user_profile.html', ctx)
    except Exception as e:
        logger.error(f"Error in user_profile: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def transaction_detail(request, trans_id):
    """Transaction details from requests table"""
    try:
        from bot_control.models import Request
        
        # Основная транзакция через Django ORM
        try:
            req = Request.objects.get(id=trans_id)
        except Request.DoesNotExist:
            return render(request, 'bot_control/404.html')

        tx = {
            'id': req.id,
            'user_id': req.user_id,
            'username': req.username or '',
            'first_name': req.first_name or '',
            'last_name': req.last_name or '',
            'request_type': req.request_type,
            'amount': req.amount,
            'status': req.status,
            'bookmaker': req.bookmaker,
            'account_id': req.account_id,
            'bank': req.bank,
            'phone': req.phone,
            'created_at': req.created_at,
            'updated_at': req.updated_at,
            'processed_at': req.processed_at,
            'withdrawal_code': req.withdrawal_code,
            'photo_file_id': req.photo_file_id,
            'photo_file_url': req.photo_file_url,
        }

        # Пытаемся восстановить URL фото (разные пайплайны пишут в разные поля)
        photo_url = (
            tx.get('photo_file_url') or
            tx.get('receipt_photo_url') or
            tx.get('qr_photo_url') or
            tx.get('photo_url') or
            tx.get('screenshot_url') or
            ''
        )
        
        try:
            if photo_url:
                # Если путь относительный (локальный файл), строим абсолютный URL через MEDIA_URL
                if not (str(photo_url).startswith('http://') or str(photo_url).startswith('https://')):
                    media_url = getattr(settings, 'MEDIA_URL', '/media/')
                    # Убираем возможный префикс / если MEDIA_URL уже содержит его
                    if str(photo_url).startswith('/'):
                        photo_url = str(photo_url).lstrip('/')
                    # Строим абсолютный URL
                    photo_url = request.build_absolute_uri(f"{media_url}{photo_url}")
            else:
                file_id = (tx.get('photo_file_id') or '').strip()
                bot_token = getattr(settings, 'BOT_TOKEN', '')
                if file_id and bot_token:
                    import requests as _req
                    api = f"https://api.telegram.org/bot{bot_token}"
                    rf = _req.get(f"{api}/getFile", params={"file_id": file_id}, timeout=3)
                    jf = rf.json() if rf.ok else {}
                    fp = (jf.get('result') or {}).get('file_path')
                    if fp:
                        photo_url = f"https://api.telegram.org/file/bot{bot_token}/{fp}"
        except Exception:
            photo_url = tx.get('photo_file_url') or ''

        # Другие заявки пользователя (последние 100)
        user_requests = []
        try:
            uid = tx.get('user_id')
            if uid is not None:
                cursor.execute('''
                    SELECT id, request_type, amount, status, created_at
                    FROM requests
                    WHERE user_id = ?
                    ORDER BY datetime(COALESCE(created_at,'1970-01-01')) DESC
                    LIMIT 100
                ''', (uid,))
                for rid, rtype, amount, status, created in cursor.fetchall():
                    user_requests.append({
                        'id': rid,
                        'type': (rtype or 'deposit'),
                        'amount': float(amount or 0),
                        'status': status or 'pending',
                        'created_at': created,
                    })
        except Exception:
            user_requests = []

        from django.conf import settings as dj_settings
        return render(request, 'bot_control/transaction_detail.html', {
            'transaction': tx,
            'photo_url': photo_url,
            'user_requests': user_requests,
            'api_token': getattr(dj_settings, 'DJANGO_ADMIN_API_TOKEN', '')
        })
        
    except Exception as e:
        logger.error(f"Error in transaction_detail: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def request_detail(request, req_id):
    """Request details from unified requests table"""
    try:
        # Подключаемся к общей БД бота
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Получаем детали заявки
        cursor.execute('''
            SELECT r.*, u.username, u.first_name, u.last_name
            FROM requests r
            LEFT JOIN users u ON r.user_id = u.telegram_id
            WHERE r.id = ? OR r.request_id = ?
        ''', (req_id, req_id))
        
        request_data = cursor.fetchone()
        if not request_data:
            conn.close()
            return render(request, 'bot_control/error.html', {'error': 'Заявка не найдена'})
        
        # Получаем историю действий для этой заявки
        cursor.execute('''
            SELECT * FROM user_actions
            WHERE data LIKE ? AND action LIKE '%request%'
            ORDER BY timestamp DESC
        ''', (f'%{req_id}%',))
        
        actions = cursor.fetchall()
        
        conn.close()
        
        return render(request, 'bot_control/request_detail.html', {
            'request': request_data,
            'actions': actions
        })
        
    except Exception as e:
        logger.error(f"Error in request_detail: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def deposit_detail(request, deposit_id):
    """Deposit request details"""
    try:
        deposit = get_object_or_404(AutoDepositRequest, id=deposit_id)

        # Load recent requests history for the same user from bot DB (SQLite)
        user_history = []
        try:
            uid = getattr(deposit, 'user_id', None)
            if uid is not None:
                conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute('''
                    SELECT id, COALESCE(request_type,'') AS request_type, COALESCE(amount,0) AS amount,
                           COALESCE(status,'pending') AS status, COALESCE(created_at,'') AS created_at
                    FROM requests
                    WHERE user_id = ?
                    ORDER BY datetime(COALESCE(created_at,'1970-01-01')) DESC
                    LIMIT 100
                ''', (uid,))
                for row in cur.fetchall():
                    user_history.append({
                        'id': row['id'],
                        'request_type': row['request_type'] or 'deposit',
                        'amount': float(row['amount'] or 0),
                        'status': row['status'] or 'pending',
                        'created_at': row['created_at'] or '',
                    })
                conn.close()
        except Exception:
            user_history = []

        return render(request, 'bot_control/deposit_detail.html', {
            'deposit': deposit,
            'user_history': user_history,
        })
    except Exception as e:
        logger.error(f"Error in deposit_detail: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def withdrawals_list(request):
    """
    Withdrawal requests list from bot database
    """
    try:
        # Filters
        status_filter = request.GET.get('status', 'all')
        search_query = request.GET.get('search', '').strip()
        page_number = request.GET.get('page', 1)

        # Connect to bot database
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Base query for withdrawals
        query = '''
            SELECT id, user_id, amount, bookmaker, bank, phone, site_code, 
                   qr_photo, request_id, status, created_at, updated_at
            FROM withdrawals
            WHERE 1=1
        '''
        
        params = []
        
        # Filter by status
        if status_filter != 'all':
            query += ' AND status = ?'
            params.append(status_filter)
        
        # Search
        if search_query:
            try:
                # Try to search by ID
                uid = int(search_query)
                query += ' AND user_id = ?'
                params.append(uid)
            except ValueError:
                # Search by amount, bank, phone, site_code
                query += ' AND (amount LIKE ? OR bank LIKE ? OR phone LIKE ? OR site_code LIKE ? OR request_id LIKE ?)'
                search_term = f'%{search_query}%'
                params.extend([search_term, search_term, search_term, search_term, search_term])
        
        query += ' ORDER BY created_at DESC'
        
        # Get total count for stats
        count_query = query.replace('SELECT id, user_id, amount, bookmaker, bank, phone, site_code, qr_photo, request_id, status, created_at, updated_at', 'SELECT COUNT(*)')
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()[0]
        
        # Get stats
        cursor.execute('SELECT status, COUNT(*) FROM withdrawals GROUP BY status')
        status_counts = dict(cursor.fetchall())
        
        stats = {
            'total': total_count,
            'pending': status_counts.get('pending', 0),
            'completed': status_counts.get('completed', 0),
            'rejected': status_counts.get('rejected', 0),
        }
        
        # Pagination
        cursor.execute(query, params)
        all_results = cursor.fetchall()
        
        # Simple pagination
        per_page = 20
        start = (int(page_number) - 1) * per_page
        end = start + per_page
        page_results = all_results[start:end]
        
        # Convert to list of dicts
        withdrawals_list = []
        for row in page_results:
            withdrawals_list.append({
                'id': row['id'],
                'user_id': row['user_id'],
                'amount': float(row['amount']),
                'bookmaker': row['bookmaker'],
                'bank': row['bank'],
                'phone': row['phone'],
                'site_code': row['site_code'],
                'qr_photo': row['qr_photo'],
                'request_id': row['request_id'],
                'status': row['status'],
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
            })
        
        # Create pagination object
        from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
        paginator = Paginator(all_results, per_page)
        try:
            page_obj = paginator.page(page_number)
        except (EmptyPage, PageNotAnInteger):
            page_obj = paginator.page(1)
        
        conn.close()

        context = {
            'page_obj': page_obj,
            'withdrawals': withdrawals_list,
            'stats': stats,
            'status_filter': status_filter,
            'search_query': search_query,
        }

        # Render template
        return render(request, 'bot_control/withdrawals_list.html', context)

    except Exception as e:
        logger.error(f"Error in withdrawals_list: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

@csrf_exempt
@require_http_methods(["POST"])
def api_deposit_status(request, deposit_id):
    """API to update deposit status"""
    try:
        if request.method == 'POST':
            data = json.loads(request.body)
            new_status = data.get('status')
            admin_comment = data.get('comment', '')
            
            deposit = get_object_or_404(AutoDepositRequest, id=deposit_id)
            deposit.status = new_status
            deposit.admin_comment = admin_comment
            deposit.processed_at = timezone.now()
            deposit.save()
            
            return JsonResponse({
                'success': True,
                'message': f'Deposit request {deposit_id} updated to {new_status}'
            })
        else:
            return JsonResponse({'error': 'Method not allowed'}, status=405)
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def auto_deposit_api(request):
    """
    API for processing automatic deposits
    """
    try:
        data = json.loads(request.body)
        
        request_id = data.get('request_id')
        user_id = data.get('user_id')
        amount = data.get('amount')
        bookmaker = data.get('bookmaker')
        transaction_date = data.get('transaction_date')
        source = data.get('source', 'email_parser')
        
        logger.info(f"Received auto deposit: {request_id}, {amount} KGS, {bookmaker}")
        
        # Validate required fields
        if not all([request_id, user_id, amount, bookmaker, transaction_date]):
            return JsonResponse({
                'success': False,
                'error': 'Missing required fields'
            }, status=400)
        
        # Check if request already exists
        if AutoDepositRequest.objects.filter(request_id=request_id).exists():
            return JsonResponse({
                'success': False,
                'error': 'Request ID already exists'
            }, status=400)
        
        # Create new deposit request
        deposit = AutoDepositRequest.objects.create(
            request_id=request_id,
            user_id=user_id,
            amount=amount,
            bookmaker=bookmaker,
            transaction_date=transaction_date,
            source=source,
            status='pending'
        )
        
        logger.info(f"Created new deposit request: {deposit.id}")
        
        return JsonResponse({
            'success': True,
            'deposit_id': deposit.id
        })
        
    except Exception as e:
        logger.error(f"Error in auto_deposit_api: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

def dashboard(request):
    """Main dashboard view"""
    try:
        # Get recent deposits
        recent_deposits = AutoDepositRequest.objects.order_by('-created_at')[:5]
        
        # Get recent withdrawals
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT r.*, u.username, u.first_name
            FROM requests r
            LEFT JOIN users u ON r.user_id = u.telegram_id
            WHERE r.request_type = 'withdraw'
            ORDER BY r.created_at DESC
            LIMIT 5
        ''')
        
        recent_withdrawals = [dict(row) for row in cursor.fetchall()]
        
        # Get statistics
        deposit_stats = AutoDepositRequest.objects.aggregate(
            total=Count('id'),
            pending=Count('id', filter=Q(status='pending')),
            completed=Count('id', filter=Q(status='completed')),
            rejected=Count('id', filter=Q(status='rejected'))
        )
        
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM withdrawal_requests
        ''')
        
        withdrawal_stats = dict(cursor.fetchone())
        
        # Format stats
        for stat in [deposit_stats, withdrawal_stats]:
            for key, value in stat.items():
                if value is None:
                    stat[key] = 0
        
        conn.close()
        
        context = {
            'recent_deposits': recent_deposits,
            'recent_withdrawals': recent_withdrawals,
            'deposit_stats': deposit_stats,
            'withdrawal_stats': withdrawal_stats,
        }
        
        return render(request, 'bot_control/dashboard.html', context)
        
    except Exception as e:
        logger.error(f"Error in dashboard: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def menu(request):
    """
    Menu page with navigation options
    """
    try:
        return render(request, 'dashboard/menu_mobile.html')
    except Exception as e:
        logger.error(f"Error in menu: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})