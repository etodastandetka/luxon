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
from .models import BotDepositRequest, BotWithdrawRequest, BotConfiguration, TransactionLog
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
# Payment hook from Android app
# ============================

@csrf_exempt
@require_http_methods(["POST"])
def payment_hook(request: HttpRequest):
    """Accept payment notifications and store in TransactionLog.

    Auth: expects header Authorization: Bearer <TOKEN> or Token <TOKEN>.
    TOKEN is taken from settings.PAYMENT_HOOK_TOKEN or BotConfiguration key 'payment_hook_token'.
    """
    try:
        # Auth
        auth = request.headers.get('Authorization', '')
        token = ''
        if auth.lower().startswith('bearer '):
            token = auth.split(' ', 1)[1].strip()
        elif auth.lower().startswith('token '):
            token = auth.split(' ', 1)[1].strip()

        expected = getattr(settings, 'PAYMENT_HOOK_TOKEN', '') or (BotConfiguration.get_setting('payment_hook_token') or '')
        if not expected or token != expected:
            return JsonResponse({'detail': 'Unauthorized'}, status=401)

        # Parse JSON
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'Invalid JSON'}, status=400)

        # Validate
        missing = [k for k in ('amount', 'bank', 'timestamp', 'raw_message') if data.get(k) is None]
        if missing:
            return JsonResponse({'detail': f'Missing fields: {", ".join(missing)}'}, status=400)

        # Coerce fields
        try:
            amount = round(float(data['amount']), 2)
        except Exception:
            return JsonResponse({'detail': 'Invalid amount'}, status=400)

        from django.utils.dateparse import parse_datetime
        ts = parse_datetime(str(data['timestamp']))
        if not ts:
            return JsonResponse({'detail': 'Invalid timestamp'}, status=400)

        obj = TransactionLog.objects.create(
            amount=amount,
            bank=str(data['bank'])[:50],
            timestamp=ts,
            raw_message=str(data.get('raw_message', '')),
            status='received'
        )

        return JsonResponse({'status': obj.status, 'id': obj.id})
    except Exception as e:
        logging.exception('payment_hook failed: %s', e)
        return JsonResponse({'detail': str(e)}, status=500)


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


@require_http_methods(["GET"])
def pending_requests(request: HttpRequest):
    """Return pending deposit requests for the site UI, sourced from the bot DB `requests` table.

    Shape aligns with get_requests() deposit objects: id, user_id, username, bookmaker, account_id, amount, bank, status, created_at, receipt_photo_url
    """
    try:
        limit = int(request.GET.get('limit', 50))
        bot_db = getattr(settings, 'BOT_DATABASE_PATH', None)
        if not bot_db:
            return JsonResponse({'success': False, 'error': 'BOT_DATABASE_PATH не задан'}, status=500)

        conn = sqlite3.connect(str(bot_db))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        # Join users for username/first_name if present
        cur.execute('''
            SELECT r.id, r.user_id, COALESCE(u.username, '') AS username,
                   COALESCE(r.bookmaker,'') AS bookmaker,
                   COALESCE(r.account_id,'') AS account_id,
                   COALESCE(r.amount,0) AS amount,
                   COALESCE(r.bank,'') AS bank,
                   COALESCE(r.status,'pending') AS status,
                   COALESCE(r.created_at,'') AS created_at,
                   -- try multiple photo URL fields for compatibility
                   COALESCE(r.photo_file_url, r.receipt_photo_url, r.qr_photo_url, r.photo_url, r.screenshot_url, '') AS receipt_photo_url
            FROM requests r
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE r.request_type = 'deposit' AND r.status = 'pending'
            ORDER BY datetime(COALESCE(r.created_at,'1970-01-01')) DESC
            LIMIT ?
        ''', (limit,))
        rows = cur.fetchall()
        conn.close()

        deposits = []
        for row in rows:
            item = dict(row)
            # coerce types
            try:
                item['amount'] = float(item.get('amount') or 0)
            except Exception:
                item['amount'] = 0.0
            deposits.append(item)

        return JsonResponse({'success': True, 'deposits': deposits})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

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
            kind TEXT DEFAULT 'text', -- 'text' | 'photo' | 'video'
            media_url TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Add missing columns if DB was created earlier
    cur.execute("PRAGMA table_info(chat_messages)")
    cols = {row[1] for row in cur.fetchall()}
    if 'kind' not in cols:
        cur.execute("ALTER TABLE chat_messages ADD COLUMN kind TEXT DEFAULT 'text'")
    if 'media_url' not in cols:
        cur.execute("ALTER TABLE chat_messages ADD COLUMN media_url TEXT DEFAULT ''")
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
            SELECT id, user_id, direction, message, kind, media_url, created_at
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
                'kind': kind or 'text',
                'media_url': media_url or '',
                'created_at': created_at,
            }
            for (rid, uid, direction, message, kind, media_url, created_at) in reversed(rows)
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
        cur.execute('INSERT INTO chat_messages (user_id, direction, message, kind) VALUES (?, ?, ?, ?) ', (user_id, 'out', message, 'text'))
        conn.commit()
        conn.close()

        # Resolve BOT token: bot.config -> root config.py -> BotConfiguration -> settings.BOT_TOKEN
        token_source = 'bot_config'
        botcfg_token = ''
        root_token = ''
        try:
            # Try import bot/config.py
            import importlib
            bot_cfg = importlib.import_module('bot.config')
            botcfg_token = (getattr(bot_cfg, 'BOT_TOKEN', '') or '').strip()
        except Exception:
            botcfg_token = ''
        try:
            # Try import root-level config.py (not bot/config.py)
            import importlib
            root_cfg = importlib.import_module('config')
            root_token = (getattr(root_cfg, 'BOT_TOKEN', '') or '').strip()
        except Exception:
            root_token = ''
        cfg_token = (BotConfiguration.get_setting('bot_token') or '').strip()
        settings_token = (getattr(settings, 'BOT_TOKEN', None) or '').strip()
        bot_token = botcfg_token or root_token or cfg_token or settings_token
        if not bot_token:
            return JsonResponse({'success': False, 'error': 'BOT token is not configured. Set BotConfiguration key "bot_token" or settings.BOT_TOKEN.'}, status=400)
        if not botcfg_token:
            token_source = 'root_config' if root_token else ('db_config' if cfg_token else 'settings')

        # Call Telegram API
        api = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        try:
            resp = requests.post(api, json={'chat_id': user_id, 'text': message, 'disable_web_page_preview': True}, timeout=8)
            if resp.status_code != 200:
                try:
                    payload = resp.json()
                except Exception:
                    payload = {'raw': resp.text[:300]}
                return JsonResponse({'success': False, 'error': f'Telegram API error {resp.status_code}', 'details': payload, 'token_source': token_source}, status=502)
        except requests.RequestException as e:
            return JsonResponse({'success': False, 'error': f'Telegram request failed: {e}', 'token_source': token_source}, status=502)

        return JsonResponse({'success': True, 'token_source': token_source})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def chat_send_media_from_admin(request: HttpRequest):
    """Admin uploads photo/video and relays to Telegram. Saves media to MEDIA_ROOT to render in history."""
    try:
        user_id = int(request.POST.get('user_id') or 0)
        media_type = (request.POST.get('media_type') or '').strip()  # 'photo' | 'video'
        caption = (request.POST.get('caption') or '').strip()
        file = request.FILES.get('file')
        if not user_id or media_type not in ('photo','video') or not file:
            return JsonResponse({'success': False, 'error': 'user_id, media_type (photo|video) и file обязательны'}, status=400)

        # Save file to MEDIA_ROOT/chat_uploads/<user_id>/
        import os
        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile
        media_root = getattr(settings, 'MEDIA_ROOT', None)
        media_url_root = getattr(settings, 'MEDIA_URL', '/media/')
        subdir = f"chat_uploads/{user_id}/"
        filename = file.name
        path = default_storage.save(os.path.join(subdir, filename), ContentFile(file.read()))
        media_url = media_url_root.rstrip('/') + '/' + path.replace('\\','/')

        # Store in bot DB
        bot_db = getattr(settings, 'BOT_DATABASE_PATH', None)
        if not bot_db:
            return JsonResponse({'success': False, 'error': 'BOT_DATABASE_PATH не задан'}, status=500)
        conn = sqlite3.connect(str(bot_db))
        cur = conn.cursor()
        _ensure_chat_table(conn)
        cur.execute('INSERT INTO chat_messages (user_id, direction, message, kind, media_url) VALUES (?, ?, ?, ?, ?)', (user_id, 'out', caption, media_type, media_url))
        conn.commit()
        conn.close()

        # Resolve bot token (bot.config -> root config -> db -> settings)
        token_source = 'bot_config'
        botcfg_token = ''
        root_token = ''
        try:
            import importlib
            bot_cfg = importlib.import_module('bot.config')
            botcfg_token = (getattr(bot_cfg, 'BOT_TOKEN', '') or '').strip()
        except Exception:
            botcfg_token = ''
        try:
            import importlib
            root_cfg = importlib.import_module('config')
            root_token = (getattr(root_cfg, 'BOT_TOKEN', '') or '').strip()
        except Exception:
            root_token = ''
        cfg_token = (BotConfiguration.get_setting('bot_token') or '').strip()
        settings_token = (getattr(settings, 'BOT_TOKEN', None) or '').strip()
        bot_token = botcfg_token or root_token or cfg_token or settings_token
        if not bot_token:
            return JsonResponse({'success': False, 'error': 'BOT token is not configured'}, status=400)
        if not botcfg_token:
            token_source = 'root_config' if root_token else ('db_config' if cfg_token else 'settings')

        # Relay to Telegram
        api = f"https://api.telegram.org/bot{bot_token}/sendPhoto" if media_type=='photo' else f"https://api.telegram.org/bot{bot_token}/sendVideo"
        try:
            files = {'photo' if media_type=='photo' else 'video': (filename, open(default_storage.path(path), 'rb'))}
            data = {'chat_id': user_id, 'caption': caption, 'disable_notification': False}
            resp = requests.post(api, data=data, files=files, timeout=20)
            if resp.status_code != 200:
                return JsonResponse({'success': False, 'error': f'Telegram API error {resp.status_code}', 'details': resp.text[:300], 'token_source': token_source}, status=502)
        except Exception as e:
            return JsonResponse({'success': False, 'error': f'Telegram request failed: {e}', 'token_source': token_source}, status=502)

        return JsonResponse({'success': True, 'media_url': media_url, 'token_source': token_source})
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


@csrf_exempt
@require_http_methods(["POST"])
def chat_typing_from_admin(request: HttpRequest):
    """Relay typing indicator to Telegram (sendChatAction). action defaults to 'typing'."""
    try:
        data = json.loads(request.body or '{}')
        user_id = int(data.get('user_id') or 0)
        action = (data.get('action') or 'typing').strip()  # typing|upload_photo|upload_video|upload_document
        if not user_id:
            return JsonResponse({'success': False, 'error': 'user_id обязателен'}, status=400)

        # Resolve bot token
        token_source = 'bot_config'
        botcfg_token = ''
        root_token = ''
        try:
            import importlib
            bot_cfg = importlib.import_module('bot.config')
            botcfg_token = (getattr(bot_cfg, 'BOT_TOKEN', '') or '').strip()
        except Exception:
            botcfg_token = ''
        try:
            import importlib
            root_cfg = importlib.import_module('config')
            root_token = (getattr(root_cfg, 'BOT_TOKEN', '') or '').strip()
        except Exception:
            root_token = ''
        cfg_token = (BotConfiguration.get_setting('bot_token') or '').strip()
        settings_token = (getattr(settings, 'BOT_TOKEN', None) or '').strip()
        bot_token = botcfg_token or root_token or cfg_token or settings_token
        if not bot_token:
            return JsonResponse({'success': False, 'error': 'BOT token is not configured'}, status=400)
        if not botcfg_token:
            token_source = 'root_config' if root_token else ('db_config' if cfg_token else 'settings')

        # Call sendChatAction
        api = f"https://api.telegram.org/bot{bot_token}/sendChatAction"
        try:
            resp = requests.post(api, json={'chat_id': user_id, 'action': action}, timeout=6)
            if resp.status_code != 200:
                return JsonResponse({'success': False, 'error': f'Telegram API error {resp.status_code}', 'details': resp.text[:200]}, status=502)
        except Exception as e:
            return JsonResponse({'success': False, 'error': f'Telegram request failed: {e}'}, status=502)

        return JsonResponse({'success': True, 'token_source': token_source})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
