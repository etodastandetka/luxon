#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Простой скрипт для работы с WinWin mobcash API
Просто вводите ID игрока и сумму - все остальное автоматически!
"""

import hashlib
import json
import requests
import base64
from datetime import datetime, timezone

class WinWinDeposit:
    def __init__(self):
        # Ваши данные для WinWin mobcash
        self.hash_key = "ca4c49cea830e2fbebf7e3894659df1cd74abb2e0e79d58b17ecf82ea148cf2d"
        self.cashierpass = "yYRbyQeX"
        self.login = "burgoevkan"
        self.cashdesk_id = 1416579
        self.base_url = "https://partners.servcul.com/CashdeskBotAPI"
        
        # Создаем заголовок Basic Auth
        auth_string = f"{self.login}:{self.cashierpass}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        self.auth_header = f"Basic {auth_b64}"
    
    def get_timestamp(self):
        """Получить текущее время в UTC формате"""
        now = datetime.now(timezone.utc)
        return now.strftime("%Y.%m.%d %H:%M:%S")
    
    def generate_signature(self, method, user_id=None, summa=None, code=None):
        """Генерировать подпись для WinWin API"""
        dt = self.get_timestamp()
        lng = "ru"              
        
        if method == "balance":
            # Для баланса: SHA256(hash={0}&cashierpass={1}&dt={2})
            step1 = f"hash={self.hash_key}&cashierpass={self.cashierpass}&dt={dt}"
            step1_hash = hashlib.sha256(step1.encode()).hexdigest()
            
            # MD5(dt={0}&cashierpass={1}&cashdeskid={2})
            step2 = f"dt={dt}&cashierpass={self.cashierpass}&cashdeskid={self.cashdesk_id}"
            step2_hash = hashlib.md5(step2.encode()).hexdigest()
            
            # SHA256(step1 + step2)
            final_string = step1_hash + step2_hash
            signature = hashlib.sha256(final_string.encode()).hexdigest()
            
        elif method == "search":
            # Для поиска: SHA256(hash={0}&userid={1}&cashdeskid={2})
            step1 = f"hash={self.hash_key}&userid={user_id}&cashdeskid={self.cashdesk_id}"
            step1_hash = hashlib.sha256(step1.encode()).hexdigest()
            
            # MD5(userid={0}&cashierpass={1}&hash={2})
            step2 = f"userid={user_id}&cashierpass={self.cashierpass}&hash={self.hash_key}"
            step2_hash = hashlib.md5(step2.encode()).hexdigest()
            
            # SHA256(step1 + step2)
            final_string = step1_hash + step2_hash
            signature = hashlib.sha256(final_string.encode()).hexdigest()
            
        elif method == "deposit":
            # Для пополнения: SHA256(hash={0}&lng={1}&UserId={2})
            # В документации указан UserId с большой буквы, но в примере используется userid
            # Используем userid для совместимости
            step1 = f"hash={self.hash_key}&lng={lng}&userid={user_id}"
            step1_hash = hashlib.sha256(step1.encode()).hexdigest()
            
            # MD5(summa={0}&cashierpass={1}&cashdeskid={2})
            step2 = f"summa={summa}&cashierpass={self.cashierpass}&cashdeskid={self.cashdesk_id}"
            step2_hash = hashlib.md5(step2.encode()).hexdigest()
            
            # SHA256(step1 + step2)
            final_string = step1_hash + step2_hash
            signature = hashlib.sha256(final_string.encode()).hexdigest()
            
            print(f"🔍 DEBUG - Step1: {step1}")
            print(f"🔍 DEBUG - Step1 Hash: {step1_hash}")
            print(f"🔍 DEBUG - Step2: {step2}")
            print(f"🔍 DEBUG - Step2 Hash: {step2_hash}")
            print(f"🔍 DEBUG - Final String: {final_string}")
            print(f"🔍 DEBUG - Signature: {signature}")
            
        elif method == "payout":
            # Для выплаты: SHA256(hash={0}&lng={1}&UserId={2})
            # В документации указан UserId с большой буквы, но в примере используется userid
            # Используем userid для совместимости
            step1 = f"hash={self.hash_key}&lng={lng}&userid={user_id}"
            step1_hash = hashlib.sha256(step1.encode()).hexdigest()
            
            # MD5(code={0}&cashierpass={1}&cashdeskid={2})
            step2 = f"code={code}&cashierpass={self.cashierpass}&cashdeskid={self.cashdesk_id}"
            step2_hash = hashlib.md5(step2.encode()).hexdigest()
            
            # SHA256(step1 + step2)
            final_string = step1_hash + step2_hash
            signature = hashlib.sha256(final_string.encode()).hexdigest()
        
        return signature
    
    def generate_confirm(self, user_id, method_hash):
        """Генерировать confirm для запроса"""
        return hashlib.md5(f"{user_id}:{method_hash}".encode()).hexdigest()
    
    def generate_confirm_deposit(self, user_id):
        """Генерировать confirm для пополнения"""
        # Для пополнения: confirm = MD5(userId:hash)
        return hashlib.md5(f"{user_id}:{self.hash_key}".encode()).hexdigest()
    
    def generate_confirm_payout(self, user_id):
        """Генерировать confirm для выплаты"""
        # Для выплаты: confirm = MD5(userId:hash)
        return hashlib.md5(f"{user_id}:{self.hash_key}".encode()).hexdigest()
    
    def check_balance(self):
        """Проверить баланс кассы"""
        try:
            dt = self.get_timestamp()
            signature = self.generate_signature("balance")
            
            # Для баланса confirm = MD5(cashdeskId:hash)
            confirm = hashlib.md5(f"{self.cashdesk_id}:{self.hash_key}".encode()).hexdigest()
            
            url = f"{self.base_url}/Cashdesk/{self.cashdesk_id}/Balance?confirm={confirm}&dt={dt}"
            headers = {
                'Authorization': self.auth_header,
                'sign': signature
            }
            
            print(f"🔗 URL: {url}")
            print(f"⏰ Время: {dt}")
            print(f"🔐 Подпись: {signature[:20]}...")
            
            response = requests.get(url, headers=headers, timeout=30)
            print(f"📊 Статус: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ УСПЕХ! Баланс кассы:")
                print(f"   💰 Баланс: {data.get('Balance', 'N/A')}")
                print(f"   📊 Лимит: {data.get('Limit', 'N/A')}")
                return True
            else:
                print(f"❌ ОШИБКА! {response.status_code}")
                print(f"   📝 Ответ: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ ОШИБКА: {e}")
            return False
    
    def search_player(self, user_id):
        """Найти игрока"""
        try:
            signature = self.generate_signature("search", user_id)
            confirm = self.generate_confirm(user_id, self.hash_key)
            
            url = f"{self.base_url}/Users/{user_id}?confirm={confirm}&cashdeskId={self.cashdesk_id}"
            headers = {
                'Authorization': self.auth_header,
                'sign': signature
            }
            
            print(f"🔗 URL: {url}")
            print(f"🔐 Подпись: {signature[:20]}...")
            
            response = requests.get(url, headers=headers, timeout=30)
            print(f"📊 Статус: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ УСПЕХ! Игрок найден:")
                print(f"   🆔 ID: {data.get('userId', 'N/A')}")
                print(f"   👤 Имя: {data.get('name', 'N/A')}")
                print(f"   💱 Валюта: {data.get('currencyId', 'N/A')}")
                return True
            else:
                print(f"❌ ОШИБКА! {response.status_code}")
                print(f"   📝 Ответ: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ ОШИБКА: {e}")
            return False
    
    def deposit_player(self, user_id, summa):
        """Пополнить счет игрока"""
        try:
            signature = self.generate_signature("deposit", user_id, summa)
            confirm = self.generate_confirm_deposit(user_id)
            
            url = f"{self.base_url}/Deposit/{user_id}/Add"
            headers = {
                'Authorization': self.auth_header,
                'sign': signature,
                'Content-Type': 'application/json'
            }
            
            request_body = {
                "cashdeskId": self.cashdesk_id,
                "lng": "ru",
                "summa": float(summa),
                "confirm": confirm
            }
            
            print(f"🔗 URL: {url}")
            print(f"📝 Запрос: {json.dumps(request_body, separators=(',', ':'))}")
            print(f"🔐 Подпись: {signature[:20]}...")
            print(f"🔍 DEBUG - Confirm: {confirm}")
            print(f"🔍 DEBUG - User ID: {user_id}")
            print(f"🔍 DEBUG - Hash Key: {self.hash_key[:20]}...")
            
            response = requests.post(url, headers=headers, json=request_body, timeout=30)
            print(f"📊 Статус: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"\n📦 ПОЛНЫЙ ОТВЕТ ОТ API:")
                print(f"   {json.dumps(data, indent=2, ensure_ascii=False)}")
                print(f"\n✅ УСПЕХ! Пополнение выполнено:")
                print(f"   💰 Сумма: {data.get('summa', 'N/A')}")
                print(f"   ✅ Успех: {data.get('success', 'N/A')}")
                print(f"   📝 Сообщение: {data.get('message', 'N/A')}")
                if data.get('messageId'):
                    print(f"   🔢 Код ошибки: {data.get('messageId')}")
                return True
            else:
                print(f"❌ ОШИБКА! {response.status_code}")
                print(f"   📝 Полный ответ: {response.text}")
                return False
           
        except Exception as e:
            print(f"❌ ОШИБКА: {e}")
            return False
    
    def payout_player(self, user_id, code):
        """Выплата со счета игрока"""
        try:
            signature = self.generate_signature("payout", user_id, code=code)
            confirm = self.generate_confirm_payout(user_id)
            
            url = f"{self.base_url}/Deposit/{user_id}/Payout"
            headers = {
                'Authorization': self.auth_header,
                'sign': signature,
                'Content-Type': 'application/json'
            }
            
            request_body = {
                "cashdeskId": self.cashdesk_id,
                "lng": "ru",
                "code": code,
                "confirm": confirm
            }
            
            print(f"🔗 URL: {url}")
            print(f"📝 Запрос: {json.dumps(request_body, separators=(',', ':'))}")
            print(f"🔐 Подпись: {signature[:20]}...")
            print(f"🔍 DEBUG - Confirm: {confirm}")
            print(f"🔍 DEBUG - User ID: {user_id}")
            print(f"🔍 DEBUG - Code: {code}")
            
            response = requests.post(url, headers=headers, json=request_body, timeout=30)
            print(f"📊 Статус: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"\n📦 ПОЛНЫЙ ОТВЕТ ОТ API:")
                print(f"   {json.dumps(data, indent=2, ensure_ascii=False)}")
                print(f"\n✅ УСПЕХ! Выплата выполнена:")
                print(f"   💰 Сумма вывода: {data.get('summa', 'N/A')}")
                print(f"   ✅ Успех: {data.get('success', 'N/A')}")
                print(f"   📝 Сообщение: {data.get('message', 'N/A')}")
                if data.get('messageId'):
                    print(f"   🔢 Код ошибки: {data.get('messageId')}")
                return True
            else:
                print(f"❌ ОШИБКА! {response.status_code}")
                print(f"   📝 Полный ответ: {response.text}")
                return False
           
        except Exception as e:
            print(f"❌ ОШИБКА: {e}")
            return False

def main():
    print("🎰 WINWIN MOBCASH - УПРАВЛЕНИЕ КАССОЙ")
    print("=" * 50)
    
    # Создаем экземпляр класса
    winwin = WinWinDeposit()
    
    while True:
        try:
            print(f"\n📋 Выберите действие:")
            print(f"1. 💰 Проверить баланс кассы")
            print(f"2. 🔍 Найти игрока")
            print(f"3. 💸 Пополнить счет игрока")
            print(f"4. 💵 Выплата со счета игрока")
            print(f"5. 🚪 Выход")
            
            choice = input("\n🎯 Ваш выбор (1-5): ").strip()
            
            if choice == "1":
                print(f"\n🔄 Проверяем баланс кассы...")
                winwin.check_balance()
                
            elif choice == "2":
                user_id = input("🆔 ID игрока для поиска: ").strip()
                if user_id:
                    print(f"\n🔄 Ищем игрока...")
                    winwin.search_player(user_id)
                else:
                    print("❌ ID игрока не может быть пустым!")
                    
            elif choice == "3":
                user_id = input("🆔 ID игрока: ").strip()
                if not user_id:
                    print("❌ ID игрока не может быть пустым!")
                    continue
                
                summa_str = input("💰 Сумма пополнения: ").strip()
                if not summa_str:
                    print("❌ Сумма не может быть пустой!")
                    continue
                
                try:
                    summa = float(summa_str)
                    if summa <= 0:
                        print("❌ Сумма должна быть больше 0!")
                        continue
                except ValueError:
                    print("❌ Неверный формат суммы!")
                    continue
                
                print(f"\n🔄 Выполняем пополнение...")
                print(f"   👤 Игрок: {user_id}")
                print(f"   💰 Сумма: {summa}")
                
                success = winwin.deposit_player(user_id, summa)
                
                if success:
                    print(f"\n🎉 Пополнение успешно выполнено!")
                else:
                    print(f"\n💥 Пополнение не удалось!")
                    
            elif choice == "4":
                user_id = input("🆔 ID игрока: ").strip()
                if not user_id:
                    print("❌ ID игрока не может быть пустым!")
                    continue
                
                code = input("🔐 Код подтверждения: ").strip()
                if not code:
                    print("❌ Код подтверждения не может быть пустым!")
                    continue
                
                print(f"\n🔄 Выполняем выплату...")
                print(f"   👤 Игрок: {user_id}")
                print(f"   🔐 Код: {code}")
                
                success = winwin.payout_player(user_id, code)
                
                if success:
                    print(f"\n🎉 Выплата успешно выполнена!")
                else:
                    print(f"\n💥 Выплата не удалась!")
                    
            elif choice == "5":
                print(f"\n👋 До свидания!")
                break
            else:
                print(f"❌ Неверный выбор! Попробуйте снова.")
                
        except KeyboardInterrupt:
            print(f"\n\n👋 До свидания!")
            break
        except Exception as e:
            print(f"\n❌ Неожиданная ошибка: {e}")
            continue
    
    print(f"\n🎯 Спасибо за использование WinWin mobcash API!")

if __name__ == "__main__":
    main()

