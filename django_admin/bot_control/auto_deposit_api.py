from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from .auto_deposit_models import BankNotification, AutoDepositRequest, PlayerBalance, DepositRule
from .models import BotSettings
import json
import re
import logging

logger = logging.getLogger(__name__)

def parse_bank_notification(notification_text, bank_code):
    """Парсит уведомление от банка и извлекает сумму"""
    try:
        # Паттерны для разных банков
        patterns = {
            'optima': [
                r'На сумму:\s*([\d,]+\.?\d*)\s*KGS',
                r'Сумма:\s*([\d,]+\.?\d*)\s*KGS',
                r'(\d+\.?\d*)\s*KGS'
            ],
            'demirbank': [
                r'Сумма:\s*([\d,]+\.?\d*)\s*сом',
                r'(\d+\.?\d*)\s*сом'
            ],
            'odengi': [
                r'Сумма:\s*([\d,]+\.?\d*)\s*сом',
                r'(\d+\.?\d*)\s*сом'
            ],
            'bakai': [
                r'Сумма:\s*([\d,]+\.?\d*)\s*сом',
                r'(\d+\.?\d*)\s*сом'
            ],
            'balance': [
                r'Сумма:\s*([\d,]+\.?\d*)\s*сом',
                r'(\d+\.?\d*)\s*сом'
            ],
            'megapay': [
                r'Сумма:\s*([\d,]+\.?\d*)\s*сом',
                r'(\d+\.?\d*)\s*сом'
            ],
            'mbank': [
                r'Сумма:\s*([\d,]+\.?\d*)\s*сом',
                r'(\d+\.?\d*)\s*сом'
            ]
        }
        
        # Пробуем найти сумму по паттернам
        for pattern in patterns.get(bank_code, patterns['optima']):
            match = re.search(pattern, notification_text, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(',', '.')
                amount = float(amount_str)
                return amount
        
        # Если не нашли по паттернам, ищем любое число
        numbers = re.findall(r'(\d+\.?\d*)', notification_text)
        if numbers:
            return float(numbers[0])
        
        return None
        
    except Exception as e:
        logger.error(f"Ошибка парсинга уведомления: {e}")
        return None

@csrf_exempt
@require_http_methods(["POST"])
def receive_bank_notification(request):
    """Получает уведомление от банка"""
    try:
        data = json.loads(request.body)
        
        bank_code = data.get('bank', 'optima')
        notification_text = data.get('text', '')
        raw_data = data.get('raw_data', {})
        
        # Парсим сумму из уведомления
        amount = parse_bank_notification(notification_text, bank_code)
        
        if not amount:
            return JsonResponse({
                'success': False,
                'error': 'Не удалось извлечь сумму из уведомления'
            })
        
        # Создаем запись уведомления
        notification = BankNotification.objects.create(
            bank=bank_code,
            amount=amount,
            notification_text=notification_text,
            raw_data=raw_data
        )
        
        # Проверяем правила автопополнения
        rules = DepositRule.objects.filter(
            bank=bank_code,
            amount_min__lte=amount,
            amount_max__gte=amount,
            is_active=True
        )
        
        if rules.exists():
            # Создаем заявку на автопополнение
            auto_request = AutoDepositRequest.objects.create(
                user_id=data.get('user_id', 0),  # Нужно определить пользователя
                bookmaker=data.get('bookmaker', '1xbet'),
                amount=amount,
                bank_notification=notification,
                status='pending'
            )
            
            # Если включено автоодобрение
            if rules.first().auto_approve:
                process_auto_deposit(auto_request.id)
        
        return JsonResponse({
            'success': True,
            'notification_id': notification.id,
            'amount': float(amount),
            'message': 'Уведомление получено и обработано'
        })
        
    except Exception as e:
        logger.error(f"Ошибка обработки уведомления: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

def process_auto_deposit(request_id):
    """Обрабатывает заявку автопополнения"""
    try:
        request = AutoDepositRequest.objects.get(id=request_id)
        request.status = 'processing'
        request.save()
        
        # Получаем или создаем баланс игрока
        balance, created = PlayerBalance.objects.get_or_create(
            user_id=request.user_id,
            bookmaker=request.bookmaker,
            defaults={'balance': 0}
        )
        
        # Добавляем средства на баланс
        balance.add_balance(request.amount)
        
        # Обновляем статус заявки
        request.status = 'completed'
        request.processed_at = timezone.now()
        request.save()
        
        # Отмечаем уведомление как обработанное
        request.bank_notification.is_processed = True
        request.bank_notification.processed_at = timezone.now()
        request.bank_notification.save()
        
        logger.info(f"Автопополнение завершено: {request.user_id} +{request.amount} {request.bookmaker}")
        
        return True
        
    except Exception as e:
        logger.error(f"Ошибка обработки автопополнения: {e}")
        request.status = 'failed'
        request.error_message = str(e)
        request.save()
        return False

@csrf_exempt
@require_http_methods(["GET"])
def get_player_balance(request, user_id):
    """Получает баланс игрока"""
    try:
        balances = PlayerBalance.objects.filter(user_id=user_id)
        data = {
            'user_id': user_id,
            'balances': [
                {
                    'bookmaker': balance.bookmaker,
                    'balance': float(balance.balance),
                    'last_updated': balance.last_updated.isoformat()
                }
                for balance in balances
            ]
        }
        
        return JsonResponse({
            'success': True,
            'data': data
        })
        
    except Exception as e:
        logger.error(f"Ошибка получения баланса: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@csrf_exempt
@require_http_methods(["POST"])
def manual_deposit(request):
    """Ручное пополнение баланса"""
    try:
        data = json.loads(request.body)
        
        user_id = data.get('user_id')
        bookmaker = data.get('bookmaker')
        amount = data.get('amount')
        
        if not all([user_id, bookmaker, amount]):
            return JsonResponse({
                'success': False,
                'error': 'Недостаточно данных'
            })
        
        # Получаем или создаем баланс
        balance, created = PlayerBalance.objects.get_or_create(
            user_id=user_id,
            bookmaker=bookmaker,
            defaults={'balance': 0}
        )
        
        # Добавляем средства
        balance.add_balance(amount)
        
        return JsonResponse({
            'success': True,
            'message': f'Баланс пополнен на {amount}',
            'new_balance': float(balance.balance)
        })
        
    except Exception as e:
        logger.error(f"Ошибка ручного пополнения: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

