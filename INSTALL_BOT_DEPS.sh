#!/bin/bash

# Скрипт для установки зависимостей для бота

echo "🔍 Проверяем requirements.txt..."
cat /var/www/luxon/bot_simple/requirements.txt

echo ""
echo "📦 Устанавливаем зависимости в виртуальное окружение..."
cd /var/www/luxon

# Вариант 1: Если используется venv из django_admin
source /var/www/luxon/django_admin/venv/bin/activate
pip install -r /var/www/luxon/bot_simple/requirements.txt

# Или если нужно установить в отдельное venv для bot_simple
# cd /var/www/luxon/bot_simple
# python3 -m venv venv
# source venv/bin/activate
# pip install -r requirements.txt

echo ""
echo "✅ Зависимости установлены!"
echo ""
echo "🔍 Проверяем установку модуля telegram..."
python3 -c "import telegram; print('✅ Модуль telegram установлен:', telegram.__version__)" || echo "❌ Модуль telegram не найден"

echo ""
echo "🔄 Перезапускаем бота..."
pm2 restart luxon-bot

echo ""
echo "📊 Проверяем статус..."
pm2 status luxon-bot

echo ""
echo "📝 Проверяем логи (последние 20 строк)..."
pm2 logs luxon-bot --lines 20 --nostream

