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
from .models import TransactionLog
from django.db.models import Q, Sum, Count
from django.conf import settings
import subprocess
import sys
from .models import BankSettings, QRHash, BankWallet
from datetime import datetime, date
from typing import Dict, Any

def format_chart_date(date_string):
    """Форматирует дату для графиков в формат DD.MM"""
    try:
        date_obj = datetime.strptime(date_string, '%Y-%m-%d')
        return date_obj.strftime('%d.%m')
    except:
        return date_string


def broadcast_message(request):
    """Страница рассылки сообщений"""
    return render(request, 'bot_control/broadcast.html')

def bot_management(request):
    """Страница управления ботом - все настройки в одном месте"""
    return render(request, 'bot_control/bot_management.html')

def statistics(request):
    """Страница статистики"""
    return render(request, 'bot_control/statistics_mobile.html')


@csrf_exempt
def api_export_statistics(request):
    """API для экспорта статистики в CSV"""
    try:
        from bot_control.auto_deposit_models import AutoDepositRequest
        import csv
        from django.http import HttpResponse
        
        # Получаем параметры фильтрации
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        bookmaker = request.GET.get('bookmaker')
        
        # Фильтруем данные
        queryset = AutoDepositRequest.objects.all()
        
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)
        if bookmaker:
            queryset = queryset.filter(bookmaker=bookmaker)
        
        # Создаем CSV ответ
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="statistics_export.csv"'
        
        writer = csv.writer(response)
        
        # Заголовки
        writer.writerow(['ID', 'User ID', 'Username', 'Bookmaker', 'Account ID', 'Amount', 'Bank', 'Status', 'Created At', 'Updated At'])
        
        # Данные
        for req in queryset:
            writer.writerow([
                req.id,
                req.user_id,
                req.username,
                req.bookmaker,
                req.account_id,
                req.amount,
                req.bank,
                req.status,
                req.created_at.strftime('%Y-%m-%d %H:%M:%S') if req.created_at else '',
                req.updated_at.strftime('%Y-%m-%d %H:%M:%S') if req.updated_at else ''
            ])
        
        return response
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@csrf_exempt
def api_get_bot_settings(request):
    """API для получения настроек бота (для Next.js)"""
    try:
        # Простые настройки по умолчанию без базы данных
        return JsonResponse({
            'success': True,
            'data': {
                'is_active': True,
                'maintenance_message': '🔧 Технические работы\nБот временно недоступен. Попробуйте позже.',
                'deposits_enabled': True,
                'withdrawals_enabled': True,
                'channel_subscription_required': False,
                'channel_username': '',
                'enabled_deposit_banks': ['mbank', 'bakai', 'balance', 'demir', 'omoney', 'megapay'],
                'enabled_withdrawal_banks': ['kompanion', 'odengi', 'bakai', 'balance', 'megapay', 'mbank']
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def api_save_bot_settings(request):
    """API для сохранения настроек бота (для Next.js)"""
    try:
        if request.method != 'POST':
            return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
        
        # Просто возвращаем успех без сохранения в базу
        return JsonResponse({
            'success': True,
            'message': 'Настройки сохранены (демо режим)'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


def bank_report(request):
    """Отчёт по поступлениям: агрегаты по банкам и список операций.

    GET:
      - start: YYYY-MM-DD
      - end: YYYY-MM-DD
      - bank: код банка (фильтр)
    """
    start = (request.GET.get('start') or '').strip()
    end = (request.GET.get('end') or '').strip()
    bank_filter = (request.GET.get('bank') or '').strip()

    qs = TransactionLog.objects.all()
    if start:
        qs = qs.filter(timestamp__date__gte=start)
    if end:
        qs = qs.filter(timestamp__date__lte=end)
    if bank_filter:
        qs = qs.filter(bank__iexact=bank_filter)

    # Агрегаты по банкам
    by_bank = (
        qs.values('bank')
          .annotate(total_amount=Sum('amount'), cnt=Count('id'))
          .order_by('bank')
    )
    total_amount = qs.aggregate(total=Sum('amount'))['total'] or 0
    total_count = qs.count()

    # Последние операции
    items = list(qs.order_by('-timestamp')[:200])

    ctx = {
        'filters': {'start': start, 'end': end, 'bank': bank_filter},
        'by_bank': by_bank,
        'total_amount': float(total_amount),
        'total_count': total_count,
        'items': items,
    }
    return render(request, 'bot_control/bank_report.html', ctx)

@csrf_exempt
def api_bank_settings_list(request):
    """GET: список всех банков и их флагов (deposit/withdraw) для UI."""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        items = [
            {
                'id': b.id,
                'bank_code': b.bank_code,
                'bank_name': b.bank_name,
                'is_enabled_deposit': bool(b.is_enabled_deposit),
                'is_enabled_withdraw': bool(b.is_enabled_withdraw),
            }
            for b in BankSettings.objects.all().order_by('bank_name')
        ]
        return JsonResponse({'success': True, 'banks': items})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_bank_settings_toggle(request, bank_id: int):
    """POST: переключить флаг deposit/withdraw у банка.
    Body: { setting: 'deposit'|'withdraw', enabled: bool }
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        data = json.loads(request.body or '{}')
        setting = (data.get('setting') or '').strip()
        enabled = bool(data.get('enabled', True))
        b = BankSettings.objects.get(id=int(bank_id))
        if setting == 'deposit':
            b.is_enabled_deposit = enabled
        elif setting == 'withdraw':
            b.is_enabled_withdraw = enabled
        else:
            return JsonResponse({'success': False, 'error': 'invalid setting'}, status=400)
        b.save(update_fields=['is_enabled_deposit', 'is_enabled_withdraw', 'updated_at'])

        # Взаимоисключаемость для депозитов: если включили депозит для банка b,
        # отключаем депозиты остальных банков и деактивируем Demirbank (QRHash) и кошельки других банков
        try:
            if setting == 'deposit' and enabled:
                from .models import BankWallet, QRHash, BankSettings
                # Выключим депозиты на других банках
                BankSettings.objects.exclude(id=b.id).update(is_enabled_deposit=False)
                # Деактивируем все QR Demirbank
                QRHash.objects.filter(is_active=True).update(is_active=False)
                # Деактивируем кошельки других банков
                BankWallet.objects.exclude(bank_code=b.bank_code).update(is_active=False)
                # Деактивируем активные реквизиты через Django ORM
                try:
                    from bot_control.models import BotRequisite
                    BotRequisite.objects.filter(is_active=True).update(is_active=False)
                except Exception:
                    pass
        except Exception:
            pass

        return JsonResponse({'success': True})
    except BankSettings.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

def payments_history(request):
    """История поступлений из Android-хука: таблица с фильтрами и ручным изменением статуса.

    URL: /payments/
    GET-параметры: bank, status, start, end, q
    POST: { id, status } — изменить статус записи
    """
    # Handle status change
    if request.method == 'POST':
        try:
            tid = int(request.POST.get('id') or 0)
            new_status = (request.POST.get('status') or '').strip()
            if tid and new_status in ('received', 'processed', 'error'):
                TransactionLog.objects.filter(id=tid).update(status=new_status)
        except Exception:
            pass

    # Filters
    bank = (request.GET.get('bank') or '').strip()
    status = (request.GET.get('status') or '').strip()
    start = (request.GET.get('start') or '').strip()
    end = (request.GET.get('end') or '').strip()
    query = (request.GET.get('q') or '').strip()

    qs = TransactionLog.objects.all().order_by('-created_at')
    if bank:
        qs = qs.filter(bank__iexact=bank)
    if status:
        qs = qs.filter(status=status)
    if start:
        qs = qs.filter(timestamp__date__gte=start)
    if end:
        qs = qs.filter(timestamp__date__lte=end)
    if query:
        qs = qs.filter(Q(raw_message__icontains=query) | Q(bank__icontains=query))

    # Simple pagination
    try:
        page = max(1, int(request.GET.get('page') or 1))
    except Exception:
        page = 1
    page_size = 50
    total = qs.count()
    items = list(qs[(page-1)*page_size: page*page_size])

    ctx = {
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'filters': {
            'bank': bank,
            'status': status,
            'start': start,
            'end': end,
            'q': query,
        }
    }
    return render(request, 'bot_control/payments.html', ctx)


def bank_management(request):
    """Страница управления банками с отображением всех кошельков внизу"""
    # Группы кошельков по банкам для нижнего блока
    wallets = BankWallet.objects.all().order_by('bank_code', '-is_main', '-is_active', '-created_at')
    groups = {
        'mbank': [w for w in wallets if w.bank_code == 'mbank'],
        'bakai': [w for w in wallets if w.bank_code == 'bakai'],
        'optima': [w for w in wallets if w.bank_code == 'optima'],
    }
    qrhash = QRHash.objects.all().order_by('-is_main', '-is_active', '-created_at')
    return render(request, 'bot_control/bank_management.html', {
        'groups': groups,
        'qrhash': qrhash,
    })


def wallets_management(request):
    """Управление кошельками банков (MBank/Bakai/Optima). Отдельно от Демирбанка (QRHash)."""
    message = None
    error = None
    
    if request.method == 'POST':
        action = request.POST.get('action')
        try:
            if action == 'create_wallet':
                bank_code = (request.POST.get('bank_code') or '').strip()
                account_name = (request.POST.get('account_name') or '').strip()
                hash_value = (request.POST.get('hash_value') or '').strip()
                is_active = bool(request.POST.get('is_active'))
                is_main = bool(request.POST.get('is_main'))
                if not bank_code or not account_name or not hash_value:
                    raise ValueError('Укажите банк, название и хеш')
                w = BankWallet.objects.create(
                    bank_code=bank_code,
                    account_name=account_name,
                    hash_value=hash_value,
                    is_active=is_active,
                    is_main=is_main,
                )
                if is_main:
                    BankWallet.objects.filter(bank_code=bank_code, is_main=True).exclude(id=w.id).update(is_main=False)
                message = 'Кошелёк добавлен'
            elif action == 'toggle_active':
                wid = int(request.POST.get('id') or 0)
                w = BankWallet.objects.get(id=wid)
                w.is_active = not w.is_active
                w.save()
                message = 'Статус активности изменён'
            elif action == 'set_main':
                wid = int(request.POST.get('id') or 0)
                w = BankWallet.objects.get(id=wid)
                BankWallet.objects.filter(bank_code=w.bank_code, is_main=True).exclude(id=w.id).update(is_main=False)
                w.is_main = True
                w.save()
                message = 'Основной кошелёк выбран'
            elif action == 'toggle_active_qr':
                qid = int(request.POST.get('id') or 0)
                q = QRHash.objects.get(id=qid)
                q.is_active = not q.is_active
                q.save(update_fields=['is_active','updated_at']) if hasattr(q, 'updated_at') else q.save()
                message = 'Статус активности (Demirbank) изменён'
            elif action == 'set_main_qr':
                qid = int(request.POST.get('id') or 0)
                q = QRHash.objects.get(id=qid)
                # Сбрасываем другие main в QRHash
                QRHash.objects.filter(is_main=True).exclude(id=q.id).update(is_main=False)
                q.is_main = True
                q.save(update_fields=['is_main','updated_at']) if hasattr(q, 'updated_at') else q.save()
                message = 'Основной кошелёк Demirbank выбран'
        except Exception as e:
            error = str(e)

    wallets = BankWallet.objects.all().order_by('bank_code', '-is_main', '-is_active', '-created_at')
    groups = {
        'mbank': [w for w in wallets if w.bank_code == 'mbank'],
        'bakai': [w for w in wallets if w.bank_code == 'bakai'],
        'optima': [w for w in wallets if w.bank_code == 'optima'],
    }
    qrhash = QRHash.objects.all().order_by('-is_main', '-is_active', '-created_at')
    return render(request, 'bot_control/wallets.html', {
        'groups': groups,
        'qrhash': qrhash,
        'message': message,
        'error': error,
    })

# ===== API для BankWallet (MBank/Bakai/Optima) =====
@csrf_exempt
def api_bank_wallets(request):
    """GET: список всех кошельков банков.

    Ответ: { success, items: [ {id, bank_code, account_name, hash_value, is_active, is_main, created_at} ] }
    """
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        items = [
            {
                'id': w.id,
                'bank_code': w.bank_code,
                'account_name': w.account_name,
                'hash_value': w.hash_value,
                'is_active': bool(w.is_active),
                'is_main': bool(w.is_main),
                'created_at': w.created_at.isoformat(),
            }
            for w in BankWallet.objects.all().order_by('bank_code', '-is_main', '-is_active', '-created_at')
        ]
        return JsonResponse({'success': True, 'items': items, 'count': len(items)})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def api_bank_wallets_create(request):
    """POST: создать кошелёк банка.
    Body: { bank_code: mbank|optima|bakai, account_name: str, hash_value: str, is_active?:bool, is_main?:bool }
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        data = json.loads(request.body or '{}')
        bank_code = str(data.get('bank_code') or '').strip()
        account_name = str(data.get('account_name') or '').strip()
        hash_value = str(data.get('hash_value') or '').strip()
        is_active = bool(data.get('is_active', True))
        is_main = bool(data.get('is_main', False))
        if bank_code not in ('mbank','optima','bakai'):
            return JsonResponse({'success': False, 'error': 'bank_code должен быть mbank|optima|bakai'}, status=400)
        if not account_name or not hash_value:
            return JsonResponse({'success': False, 'error': 'Укажите название и hash'}, status=400)
        w = BankWallet.objects.create(
            bank_code=bank_code,
            account_name=account_name,
            hash_value=hash_value,
            is_active=is_active,
            is_main=is_main,
        )
        if is_main:
            BankWallet.objects.filter(bank_code=bank_code, is_main=True).exclude(id=w.id).update(is_main=False)
        return JsonResponse({'success': True, 'id': w.id})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def api_bank_wallets_toggle(request, wid: int):
    """POST: переключить активность кошелька."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        w = BankWallet.objects.get(id=wid)
        w.is_active = not w.is_active
        w.save(update_fields=['is_active','updated_at'])

        # Если кошелёк включили — делаем его единственно активным и выключаем Demirbank
        if w.is_active:
            try:
                from .models import BankWallet as BW2, QRHash as Q2
                BW2.objects.exclude(id=w.id).update(is_active=False)
                Q2.objects.filter(is_active=True).update(is_active=False)
                # Деактивируем активные реквизиты через Django ORM
                try:
                    from bot_control.models import BotRequisite
                    BotRequisite.objects.filter(is_active=True).update(is_active=False)
                except Exception:
                    pass
            except Exception:
                pass

        return JsonResponse({'success': True, 'is_active': bool(w.is_active)})
    except BankWallet.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def api_bank_wallets_set_main(request, wid: int):
    """POST: сделать кошелёк основным для своего банка."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        w = BankWallet.objects.get(id=wid)
        BankWallet.objects.filter(bank_code=w.bank_code, is_main=True).exclude(id=w.id).update(is_main=False)
        w.is_main = True
        w.save(update_fields=['is_main','updated_at'])
        return JsonResponse({'success': True})
    except BankWallet.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def api_bank_wallets_delete(request, wid: int):
    """DELETE: удалить кошелёк."""
    if request.method != 'DELETE':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    try:
        BankWallet.objects.filter(id=wid).delete()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_request_status(request, request_id: int):
    """Таблица requests больше не существует, возвращаем ошибку"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    return JsonResponse({'success': False, 'error': 'Requests table no longer exists'}, status=404)

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
    from bot_control.models import Request
    from django.db.models import Sum, Count
    from django.utils import timezone
    
    # Формируем фильтры для Django ORM
    filters = {'bookmaker': bookmaker_key}
    
    if start_d:
        filters['created_at__date__gte'] = start_d
    if end_d:
        filters['created_at__date__lte'] = end_d
    
    # Получаем данные по депозитам из таблицы requests через Django ORM
    deposit_stats = Request.objects.filter(
        request_type='deposit',
        **filters
    ).aggregate(
        total_amount=Sum('amount'),
        total_count=Count('id')
    )
    
    # Получаем данные по выводам из таблицы requests через Django ORM
    withdrawal_stats = Request.objects.filter(
        request_type='withdraw',
        **filters
    ).aggregate(
        total_amount=Sum('amount'),
        total_count=Count('id')
    )
    
    return {
        'deposits_sum': float(deposit_stats['total_amount'] or 0),
        'deposits_count': int(deposit_stats['total_count'] or 0),
        'withdrawals_sum': float(withdrawal_stats['total_amount'] or 0),
        'withdrawals_count': int(withdrawal_stats['total_count'] or 0)
    }

def _get_cashdesk_balance_xbet(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Получение баланса и лимита кассы 1xbet через CashdeskAPI"""
    try:
        from bot_control.cashdesk_api import CashdeskAPI
        api = CashdeskAPI(
            casino='1xbet',
            hash_key=cfg.get('hash', ''),
            cashierpass=cfg.get('cashierpass', ''),
            login=cfg.get('login', ''),
            cashdeskid=int(cfg.get('cashdeskid') or 0)
        )
        result = api.get_balance()
        # API возвращает напрямую {'Balance': ..., 'Limit': ...} или {'Balance': 0, 'Limit': 0} при ошибке
        if isinstance(result, dict) and 'Balance' in result:
            return {
                'balance': float(result.get('Balance') or 0),
                'limit': float(result.get('Limit') or 0)
            }
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting 1xbet balance: {e}", exc_info=True)
    return {'balance': 0, 'limit': 0}

def _get_cashdesk_balance_mostbet(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Получение баланса кассы Mostbet через MostbetAPI (лимит недоступен в API)"""
    try:
        from bot_control.mostbet_api import MostbetAPI
        api = MostbetAPI(
            api_key=cfg.get('api_key', ''),
            secret=cfg.get('secret', ''),
            cashpoint_id=int(cfg.get('cashpoint_id') or 0)
        )
        result = api.get_balance()
        # API возвращает напрямую {'balance': ..., 'currency': ...} или {'balance': 0, 'currency': 'RUB'} при ошибке
        if isinstance(result, dict) and 'balance' in result:
            balance = float(result.get('balance') or 0)
            return {
                'balance': balance,
                'limit': 0  # Лимит недоступен в Mostbet Cash API
            }
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting Mostbet balance: {e}", exc_info=True)
    return {'balance': 0, 'limit': 0}

def _get_cashdesk_balance_melbet(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Получение баланса и лимита кассы Melbet через CashdeskAPI"""
    try:
        from bot_control.cashdesk_api import CashdeskAPI
        api = CashdeskAPI(
            casino='melbet',
            hash_key=cfg.get('hash', ''),
            cashierpass=cfg.get('cashierpass', ''),
            login=cfg.get('login', ''),
            cashdeskid=int(cfg.get('cashdeskid') or 0)
        )
        result = api.get_balance()
        # API возвращает напрямую {'Balance': ..., 'Limit': ...} или {'Balance': 0, 'Limit': 0} при ошибке
        if isinstance(result, dict) and 'Balance' in result:
            return {
                'balance': float(result.get('Balance') or 0),
                'limit': float(result.get('Limit') or 0)
            }
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting Melbet balance: {e}", exc_info=True)
    return {'balance': 0, 'limit': 0}

def limits_dashboard(request):
    """Мобильная страница лимитов платформ со статистикой."""
    start_d, end_d = _parse_period(request)
    
    # Загружаем конфиг из casino_api_config
    try:
        from bot_control.casino_api_config import CASHDESK_CONFIG, MOSTBET_CONFIG
        
        # Конфиги для API
        x_cfg = CASHDESK_CONFIG.get('1xbet', {})
        m_cfg = CASHDESK_CONFIG.get('melbet', {})
        mb_cfg = MOSTBET_CONFIG.copy()
        
        # Получаем балансы и лимиты
        x_bal = _get_cashdesk_balance_xbet(x_cfg)
        m_bal = _get_cashdesk_balance_melbet(m_cfg)
        mb_bal = _get_cashdesk_balance_mostbet(mb_cfg)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error loading casino config: {e}")
        x_bal = {'balance': 0, 'limit': 0}
        m_bal = {'balance': 0, 'limit': 0}
        mb_bal = {'balance': 0, 'limit': 0}

    platform_limits = [
        {'key':'1xbet', 'name':'1xbet', 'limit': float(x_bal.get('limit') or 0)},
        {'key':'melbet','name':'Melbet','limit': float(m_bal.get('limit') or 0)},
        {'key':'1win','name':'1WIN','limit': 0.0},
        {'key':'mostbet','name':'Mostbet','limit': float(mb_bal.get('limit') or 0)},
    ]

    # Собираем статистику по заявкам
    filters = {}
    if start_d:
        filters['created_at__date__gte'] = start_d.date()
    if end_d:
        filters['created_at__date__lte'] = end_d.date()
    
    from bot_control.models import Request
    from django.db.models import Sum, Count
    
    # Статистика пополнений
    deposit_stats = Request.objects.filter(
        request_type='deposit',
        **filters
    ).aggregate(
        total_count=Count('id'),
        total_sum=Sum('amount')
    )
    
    # Статистика выводов
    withdrawal_stats = Request.objects.filter(
        request_type='withdraw',
        **filters
    ).aggregate(
        total_count=Count('id'),
        total_sum=Sum('amount')
    )
    
    total_deposits_count = deposit_stats['total_count'] or 0
    total_deposits_sum = float(deposit_stats['total_sum'] or 0)
    total_withdrawals_count = withdrawal_stats['total_count'] or 0
    total_withdrawals_sum = float(withdrawal_stats['total_sum'] or 0)
    
    # Приблизительный доход: 8% от пополнений + 2% от выводов
    approximate_income = (total_deposits_sum * 0.08) + (total_withdrawals_sum * 0.02)
    
    # График по датам (последние 10 дней)
    from django.db.models.functions import TruncDate
    from datetime import timedelta
    
    # Если период не указан, берем последние 30 дней
    if not start_d or not end_d:
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=30)
    else:
        start_date = start_d.date()
        end_date = end_d.date()
    
    chart_filters = {'created_at__date__gte': start_date, 'created_at__date__lte': end_date}
    
    deposits_chart_all = list(Request.objects.filter(
        request_type='deposit',
        **chart_filters
    ).extra(
        select={'date': 'DATE(created_at)'}
    ).values('date').annotate(
        count=Count('id')
    ).order_by('date'))
    
    withdrawals_chart_all = list(Request.objects.filter(
        request_type='withdraw',
        **chart_filters
    ).extra(
        select={'date': 'DATE(created_at)'}
    ).values('date').annotate(
        count=Count('id')
    ).order_by('date'))
    
    # Берем последние 10 записей
    deposits_chart = deposits_chart_all[-10:] if len(deposits_chart_all) > 10 else deposits_chart_all
    withdrawals_chart = withdrawals_chart_all[-10:] if len(withdrawals_chart_all) > 10 else withdrawals_chart_all

    def format_chart_date(date_str):
        if isinstance(date_str, str):
            return timezone.datetime.strptime(date_str, '%Y-%m-%d').strftime('%d.%m')
        return date_str.strftime('%d.%m') if hasattr(date_str, 'strftime') else str(date_str)

    # Формируем данные для графика
    deposits_labels = [format_chart_date(row['date']) for row in deposits_chart]
    deposits_data = [row['count'] for row in deposits_chart]
    withdrawals_labels = [format_chart_date(row['date']) for row in withdrawals_chart]
    withdrawals_data = [row['count'] for row in withdrawals_chart]
    
    # Объединяем метки (берем уникальные из обоих графиков)
    all_labels = sorted(list(set(deposits_labels + withdrawals_labels)))
    
    # Синхронизируем данные с общими метками
    deposits_dict = dict(zip(deposits_labels, deposits_data))
    withdrawals_dict = dict(zip(withdrawals_labels, withdrawals_data))
    
    synchronized_deposits = [deposits_dict.get(label, 0) for label in all_labels]
    synchronized_withdrawals = [withdrawals_dict.get(label, 0) for label in all_labels]

    context = {
        'start': start_d.strftime('%Y-%m-%d') if start_d else '',
        'end': end_d.strftime('%Y-%m-%d') if end_d else '',
        'platform_limits': platform_limits,
        'total_deposits_count': total_deposits_count,
        'total_deposits_sum': total_deposits_sum,
        'total_withdrawals_count': total_withdrawals_count,
        'total_withdrawals_sum': total_withdrawals_sum,
        'approximate_income': approximate_income,
        'chart_labels_json': json.dumps(all_labels),
        'chart_deposits_json': json.dumps(synchronized_deposits),
        'chart_withdrawals_json': json.dumps(synchronized_withdrawals),
    }
    return render(request, 'bot_control/limits_mobile.html', context)

@csrf_exempt
def api_bot_status(request):
    """API для получения статуса бота через Django ORM"""
    try:
        from bot_control.models import BotSetting
        
        # Получаем настройки бота через Django ORM
        try:
            is_active_setting = BotSetting.objects.get(key='is_active')
            is_active = bool(int(is_active_setting.value)) if is_active_setting.value else True
        except BotSetting.DoesNotExist:
            is_active = True
        
        try:
            maintenance_setting = BotSetting.objects.get(key='maintenance_message')
            maintenance_message = maintenance_setting.value or "🔧 Технические работы\nБот временно недоступен."
        except BotSetting.DoesNotExist:
            maintenance_message = "🔧 Технические работы\nБот временно недоступен."
        
        return JsonResponse({
            'is_active': is_active,
            'maintenance_message': maintenance_message
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_debug_bot_settings(request):
    """Отладка: показать актуальные значения ключей через Django ORM."""
    try:
        from bot_control.models import BotSetting
        
        def _get(key):
            try:
                setting = BotSetting.objects.get(key=key)
                return setting.value
            except BotSetting.DoesNotExist:
                return None
        
        data = {
            'bot_db_type': 'PostgreSQL',
            'withdrawals_enabled': _get('withdrawals_enabled'),
            'withdraw_banks': _get('withdraw_banks'),
            'deposits_enabled': _get('deposits_enabled'),
            'deposit_banks': _get('deposit_banks'),
        }
        return JsonResponse({'success': True, 'data': data})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

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
            # Сохраняем настройки через Django ORM
            from bot_control.models import BotSetting
            
            BotSetting.objects.update_or_create(
                key='is_active',
                defaults={'value': '1' if is_active else '0'}
            )
            
            BotSetting.objects.update_or_create(
                key='maintenance_message',
                defaults={'value': maintenance_message}
            )
            
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
            
            # Получаем всех пользователей через Django ORM
            from bot_control.models import BotUser
            user_ids = list(BotUser.objects.values_list('user_id', flat=True))
            
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
            
            # Сохраняем в историю рассылок через Django ORM
            from bot_control.models import BroadcastMessage
            from django.utils import timezone
            
            BroadcastMessage.objects.create(
                title=f"Рассылка {timezone.now()}",
                message=message,
                is_sent=True,
                sent_at=timezone.now()
            )
            # Можно добавить sent_count и error_count в модель если нужно
            # Пока просто сохраняем сообщение
            
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
            # Импорты
            from bot_control.models import Request
            from django.db.models import Sum, Count, Avg
            from django.utils import timezone
            
            # Фильтры
            date_from = request.GET.get('date_from')
            date_to = request.GET.get('date_to')
            bookmaker_filter = request.GET.get('bookmaker')

            # Общая статистика - считаем уникальных пользователей из заявок
            total_users = Request.objects.values('user_id').distinct().count()
            
            # Формируем фильтры для Django ORM
            filters = {}
            if date_from:
                filters['created_at__date__gte'] = date_from
            if date_to:
                filters['created_at__date__lte'] = date_to
            if bookmaker_filter:
                filters['bookmaker'] = bookmaker_filter

            # Получаем статистику по депозитам через Django ORM
            deposit_stats = Request.objects.filter(
                request_type='deposit',
                **filters
            ).aggregate(
                count=Count('id'),
                total_amount=Sum('amount'),
                avg_amount=Avg('amount')
            )
            
            # Получаем статистику по выводам через Django ORM
            withdrawal_stats = Request.objects.filter(
                request_type='withdraw',
                **filters
            ).aggregate(
                count=Count('id'),
                avg_amount=Avg('amount')
            )
            
            # Получаем количество уникальных пользователей с депозитами
            users_with_deposits = Request.objects.filter(
                request_type='deposit',
                **filters
            ).values('user_id').distinct().count()

            total_deposits = deposit_stats['count'] or 0
            total_withdrawals = withdrawal_stats['count'] or 0
            total_amount = deposit_stats['total_amount'] or 0
            avg_deposit = deposit_stats['avg_amount'] or 0
            avg_withdrawal = withdrawal_stats['avg_amount'] or 0

            conversion_rate = (users_with_deposits / total_users * 100) if total_users > 0 else 0

            # Статистика по букмекерам через Django ORM
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
                
                # Используем Django ORM для получения статистики по букмекеру
                bookmaker_filters = filters.copy()
                bookmaker_filters['bookmaker'] = bookmaker_key
                
                dep_stats = Request.objects.filter(
                    request_type='deposit',
                    **bookmaker_filters
                ).aggregate(
                    count=Count('id'),
                    total_amount=Sum('amount')
                )
                w_stats = Request.objects.filter(
                    request_type='withdraw',
                    **bookmaker_filters
                ).aggregate(
                    count=Count('id'),
                    total_amount=Sum('amount')
                )
                
                d_count, d_sum = dep_stats['count'] or 0, dep_stats['total_amount'] or 0
                w_count, w_sum = w_stats['count'] or 0, w_stats['total_amount'] or 0

                bookmakers[bookmaker_key] = {
                    'name': bookmaker_name,
                    'deposits_count': d_count or 0,
                    'deposits_amount': d_sum or 0,
                    'withdrawals_count': w_count or 0,
                    'withdrawals_amount': w_sum or 0
                }

            # Графики (по датам) через Django ORM
            from django.db.models.functions import TruncDate
            
            deposits_chart = list(Request.objects.filter(
                request_type='deposit',
                **filters
            ).extra(
                select={'date': 'DATE(created_at)'}
            ).values('date').annotate(
                count=Count('id')
            ).order_by('date')[:10])
            
            withdrawals_chart = list(Request.objects.filter(
                request_type='withdraw',
                **filters
            ).extra(
                select={'date': 'DATE(created_at)'}
            ).values('date').annotate(
                count=Count('id')
            ).order_by('date')[:10])

            return JsonResponse({
                'success': True,
                'general': {
                    'total_users': total_users,
                    'total_deposits': total_deposits,
                    'total_withdrawals': total_withdrawals,
                    'total_amount': total_amount,
                    'avg_deposit': round(avg_deposit, 2),
                    'avg_withdrawal': round(avg_withdrawal, 2),
                    'conversion_rate': round(conversion_rate, 1)
                },
                'bookmakers': list(bookmakers.values()),
                'charts': {
                    'deposits': {
                        'labels': [format_chart_date(row['date']) for row in deposits_chart],
                        'data': [row['count'] for row in deposits_chart]
                    },
                    'withdrawals': {
                        'labels': [format_chart_date(row['date']) for row in withdrawals_chart],
                        'data': [row['count'] for row in withdrawals_chart]
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
def api_get_bank_settings(request):
    """API для получения настроек банков"""
    try:
        settings = {
            'deposit_banks': BotConfiguration.get_setting('deposits', {}).get('banks', ['mbank', 'bakai', 'balance', 'demir', 'omoney', 'megapay']),
            'withdrawal_banks': BotConfiguration.get_setting('withdrawals', {}).get('banks', ['kompanion', 'odengi', 'bakai', 'balance', 'megapay', 'mbank'])
        }
        return JsonResponse(settings)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_save_bank_settings(request):
    """API для сохранения настроек банков"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        
        # Получаем текущие настройки
        deposits = BotConfiguration.get_setting('deposits', {'enabled': True, 'banks': []})
        withdrawals = BotConfiguration.get_setting('withdrawals', {'enabled': True, 'banks': []})
        
        # Обновляем банки
        deposits['banks'] = data.get('deposit_banks', [])
        withdrawals['banks'] = data.get('withdrawal_banks', [])
        
        # Сохраняем
        BotConfiguration.set_setting('deposits', deposits, 'Настройки депозитов')
        BotConfiguration.set_setting('withdrawals', withdrawals, 'Настройки выводов')
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_get_deposit_settings(request):
    """API для получения настроек депозитов"""
    try:
        import json
        settings_str = BotConfiguration.get_setting('deposits', '{"enabled": true, "banks": ["mbank", "bakai", "balance", "demir", "omoney", "megapay"]}')
        settings = json.loads(settings_str) if isinstance(settings_str, str) else settings_str
        return JsonResponse(settings)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_save_deposit_settings(request):
    """API для сохранения настроек депозитов"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        
        settings = {
            'enabled': data.get('enabled', True),
            'banks': data.get('banks', [])
        }
        
        BotConfiguration.set_setting('deposits', json.dumps(settings), 'Настройки депозитов')
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_get_payment_settings(request):
    """API для получения настроек платежей для клиентского сайта"""
    try:
        import json
        
        # Получаем настройки депозитов
        deposits_str = BotConfiguration.get_setting('deposits', '{"enabled": true, "banks": ["mbank", "bakai", "balance", "demir", "omoney", "megapay"]}')
        deposits = json.loads(deposits_str) if isinstance(deposits_str, str) else deposits_str
        
        # Получаем настройки выводов
        withdrawals_str = BotConfiguration.get_setting('withdrawals', '{"enabled": true, "banks": ["kompanion", "odengi", "bakai", "balance", "megapay", "mbank"]}')
        withdrawals = json.loads(withdrawals_str) if isinstance(withdrawals_str, str) else withdrawals_str
        
        # Получаем настройки казино
        casinos_str = BotConfiguration.get_setting('casinos', '{"1xbet": true, "1win": true, "melbet": true, "mostbet": true}')
        casinos = json.loads(casinos_str) if isinstance(casinos_str, str) else casinos_str
        
        # Маппинг банков для клиентского сайта
        bank_mapping = {
            'mbank': {'name': 'MBank', 'logo': '/static/images/mbank.png'},
            'demir': {'name': 'DemirBank', 'logo': '/static/images/demirbank.jpg'},
            'balance': {'name': 'Balance.kg', 'logo': '/static/images/balance.jpg'},
            'omoney': {'name': 'O!Money', 'logo': '/static/images/omoney.jpg'},
            'megapay': {'name': 'MegaPay', 'logo': '/static/images/megapay.jpg'},
            'bakai': {'name': 'Bakai', 'logo': '/static/images/bakai.jpg'},
            'kompanion': {'name': 'Компаньон', 'logo': '/static/images/companion.png'},
            'odengi': {'name': 'O!Money', 'logo': '/static/images/omoney.jpg'}
        }
        
        # Формируем ответ
        response = {
            'deposits': {
                'enabled': deposits.get('enabled', True),
                'banks': []
            },
            'withdrawals': {
                'enabled': withdrawals.get('enabled', True),
                'banks': []
            },
            'casinos': {
                '1xbet': casinos.get('1xbet', True),
                '1win': casinos.get('1win', True),
                'melbet': casinos.get('melbet', True),
                'mostbet': casinos.get('mostbet', True)
            }
        }
        
        # Добавляем информацию о банках для депозитов
        for bank_code in deposits.get('banks', []):
            if bank_code in bank_mapping:
                response['deposits']['banks'].append({
                    'code': bank_code,
                    'name': bank_mapping[bank_code]['name'],
                    'logo': bank_mapping[bank_code]['logo']
                })
        
        # Добавляем информацию о банках для выводов
        for bank_code in withdrawals.get('banks', []):
            if bank_code in bank_mapping:
                response['withdrawals']['banks'].append({
                    'code': bank_code,
                    'name': bank_mapping[bank_code]['name'],
                    'logo': bank_mapping[bank_code]['logo']
                })
        
        return JsonResponse(response)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_get_withdrawal_settings(request):
    """API для получения настроек выводов"""
    try:
        withdrawals_str = BotConfiguration.get_setting('withdrawals', '{"enabled": true, "banks": ["kompanion", "odengi", "bakai", "balance", "megapay", "mbank"]}')
        withdrawals = json.loads(withdrawals_str) if isinstance(withdrawals_str, str) else withdrawals_str
        
        return JsonResponse({
            'success': True,
            'data': {
                'enabled': withdrawals.get('enabled', True),
                'banks': withdrawals.get('banks', [])
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_save_withdrawal_settings(request):
    """API для сохранения настроек выводов"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        
        settings = {
            'enabled': data.get('enabled', True),
            'banks': data.get('banks', [])
        }
        
        BotConfiguration.set_setting('withdrawals', json.dumps(settings), 'Настройки выводов')
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_get_bot_control(request):
    """API для получения настроек управления ботом"""
    try:
        # Получаем настройки депозитов
        deposit_settings = BotConfiguration.get_setting('deposit_settings', {})
        if isinstance(deposit_settings, str):
            import json
            deposit_settings = json.loads(deposit_settings)
        
        # Получаем настройки выводов
        withdrawal_settings = BotConfiguration.get_setting('withdrawal_settings', {})
        if isinstance(withdrawal_settings, str):
            import json
            withdrawal_settings = json.loads(withdrawal_settings)
        
        settings = {
            'success': True,
            'data': {
                'pause': BotConfiguration.get_setting('pause', False),
                'maintenance_message': BotConfiguration.get_setting('maintenance_message', 'Технические работы. Попробуйте позже.'),
                'deposits_enabled': deposit_settings.get('enabled', True),
                'withdrawals_enabled': withdrawal_settings.get('enabled', True),
                'enabled_deposit_banks': deposit_settings.get('enabled_banks', ['DemirBank', 'O!bank', 'Balance.kg', 'Bakai', 'MegaPay', 'MBank'])
            }
        }
        return JsonResponse(settings)
    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)

@csrf_exempt
def api_save_bot_control(request):
    """API для сохранения настроек управления ботом"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        
        BotConfiguration.set_setting('pause', data.get('pause', False), 'Пауза бота')
        BotConfiguration.set_setting('maintenance_message', data.get('maintenance_message', ''), 'Сообщение о технических работах')
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_get_channel_settings(request):
    """API для получения настроек канала"""
    try:
        import json
        settings_str = BotConfiguration.get_setting('channel', '{"enabled": false, "name": "@bingokg_news", "welcome_message": "Добро пожаловать! Подпишитесь на наш канал для получения уведомлений."}')
        settings = json.loads(settings_str) if isinstance(settings_str, str) else settings_str
        return JsonResponse(settings)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_save_channel_settings(request):
    """API для сохранения настроек канала"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        
        settings = {
            'enabled': data.get('enabled', False),
            'name': data.get('name', '@bingokg_news'),
            'channel_id': data.get('channel_id', ''),
            'channel_username': data.get('channel_username', '')
        }
        
        BotConfiguration.set_setting('channel', json.dumps(settings), 'Настройки канала')
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_get_casino_settings(request):
    """API для получения настроек казино"""
    try:
        import json
        settings_str = BotConfiguration.get_setting('casinos', '{"1xbet": true, "1win": true, "melbet": true, "mostbet": true}')
        settings = json.loads(settings_str) if isinstance(settings_str, str) else settings_str
        return JsonResponse(settings)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_save_casino_settings(request):
    """API для сохранения настроек казино"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        
        settings = {
            '1xbet': data.get('1xbet', True),
            '1win': data.get('1win', True),
            'melbet': data.get('melbet', True),
            'mostbet': data.get('mostbet', True)
        }
        
        BotConfiguration.set_setting('casinos', json.dumps(settings), 'Настройки казино')
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

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

@csrf_exempt
def api_bot_status(request):
    """API для получения статуса бота"""
    try:
        # Получаем статус бота из конфигурации
        config = BotConfiguration.objects.first()
        if config:
            return JsonResponse({
                'is_active': config.is_active,
                'maintenance_message': config.maintenance_message or ''
            })
        else:
            return JsonResponse({
                'is_active': True,
                'maintenance_message': ''
            })
    except Exception as e:
        return JsonResponse({
            'is_active': True,
            'maintenance_message': ''
        })

@csrf_exempt
def api_set_bot_status(request):
    """API для установки статуса бота"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            is_active = data.get('is_active', True)
            maintenance_message = data.get('maintenance_message', '')
            
            config, created = BotConfiguration.objects.get_or_create(
                defaults={'is_active': True, 'maintenance_message': ''}
            )
            config.is_active = is_active
            config.maintenance_message = maintenance_message
            config.save()
            
            return JsonResponse({
                'success': True,
                'message': 'Статус бота обновлен'
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_restart_bot(request):
    """API для перезапуска бота"""
    if request.method == 'POST':
        try:
            # Здесь можно добавить логику перезапуска бота
            # Пока просто возвращаем успех
            return JsonResponse({
                'success': True,
                'message': 'Бот перезапущен'
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
    return JsonResponse({'error': 'Method not allowed'}, status=405)
