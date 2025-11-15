#!/bin/bash
# Скрипт для установки зависимостей бота на сервере

echo "🔧 Установка зависимостей для bot_1xbet..."

# Переходим в директорию бота
cd /var/www/luxon/bot_1xbet || exit 1

# Проверяем наличие Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не найден!"
    exit 1
fi

# Проверяем наличие pip
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 не найден! Устанавливаем pip..."
    python3 -m ensurepip --upgrade
fi

# Устанавливаем зависимости из requirements.txt
echo "📦 Устанавливаем зависимости из requirements.txt..."
pip3 install -r requirements.txt

# Проверяем установку httpx
echo "✅ Проверяем установку httpx..."
python3 -c "import httpx; print('✅ httpx установлен успешно')" || {
    echo "❌ Ошибка: httpx не установлен!"
    exit 1
}

# Проверяем установку python-telegram-bot
echo "✅ Проверяем установку python-telegram-bot..."
python3 -c "import telegram; print('✅ python-telegram-bot установлен успешно')" || {
    echo "❌ Ошибка: python-telegram-bot не установлен!"
    exit 1
}

echo "✅ Все зависимости установлены успешно!"









