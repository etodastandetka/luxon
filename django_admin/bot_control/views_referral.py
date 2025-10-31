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
    """Получение данных пользователя через Django ORM"""
    try:
        from bot_control.models import BotUser
        user = BotUser.objects.get(user_id=user_id)
        return UserContext(
            user_id=user_id,
            username=user.username or '',
            first_name=user.first_name or '',
            last_name=user.last_name or ''
        )
    except Exception:
        return UserContext(user_id=user_id, username='', first_name='', last_name='')


def _get_referral_stats(user_id: int) -> Dict[str, Any]:
    """Получение статистики рефералов через Django ORM"""
    from bot_control.models import BotReferral, BotReferralEarning, Request, BotUser
    
    try:
        # Получаем всех приглашенных пользователей
        referrals = BotReferral.objects.filter(referrer__user_id=user_id)
        referred_ids = [ref.referred.user_id for ref in referrals]
        
        # Active referrals = referred users who have a completed deposit
        completed_deposits = Request.objects.filter(
            user_id__in=referred_ids,
            request_type='deposit',
            status__in=['completed', 'approved', 'auto_completed', 'autodeposit_success']
        )
        active_count = completed_deposits.values('user_id').distinct().count()
        
        # Total deposits amount
        total_deposits_result = completed_deposits.aggregate(total=Sum('amount'))
        total_deposits = float(total_deposits_result['total'] or 0)
        
        # Earned commissions (completed)
        try:
            earnings = BotReferralEarning.objects.filter(
                referrer__user_id=user_id,
                status='completed'
            ).aggregate(total=Sum('commission_amount'))
            earned = float(earnings['total'] or 0)
        except Exception:
            earned = 0.0
    except Exception as e:
        active_count = 0
        total_deposits = 0.0
        earned = 0.0

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
    """Получение лидерборда через Django ORM"""
    from bot_control.models import BotReferral, Request, BotUser
    from django.db.models import Count
    
    try:
        # Получаем пользователей с активными депозитами (завершенными)
        completed_user_ids = Request.objects.filter(
            request_type='deposit',
            status__in=['completed', 'approved', 'auto_completed', 'autodeposit_success']
        ).values_list('user_id', flat=True).distinct()
        
        # Получаем рефералов, у которых есть активные депозиты
        referrals = BotReferral.objects.filter(
            referred__user_id__in=completed_user_ids
        ).select_related('referrer', 'referred')
        
        # Группируем по referrer и считаем активных
        from collections import defaultdict
        referrer_counts = defaultdict(int)
        for ref in referrals:
            referrer_counts[ref.referrer.user_id] += 1
        
        # Сортируем по количеству активных рефералов
        sorted_referrers = sorted(referrer_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
        
        leaders = []
        prizes = [10000, 5000, 2500]
        for idx, (user_id, active_count) in enumerate(sorted_referrers):
            try:
                user = BotUser.objects.get(user_id=user_id)
                leaders.append({
                    'position': idx + 1,
                    'user_id': user.user_id,
                    'username': user.username or '',
                    'first_name': user.first_name or '',
                    'active_referrals': active_count,
                    'prize': prizes[idx] if idx < len(prizes) else 0,
                })
            except BotUser.DoesNotExist:
                continue
    except Exception:
        leaders = []
    
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
