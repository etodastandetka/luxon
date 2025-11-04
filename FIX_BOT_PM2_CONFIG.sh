#!/bin/bash

# Скрипт для правильной настройки PM2 для бота с корректным Python окружением

echo "🔍 Проверяем текущую конфигурацию PM2..."
pm2 show luxon-bot | grep -E "script path|exec cwd" || echo "Процесс не найден"

echo ""
echo "📦 Проверяем установку модуля telegram в venv..."
source /var/www/luxon/django_admin/venv/bin/activate
python3 -c "from telegram import Update; print('✅ Модуль telegram установлен в venv')" || {
    echo "❌ Модуль telegram НЕ установлен в venv"
    echo "📥 Устанавливаем..."
    pip install python-telegram-bot==20.7
    python3 -c "from telegram import Update; print('✅ Модуль telegram установлен!')" || {
        echo "❌ Ошибка установки"
        exit 1
    }
}

echo ""
echo "🛑 Останавливаем и удаляем старый процесс..."
pm2 delete luxon-bot 2>/dev/null || true
sleep 2

echo ""
echo "🚀 Запускаем бота с правильным Python из venv..."
cd /var/www/luxon/bot_simple

# Вариант 1: Используем полный путь к Python из venv
pm2 start /var/www/luxon/django_admin/venv/bin/python3 \
  --name "luxon-bot" \
  -- bot.py \
  --cwd /var/www/luxon/bot_simple \
  --interpreter none

echo ""
echo "💾 Сохраняем конфигурацию..."
pm2 save

echo ""
echo "⏳ Ждем 3 секунды..."
sleep 3

echo ""
echo "📊 Проверяем статус..."
pm2 status luxon-bot

echo ""
echo "📝 Проверяем логи (последние 15 строк)..."
pm2 logs luxon-bot --lines 15 --nostream

echo ""
echo "✅ Готово!"
echo ""
echo "Если ошибок нет - бот запущен успешно."
echo "Если ошибка все еще есть, проверьте:"
echo "  1. pm2 show luxon-bot - проверьте 'script path'"
echo "  2. python3 -c 'from telegram import Update' - проверьте импорт в venv"
echo "  3. pm2 logs luxon-bot - проверьте логи"

