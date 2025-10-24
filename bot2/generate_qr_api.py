#!/usr/bin/env python3
"""
API для генерации QR-ссылок
Используется Next.js API для вызова Python QR Service
"""
import sys
import json
import os

# Добавляем путь к модулям
sys.path.append(os.path.dirname(__file__))

try:
    from qr_service import generate_payment_url
except ImportError as e:
    print(json.dumps({"error": f"Import error: {e}"}))
    sys.exit(1)

def main():
    """Главная функция для API"""
    if len(sys.argv) != 4:
        print(json.dumps({"error": "Usage: python generate_qr_api.py <bank_key> <amount> <player_id>"}))
        sys.exit(1)
    
    bank_key = sys.argv[1]
    amount = float(sys.argv[2])
    player_id = sys.argv[3]
    
    try:
        result = generate_payment_url(bank_key, amount, player_id)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()

