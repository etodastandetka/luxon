#!/bin/bash

# Скрипт для установки зависимостей бота и исправления ошибки

echo "🔍 Проверяем текущую ошибку..."
pm2 logs luxon-bot --lines 5 --nostream | grep -i "ModuleNotFoundError" || echo "Ошибка не найдена в последних логах"

echo ""
echo "📦 Активируем виртуальное окружение и устанавливаем зависимости..."
cd /var/www/luxon

# Активируем venv из django_admin (так как бот использует этот Python)
source /var/www/luxon/django_admin/venv/bin/activate

echo "📍 Текущий Python: $(which python3)"
echo "📍 Python версия: $(python3 --version)"

echo ""
echo "📥 Устанавливаем python-telegram-bot..."
pip install python-telegram-bot==20.7

echo ""
echo "✅ Проверяем установку модуля..."
python3 -c "from telegram import Update; print('✅ Модуль telegram успешно установлен!')" || {
    echo "❌ Ошибка установки модуля"
    exit 1
}

echo ""
echo "🔄 Перезапускаем бота..."
pm2 restart luxon-bot

echo ""
echo "⏳ Ждем 3 секунды..."
sleep 3

echo ""
echo "📊 Проверяем статус..."
pm2 status luxon-bot

echo ""
echo "📝 Проверяем логи (последние 10 строк)..."
pm2 logs luxon-bot --lines 10 --nostream

echo ""
echo "✅ Готово! Если ошибок нет, бот запущен успешно."

