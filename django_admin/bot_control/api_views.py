from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
import json
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST", "PUT"])
def payment_api(request):
    """
    API для создания и обновления заявок на пополнение/вывод
    """
    try:
        print(f"🔄 Django API: Получен запрос {request.method} на /api/payment/")
        print(f"🔄 Django API: Headers: {dict(request.headers)}")
        print(f"🔄 Django API: Body: {request.body}")
        
        data = json.loads(request.body)
        print(f"🔄 Django API: Parsed data: {data}")
        
        if request.method == 'POST':
            # Создание новой заявки
            print("🔄 Django API: Создаем заявку...")
            return create_payment_request(data)
        elif request.method == 'PUT':
            # Обновление статуса заявки
            print("🔄 Django API: Обновляем заявку...")
            return update_payment_status(data)
            
    except Exception as e:
        print(f"❌ Django API error: {str(e)}")
        logger.error(f"Error in payment_api: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

def create_payment_request(data):
    """Создание заявки на пополнение или вывод"""
    try:
        print(f"🔄 Django API: Начинаем создание заявки с данными: {data}")
        
        from bot_control.models import Request
        
        # Валидация обязательных полей
        required_fields = ['type', 'amount', 'bookmaker']
        for field in required_fields:
            if field not in data:
                print(f"❌ Django API: Отсутствует обязательное поле: {field}")
                return JsonResponse({'error': f'Missing required field: {field}'}, status=400)
        
        # Проверяем наличие хотя бы одного ID пользователя
        if not data.get('userId') and not data.get('user_id') and not data.get('telegram_user_id'):
            print(f"❌ Django API: Отсутствует идентификация пользователя (userId, user_id или telegram_user_id)")
            return JsonResponse({'error': 'Missing user identification'}, status=400)
        
        print(f"🔄 Django API: Все обязательные поля присутствуют")
        
        # Получаем ID пользователей
        telegram_user_id = data.get('telegram_user_id')
        casino_player_id = data.get('userId') or data.get('user_id')  # ID игрока в букмекерской конторе
        
        print(f"🔄 Django API: Telegram ID: {telegram_user_id}, Casino ID: {casino_player_id}")
        
        # Проверяем, что у нас есть хотя бы один ID
        if not telegram_user_id and not casino_player_id:
            return JsonResponse({'error': 'Missing user identification'}, status=400)
        
        # Создаем заявку через Django ORM
        request_obj = Request.objects.create(
            user_id=telegram_user_id or casino_player_id,  # Telegram ID приоритетен, но можно использовать Casino ID как fallback
            request_type=data['type'],  # 'deposit' или 'withdraw'
            amount=data['amount'],
            bookmaker=data['bookmaker'],
            bank=data.get('bank', ''),
            account_id=casino_player_id or '',  # Casino ID игрока в букмекерской конторе
            phone=data.get('phone', ''),
            status='pending',
            created_at=timezone.now(),
            # Данные пользователя Telegram
            username=data.get('telegram_username', ''),
            first_name=data.get('telegram_first_name', ''),
            last_name=data.get('telegram_last_name', '')
        )
        
        print(f"✅ Django API: Заявка создана с ID {request_obj.id}")
        
        # Синхронизируем заявку в SQLite базу бота для автопополнения
        if data['type'] == 'deposit':
            try:
                # Создаем заявку в SQLite базе бота
                from django.conf import settings
                import sqlite3
                import os
                from pathlib import Path
                
                # Получаем путь к базе данных бота
                db_path = getattr(settings, 'BOT_DATABASE_PATH', None)
                if not db_path:
                    # Fallback путь
                    project_root = Path(__file__).resolve().parent.parent.parent
                    db_path = str(project_root / 'bot' / 'universal_bot.db')
                
                # Заявка уже сохранена в PostgreSQL через Request.objects.create()
                # Дублирование в SQLite больше не требуется
                logger.info(f"Request {request_obj.id} saved to PostgreSQL")
                
                # Запускаем немедленную проверку почты для автопополнения
                try:
                    from autodeposit.watcher import trigger_immediate_check
                    trigger_immediate_check()
                    logger.info(f"✅ Запущена немедленная проверка почты для заявки {request_obj.id}")
                except Exception as e:
                    logger.error(f"❌ Ошибка запуска проверки почты для заявки {request_obj.id}: {e}")
            except Exception as e:
                logger.error(f"❌ Ошибка синхронизации заявки {request_obj.id} в SQLite базу бота: {e}")
        
        return JsonResponse({
            'success': True,
            'id': request_obj.id,
            'transactionId': request_obj.id,
            'message': 'Заявка успешно создана'
        })
        
    except Exception as e:
        print(f"❌ Django API: Ошибка создания заявки: {str(e)}")
        logger.error(f"Error creating payment request: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

def update_payment_status(data):
    """Обновление статуса заявки"""
    try:
        from bot_control.models import Request
        
        print(f"🔄 Django API: Обновляем заявку с данными: {data}")
        
        # Если ID не указан или null, ищем последнюю заявку пользователя
        if 'id' not in data or data['id'] is None:
            print("🔄 Django API: ID не указан, ищем последнюю заявку пользователя")
            # Получаем последнюю заявку данного типа
            request_obj = Request.objects.filter(
                request_type=data.get('type', 'deposit')
            ).order_by('-created_at').first()
            
            if not request_obj:
                print("🔄 Django API: Заявки не найдены, создаем новую")
                # Если заявки не найдены, создаем новую с базовыми данными
                request_obj = Request.objects.create(
                    user_id=1,  # Временный ID
                    request_type=data.get('type', 'deposit'),
                    amount=0,
            status=data.get('status', 'pending'),
                    created_at=timezone.now()
                )
                print(f"🔄 Django API: Создана новая заявка ID {request_obj.id}")
            else:
                print(f"🔄 Django API: Найдена заявка ID {request_obj.id}")
        else:
            try:
                request_obj = Request.objects.get(id=data['id'])
                print(f"🔄 Django API: Найдена заявка по ID {request_obj.id}")
            except Request.DoesNotExist:
                return JsonResponse({'error': 'Request not found'}, status=404)
        
        # Обновляем статус
        if 'status' in data:
            request_obj.status = data['status']
            request_obj.updated_at = timezone.now()
            
            # Сохраняем status_detail если есть
            if 'status_detail' in data:
                try:
                    if hasattr(request_obj, 'status_detail'):
                        request_obj.status_detail = data['status_detail']
                except Exception:
                    pass
            
            # Если статус завершающий, устанавливаем processed_at
            if data['status'] in ['completed', 'rejected', 'approved', 'auto_completed', 'autodeposit_success', 'profile-5']:
                request_obj.processed_at = timezone.now()
            
            request_obj.save()

        return JsonResponse({
            'success': True,
            'message': 'Статус заявки обновлен'
        })
        
    except Exception as e:
        logger.error(f"Error updating payment status: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def generate_qr_api(request):
    """
    API для генерации QR кода для всех банков
    """
    try:
        data = json.loads(request.body)
        
        amount = data.get('amount', 0)
        player_id = data.get('playerId', '')
        
        # Получаем активный реквизит из PostgreSQL через Django ORM
        requisite = None
        try:
            from bot_control.models import BotRequisite
            active_requisite = BotRequisite.objects.filter(is_active=True).first()
            if active_requisite:
                requisite = active_requisite.value
                logger.info(f"Using active requisite from PostgreSQL: {requisite}")
        except Exception as e:
            logger.error(f"Error fetching requisite from PostgreSQL: {str(e)}", exc_info=True)
        
        # Если не нашли в PostgreSQL, пробуем получить из BotConfiguration (fallback)
        if not requisite:
            try:
                from bot_control.models import BotConfiguration
                active_config = BotConfiguration.objects.filter(key='active_requisite').first()
                if active_config and active_config.value:
                    # Ищем реквизит по ID
                    req_id = active_config.value
                    req_config = BotConfiguration.objects.filter(id=int(req_id), key__startswith='requisite_').first()
                    if req_config:
                        requisite = req_config.value
                        logger.info(f"Using requisite from BotConfiguration: {requisite}")
            except Exception as e:
                logger.error(f"Error fetching requisite from BotConfiguration: {str(e)}", exc_info=True)
        
        # Если всё еще нет реквизита, используем fallback
        if not requisite:
            requisite = '1234567890123456'
            logger.warning("No active requisite found, using fallback")
        
        logger.info(f"Generating QR for amount={amount}, requisite={requisite}")
        
        # Валидация данных
        if not amount or amount <= 0:
            logger.error(f"Invalid amount: {amount}")
            return JsonResponse({'error': 'Invalid amount'}, status=400)
        
        if not requisite or len(requisite) < 10:
            logger.error(f"Invalid requisite: {requisite}")
            return JsonResponse({'error': 'Invalid requisite'}, status=400)
        
        # Генерируем QR код
        try:
            amount_cents = int(float(amount) * 100)
            # Паддим сумму до 5 символов (например: 200.74 -> 20074)
            amount_str = str(amount_cents).zfill(5)
            amount_length = "05"  # Всегда 5 символов для совместимости
            
            requisite_length = str(len(requisite)).zfill(2)  # Длина реквизита
            
            # Создаем TLV структуру до контрольной суммы (без 6304)
            # Упрощенная структура для совместимости со всеми банками (особенно MBank)
            merchant_account_value = (
                f"0015qr.demirbank.kg"  # Под-тег 00: домен
                f"01047001"              # Под-тег 01: короткий тип (7001)
                f"10{requisite_length}{requisite}"  # Под-тег 10: реквизит
                f"120211130212"          # Под-теги 12, 13: дополнительные поля (упрощенные)
            )
            merchant_account_length = str(len(merchant_account_value)).zfill(2)
            
            payload = (
                f"000201"  # 00 - Payload Format Indicator
                f"010211"  # 01 - Point of Initiation Method (статический QR)
                f"32{merchant_account_length}{merchant_account_value}"  # 32 - Merchant Account
                f"52044829"  # 52 - Merchant Category Code
                f"5303417"   # 53 - Transaction Currency
                f"54{amount_length}{amount_str}"  # 54 - Amount (5 цифр с паддингом)
                f"5909DEMIRBANK"  # 59 - Merchant Name
            )
            
            logger.info(f"Payload before checksum: {payload}")
            
            # Вычисляем SHA256 контрольную сумму (по документации - от payload БЕЗ '6304')
            import hashlib
            checksum_full = hashlib.sha256(payload.encode('utf-8')).hexdigest()
            # Берем последние 4 символа в нижнем регистре (как в примере: 283f)
            checksum = checksum_full[-4:].lower()
            
            # Полный QR хеш: payload + '6304' + checksum
            qr_hash = payload + "6304" + checksum
        except Exception as e:
            logger.error(f"Error generating QR hash: {str(e)}", exc_info=True)
            return JsonResponse({'error': f'Error generating QR: {str(e)}'}, status=500)
        
        logger.info(f"Generated QR hash: {qr_hash}")
        logger.info(f"Checksum: {checksum}")
        
        # Создаем ссылки для всех банков
        bank_links = {
            'DemirBank': f"https://retail.demirbank.kg/#{qr_hash}",
            'O!Money': f"https://api.dengi.o.kg/ru/qr/#{qr_hash}",
            'Balance.kg': f"https://balance.kg/#{qr_hash}",
            'Bakai': f"https://bakai24.app/#{qr_hash}",
            'MegaPay': f"https://megapay.kg/get#{qr_hash}",
            'MBank': f"https://app.mbank.kg/qr/#{qr_hash}",
            'Optima': f"https://optima.kg/qr/#{qr_hash}",
            'Компаньон': f"https://kompanion.kg/qr/#{qr_hash}"
        }

        # Получаем настройки депозитов из админки
        try:
            import json
            deposits_str = BotConfiguration.get_setting('deposits', '{"enabled": true, "banks": ["mbank", "bakai", "balance", "demir", "omoney", "megapay"]}')
            deposits = json.loads(deposits_str) if isinstance(deposits_str, str) else deposits_str
            
            # Маппинг банков для клиентского сайта
            bank_mapping = {
                'mbank': 'MBank',
                'demir': 'DemirBank', 
                'balance': 'Balance.kg',
                'omoney': 'O!Money',
                'megapay': 'MegaPay',
                'bakai': 'Bakai',
                'optima': 'Optima',
                'kompanion': 'Компаньон'
            }
            
            # Фильтруем банки согласно настройкам
            enabled_banks = []
            for bank_code in deposits.get('banks', []):
                if bank_code in bank_mapping:
                    enabled_banks.append(bank_code)
            
            logger.info(f"Enabled banks from admin: {enabled_banks}")
            
        except Exception as e:
            logger.error(f"Error getting deposit settings: {str(e)}")
            # Fallback - все банки включены
            enabled_banks = ['demir', 'omoney', 'balance', 'bakai', 'megapay', 'mbank', 'optima', 'kompanion']

        return JsonResponse({
            'success': True,
            'qr_hash': qr_hash,
            'primary_url': bank_links['DemirBank'],
            'all_bank_urls': bank_links,
            'settings': {
                'enabled_banks': enabled_banks,
                'deposits_enabled': deposits.get('enabled', True)
            }
        })
        
    except Exception as e:
        logger.error(f"Error generating QR code: {str(e)}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_bot_settings(request):
    """API для получения настроек бота"""
    try:
        from bot_control.models import BotConfiguration
        
        settings = {}
        configs = BotConfiguration.objects.all()
        
        for config in configs:
            settings[config.key] = config.value
        
        return JsonResponse({
            'success': True,
            'settings': settings
        })
        
    except Exception as e:
        logger.error(f"Error getting bot settings: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_requisites_list(request):
    """API для получения списка реквизитов из PostgreSQL через Django ORM"""
    try:
        from bot_control.models import BotRequisite
        requisites_list = BotRequisite.objects.all().order_by('-is_active', '-id')
        
        requisites = []
        active_id = None
        
        for req in requisites_list:
            if req.is_active and active_id is None:
                active_id = req.id
            
            requisites.append({
                'id': req.id,
                'name': req.name or f'Реквизит {req.id}',
                'value': req.value,
                'is_active': req.is_active,
                'created_at': req.created_at.isoformat() if req.created_at else ''
            })
        
        logger.info(f"Found {len(requisites)} requisites, active_id: {active_id}")
        
        return JsonResponse({
            'success': True,
            'requisites': requisites,
            'active_id': active_id
        })
        
    except Exception as e:
        logger.error(f"Error getting requisites: {str(e)}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_search_payments(request):
    """API для поиска поступлений по сумме (игнорируя копейки)"""
    try:
        from bot_control.models import IncomingPayment
        from decimal import Decimal
        
        search_amount = request.GET.get('amount', '').strip()
        exact_match = request.GET.get('exact', 'false').lower() == 'true'
        processed_only = request.GET.get('processed', 'false').lower() == 'true'
        request_id = request.GET.get('request_id')
        
        payments_queryset = IncomingPayment.objects.all()
        
        # Фильтр по заявке, если указан
        if request_id:
            try:
                from bot_control.models import Request
                req = Request.objects.get(id=int(request_id))
                payments_queryset = payments_queryset.filter(request=req)
            except (Request.DoesNotExist, ValueError):
                payments_queryset = payments_queryset.none()
        
        # Фильтр по обработанным
        if processed_only:
            payments_queryset = payments_queryset.filter(is_processed=True)
        
        # Поиск по сумме
        if search_amount:
            try:
                search_amount_float = float(search_amount)
                # Если точное совпадение - ищем точную сумму
                if exact_match:
                    payments_queryset = payments_queryset.filter(amount=Decimal(str(search_amount_float)))
                else:
                    # Ищем по сумме без копеек (округляем до целого)
                    search_int = int(search_amount_float)
                    # Находим все суммы, где целая часть равна search_int
                    # Используем FLOOR для сравнения
                    from django.db.models import F, Value, IntegerField
                    from django.db.models.functions import Floor
                    payments_queryset = payments_queryset.annotate(
                        amount_int=Floor(F('amount'))
                    ).filter(amount_int=search_int)
            except ValueError:
                return JsonResponse({
                    'success': False,
                    'error': 'Некорректная сумма'
                }, status=400)
        
        payments_queryset = payments_queryset.order_by('-payment_date')[:50]  # Максимум 50
        
        payments = []
        for payment in payments_queryset:
            payments.append({
                'id': payment.id,
                'amount': float(payment.amount),
                'bank': payment.bank or '',
                'payment_date': payment.payment_date.strftime('%d.%m.%Y • %H:%M'),
                'is_processed': payment.is_processed,
                'request_id': payment.request.id if payment.request else None,
                'notification_text': payment.notification_text[:100] if payment.notification_text else ''
            })
        
        return JsonResponse({
            'success': True,
            'payments': payments,
            'count': len(payments)
        })
        
    except Exception as e:
        # Если таблица еще не создана (миграция не применена), возвращаем пустой список,
        # чтобы UI продолжал работать до выполнения миграций.
        if 'no such table' in str(e).lower() and 'incoming_payments' in str(e).lower():
            return JsonResponse({'success': True, 'payments': [], 'count': 0})
        logger.error(f"Error searching payments: {str(e)}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_referral_data(request):
    """API для получения данных рефералов"""
    try:
        user_id = request.GET.get('user_id')
        
        if not user_id:
            return JsonResponse({'error': 'user_id is required'}, status=400)
        
        # Здесь должна быть логика получения реферальных данных
        # Пока возвращаем заглушку
        return JsonResponse({
            'success': True,
            'referral_data': {
                'user_id': user_id,
                'referral_code': f'REF{user_id}',
                'total_referrals': 0,
                'total_earnings': 0
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting referral data: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def api_transaction_history(request):
    """API для получения истории транзакций"""
    try:
        from bot_control.models import Request
        
        user_id = request.GET.get('user_id')
        request_type = request.GET.get('type', '')  # deposit, withdraw, или пустая строка для всех
        
        print(f"🔄 Django API: Получен запрос истории транзакций, user_id={user_id}, type={request_type}")
        
        # БЕЗОПАСНО: выбираем только существующие столбцы, чтобы избежать ошибок миграций
        base_qs = Request.objects.all().only(
            'id', 'user_id', 'account_id', 'username', 'first_name', 'last_name',
            'request_type', 'amount', 'status', 'bookmaker', 'bank', 'phone',
            'created_at', 'processed_at'
        )
        if user_id:
            print(f"🔄 Django API: Фильтруем по user_id={user_id}")
            base_qs = base_qs.filter(user_id=user_id)
        else:
            print("🔄 Django API: user_id не указан, возвращаем все транзакции")

        if request_type:
            base_qs = base_qs.filter(request_type=request_type)

        transactions = list(base_qs.order_by('-created_at')[: (50 if user_id else 100)])

        transaction_list = []
        for tx in transactions:
            # Формируем имя пользователя
            user_display_name = 'Unknown'
            if tx.username:
                user_display_name = f"@{tx.username}"
            elif tx.first_name and tx.last_name:
                user_display_name = f"{tx.first_name} {tx.last_name}"
            elif tx.first_name:
                user_display_name = tx.first_name
            
            # Безопасно достаем status_detail из metadata, если поле есть и валидно
            status_detail_value = None
            try:
                if getattr(tx, 'status_detail', None):
                    status_detail_value = tx.status_detail
                elif hasattr(tx, 'metadata') and getattr(tx, 'metadata', None):
                    meta = getattr(tx, 'metadata', '{}') or '{}'
                    if isinstance(meta, str):
                        meta_json = json.loads(meta)
                    else:
                        meta_json = meta
                    status_detail_value = meta_json.get('status_detail')
            except Exception:
                status_detail_value = None

            transaction_list.append({
                'id': tx.id,
                'user_id': tx.user_id,  # Telegram ID
                'account_id': tx.account_id or '',  # Casino ID
                'user_display_name': user_display_name,
                'username': tx.username or '',
                'first_name': tx.first_name or '',
                'last_name': tx.last_name or '',
                'type': tx.request_type,
                'amount': float(tx.amount) if tx.amount else 0,
                'status': tx.status,
                'status_detail': status_detail_value,
                'bookmaker': tx.bookmaker or '',
                'bank': tx.bank or '',
                'phone': tx.phone or '',
                'created_at': tx.created_at.isoformat() if tx.created_at else '',
                'processed_at': tx.processed_at.isoformat() if tx.processed_at else None,
            })
        
        print(f"✅ Django API: Возвращаем {len(transaction_list)} транзакций")
        
        return JsonResponse({
            'success': True,
            'transactions': transaction_list
        })
        
    except Exception as e:
        print(f"❌ Django API: Ошибка получения истории транзакций: {str(e)}")
        logger.error(f"Error getting transaction history: {str(e)}")
        # Если таблица ещё не создана или иная проблемная ситуация — не ломаем UI
        if 'no such table' in str(e).lower() and 'request' in str(e).lower():
            return JsonResponse({'success': True, 'transactions': []})
        return JsonResponse({'success': False, 'transactions': [], 'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def sync_bot_api(request):
    """
    API для синхронизации с Telegram ботом
    """
    try:
        print(f"🔄 Django API: Получен запрос на синхронизацию с ботом")
        
        data = json.loads(request.body)
        print(f"🔄 Django API: Данные синхронизации: {data}")
        
        user_data = data.get('user', {})
        action = data.get('action', '')
        additional_data = data.get('data', {})
        init_data = data.get('initData', '')
        
        # Сохраняем данные пользователя в базе данных
        if user_data:
            from bot_control.models import UserProfile
            
            user_id = user_data.get('id')
            if user_id:
                # Создаем или обновляем профиль пользователя
                profile, created = UserProfile.objects.get_or_create(
                    telegram_id=user_id,
                    defaults={
                        'username': user_data.get('username', ''),
                        'first_name': user_data.get('first_name', ''),
                        'last_name': user_data.get('last_name', ''),
                        'language_code': user_data.get('language_code', 'ru'),
                        'is_premium': user_data.get('is_premium', False),
                        'init_data': init_data,
                        'last_activity': timezone.now()
                    }
                )
                
                if not created:
                    # Обновляем существующий профиль
                    profile.username = user_data.get('username', profile.username)
                    profile.first_name = user_data.get('first_name', profile.first_name)
                    profile.last_name = user_data.get('last_name', profile.last_name)
                    profile.language_code = user_data.get('language_code', profile.language_code)
                    profile.is_premium = user_data.get('is_premium', profile.is_premium)
                    profile.init_data = init_data
                    profile.last_activity = timezone.now()
                    profile.save()
                
                print(f"✅ Django API: Профиль пользователя {user_id} {'создан' if created else 'обновлен'}")
        
        # Обрабатываем различные действия
        if action == 'deposit_request_created':
            print(f"🔄 Django API: Обработка создания заявки на пополнение")
            # Здесь можно добавить дополнительную логику
            
        elif action == 'withdraw_request_created':
            print(f"🔄 Django API: Обработка создания заявки на вывод")
            # Здесь можно добавить дополнительную логику
            
        return JsonResponse({
            'success': True,
            'message': 'Синхронизация с ботом успешна'
        })
        
    except Exception as e:
        print(f"❌ Django API: Ошибка синхронизации с ботом: {str(e)}")
        logger.error(f"Error in sync_bot_api: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)