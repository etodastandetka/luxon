from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import sqlite3
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def api_sync_webapp(request):
    """
    API endpoint для синхронизации данных между мини-приложением и ботом
    """
    try:
        data = json.loads(request.body)
        
        telegram_user_id = data.get('telegram_user_id')
        username = data.get('username')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        language_code = data.get('language_code')
        action = data.get('action')
        webapp_data = data.get('data', {})
        init_data = data.get('init_data')
        timestamp = data.get('timestamp')
        
        if not telegram_user_id or not action:
            return JsonResponse({
                'error': 'Missing required fields: telegram_user_id, action'
            }, status=400)
        
        # Используем Django ORM для работы с данными
        from bot_control.models import BotUser, Request
        
        # Обновляем или создаем запись пользователя
        BotUser.objects.update_or_create(
            user_id=telegram_user_id,
            defaults={
                'username': username or '',
                'first_name': first_name or '',
                'last_name': last_name or '',
                'language': language_code or 'ru'
            }
        )
        
        # user_actions - можно создать отдельную модель если нужно, пока пропускаем
        
        # Обрабатываем специфичные действия
        if action == 'deposit_request_created':
            handle_deposit_request(telegram_user_id, webapp_data)
        elif action == 'withdraw_request_created':
            handle_withdraw_request(telegram_user_id, webapp_data)
        elif action == 'app_opened':
            handle_app_opened(telegram_user_id, webapp_data)
        
        return JsonResponse({
            'success': True,
            'message': 'Data synced successfully'
        })
        
    except Exception as e:
        logger.error(f"Error in api_sync_webapp: {str(e)}")
        return JsonResponse({
            'error': 'Internal server error'
        }, status=500)

def handle_deposit_request(telegram_user_id, data):
    """Обработка создания заявки на пополнение через Django ORM"""
    try:
        from bot_control.models import Request
        from django.utils import timezone
        
        request_id = data.get('requestId')
        bookmaker = data.get('bookmaker')
        player_id = data.get('playerId')
        amount = data.get('amount')
        bank = data.get('bank')
        payment_url = data.get('paymentUrl')
        
        # Обновляем статус заявки через Django ORM
        try:
            req = Request.objects.get(id=request_id)
            req.status = 'pending'
            req.user_id = telegram_user_id
            req.save()
        except Request.DoesNotExist:
            # Заявка не найдена - это нормально для webapp синхронизации
            pass
        
        # Отправляем уведомление пользователю через бота
        send_telegram_notification(
            telegram_user_id,
            f"✅ Заявка на пополнение создана!\n\n"
            f"📊 Букмекер: {bookmaker}\n"
            f"🆔 ID игрока: {player_id}\n"
            f"💰 Сумма: {amount} сом\n"
            f"🏦 Банк: {bank}\n\n"
            f"Ссылка для оплаты готова. Перейдите в мини-приложение для оплаты."
        )
        
    except Exception as e:
        logger.error(f"Error handling deposit request: {str(e)}")

def handle_withdraw_request(telegram_user_id, data):
    """Обработка создания заявки на вывод через Django ORM"""
    try:
        from bot_control.models import Request
        from django.utils import timezone
        
        request_id = data.get('requestId')
        bookmaker = data.get('bookmaker')
        player_id = data.get('playerId')
        amount = data.get('amount')
        bank = data.get('bank')
        phone = data.get('phone')
        
        # Обновляем статус заявки через Django ORM
        try:
            req = Request.objects.get(id=request_id)
            req.status = 'pending'
            req.user_id = telegram_user_id
            req.save()
        except Request.DoesNotExist:
            # Заявка не найдена - это нормально для webapp синхронизации
            pass
        
        # Отправляем уведомление пользователю через бота
        send_telegram_notification(
            telegram_user_id,
            f"✅ Заявка на вывод создана!\n\n"
            f"📊 Букмекер: {bookmaker}\n"
            f"🆔 ID игрока: {player_id}\n"
            f"💰 Сумма: {amount} сом\n"
            f"🏦 Банк: {bank}\n"
            f"📱 Телефон: {phone}\n\n"
            f"Заявка отправлена на обработку. Результат будет уведомлен."
        )
        
    except Exception as e:
        logger.error(f"Error handling withdraw request: {str(e)}")

def handle_app_opened(telegram_user_id, data):
    """Обработка открытия приложения через Django ORM"""
    try:
        from bot_control.models import BotUser
        
        page = data.get('page', 'unknown')
        language = data.get('language', 'ru')
        
        # Обновляем язык пользователя
        try:
            user = BotUser.objects.get(user_id=telegram_user_id)
            user.language = language or 'ru'
            user.save()
        except BotUser.DoesNotExist:
            # Пользователь уже создан выше
            pass
        
        # user_actions - можно создать отдельную модель если нужно
        # Пока считаем что это не первое открытие если пользователь уже существует
        is_first_time = False
        
        if is_first_time:
            send_telegram_notification(
                telegram_user_id,
                f"🎉 Добро пожаловать в LUX ON!\n\n"
                f"Теперь вы можете:\n"
                f"• Пополнять баланс в любом букмекере\n"
                f"• Выводить средства на карту\n"
                f"• Участвовать в реферальной программе\n\n"
                f"Выберите действие в мини-приложении!"
            )
        
    except Exception as e:
        logger.error(f"Error handling app opened: {str(e)}")

def send_telegram_notification(user_id, message):
    """Отправка уведомления пользователю через Telegram бота"""
    try:
        # Здесь должна быть логика отправки сообщения через Telegram Bot API
        # Пока что просто логируем
        logger.info(f"Sending notification to user {user_id}: {message}")
        
        # TODO: Реализовать отправку через Telegram Bot API
        # import requests
        # bot_token = "YOUR_BOT_TOKEN"
        # url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        # data = {
        #     "chat_id": user_id,
        #     "text": message,
        #     "parse_mode": "HTML"
        # }
        # requests.post(url, data=data)
        
    except Exception as e:
        logger.error(f"Error sending Telegram notification: {str(e)}")

@csrf_exempt
@require_http_methods(["POST"])
def api_notify_payment_success(request):
    """
    API endpoint для уведомления об успешной оплате
    """
    try:
        data = json.loads(request.body)
        
        request_id = data.get('request_id')
        amount = data.get('amount')
        bookmaker = data.get('bookmaker')
        
        if not request_id:
            return JsonResponse({
                'error': 'Missing request_id'
            }, status=400)
        
        # Подключаемся к базе данных
        conn = sqlite3.connect('universal_bot.db')
        cursor = conn.cursor()
        
        # Получаем данные пользователя по заявке
        cursor.execute('''
            SELECT r.user_id, r.amount, r.bookmaker, u.username, u.first_name
            FROM requests r
            LEFT JOIN users u ON r.user_id = u.telegram_id
            WHERE r.id = ? OR r.request_id = ?
        ''', (request_id, request_id))
        
        result = cursor.fetchone()
        if result:
            user_id, amount, bookmaker, username, first_name = result
            
            # Обновляем статус заявки
            cursor.execute('''
                UPDATE requests 
                SET status = 'completed', updated_at = ?
                WHERE id = ? OR request_id = ?
            ''', (datetime.now().isoformat(), request_id, request_id))
            
            # Отправляем уведомление об успешной оплате
            send_telegram_notification(
                user_id,
                f"🎉 Пополнение успешно!\n\n"
                f"💰 Сумма: {amount} сом\n"
                f"📊 Букмекер: {bookmaker}\n"
                f"✅ Статус: Завершено\n\n"
                f"Средства поступили на ваш счет. Удачной игры!"
            )
            
            conn.commit()
            conn.close()
            
            return JsonResponse({
                'success': True,
                'message': 'Payment notification sent'
            })
        else:
            conn.close()
            return JsonResponse({
                'error': 'Request not found'
            }, status=404)
            
    except Exception as e:
        logger.error(f"Error in api_notify_payment_success: {str(e)}")
        return JsonResponse({
            'error': 'Internal server error'
        }, status=500)
