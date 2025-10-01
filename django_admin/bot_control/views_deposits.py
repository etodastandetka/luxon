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

from .models import BankNotification, AutoDepositRequest, PlayerBalance
from .auto_deposit_models import BankNotification as BankNotificationModel, AutoDepositRequest
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
        
        # Base query for deposits (avoid non-existent columns like u.phone_number)
        query = '''
            SELECT r.*, u.username, u.first_name
            FROM requests r
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE r.request_type = 'deposit'
        '''
        
        params = []
        
        # Filter by status
        if status_filter != 'all':
            query += ' AND r.status = ?'
            params.append(status_filter)
        
        # Search
        if search_query:
            query += ' AND (r.user_id LIKE ? OR r.amount LIKE ? OR u.username LIKE ? OR u.first_name LIKE ?)'
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
            FROM requests
            WHERE request_type = 'deposit'
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

def user_profile(request, user_id: int):
    """User profile: aggregates and all requests for a given user_id (from bot DB)."""
    try:
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # User info (if present in users)
        cur.execute('SELECT user_id, username, first_name, last_name FROM users WHERE user_id=?', (user_id,))
        urow = cur.fetchone()
        user = dict(urow) if urow else {'user_id': user_id, 'username': '', 'first_name': '', 'last_name': ''}

        # Aggregates
        def _agg(req_type):
            cur.execute('''
                SELECT COALESCE(SUM(COALESCE(amount,0)),0), COUNT(1)
                FROM requests
                WHERE user_id=? AND request_type=? AND status IN ('completed','approved','auto_completed')
            ''', (user_id, req_type))
            s, c = cur.fetchone() or (0,0)
            return float(s or 0), int(c or 0)

        total_dep, dep_cnt = _agg('deposit')
        total_wdr, wdr_cnt = _agg('withdraw')

        # Requests list (last 300)
        cur.execute('''
            SELECT id, COALESCE(request_type,''), COALESCE(amount,0), COALESCE(status,'pending'), COALESCE(created_at,''), COALESCE(bookmaker,'')
            FROM requests
            WHERE user_id = ?
            ORDER BY datetime(COALESCE(created_at,'1970-01-01')) DESC
            LIMIT 300
        ''', (user_id,))
        items = []
        for rid, rtype, amount, status, created_at, bookmaker in cur.fetchall():
            items.append({
                'id': rid,
                'type': rtype or 'deposit',
                'amount': float(amount or 0),
                'status': status,
                'created_at': created_at,
                'bookmaker': bookmaker,
            })

        conn.close()

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
        }
        return render(request, 'bot_control/user_profile.html', ctx)
    except Exception as e:
        logger.error(f"Error in user_profile: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def transaction_detail(request, trans_id):
    """Transaction details from requests table"""
    try:
        conn = sqlite3.connect(str(settings.BOT_DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Основная транзакция
        cursor.execute('''
            SELECT r.*, u.username, u.first_name
            FROM requests r
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE r.id = ?
        ''', (trans_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return render(request, 'bot_control/404.html')

        tx = dict(row)

        # Пытаемся восстановить URL фото (разные пайплайны пишут в разные поля)
        photo_url = (
            tx.get('photo_file_url') or
            tx.get('receipt_photo_url') or
            tx.get('qr_photo_url') or
            tx.get('photo_url') or
            tx.get('screenshot_url') or
            ''
        )
        photo_debug = {
            'photo_file_url': tx.get('photo_file_url') or '',
            'receipt_photo_url': tx.get('receipt_photo_url') or '',
            'qr_photo_url': tx.get('qr_photo_url') or '',
            'photo_url_field': tx.get('photo_url') or '',
            'screenshot_url': tx.get('screenshot_url') or '',
            'photo_file_id': tx.get('photo_file_id') or '',
            'bot_token_present': bool(getattr(settings, 'BOT_TOKEN', '')),
            'resolved_photo_url': '',
            'resolved_via': '',
        }
        try:
            if not photo_url:
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
                        photo_debug['resolved_via'] = 'telegram_getFile'
            else:
                photo_debug['resolved_via'] = 'direct_field'
        except Exception:
            photo_url = tx.get('photo_file_url') or ''
        photo_debug['resolved_photo_url'] = photo_url or ''

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

        conn.close()

        from django.conf import settings as dj_settings
        return render(request, 'bot_control/transaction_detail.html', {
            'transaction': tx,
            'photo_url': photo_url,
            'user_requests': user_requests,
            'photo_debug': photo_debug,
            'api_token': getattr(dj_settings, 'DJANGO_ADMIN_API_TOKEN', '')
        })
        
    except Exception as e:
        logger.error(f"Error in transaction_detail: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def deposit_detail(request, deposit_id):
    """Deposit request details"""
    try:
        deposit = get_object_or_404(AutoDepositRequest, id=deposit_id)
        return render(request, 'bot_control/deposit_detail.html', {
            'deposit': deposit
        })
    except Exception as e:
        logger.error(f"Error in deposit_detail: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def withdrawals_list(request):
    """
    Withdrawal requests list (Lux minimal). Now sourced from Django model
    ReferralWithdrawalRequest, so new реферальные заявки отображаются сразу.
    """
    try:
        # Filters
        status_filter = request.GET.get('status', 'all')
        search_query = request.GET.get('search', '').strip()
        page_number = request.GET.get('page', 1)

        qs = ReferralWithdrawalRequest.objects.all().order_by('-created_at')
        if status_filter != 'all':
            qs = qs.filter(status=status_filter)
        if search_query:
            # Поиск по user_id, сумме, реквизитам, ID аккаунта
            try:
                uid = int(search_query)
                qs = qs.filter(user_id=uid)
            except ValueError:
                qs = qs.filter(
                    Q(wallet_details__icontains=search_query) |
                    Q(bookmaker_account_id__icontains=search_query) |
                    Q(amount__icontains=search_query)
                )

        # Stats
        stats = {
            'total': qs.count(),
            'pending': qs.filter(status='pending').count(),
            'completed': qs.filter(status='completed').count(),
            'rejected': qs.filter(status='rejected').count(),
        }

        paginator = Paginator(qs, 20)
        page_obj = paginator.get_page(page_number)

        withdrawals_list = [{
            'id': o.id,
            'user_id': o.user_id,
            'amount': float(o.amount),
            'currency': o.currency,
            'status': o.status,
            'created_at': o.created_at,
            'bookmaker': o.bookmaker,
            'bookmaker_account_id': o.bookmaker_account_id,
        } for o in page_obj.object_list]

        context = {
            'page_obj': page_obj,
            'withdrawals': withdrawals_list,
            'stats': stats,
            'status_filter': status_filter,
            'search_query': search_query,
        }

        # Render Lux template
        return render(request, 'bot_control/withdrawals_lux.html', context)

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
            SELECT wr.*, u.username, u.first_name
            FROM withdrawal_requests wr
            LEFT JOIN users u ON wr.user_id = u.user_id
            ORDER BY wr.created_at DESC
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
