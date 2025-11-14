#!/bin/bash
# Скрипт установки зависимостей для bot_simple

echo "🚀 Установка зависимостей для bot_simple..."

# Проверяем наличие Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не найден. Установите Python3."
    exit 1
fi

# Проверяем наличие pip
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 не найден. Установите pip3."
    exit 1
fi

# Устанавливаем зависимости
echo "📦 Установка зависимостей из requirements.txt..."
pip3 install -r requirements.txt

echo "✅ Зависимости установлены!"
echo ""
echo "Для запуска бота используйте:"
echo "  python3 bot.py"
echo ""
echo "Или через PM2:"
echo "  pm2 start ecosystem.config.js"

