#!/usr/bin/env python3
"""
API views для интеграции с ботом
"""
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.conf import settings
import json
import logging
import requests
import sqlite3

from .referral_models import ReferralWithdrawalRequest
from .models import BotDepositRequest, BotWithdrawRequest, BotConfiguration
from .views_referral import (
    _get_user_ctx,
    _get_referral_stats,
    _get_leaderboard,
    _get_bot_username,
)

@csrf_exempt
@require_http_methods(["POST"])
def create_deposit_request(request):
    """API для создания заявки на пополнение"""
    try:
        data = json.loads(request.body)

        required_fields = ['user_id', 'bookmaker', 'account_id', 'amount']
        for field in required_fields:
            if field not in data:
                return JsonResponse({
                    'success': False,
                    'error': f'Отсутствует обязательное поле: {field}'
                }, status=400)

        deposit = BotDepositRequest.objects.create(
            user_id=data['user_id'],
            username=data.get('username', ''),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            bookmaker=data['bookmaker'],
            account_id=data['account_id'],
            amount=data['amount'],
            bank=data.get('bank', ''),
            status=data.get('status', 'pending'),
            receipt_photo=data.get('receipt_photo', ''),
            receipt_photo_url=data.get('receipt_photo_url', ''),
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )

        return JsonResponse({'success': True, 'request_id': deposit.id, 'message': 'Заявка на пополнение создана успешно'})
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Неверный JSON формат'}, status=400)
    except Exception as e:
        logging.exception("create_deposit_request failed: %s", e)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ============================
# Referral public JSON APIs (for separate site)
# ============================

@require_http_methods(["GET"])
def referral_stats(request: HttpRequest):
    """Return profile, stats and referral link for a given user_id."""
    try:
        uid = request.GET.get('user_id')
        if not uid or not str(uid).isdigit():
            return JsonResponse({'success': False, 'error': 'user_id is required'}, status=400)
        user_id = int(uid)

        user = _get_user_ctx(user_id)
        stats = _get_referral_stats(user_id)
        bot_username = _get_bot_username()
        referral_link = f"https://t.me/{bot_username}?start=ref_{user_id}"

        return JsonResponse({
            'success': True,
            'user': {
                'user_id': user.user_id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
            },
            'stats': stats,
            'referral_link': referral_link,
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_http_methods(["GET"])
def referral_leaderboard(request: HttpRequest):
    """Return top-3 leaderboard of users with most active referrals."""
    try:
        items = _get_leaderboard(limit=3)
        return JsonResponse({'success': True, 'items': items})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def create_withdraw_request(request):
    """API для создания заявки на вывод"""
    try:
        data = json.loads(request.body)
        
        # Валидация обязательных полей
        required_fields = ['user_id', 'bookmaker', 'account_id', 'amount', 'withdrawal_code']
        for field in required_fields:
            if field not in data:
                return JsonResponse({
                    'success': False,
                    'error': f'Отсутствует обязательное поле: {field}'
                }, status=400)
        
        # Создание заявки
        withdraw_request = BotWithdrawRequest.objects.create(
            user_id=data['user_id'],
            username=data.get('username', ''),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            bookmaker=data['bookmaker'],
            account_id=data['account_id'],
            amount=data['amount'],
            bank=data.get('bank', ''),
            withdrawal_code=data['withdrawal_code'],
            status=data.get('status', 'pending'),
            qr_photo=data.get('qr_photo', '') or data.get('receipt_photo', ''),
            qr_photo_url=data.get('qr_photo_url', '') or data.get('receipt_photo_url', ''),
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        
        return JsonResponse({
            'success': True,
            'request_id': withdraw_request.id,
            'message': 'Заявка на вывод создана успешно'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Неверный JSON формат'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ============================
# Referral Withdrawal Endpoints
# ============================

def _fake_bookmaker_call(bookmaker: str, account_id: str, amount: float, currency: str, user_id: int) -> bool:
    url = getattr(settings, 'FAKE_BOOKMAKER_API_URL', 'https://httpbin.org/status/200')
    try:
        resp = requests.post(url, json={
            'bookmaker': bookmaker,
            'account_id': account_id,
            'amount': amount,
            'currency': currency,
            'user_id': user_id,
        }, timeout=8)
        return 200 <= resp.status_code < 300
    except Exception:
        return False


@csrf_exempt
@require_http_methods(["POST"])
def create_referral_withdraw_request(request: HttpRequest):
    """Создать заявку на вывод реферальных средств"""
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
        required = ['user_id', 'amount', 'bookmaker', 'bookmaker_account_id', 'payment_method', 'wallet_details']
        missing = [k for k in required if not data.get(k)]
        if missing:
            return JsonResponse({'success': False, 'error': f'Missing fields: {", ".join(missing)}'}, status=400)

        # Normalize input
        user_id = int(data['user_id'])
        try:
            requested_amount = round(float(data['amount']), 2)
        except Exception:
            return JsonResponse({'success': False, 'error': 'Invalid amount'}, status=400)
        if requested_amount <= 0:
            return JsonResponse({'success': False, 'error': 'Amount must be greater than 0'}, status=400)

        # Balance check against referral stats
        from .views_referral import _get_referral_stats
        stats = _get_referral_stats(user_id)
        balance = float(stats.get('balance') or 0.0)
        if requested_amount > balance + 1e-6:
            return JsonResponse({'success': False, 'error': 'Недостаточно средств для вывода'}, status=400)

        obj = ReferralWithdrawalRequest.objects.create(
            user_id=user_id,
            username=data.get('username', ''),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            phone_number=data.get('phone_number', ''),
            amount=requested_amount,
            currency=data.get('currency', 'KGS'),
            bookmaker=data['bookmaker'],
            bookmaker_account_id=str(data['bookmaker_account_id']),
            payment_method=data['payment_method'],
            wallet_details=data['wallet_details'],
            status='pending'
        )
        return JsonResponse({'success': True, 'id': obj.id})
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Неверный JSON формат'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_http_methods(["GET"])
def list_referral_withdraw_requests(request: HttpRequest):
    """Получить список заявок на вывод реферальных"""
    try:
        status_filter = request.GET.get('status')
        bookmaker = request.GET.get('bookmaker')
        qs = ReferralWithdrawalRequest.objects.all().order_by('-created_at')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if bookmaker:
            qs = qs.filter(bookmaker=bookmaker)
        items = [{
            'id': o.id,
            'user_id': o.user_id,
            'username': o.username,
            'amount': float(o.amount),
            'currency': o.currency,
            'bookmaker': o.bookmaker,
            'bookmaker_account_id': o.bookmaker_account_id,
            'status': o.status,
            'created_at': o.created_at.isoformat(),
            'processed_at': o.processed_at.isoformat() if o.processed_at else None,
        } for o in qs[:500]]
        return JsonResponse({'success': True, 'items': items})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def approve_referral_withdraw_request(request: HttpRequest, req_id: int):
    """Подтвердить заявку на вывод реферальных"""
    try:
        obj = ReferralWithdrawalRequest.objects.get(pk=req_id)
        if obj.status in ('completed', 'rejected'):
            return JsonResponse({'success': False, 'error': 'Already finalized'}, status=400)
        obj.status = 'processing'
        obj.save()
        ok = _fake_bookmaker_call(obj.bookmaker, obj.bookmaker_account_id, float(obj.amount), obj.currency, obj.user_id)
        if ok:
            obj.status = 'completed'
            obj.processed_at = timezone.now()
            obj.save()
            return JsonResponse({'success': True})
        else:
            return JsonResponse({'success': False, 'error': 'Bookmaker API failed'}, status=502)
    except ReferralWithdrawalRequest.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reject_referral_withdraw_request(request: HttpRequest, req_id: int):
    """Отклонить заявку на вывод реферальных"""
    try:
        obj = ReferralWithdrawalRequest.objects.get(pk=req_id)
        if obj.status == 'completed':
            return JsonResponse({'success': False, 'error': 'Already completed'}, status=400)
        data = json.loads(request.body.decode('utf-8') or '{}')
        comment = data.get('comment', '')
        obj.status = 'rejected'
        obj.admin_comment = comment
        obj.processed_at = timezone.now()
        obj.save()
        return JsonResponse({'success': True})
    except ReferralWithdrawalRequest.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def update_request_status(request):
    """API для обновления статуса заявки (таблица requests)."""
    try:
        data = json.loads(request.body)
        # Обязательные поля: id, status, type
        for field in ('request_id', 'status', 'request_type'):
            if field not in data:
                return JsonResponse({'success': False, 'error': f'Отсутствует обязательное поле: {field}'}, status=400)

        rid = int(data['request_id'])
        status = str(data['status']).strip()
        req_type = 'deposit' if data['request_type'] == 'deposit' else 'withdraw'

        import sqlite3
        bot_db = getattr(settings, 'BOT_DATABASE_PATH', None)
        if not bot_db:
            return JsonResponse({'success': False, 'error': 'BOT_DATABASE_PATH не задан'}, status=500)

        conn = sqlite3.connect(str(bot_db))
        cur = conn.cursor()

        # Получаем запись
        cur.execute("SELECT id, user_id, COALESCE(bookmaker,''), COALESCE(amount,0), COALESCE(request_type,''), COALESCE(status,'pending') FROM requests WHERE id=?", (rid,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return JsonResponse({'success': False, 'error': 'Заявка не найдена'}, status=404)

        _, user_id, bookmaker, amount, db_req_type, db_status = row

        # Если тип отличается — всё равно обновляем, но сообщим в ответе
        # Если статус не меняется — успех без действий
        if db_status == status:
            conn.close()
            return JsonResponse({'success': True, 'message': f'Статус заявки {rid} уже {status}', 'synced': True})

        # Обновление статуса
        if status in ('completed', 'rejected'):
            cur.execute("UPDATE requests SET status=?, processed_at=datetime('now'), updated_at=datetime('now') WHERE id=?", (status, rid))
        else:
            cur.execute("UPDATE requests SET status=?, updated_at=datetime('now') WHERE id=?", (status, rid))
        conn.commit()

        # Отправляем уведомление в Telegram
        try:
            bot_token = getattr(settings, 'BOT_TOKEN', None)
            if bot_token and user_id:
                status_ru = (
                    'Пополнено' if (status == 'completed' and req_type == 'deposit') else
                    'Выведено' if (status == 'completed' and req_type == 'withdraw') else
                    'Отклонено' if status == 'rejected' else
                    'В обработке' if status == 'processing' else
                    'Ожидает'
                )
                prefix = '✅' if status == 'completed' else ('❌' if status == 'rejected' else 'ℹ️')
                op_ru = 'пополнение' if req_type == 'deposit' else 'вывод'
                text = f"{prefix} Ваша заявка на {op_ru} #{rid} обновлена.\nСтатус: {status_ru}.\nСумма: {amount} KGS\nБукмекер: {bookmaker.upper()}"
                site_base = getattr(settings, 'SITE_BASE_URL', 'http://localhost:8081')
                tx_url = f"{site_base}/bot/transactions/{rid}/"
                reply_markup = {
                    'inline_keyboard': [
                        [ {'text': '🔗 Открыть заявку', 'url': tx_url} ]
                    ]
                }
                api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                requests.post(api_url, json={'chat_id': user_id, 'text': text, 'reply_markup': reply_markup, 'parse_mode': 'HTML', 'disable_web_page_preview': True}, timeout=5)
        except Exception:
            pass

        conn.close()
        return JsonResponse({'success': True, 'message': f'Статус заявки {rid} обновлён', 'synced': True, 'synced_info': {'table': 'requests', 'id': rid}})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@require_http_methods(["GET"])
def get_requests(request):
    """API для получения списка заявок"""
    try:
        request_type = request.GET.get('type', 'all')
        status = request.GET.get('status', 'all')
        limit = int(request.GET.get('limit', 50))
        
        if request_type == 'deposit' or request_type == 'all':
            deposits = BotDepositRequest.objects.all()
            if status != 'all':
                deposits = deposits.filter(status=status)
            deposits = deposits.order_by('-created_at')[:limit]
            
            deposit_data = []
            for deposit in deposits:
                deposit_data.append({
                    'id': deposit.id,
                    'user_id': deposit.user_id,
                    'username': deposit.username,
                    'bookmaker': deposit.bookmaker,
                    'account_id': deposit.account_id,
                    'amount': float(deposit.amount),
                    'bank': deposit.bank,
                    'status': deposit.status,
                    'created_at': deposit.created_at.isoformat(),
                    'receipt_photo_url': getattr(deposit, 'receipt_photo_url', ''),
                })
        else:
            deposit_data = []
        
        if request_type == 'withdraw' or request_type == 'all':
            withdraws = BotWithdrawRequest.objects.all()
            if status != 'all':
                withdraws = withdraws.filter(status=status)
            withdraws = withdraws.order_by('-created_at')[:limit]
            
            withdraw_data = []
            for withdraw in withdraws:
                withdraw_data.append({
                    'id': withdraw.id,
                    'user_id': withdraw.user_id,
                    'username': withdraw.username,
                    'bookmaker': withdraw.bookmaker,
                    'account_id': withdraw.account_id,
                    'amount': float(withdraw.amount),
                    'bank': withdraw.bank,
                    'withdrawal_code': withdraw.withdrawal_code,
                    'status': withdraw.status,
                    'created_at': withdraw.created_at.isoformat(),
                    'qr_photo_url': getattr(withdraw, 'qr_photo_url', ''),
                })
        else:
            withdraw_data = []
        
        return JsonResponse({
            'success': True,
            'deposits': deposit_data,
            'withdraws': withdraw_data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# ============================
# Simple Admin <-> User Chat
# ============================

def _ensure_chat_table(conn):
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            direction TEXT NOT NULL, -- 'in' (from user) | 'out' (from admin)
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()


@require_http_methods(["GET"])
def chat_history(request, user_id: int):
    """Return last N chat messages for user from bot DB."""
    try:
        limit = int(request.GET.get('limit', 100))
        bot_db = getattr(settings, 'BOT_DATABASE_PATH', None)
        if not bot_db:
            return JsonResponse({'success': False, 'error': 'BOT_DATABASE_PATH не задан'}, status=500)
        conn = sqlite3.connect(str(bot_db))
        cur = conn.cursor()
        _ensure_chat_table(conn)
        cur.execute('''
            SELECT id, user_id, direction, message, created_at
            FROM chat_messages
            WHERE user_id=?
            ORDER BY id DESC
            LIMIT ?
        ''', (user_id, limit))
        rows = cur.fetchall()
        conn.close()
        items = [
            {
                'id': rid,
                'user_id': uid,
                'direction': direction,
                'message': message,
                'created_at': created_at,
            }
            for (rid, uid, direction, message, created_at) in reversed(rows)
        ]
        return JsonResponse({'success': True, 'items': items})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def chat_send_from_admin(request):
    """Admin sends a message to user: store in DB and relay via Telegram sendMessage."""
    try:
        data = json.loads(request.body or '{}')
        user_id = int(data.get('user_id') or 0)
        message = str(data.get('message') or '').strip()
        if not user_id or not message:
            return JsonResponse({'success': False, 'error': 'user_id и message обязательны'}, status=400)

        bot_db = getattr(settings, 'BOT_DATABASE_PATH', None)
        if not bot_db:
            return JsonResponse({'success': False, 'error': 'BOT_DATABASE_PATH не задан'}, status=500)
        conn = sqlite3.connect(str(bot_db))
        cur = conn.cursor()
        _ensure_chat_table(conn)
        cur.execute('INSERT INTO chat_messages (user_id, direction, message) VALUES (?, ?, ?)', (user_id, 'out', message))
        conn.commit()
        conn.close()

        # Relay via Telegram (prefer BotConfiguration bot_token, fallback to settings.BOT_TOKEN)
        try:
            cfg_token = (BotConfiguration.get_setting('bot_token') or '').strip()
            settings_token = (getattr(settings, 'BOT_TOKEN', None) or '').strip()
            bot_token = cfg_token or settings_token
            if bot_token:
                api = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                requests.post(api, json={'chat_id': user_id, 'text': message, 'disable_web_page_preview': True}, timeout=6)
        except Exception:
            pass

        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def chat_ingest_from_bot(request):
    """Webhook-like endpoint for the bot to push user's messages into admin chat storage."""
    try:
        data = json.loads(request.body or '{}')
        user_id = int(data.get('user_id') or 0)
        message = str(data.get('message') or '').strip()
        if not user_id or not message:
            return JsonResponse({'success': False, 'error': 'user_id и message обязательны'}, status=400)

        bot_db = getattr(settings, 'BOT_DATABASE_PATH', None)
        if not bot_db:
            return JsonResponse({'success': False, 'error': 'BOT_DATABASE_PATH не задан'}, status=500)
        conn = sqlite3.connect(str(bot_db))
        cur = conn.cursor()
        _ensure_chat_table(conn)
        cur.execute('INSERT INTO chat_messages (user_id, direction, message) VALUES (?, ?, ?)', (user_id, 'in', message))
        conn.commit()
        conn.close()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
