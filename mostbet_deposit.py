#!/usr/bin/env python3
"""
Простой скрипт для пополнения через Mostbet Cash API
Просто вводите ID игрока и сумму - все остальное автоматически!
"""

import hashlib
import hmac
import json
import requests
from datetime import datetime, timezone

class MostbetDeposit:
    def __init__(self):
        # Ваши данные из сообщения (ОБНОВЛЕННЫЕ 05.11.2025)
        self.api_key = "api-key:62e9da4c-52e3-4d0f-b579-c9e7805f711d"
        self.secret = "Kana312"
        self.cashpoint_id = "C131864"  # Второй cashpoint_id (пробуем вместо F125160)
        self.base_url = "https://apimb.com"
    
    def get_timestamp(self):
        """Получить текущее время в UTC формате"""
        now = datetime.now(timezone.utc)
        return now.strftime("%Y-%m-%d %H:%M:%S")
    
    def generate_signature(self, path, request_body, timestamp):
        """Генерировать HMAC SHA3-256 подпись"""
        signature_string = f"{self.api_key}{path}{request_body}{timestamp}"
        signature = hmac.new(
            self.secret.encode('utf-8'),
            signature_string.encode('utf-8'),
            hashlib.sha3_256
        ).hexdigest()
        return signature
    
    def deposit_player(self, player_id, amount, currency="KGS"):
        """Пополнить счет игрока"""
        try:
            path = f"/mbc/gateway/v1/api/cashpoint/{self.cashpoint_id}/player/deposit"
            timestamp = self.get_timestamp()
            
            # Тело запроса
            request_body = json.dumps({
                "brandId": 1,
                "playerId": str(player_id),
                "amount": float(amount),
                "currency": currency
            }, separators=(',', ':'))
            
            # Генерируем подпись
            signature = self.generate_signature(path, request_body, timestamp)
            
            # Заголовки
            headers = {
                'X-Api-Key': self.api_key,
                'X-Timestamp': timestamp,
                'X-Signature': signature,
                'X-Project': 'MBC',
                'Content-Type': 'application/json',
                'Accept': '*/*'
            }
            
            # Отправляем запрос
            url = f"{self.base_url}{path}"
            response = requests.post(url, headers=headers, data=request_body, timeout=30)
            
            print(f"\n🔗 URL: {url}")
            print(f"📝 Запрос: {request_body}")
            print(f"⏰ Время: {timestamp}")
            print(f"🔐 Подпись: {signature[:20]}...")
            print(f"📊 Статус: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ УСПЕХ! Пополнение выполнено:")
                print(f"   🆔 ID транзакции: {data.get('transactionId', 'N/A')}")
                print(f"   📊 Статус: {data.get('status', 'N/A')}")
                return True
            else:
                print(f"❌ ОШИБКА! {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   📝 Сообщение: {error_data.get('message', 'Неизвестная ошибка')}")
                    print(f"   🔢 Код: {error_data.get('code', 'N/A')}")
                except:
                    print(f"   📝 Ответ: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ ОШИБКА: {e}")
            return False

def main():
    print("🎰 MOSTBET CASH - ПОПОЛНЕНИЕ СЧЕТА")
    print("=" * 50)
    
    # Создаем экземпляр класса
    mostbet = MostbetDeposit()
    
    while True:
        try:
            print(f"\n📋 Введите данные для пополнения:")
            
            # Запрашиваем ID игрока
            player_id = input("🆔 ID игрока (например, C92905): ").strip()
            if not player_id:
                print("❌ ID игрока не может быть пустым!")
                continue
            
            # Запрашиваем сумму
            amount_str = input("💰 Сумма пополнения (например, 1000): ").strip()
            if not amount_str:
                print("❌ Сумма не может быть пустой!")
                continue
            
            try:
                amount = float(amount_str)
                if amount <= 0:
                    print("❌ Сумма должна быть больше 0!")
                    continue
            except ValueError:
                print("❌ Неверный формат суммы!")
                continue
            
            # Запрашиваем валюту
            currency = input("💱 Валюта (KGS/RUB/USD) [KGS]: ").strip().upper()
            if not currency:
                currency = "KGS"
            
            print(f"\n🔄 Выполняем пополнение...")
            print(f"   👤 Игрок: {player_id}")
            print(f"   💰 Сумма: {amount} {currency}")
            
            # Выполняем пополнение
            success = mostbet.deposit_player(player_id, amount, currency)
            
            if success:
                print(f"\n🎉 Пополнение успешно выполнено!")
            else:
                print(f"\n💥 Пополнение не удалось!")
            
            # Спрашиваем, хотите ли продолжить
            continue_choice = input(f"\n🔄 Хотите пополнить еще одного игрока? (y/n): ").strip().lower()
            if continue_choice not in ['y', 'yes', 'да', 'д']:
                break
                
        except KeyboardInterrupt:
            print(f"\n\n👋 До свидания!")
            break
        except Exception as e:
            print(f"\n❌ Неожиданная ошибка: {e}")
            continue
    
    print(f"\n🎯 Спасибо за использование Mostbet Cash API!")

if __name__ == "__main__":
    main()
