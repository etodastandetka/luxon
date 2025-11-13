#!/usr/bin/env python3
"""
Скрипт для обновления токена бота в .env файле
"""
import sys
import os

def update_token(new_token):
    """Обновляет токен в .env файле"""
    env_file = '.env'
    
    if not os.path.exists(env_file):
        print(f"❌ Файл {env_file} не найден!")
        return False
    
    # Читаем файл
    with open(env_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Обновляем токен
    updated = False
    new_lines = []
    for line in lines:
        if line.startswith('TELEGRAM_BOT_TOKEN='):
            new_lines.append(f'TELEGRAM_BOT_TOKEN={new_token}\n')
            updated = True
        else:
            new_lines.append(line)
    
    if not updated:
        # Если строка не найдена, добавляем в начало
        new_lines.insert(0, f'TELEGRAM_BOT_TOKEN={new_token}\n')
    
    # Записываем обратно
    with open(env_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print(f"✅ Токен обновлен в {env_file}")
    return True

def test_token(token):
    """Тестирует токен через Telegram API"""
    import httpx
    
    try:
        response = httpx.get(
            f'https://api.telegram.org/bot{token}/getMe',
            timeout=5.0
        )
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                bot_info = data.get('result', {})
                print(f"✅ Токен валидный!")
                print(f"   Имя бота: {bot_info.get('first_name', 'N/A')}")
                print(f"   Username: @{bot_info.get('username', 'N/A')}")
                return True
            else:
                print(f"❌ Токен невалидный: {data.get('description', 'Unknown error')}")
                return False
        else:
            print(f"❌ Ошибка API: {response.status_code}")
            print(f"   Ответ: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ Ошибка при проверке токена: {e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Использование: python update_token.py <НОВЫЙ_ТОКЕН>")
        print("\nПример:")
        print("  python update_token.py 123456789:ABCdefGHIjklMNOpqrsTUVwxyz")
        sys.exit(1)
    
    new_token = sys.argv[1].strip()
    
    # Проверяем формат токена
    if ':' not in new_token:
        print("❌ Неверный формат токена! Токен должен содержать ':'")
        print("   Формат: <BOT_ID>:<TOKEN>")
        sys.exit(1)
    
    # Тестируем токен
    print("🔍 Проверяю токен...")
    if test_token(new_token):
        # Обновляем в файле
        print("\n📝 Обновляю файл .env...")
        if update_token(new_token):
            print("\n✅ Готово! Теперь можно запустить бота: python bot.py")
        else:
            print("\n❌ Не удалось обновить файл .env")
    else:
        print("\n❌ Токен невалидный. Проверьте токен у @BotFather")
        sys.exit(1)







