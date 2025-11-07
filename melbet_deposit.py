#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Простой скрипт для работы с Melbet Cash API
Просто вводите ID игрока и сумму - все остальное автоматически!
"""

import hashlib
import json
import requests
from datetime import datetime, timezone

class MelbetDeposit:
    def __init__(self):
        # Данные для Melbet API (Team cash - обновлено 05.11.2025)
        self.hash_key = "5c6459e67bde6c8ace972e2a4d7e1f83d05e2b68c0741474b0fa57e46a19bda1"
        self.cashierpass = "ScgOQgUzZs"
        self.login = "bakhtark"
        self.cashdesk_id = "1350588"
        self.base_url = "https://partners.servcul.com/CashdeskBotAPI"
        
        # Альтернативные варианты (закомментированы):
        # Вариант 1: Новый login + новый cashierpass
        # self.login = "1180846111"
        # self.cashierpass = "Eldiyar.07"
        
        # Вариант 2: Новый login + старый cashierpass
        # self.login = "1180846111"
        # self.cashierpass = "ScgOQgUzZs"
        
        # Вариант 3: Старый login + новый cashierpass
        # self.login = "bakhtark"
        # self.cashierpass = "Eldiyar.07"
    
    def get_timestamp(self):
        """Получить текущее время в UTC формате"""
        now = datetime.now(timezone.utc)
        return now.strftime("%Y.%m.%d %H:%M:%S")
    
    def generate_signature(self, method, user_id=None, summa=None, code=None):
        """Генерировать подпись для Melbet API"""
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
            # Для пополнения: SHA256(hash={0}&lng={1}&userid={2}) - userid с маленькой буквы!
            step1 = f"hash={self.hash_key}&lng={lng}&userid={user_id}"
            step1_hash = hashlib.sha256(step1.encode()).hexdigest()
            
            # MD5(summa={0}&cashierpass={1}&cashdeskid={2})
            step2 = f"summa={summa}&cashierpass={self.cashierpass}&cashdeskid={self.cashdesk_id}"
            step2_hash = hashlib.md5(step2.encode()).hexdigest()
            
            # SHA256(step1 + step2)
            final_string = step1_hash + step2_hash
            signature = hashlib.sha256(final_string.encode()).hexdigest()
            
        elif method == "payout":
            # Для выплаты: SHA256(hash={0}&lng={1}&userid={2}) - userid с маленькой буквы!
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
        """Генерировать confirm для пополнения (особый случай)"""
        # Для пополнения: confirm = MD5(userId:hash)
        return hashlib.md5(f"{user_id}:{self.hash_key}".encode()).hexdigest()
    
    def generate_confirm_payout(self, user_id):
        """Генерировать confirm для выплаты (особый случай)"""
        # Для выплаты: confirm = MD5(userId:hash)
        return hashlib.md5(f"{user_id}:{self.hash_key}".encode()).hexdigest()
    
    def get_balance(self):
        """Получить баланс кассы"""
        print("💰 Получение баланса кассы...")
        
        dt = self.get_timestamp()
        signature = self.generate_signature("balance")
        confirm = self.generate_confirm(self.cashdesk_id, self.hash_key)
        
        url = f"{self.base_url}/Cashdesk/{self.cashdesk_id}/Balance?confirm={confirm}&dt={dt}"
        
        # Пробуем с Basic Auth (как в melbet_client.py)
        import base64
        auth_string = f"{self.login}:{self.cashierpass}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        auth_header = f"Basic {auth_b64}"
        
        headers = {
            'sign': signature,
            'Authorization': auth_header
        }
        
        print(f"🔑 Используемые данные:")
        print(f"   Login: {self.login}")
        print(f"   Cashdesk ID: {self.cashdesk_id}")
        print(f"   Hash: {self.hash_key[:20]}...")
        print(f"   URL: {url}")
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            print(f"📡 Статус ответа: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                balance = data.get('Balance', 0)
                limit = data.get('Limit', 0)
                print(f"✅ Баланс кассы: {balance} KGS")
                print(f"📊 Лимит кассы: {limit} KGS")
                return True
            else:
                print(f"❌ Ошибка: {response.status_code}")
                print(f"📄 Ответ: {response.text}")
                return False
                
        except Exception as e:
            print(f"💥 Ошибка запроса: {e}")
            return False
    
    def search_user(self, user_id):
        """Найти игрока по ID"""
        print(f"🔍 Поиск игрока {user_id}...")
        
        signature = self.generate_signature("search", user_id=user_id)
        confirm = self.generate_confirm(user_id, self.hash_key)
        
        url = f"{self.base_url}/Users/{user_id}?confirm={confirm}&cashdeskId={self.cashdesk_id}"
        headers = {'sign': signature}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            print(f"📡 Статус ответа: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                user_name = data.get('name', 'Неизвестно')
                currency_id = data.get('currencyId', 0)
                user_id_result = data.get('userId', 0)
                
                if user_id_result > 0:
                    print(f"✅ Игрок найден: {user_name}")
                    print(f"💱 Валюта: {currency_id}")
                    return True
                else:
                    print(f"⚠️ Игрок не найден в системе")
                    return False
            else:
                print(f"❌ Ошибка: {response.status_code}")
                print(f"📄 Ответ: {response.text}")
                return False
                
        except Exception as e:
            print(f"💥 Ошибка запроса: {e}")
            return False
    
    def deposit_user(self, user_id, summa):
        """Пополнить счет игрока"""
        print(f"💳 Пополнение счета игрока {user_id} на {summa} KGS...")
        
        signature = self.generate_signature("deposit", user_id=user_id, summa=summa)
        confirm = self.generate_confirm_deposit(user_id)
        
        url = f"{self.base_url}/Deposit/{user_id}/Add"
        headers = {
            'sign': signature,
            'Content-Type': 'application/json'
        }
        
        data = {
            "cashdeskId": int(self.cashdesk_id),
            "lng": "ru",
            "summa": summa,
            "confirm": confirm
        }
        
        try:
            response = requests.post(url, json=data, headers=headers, timeout=30)
            print(f"📡 Статус ответа: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                success = result.get('Success', False)
                message = result.get('Message', '')
                summa_result = result.get('Summa', 0)
                message_id = result.get('MessageId', 0)
                
                if success:
                    print(f"✅ Пополнение успешно!")
                    print(f"💰 Сумма операции: {summa_result} KGS")
                else:
                    print(f"❌ Ошибка пополнения: {message}")
                    print(f"🔢 Код ошибки: {message_id}")
                return success
            else:
                print(f"❌ HTTP ошибка: {response.status_code}")
                print(f"📄 Ответ: {response.text}")
                return False
                
        except Exception as e:
            print(f"💥 Ошибка запроса: {e}")
            return False
    
    def payout_user(self, user_id, code):
        """Выплатить игроку"""
        print(f"💸 Выплата игроку {user_id} с кодом {code}...")
        
        signature = self.generate_signature("payout", user_id=user_id, code=code)
        confirm = self.generate_confirm_payout(user_id)
        
        url = f"{self.base_url}/Deposit/{user_id}/Payout"
        headers = {
            'sign': signature,
            'Content-Type': 'application/json'
        }
        
        data = {
            "cashdeskId": int(self.cashdesk_id),
            "lng": "ru",
            "code": code,
            "confirm": confirm
        }
        
        try:
            response = requests.post(url, json=data, headers=headers, timeout=30)
            print(f"📡 Статус ответа: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                success = result.get('Success', False)
                message = result.get('Message', '')
                summa_result = result.get('Summa', 0)
                message_id = result.get('MessageId', 0)
                
                if success:
                    print(f"✅ Выплата успешна!")
                    print(f"💰 Сумма операции: {summa_result} KGS")
                else:
                    print(f"❌ Ошибка выплаты: {message}")
                    print(f"🔢 Код ошибки: {message_id}")
                return success
            else:
                print(f"❌ HTTP ошибка: {response.status_code}")
                print(f"📄 Ответ: {response.text}")
                return False
                
        except Exception as e:
            print(f"💥 Ошибка запроса: {e}")
            return False
    
    def show_menu(self):
        """Показать главное меню"""
        print("\n" + "="*60)
        print("🎯 MELBET CASH API - УПРАВЛЕНИЕ КАССОЙ")
        print("="*60)
        print("1. 💰 Получить баланс кассы")
        print("2. 🔍 Найти игрока по ID")
        print("3. 💳 Пополнить счет игрока")
        print("4. 💸 Выплатить игроку")
        print("0. 🚪 Выход")
        print("="*60)
    
    def run(self):
        """Основной цикл программы"""
        print("🎯 ДОБРО ПОЖАЛОВАТЬ В MELBET CASH API!")
        print(f"🏪 Касса: {self.cashdesk_id}")
        print(f"👤 Логин: {self.login}")
        
        while True:
            self.show_menu()
            
            try:
                choice = input("\nВыберите действие (0-4): ").strip()
                
                if choice == "0":
                    print("👋 До свидания!")
                    break
                    
                elif choice == "1":
                    self.get_balance()
                    
                elif choice == "2":
                    user_id = input("🔍 Введите ID игрока: ").strip()
                    if user_id:
                        self.search_user(user_id)
                    else:
                        print("❌ ID игрока не введен")
                        
                elif choice == "3":
                    user_id = input("💳 Введите ID игрока: ").strip()
                    if not user_id:
                        print("❌ ID игрока не введен")
                        continue
                        
                    try:
                        summa = float(input("💰 Введите сумму пополнения: ").strip())
                        if summa <= 0:
                            print("❌ Сумма должна быть больше 0")
                            continue
                        self.deposit_user(user_id, summa)
                    except ValueError:
                        print("❌ Неверный формат суммы")
                        
                elif choice == "4":
                    user_id = input("💸 Введите ID игрока: ").strip()
                    if not user_id:
                        print("❌ ID игрока не введен")
                        continue
                        
                    code = input("🔐 Введите код подтверждения: ").strip()
                    if not code:
                        print("❌ Код подтверждения не введен")
                        continue
                        
                    self.payout_user(user_id, code)
                    
                else:
                    print("❌ Неверный выбор. Попробуйте снова.")
                    
            except KeyboardInterrupt:
                print("\n\n👋 Программа прервана пользователем. До свидания!")
                break
            except Exception as e:
                print(f"💥 Неожиданная ошибка: {e}")
            
            input("\nНажмите Enter для продолжения...")

def main():
    """Главная функция"""
    try:
        melbet = MelbetDeposit()
        melbet.run()
    except Exception as e:
        print(f"💥 Критическая ошибка: {e}")

if __name__ == "__main__":
    main()


