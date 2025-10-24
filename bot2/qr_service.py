#!/usr/bin/env python3
"""
Сервис для генерации QR-ссылок согласно ТЗ
Интеграция с qr_utils.py для C2C платежей
"""
import os
import sys
from typing import Dict, Optional, Tuple
from decimal import Decimal

# Добавляем путь к модулям
sys.path.append(os.path.dirname(__file__))

try:
    from qr_utils import (
        build_qr_and_url, 
        get_bank_links_by_type,
        build_payment_links,
        get_active_requisite_from_db,
        update_amount_in_qr_hash_proper
    )
    from config import BANKS
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure qr_utils.py and config.py are in the same directory")
    sys.exit(1)

class QRService:
    """Сервис для генерации QR-ссылок для C2C платежей"""
    
    def __init__(self):
        self.banks = BANKS
    
    def generate_payment_url(self, bank_key: str, amount: float, player_id: str = None) -> Dict[str, str]:
        """
        Генерирует URL для оплаты через выбранный банк
        
        Args:
            bank_key: Ключ банка из конфигурации
            amount: Сумма платежа
            player_id: ID игрока (для логирования)
            
        Returns:
            Dict с hash и url для оплаты
        """
        if bank_key not in self.banks:
            raise ValueError(f"Банк {bank_key} не поддерживается")
        
        bank_config = self.banks[bank_key]
        bank_code = bank_config['bank_code']
        qr_generator = bank_config.get('qr_generator', 'generic')
        
        try:
            if qr_generator == 'demirbank':
                # Для DemirBank используем специальную генерацию
                qr, links = build_payment_links(amount)
                return {
                    'hash': qr,
                    'url': links.get('DemirBank', ''),
                    'bank_name': bank_config['name']
                }
            
            elif qr_generator in ['bakai', 'mbank', 'optima']:
                # Для этих банков нужен base_hash из админки
                base_hash = self._get_base_hash_for_bank(bank_code)
                if not base_hash:
                    raise ValueError(f"Base hash для {bank_config['name']} не настроен в админке")
                
                result = build_qr_and_url(
                    bank_code=bank_code,
                    amount=amount,
                    base_hash=base_hash,
                    static_qr=True
                )
                result['bank_name'] = bank_config['name']
                return result
            
            else:
                # Для остальных банков используем generic генерацию
                return self._generate_generic_qr(bank_key, amount)
                
        except Exception as e:
            print(f"Ошибка генерации QR для {bank_config['name']}: {e}")
            # Fallback - возвращаем простую ссылку
            return self._generate_fallback_url(bank_key, amount)
    
    def _get_base_hash_for_bank(self, bank_code: str) -> Optional[str]:
        """Получает base_hash для банка из базы данных"""
        try:
            # Здесь можно добавить запрос к БД для получения base_hash
            # Пока возвращаем None для демонстрации
            return None
        except Exception:
            return None
    
    def _generate_generic_qr(self, bank_key: str, amount: float) -> Dict[str, str]:
        """Генерирует generic QR для банков без специальной поддержки"""
        bank_config = self.banks[bank_key]
        
        # Простая генерация хэша на основе суммы и времени
        import hashlib
        import time
        
        data = f"{amount}_{int(time.time())}_{bank_key}"
        qr_hash = hashlib.sha256(data.encode()).hexdigest()[:32]
        
        url = bank_config['url_template'].format(qr_hash=qr_hash)
        
        return {
            'hash': qr_hash,
            'url': url,
            'bank_name': bank_config['name']
        }
    
    def _generate_fallback_url(self, bank_key: str, amount: float) -> Dict[str, str]:
        """Fallback генерация URL если основная не работает"""
        bank_config = self.banks[bank_key]
        
        # Простейшая генерация
        qr_hash = f"fallback_{amount}_{bank_key}"
        url = bank_config['url_template'].format(qr_hash=qr_hash)
        
        return {
            'hash': qr_hash,
            'url': url,
            'bank_name': bank_config['name']
        }
    
    def get_available_banks(self) -> Dict[str, Dict]:
        """Возвращает список доступных банков"""
        return {k: v for k, v in self.banks.items() if v['enabled']}
    
    def validate_amount(self, amount: float) -> bool:
        """Проверяет корректность суммы"""
        try:
            amount_decimal = Decimal(str(amount))
            return 0 < amount_decimal <= 1000000  # Максимум 1,000,000 сом
        except:
            return False
    
    def format_amount(self, amount: float) -> str:
        """Форматирует сумму для отображения"""
        return f"{amount:,.2f} сом"

# Глобальный экземпляр сервиса
qr_service = QRService()

def generate_payment_url(bank_key: str, amount: float, player_id: str = None) -> Dict[str, str]:
    """Удобная функция для генерации URL оплаты"""
    return qr_service.generate_payment_url(bank_key, amount, player_id)

def get_available_banks() -> Dict[str, Dict]:
    """Удобная функция для получения списка банков"""
    return qr_service.get_available_banks()

if __name__ == "__main__":
    # Тестирование сервиса
    print("🧪 Тестирование QR Service...")
    
    # Тестируем генерацию для разных банков
    test_amount = 1000.50
    test_banks = ['demirbank', 'bakai', 'megapay', 'optima']
    
    for bank_key in test_banks:
        try:
            result = generate_payment_url(bank_key, test_amount, "test_player")
            print(f"✅ {result['bank_name']}: {result['url'][:50]}...")
        except Exception as e:
            print(f"❌ {bank_key}: {e}")
    
    print("\n📋 Доступные банки:")
    banks = get_available_banks()
    for key, bank in banks.items():
        print(f"  {bank['emoji']} {bank['name']} ({key})")

