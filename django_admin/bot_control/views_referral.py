#!/usr/bin/env python3
"""
Public referral dashboard views (NOT admin).
"""
from __future__ import annotations
import hmac
import hashlib
import sqlite3
from urllib.parse import urlencode
from dataclasses import dataclass
from typing import Optional, Dict, Any, List

from django.conf import settings
from django.db.models import Sum
from .referral_models import ReferralWithdrawalRequest
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.utils import timezone

# --- Config helpers ---

def _get_bot_db_path() -> str:
    # Use BOT_DATABASE_PATH if provided; otherwise default to bot/universal_bot.db
    db = getattr(settings, 'BOT_DATABASE_PATH', None)
    if db:
        return str(db)
    # fallback absolute path relative to project root (adapt if needed)
    import os
    return os.path.abspath(os.path.join(settings.BASE_DIR, '..', 'bot', 'universal_bot.db'))


def _get_bot_username() -> str:
    return getattr(settings, 'BOT_USERNAME', 'Lux_on_bot')


# --- Telegram Login verification ---

def _verify_telegram_auth(data: Dict[str, Any]) -> bool:
    """Verify Telegram Login Widget auth data using BOT_TOKEN per Telegram spec."""
    try:
        token = getattr(settings, 'BOT_TOKEN', None)
        if not token:
            return False
        secret_key = hashlib.sha256(token.encode()).digest()
        check_hash = data.get('hash', '')
        # Build data-check-string from all fields except 'hash', sorted by key
        pairs = []
        for k in sorted(k for k in data.keys() if k != 'hash'):
            pairs.append(f"{k}={data[k]}")
        data_check_string = '\n'.join(pairs)
        h = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        return h == check_hash
    except Exception:
        return False


@dataclass
class UserContext:
    user_id: int
    username: str
    first_name: str
    last_name: str


# --- Data access helpers (SQLite) ---

def _get_user_ctx(user_id: int) -> UserContext:
    conn = sqlite3.connect(_get_bot_db_path())
    cur = conn.cursor()
    cur.execute("SELECT username, first_name, last_name FROM users WHERE user_id=?", (user_id,))
    row = cur.fetchone() or ('', '', '')
    conn.close()
    return UserContext(user_id=user_id, username=row[0] or '', first_name=row[1] or '', last_name=row[2] or '')


def _get_referral_stats(user_id: int) -> Dict[str, Any]:
    conn = sqlite3.connect(_get_bot_db_path())
    cur = conn.cursor()
    # Active referrals = referred users who have a completed deposit in requests
    cur.execute(
        """
        SELECT COUNT(DISTINCT r.referred_id)
        FROM referrals r
        JOIN requests q ON q.user_id = r.referred_id AND q.request_type='deposit' AND q.status='completed'
        WHERE r.referrer_id = ?
        """,
        (user_id,)
    )
    active_count = cur.fetchone()[0] or 0

    cur.execute(
        """
        SELECT COALESCE(SUM(q.amount), 0)
        FROM referrals r
        JOIN requests q ON q.user_id = r.referred_id AND q.request_type='deposit' AND q.status='completed'
        WHERE r.referrer_id = ?
        """,
        (user_id,)
    )
    total_deposits = float(cur.fetchone()[0] or 0)

    # balance = earned commissions (completed) minus paid withdrawals (completed)
    try:
        cur.execute(
            """
            SELECT COALESCE(SUM(commission_amount), 0)
            FROM referral_earnings
            WHERE referrer_id = ? AND status = 'completed'
            """,
            (user_id,)
        )
        earned = float(cur.fetchone()[0] or 0)
    except Exception:
        # Table may not exist yet; treat as zero
        earned = 0.0

    conn.close()

    try:
        agg_c = ReferralWithdrawalRequest.objects.filter(user_id=user_id, status='completed').aggregate(total=Sum('amount'))
        paid = float(agg_c['total'] or 0)
        agg_p = ReferralWithdrawalRequest.objects.filter(user_id=user_id, status='pending').aggregate(total=Sum('amount'))
        pending = float(agg_p['total'] or 0)
    except Exception:
        paid = 0.0
        pending = 0.0

    gross_balance = max(0.0, earned - paid)
    available_balance = max(0.0, gross_balance - pending)

    return {
        'active_referrals': active_count,
        'total_deposits': total_deposits,
        'balance': round(gross_balance, 2),
        'pending_withdrawals': round(pending, 2),
        'available_balance': round(available_balance, 2),
    }


def _get_leaderboard(limit: int = 3) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(_get_bot_db_path())
    cur = conn.cursor()
    cur.execute(
        """
        SELECT r.referrer_id,
               u.username,
               u.first_name,
               COUNT(DISTINCT r.referred_id) AS active_count
        FROM referrals r
        JOIN users u ON u.user_id = r.referrer_id
        WHERE EXISTS (
            SELECT 1 FROM requests q
            WHERE q.user_id = r.referred_id
              AND q.request_type='deposit'
              AND q.status='completed'
        )
        GROUP BY r.referrer_id, u.username, u.first_name
        ORDER BY active_count DESC
        LIMIT ?
        """,
        (limit,)
    )
    rows = cur.fetchall()
    conn.close()
    leaders = []
    prizes = [10000, 5000, 2500]
    for idx, row in enumerate(rows):
        leaders.append({
            'position': idx + 1,
            'user_id': row[0],
            'username': row[1] or '',
            'first_name': row[2] or '',
            'active_referrals': row[3],
            'prize': prizes[idx] if idx < len(prizes) else 0,
        })
    return leaders


# --- Views ---

def referral_dashboard(request: HttpRequest) -> HttpResponse:
    """Public dashboard bound to Telegram Login. Accepts either a verified Telegram login widget payload
    via query params, or a dev fallback ?user_id=... for local testing.
    """
    # 1) Authenticate via Telegram login widget payload if present
    tg_fields = ['id', 'username', 'first_name', 'last_name', 'auth_date', 'hash']
    tg_data = {k: request.GET.get(k) for k in tg_fields if request.GET.get(k) is not None}
    user_id: Optional[int] = None

    if tg_data and _verify_telegram_auth(tg_data):
        user_id = int(tg_data['id'])
    else:
        # Dev fallback: allow user_id=... in query if no TG payload
        uid = request.GET.get('user_id')
        if uid and uid.isdigit():
            user_id = int(uid)

    if not user_id:
        # Render a simple page asking to log in via Telegram
        bot_username = _get_bot_username()
        return render(request, 'referral/login_required.html', {
            'bot_username': bot_username,
        })

    # 2) Load profile and stats
    user_ctx = _get_user_ctx(user_id)
    stats = _get_referral_stats(user_id)

    # 3) Generate referral link (t.me deep link)
    bot_username = _get_bot_username()
    referral_link = f"https://t.me/{bot_username}?start=ref_{user_id}"

    # 4) Handle withdraw form submission (POST)
    success_message = None
    error_message = None
    if request.method == 'POST' and request.POST.get('action') == 'withdraw':
        bookmaker = request.POST.get('bookmaker') or ''
        account_id = request.POST.get('account_id') or ''
        amount = request.POST.get('amount') or ''
        payment_method = request.POST.get('payment_method') or 'e_wallet'
        wallet_details = request.POST.get('wallet_details') or ''
        try:
            # Call local Django API (same project) to create referral withdraw request
            import requests as rq
            site_base = getattr(settings, 'SITE_BASE_URL', 'http://localhost:8081')
            url = f"{site_base.rstrip('/')}/bot/api/referral/withdraw/create/"
            payload = {
                'user_id': user_ctx.user_id,
                'username': user_ctx.username,
                'first_name': user_ctx.first_name,
                'last_name': user_ctx.last_name,
                'amount': float(amount or 0),
                'currency': 'KGS',
                'bookmaker': bookmaker,
                'bookmaker_account_id': account_id,
                'payment_method': payment_method,
                'wallet_details': wallet_details,
            }
            resp = rq.post(url, json=payload, timeout=8)
            j = resp.json()
            if j.get('success'):
                success_message = '✅ Заявка отправлена. Ожидайте подтверждения.'
            else:
                error_message = f"❌ Ошибка: {j.get('error') or 'Не удалось создать заявку'}"
        except Exception as e:
            error_message = f"❌ Ошибка отправки: {e}"

    # 5) Leaderboard
    leaderboard = _get_leaderboard(limit=3)

    # 6) Last referral withdrawal requests (history)
    try:
        from .referral_models import ReferralWithdrawalRequest
        history = list(
            ReferralWithdrawalRequest.objects.filter(user_id=user_id)
            .order_by('-created_at')
            .values('id', 'amount', 'currency', 'status', 'created_at')[:10]
        )
    except Exception:
        history = []

    return render(request, 'referral/dashboard.html', {
        'user': user_ctx,
        'stats': stats,
        'referral_link': referral_link,
        'leaderboard': leaderboard,
        'history': history,
        'success_message': success_message,
        'error_message': error_message,
    })
