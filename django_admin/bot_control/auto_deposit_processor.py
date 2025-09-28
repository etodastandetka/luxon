"""
Автоматический процессор пополнений
Обрабатывает уведомления от Android приложения и пополняет баланс игроков
"""

import json
import logging
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from .models import BankNotification, AutoDepositRequest, PlayerBalance
from .auto_deposit_models import BankNotification as BankNotificationModel, AutoDepositRequest

logger = logging.getLogger(__name__)

# Настройки Telegram бота
TELEGRAM_BOT_TOKEN = "YOUR_BOT_TOKEN"  # Замените на ваш токен
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

class AutoDepositProcessor:
    """Класс для обработки автоматических пополнений"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def process_bank_notification(self, notification_data):
        """
        Обрабатывает уведомление от банка и пополняет баланс игрока
        
        Args:
            notification_data (dict): Данные уведомления от Android приложения
            
        Returns:
            dict: Результат обработки
        """
        try:
            # Извлекаем данные из уведомления
            bank_name = notification_data.get('bank_name', 'Unknown Bank')
            amount = float(notification_data.get('amount', 0))
            transaction_id = notification_data.get('transaction_id', '')
            notification_text = notification_data.get('notification_text', '')
            device_id = notification_data.get('device_id', '')
            
            self.logger.info(f"Обработка уведомления: {bank_name}, сумма: {amount}, ID: {transaction_id}")
            
            # Проверяем, не обрабатывали ли мы уже эту транзакцию
            if transaction_id and BankNotificationModel.objects.filter(transaction_id=transaction_id).exists():
                self.logger.warning(f"Транзакция {transaction_id} уже обработана")
                return {"status": "already_processed", "message": "Транзакция уже обработана"}
            
            # Ищем игрока по сумме (точное совпадение)
            player_balance = self.find_player_by_amount(amount)
            
            if not player_balance:
                self.logger.warning(f"Игрок с суммой {amount} не найден")
                return {"status": "player_not_found", "message": f"Игрок с суммой {amount} не найден"}
            
            # Пополняем баланс игрока
            success = self.deposit_to_player(player_balance, amount, transaction_id, bank_name)
            
            if success:
                # Отправляем уведомление в Telegram
                self.send_telegram_notification(player_balance.user_id, amount, bank_name)
                
                # Сохраняем уведомление в базу
                self.save_notification(notification_data, player_balance.user_id, amount)
                
                # Помечаем как автоматически пополненное
                self.mark_as_auto_deposited(player_balance.user_id, amount)
                
                self.logger.info(f"Успешно пополнен баланс игрока {player_balance.user_id} на {amount}")
                return {
                    "status": "success", 
                    "message": f"Баланс пополнен на {amount}",
                    "player_id": player_balance.user_id,
                    "amount": amount,
                    "auto_deposited": True
                }
            else:
                return {"status": "error", "message": "Ошибка пополнения баланса"}
                
        except Exception as e:
            self.logger.error(f"Ошибка обработки уведомления: {e}")
            return {"status": "error", "message": str(e)}
    
    def find_player_by_amount(self, amount):
        """
        Ищет игрока по точной сумме пополнения
        
        Args:
            amount (float): Сумма для поиска
            
        Returns:
            PlayerBalance: Найденный игрок или None
        """
        try:
            # Ищем в ожидающих пополнениях
            deposit_request = AutoDepositRequest.objects.filter(
                amount=amount,
                status='pending'
            ).first()
            
            if deposit_request:
                return PlayerBalance.objects.filter(user_id=deposit_request.user_id).first()
            
            # Если не найдено, ищем по близкой сумме (в пределах 0.01)
            deposit_request = AutoDepositRequest.objects.filter(
                amount__gte=amount - 0.01,
                amount__lte=amount + 0.01,
                status='pending'
            ).first()
            
            if deposit_request:
                return PlayerBalance.objects.filter(user_id=deposit_request.user_id).first()
                
            return None
            
        except Exception as e:
            self.logger.error(f"Ошибка поиска игрока: {e}")
            return None
    
    def deposit_to_player(self, player_balance, amount, transaction_id, bank_name):
        """
        Пополняет баланс игрока
        
        Args:
            player_balance (PlayerBalance): Объект баланса игрока
            amount (float): Сумма пополнения
            transaction_id (str): ID транзакции
            bank_name (str): Название банка
            
        Returns:
            bool: Успешность операции
        """
        try:
            # Обновляем баланс
            player_balance.balance += amount
            player_balance.last_updated = timezone.now()
            player_balance.save()
            
            # Обновляем статус заявки на пополнение как авто-завершённой
            deposit_request = AutoDepositRequest.objects.filter(
                user_id=player_balance.user_id,
                amount=amount,
                status='pending'
            ).first()
            
            if deposit_request:
                deposit_request.status = 'auto_completed'
                deposit_request.transaction_id = transaction_id
                deposit_request.bank_name = bank_name
                deposit_request.completed_at = timezone.now()
                deposit_request.save()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Ошибка пополнения баланса: {e}")
            return False
    
    def send_telegram_notification(self, user_id, amount, bank_name):
        """
        Отправляет уведомление о пополнении в Telegram
        
        Args:
            user_id (int): ID пользователя в Telegram
            amount (float): Сумма пополнения
            bank_name (str): Название банка
        """
        try:
            message = f"""
🎉 **Пополнение успешно!**

💰 **Сумма:** {amount} KGS
🏦 **Банк:** {bank_name}
⏰ **Время:** {timezone.now().strftime('%H:%M:%S')}

Ваш баланс пополнен автоматически!
            """.strip()
            
            url = f"{TELEGRAM_API_URL}/sendMessage"
            data = {
                'chat_id': user_id,
                'text': message,
                'parse_mode': 'Markdown'
            }
            
            response = requests.post(url, data=data, timeout=10)
            
            if response.status_code == 200:
                self.logger.info(f"Уведомление отправлено пользователю {user_id}")
            else:
                self.logger.error(f"Ошибка отправки уведомления: {response.text}")
                
        except Exception as e:
            self.logger.error(f"Ошибка отправки Telegram уведомления: {e}")
    
    def save_notification(self, notification_data, user_id, amount):
        """
        Сохраняет уведомление в базу данных
        
        Args:
            notification_data (dict): Данные уведомления
            user_id (int): ID пользователя
            amount (float): Сумма
        """
        try:
            BankNotificationModel.objects.create(
                user_id=user_id,
                bank_name=notification_data.get('bank_name', ''),
                amount=amount,
                transaction_id=notification_data.get('transaction_id', ''),
                notification_text=notification_data.get('notification_text', ''),
                source_app=notification_data.get('source_app', ''),
                device_id=notification_data.get('device_id', ''),
                processed_at=timezone.now()
            )
            
        except Exception as e:
            self.logger.error(f"Ошибка сохранения уведомления: {e}")
    
    def mark_as_auto_deposited(self, user_id, amount):
        """
        Помечает заявку как автоматически пополненную
        
        Args:
            user_id (int): ID пользователя
            amount (float): Сумма
        """
        try:
            # Обновляем заявку на пополнение (на случай гонки состояний: pending/ completed)
            deposit_request = AutoDepositRequest.objects.filter(
                user_id=user_id,
                amount=amount,
                status__in=['pending','completed']
            ).order_by('-created_at').first()
            
            if deposit_request:
                deposit_request.status = 'auto_completed'
                deposit_request.completed_at = timezone.now()
                deposit_request.save()
                
                # Создаем запись о автоматическом пополнении
                PlayerBalance.objects.filter(user_id=user_id).update(
                    last_auto_deposit=timezone.now(),
                    auto_deposited=True
                )
                
                self.logger.info(f"Заявка {deposit_request.id} помечена как автоматически пополненная")
            
        except Exception as e:
            self.logger.error(f"Ошибка отметки автопополнения: {e}")
    
    def check_auto_deposit_status(self, user_id, amount):
        """
        Проверяет статус автоматического пополнения
        
        Args:
            user_id (int): ID пользователя
            amount (float): Сумма
            
        Returns:
            dict: Статус автопополнения
        """
        try:
            # Проверяем, есть ли недавние автоматические пополнения
            recent_auto_deposits = PlayerBalance.objects.filter(
                user_id=user_id,
                last_auto_deposit__gte=timezone.now() - timezone.timedelta(minutes=10),
                auto_deposited=True
            ).first()
            
            if recent_auto_deposits:
                return {
                    'auto_deposited': True,
                    'last_deposit': recent_auto_deposits.last_auto_deposit.isoformat(),
                    'balance': recent_auto_deposits.balance
                }
            else:
                return {
                    'auto_deposited': False,
                    'balance': 0
                }
                
        except Exception as e:
            self.logger.error(f"Ошибка проверки статуса автопополнения: {e}")
            return {'auto_deposited': False, 'error': str(e)}

# Глобальный экземпляр процессора
processor = AutoDepositProcessor()

@csrf_exempt
@require_http_methods(["POST"])
def receive_bank_notification(request):
    """
    API endpoint для получения уведомлений от Android приложения
    """
    try:
        # Парсим JSON данные
        data = json.loads(request.body)
        
        # Логируем полученные данные
        logger.info(f"Получено уведомление: {data}")
        
        # Обрабатываем уведомление
        result = processor.process_bank_notification(data)
        
        return JsonResponse(result)
        
    except json.JSONDecodeError:
        logger.error("Ошибка парсинга JSON")
        return JsonResponse({"status": "error", "message": "Неверный JSON"}, status=400)
        
    except Exception as e:
        logger.error(f"Ошибка обработки запроса: {e}")
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def get_player_balance(request, user_id):
    """
    API endpoint для получения баланса игрока
    """
    try:
        player_balance = PlayerBalance.objects.filter(user_id=user_id).first()
        
        if player_balance:
            # Проверяем статус автопополнения
            auto_status = processor.check_auto_deposit_status(user_id, 0)
            
            return JsonResponse({
                "user_id": user_id,
                "balance": player_balance.balance,
                "last_updated": player_balance.last_updated.isoformat(),
                "auto_deposited": auto_status.get('auto_deposited', False),
                "last_auto_deposit": auto_status.get('last_deposit'),
            })
        else:
            return JsonResponse({"error": "Игрок не найден"}, status=404)
            
    except Exception as e:
        logger.error(f"Ошибка получения баланса: {e}")
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def check_auto_deposit_status(request, user_id):
    """
    API endpoint для проверки статуса автоматического пополнения
    """
    try:
        amount = float(request.GET.get('amount', 0))
        status = processor.check_auto_deposit_status(user_id, amount)
        
        return JsonResponse(status)
        
    except Exception as e:
        logger.error(f"Ошибка проверки статуса автопополнения: {e}")
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def manual_deposit(request):
    """
    API endpoint для ручного пополнения баланса
    """
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        amount = float(data.get('amount', 0))
        bank_name = data.get('bank_name', 'Manual')
        
        if not user_id or amount <= 0:
            return JsonResponse({"error": "Неверные параметры"}, status=400)
        
        # Создаем заявку в базе данных
        photo_url = data.get('photo_url', '')
        username = data.get('username', '')
        
        deposit_request = AutoDepositRequest.objects.create(
            user_id=user_id,
            amount=amount,
            bank_name=bank_name,
            request_type='deposit',
            status='pending',
            photo_url=photo_url,
            username=username
        )
        
        # Создаем или обновляем баланс игрока
        player_balance, created = PlayerBalance.objects.get_or_create(
            user_id=user_id,
            defaults={'balance': 0.0}
        )
        
        # Пополняем баланс
        player_balance.balance += amount
        player_balance.last_updated = timezone.now()
        player_balance.save()
        
        # Отправляем уведомление
        processor.send_telegram_notification(user_id, amount, bank_name)
        
        return JsonResponse({
            "status": "success",
            "message": f"Баланс пополнен на {amount}",
            "new_balance": player_balance.balance
        })
        
    except Exception as e:
        logger.error(f"Ошибка ручного пополнения: {e}")
        return JsonResponse({"error": str(e)}, status=500)
