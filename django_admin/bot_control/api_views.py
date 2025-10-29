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
                
                if os.path.exists(db_path):
                    conn = sqlite3.connect(db_path)
                    cur = conn.cursor()
                    
                    # Создаем таблицу requests, если её нет
                    cur.execute('''
                        CREATE TABLE IF NOT EXISTS requests (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            username TEXT,
                            first_name TEXT,
                            last_name TEXT,
                            bookmaker TEXT,
                            account_id TEXT,
                            amount REAL NOT NULL DEFAULT 0,
                            request_type TEXT NOT NULL,
                            status TEXT NOT NULL DEFAULT 'pending',
                            withdrawal_code TEXT,
                            photo_file_id TEXT,
                            photo_file_url TEXT,
                            bank TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP,
                            processed_at TIMESTAMP
                        )
                    ''')
                    
                    # Вставляем заявку в SQLite базу бота
                    cur.execute('''
                        INSERT INTO requests 
                        (user_id, username, first_name, last_name, bookmaker, account_id, amount, request_type, status, bank, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ''', (
                        request_obj.user_id,
                        request_obj.username or '',
                        request_obj.first_name or '',
                        request_obj.last_name or '',
                        request_obj.bookmaker or '',
                        request_obj.account_id or '',
                        float(request_obj.amount) if request_obj.amount else 0.0,
                        'deposit',
                        'pending',
                        request_obj.bank or '',
                    ))
                    
                    conn.commit()
                    conn.close()
                    logger.info(f"✅ Заявка {request_obj.id} синхронизирована в SQLite базу бота")
                    
                    # Запускаем немедленную проверку почты для автопополнения
                    try:
                        from autodeposit.watcher import trigger_immediate_check
                        trigger_immediate_check()
                        logger.info(f"✅ Запущена немедленная проверка почты для заявки {request_obj.id}")
                    except Exception as e:
                        logger.error(f"❌ Ошибка запуска проверки почты для заявки {request_obj.id}: {e}")
                else:
                    logger.warning(f"⚠️ SQLite база бота не найдена по пути: {db_path}")
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
            
            # Если статус завершающий, устанавливаем processed_at
            if data['status'] in ['completed', 'rejected', 'approved', 'auto_completed']:
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
        
        # Получаем активный реквизит из таблицы requisites в SQLite
        try:
            import sqlite3
            from django.conf import settings as dj_settings
            
            conn = sqlite3.connect(str(dj_settings.BOT_DATABASE_PATH))
            cur = conn.cursor()
            cur.execute('SELECT value FROM requisites WHERE is_active = 1 LIMIT 1')
            row = cur.fetchone()
            conn.close()
            
            if row:
                requisite = row[0]
                logger.info(f"Using active requisite from DB: {requisite}")
            else:
                # Fallback реквизит
                requisite = '1234567890123456'
                logger.warning("No active requisite found, using fallback")
        except Exception as e:
            logger.error(f"Error fetching requisite: {str(e)}")
            # Fallback реквизит
            requisite = '1234567890123456'
        
        logger.info(f"Generating QR for amount={amount}, requisite={requisite}")
        
        # Генерируем QR код
        amount_cents = int(amount * 100)
        # Паддим сумму до 5 символов (например: 200.74 -> 20074)
        amount_str = str(amount_cents).zfill(5)
        amount_length = "05"  # Всегда 5 символов для совместимости
        
        requisite_length = str(len(requisite)).zfill(2)  # Длина реквизита
        
        # Создаем TLV структуру до контрольной суммы (без 6304)
        # Упрощенная структура для совместимости со всеми банками (особенно MBank)
        merchant_account_value = (
            f"0015qr.demirbank.kg"  # Под-тег 00: домен
            f"01047001"              # Под-тег 01: короткий тип (7001)
            f"10{requisite_length}{requisite}"  # Под-тег 10: реквизит (16 цифр)
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
    """API для получения списка реквизитов"""
    try:
        from bot_control.models import BotConfiguration
        
        requisites = []
        configs = BotConfiguration.objects.filter(key__startswith='requisite_')
        
        for config in configs:
            requisites.append({
                'id': config.id,
                'name': config.key.replace('requisite_', ''),
                'value': config.value,
                'is_active': config.key == 'active_requisite'
            })
        
        # Получаем активный реквизит
        try:
            active_config = BotConfiguration.objects.get(key='active_requisite')
            active_id = active_config.id
        except BotConfiguration.DoesNotExist:
            active_id = None
        
        return JsonResponse({
            'success': True,
            'requisites': requisites,
            'active_id': active_id
        })
        
    except Exception as e:
        logger.error(f"Error getting requisites: {str(e)}")
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
        
        # Если user_id не указан, возвращаем все транзакции
        if not user_id:
            print("🔄 Django API: user_id не указан, возвращаем все транзакции")
            transactions = Request.objects.all().order_by('-created_at')[:100]
        else:
            print(f"🔄 Django API: Фильтруем по user_id={user_id}")
            transactions = Request.objects.filter(user_id=user_id).order_by('-created_at')[:50]
        
        # Дополнительная фильтрация по типу
        if request_type:
            transactions = transactions.filter(request_type=request_type)
        
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
        return JsonResponse({'error': str(e)}, status=500)

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