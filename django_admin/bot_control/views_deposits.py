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
        from bot_control.models import Request
        from django.db.models import Q, Count
        from django.core.paginator import Paginator
        
        # Get filters
        status_filter = request.GET.get('status', 'all')
        search_query = request.GET.get('search', '')
        page_number = request.GET.get('page', 1)
        
        # Base queryset for deposits using Django ORM
        queryset = Request.objects.filter(request_type='deposit')
        
        # Filter by status
        if status_filter != 'all':
            queryset = queryset.filter(status=status_filter)
        
        # Search
        if search_query:
            queryset = queryset.filter(
                Q(user_id__icontains=search_query) |
                Q(amount__icontains=search_query) |
                Q(bookmaker__icontains=search_query) |
                Q(bank__icontains=search_query)
            )
        
        # Sorting
        queryset = queryset.order_by('-created_at')
        
        # Get statistics using Django ORM
        stats = Request.objects.filter(request_type='deposit').aggregate(
            total=Count('id'),
            pending=Count('id', filter=Q(status='pending')),
            completed=Count('id', filter=Q(status='completed')),
            rejected=Count('id', filter=Q(status='rejected'))
        )
        
        # Pagination
        paginator = Paginator(queryset, 20)
        page_obj = paginator.get_page(page_number)
        
        # Convert to list of dictionaries for template compatibility
        deposits_list = []
        for req in page_obj.object_list:
            deposits_list.append({
                'id': req.id,
                'user_id': req.user_id,
                'username': req.username,
                'first_name': req.first_name,
                'last_name': req.last_name,
                'bookmaker': req.bookmaker,
                'account_id': req.account_id,
                'amount': req.amount,
                'status': req.status,
                'bank': req.bank,
                'phone': req.phone,
                'created_at': req.created_at,
                'updated_at': req.updated_at,
                'processed_at': req.processed_at,
                'withdrawal_code': req.withdrawal_code,
                'photo_file_id': req.photo_file_id,
                'photo_file_url': req.photo_file_url,
            })
        
        context = {
            'page_obj': page_obj,
            'deposits': deposits_list,
            'stats': stats,
            'status_filter': status_filter,
            'search_query': search_query,
        }
        
        return render(request, 'bot_control/deposits_list.html', context)
        
    except Exception as e:
        logger.error(f"Error in deposits_list: {str(e)}", exc_info=True)
        return render(request, 'bot_control/error.html', {'error': str(e)})

def user_chat(request, user_id: int):
    """Full-page chat for a given user_id."""
    try:
        from bot_control.models import UserProfile
        
        # Получаем данные пользователя через Django ORM
        try:
            profile = UserProfile.objects.get(user_id=user_id)
            user = {
                'user_id': user_id,
                'username': profile.username or '',
                'first_name': profile.first_name or '',
                'last_name': profile.last_name or ''
            }
        except UserProfile.DoesNotExist:
            # Если профиль не найден, создаем базовую структуру
            user = {
                'user_id': user_id,
                'username': '',
                'first_name': '',
                'last_name': ''
            }
        
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
            LEFT JOIN users u ON r.user_id = u.user_id
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
    Withdrawal requests list from Django database
    """
    try:
        from bot_control.models import Request
        from django.db.models import Q, Count
        from django.core.paginator import Paginator
        
        # Filters
        status_filter = request.GET.get('status', 'all')
        search_query = request.GET.get('search', '').strip()
        page_number = request.GET.get('page', 1)

        # Base queryset for withdrawals using Django ORM
        queryset = Request.objects.filter(request_type='withdraw')
        
        # Filter by status
        if status_filter != 'all':
            queryset = queryset.filter(status=status_filter)
        
        # Search
        if search_query:
            try:
                # Try to search by ID
                uid = int(search_query)
                queryset = queryset.filter(user_id=uid)
            except ValueError:
                # Search by amount, bank, phone, bookmaker
                queryset = queryset.filter(
                    Q(amount__icontains=search_query) |
                    Q(bank__icontains=search_query) |
                    Q(phone__icontains=search_query) |
                    Q(bookmaker__icontains=search_query) |
                    Q(account_id__icontains=search_query)
                )
        
        # Sorting
        queryset = queryset.order_by('-created_at')
        
        # Get statistics using Django ORM
        stats = Request.objects.filter(request_type='withdraw').aggregate(
            total=Count('id'),
            pending=Count('id', filter=Q(status='pending')),
            completed=Count('id', filter=Q(status='completed')),
            rejected=Count('id', filter=Q(status='rejected'))
        )
        
        # Pagination
        paginator = Paginator(queryset, 20)
        page_obj = paginator.get_page(page_number)
        
        # Convert to list of dictionaries for template compatibility
        withdrawals_list = []
        for req in page_obj.object_list:
            withdrawals_list.append({
                'id': req.id,
                'user_id': req.user_id,
                'amount': float(req.amount) if req.amount else 0,
                'bookmaker': req.bookmaker,
                'bank': req.bank,
                'phone': req.phone,
                'account_id': req.account_id,
                'withdrawal_code': req.withdrawal_code,
                'photo_file_id': req.photo_file_id,
                'photo_file_url': req.photo_file_url,
                'status': req.status,
                'created_at': req.created_at,
                'updated_at': req.updated_at,
            })

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
            LEFT JOIN users u ON r.user_id = u.user_id
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


# Функции для чата
@csrf_exempt
@require_http_methods(["GET"])
def chat_history(request, user_id: int):
    """
    API для получения истории чата с пользователем
    """
    try:
        from .models import ChatMessage
        
        # Получаем последние 100 сообщений
        messages = ChatMessage.objects.filter(user_id=user_id).order_by('created_at')[:100]
        
        items = []
        for msg in messages:
            item = {
                'direction': msg.direction,
                'message': msg.message_text or '',
                'kind': msg.message_type,
                'media_url': msg.media_url or '',
                'created_at': msg.created_at.isoformat() if msg.created_at else None
            }
            items.append(item)
        
        return JsonResponse({
            'success': True,
            'items': items
        })
    except Exception as e:
        logger.error(f"Error getting chat history for user {user_id}: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def chat_send_from_admin(request):
    """
    API для отправки сообщения от админа пользователю через Telegram
    """
    try:
        import requests
        from .models import BotConfiguration
        
        data = json.loads(request.body)
        user_id = data.get('user_id')
        message = data.get('message')
        
        if not user_id or not message:
            return JsonResponse({
                'success': False,
                'error': 'user_id и message обязательны'
            }, status=400)
        
        # Получаем токен бота из настроек
        bot_token = BotConfiguration.get_setting('bot_token', '')
        
        if not bot_token:
            logger.error("Bot token not configured")
            return JsonResponse({
                'success': False,
                'error': 'Токен бота не настроен'
            }, status=500)
        
        # Отправляем сообщение через Telegram Bot API
        telegram_url = f'https://api.telegram.org/bot{bot_token}/sendMessage'
        payload = {
            'chat_id': user_id,
            'text': message,
            'parse_mode': 'HTML'
        }
        
        response = requests.post(telegram_url, json=payload, timeout=10)
        result = response.json()
        
        if response.ok and result.get('ok'):
            # Сохраняем сообщение в историю
            from .models import ChatMessage
            ChatMessage.objects.create(
                user_id=user_id,
                message_text=message,
                message_type='text',
                direction='out',
                telegram_message_id=result.get('result', {}).get('message_id')
            )
            
            logger.info(f"Message sent successfully to user {user_id}")
            return JsonResponse({
                'success': True,
                'message': 'Сообщение отправлено',
                'telegram_response': result
            })
        else:
            error_description = result.get('description', 'Unknown error')
            logger.error(f"Telegram API error: {error_description}")
            return JsonResponse({
                'success': False,
                'error': f'Ошибка Telegram API: {error_description}'
            }, status=500)
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error sending message: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': f'Ошибка сети: {str(e)}'
        }, status=500)
    except Exception as e:
        logger.error(f"Error sending message from admin: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def chat_typing_from_admin(request):
    """
    API для отправки индикатора печатания от админа
    """
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        is_typing = data.get('is_typing', True)
        
        # TODO: Implement actual typing indicator
        # For now, just return success
        return JsonResponse({
            'success': True,
            'message': 'Typing indicator sent'
        })
    except Exception as e:
        logger.error(f"Error sending typing indicator: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def chat_send_media_from_admin(request):
    """
    API для отправки медиа-файлов от админа пользователю через Telegram
    """
    try:
        import requests
        from .models import BotConfiguration
        
        user_id = request.POST.get('user_id')
        media_type = request.POST.get('media_type', 'photo')  # photo, video, document
        caption = request.POST.get('caption', '')
        file = request.FILES.get('file')
        
        if not user_id or not file:
            return JsonResponse({
                'success': False,
                'error': 'user_id и file обязательны'
            }, status=400)
        
        # Получаем токен бота из настроек
        bot_token = BotConfiguration.get_setting('bot_token', '')
        
        if not bot_token:
            logger.error("Bot token not configured")
            return JsonResponse({
                'success': False,
                'error': 'Токен бота не настроен'
            }, status=500)
        
        # Определяем метод API в зависимости от типа медиа
        if media_type == 'photo':
            telegram_url = f'https://api.telegram.org/bot{bot_token}/sendPhoto'
            file_key = 'photo'
        elif media_type == 'video':
            telegram_url = f'https://api.telegram.org/bot{bot_token}/sendVideo'
            file_key = 'video'
        else:
            telegram_url = f'https://api.telegram.org/bot{bot_token}/sendDocument'
            file_key = 'document'
        
        # Подготавливаем данные для отправки
        files = {file_key: (file.name, file.read(), file.content_type)}
        data = {'chat_id': user_id}
        if caption:
            data['caption'] = caption
        
        # Отправляем через Telegram Bot API
        response = requests.post(telegram_url, data=data, files=files, timeout=30)
        result = response.json()
        
        if response.ok and result.get('ok'):
            # Сохраняем медиа в историю
            from .models import ChatMessage
            
            # Пытаемся получить URL файла из ответа
            file_info = result.get('result', {})
            media_url = ''
            if media_type == 'photo' and 'photo' in file_info:
                # Берем самое большое фото
                photos = file_info['photo']
                if photos:
                    media_url = photos[-1].get('file_id', '')
            elif media_type == 'video' and 'video' in file_info:
                media_url = file_info['video'].get('file_id', '')
            
            ChatMessage.objects.create(
                user_id=user_id,
                message_text=caption,
                message_type=media_type,
                media_url=media_url,
                direction='out',
                telegram_message_id=file_info.get('message_id')
            )
            
            logger.info(f"Media sent successfully to user {user_id}")
            return JsonResponse({
                'success': True,
                'message': 'Медиа отправлено',
                'telegram_response': result
            })
        else:
            error_description = result.get('description', 'Unknown error')
            logger.error(f"Telegram API error: {error_description}")
            return JsonResponse({
                'success': False,
                'error': f'Ошибка Telegram API: {error_description}'
            }, status=500)
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error sending media: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': f'Ошибка сети: {str(e)}'
        }, status=500)
    except Exception as e:
        logger.error(f"Error sending media from admin: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)