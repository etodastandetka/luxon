#!/bin/bash

# Скрипт для исправления дубликатов процессов luxon-bot в PM2

echo "🔍 Проверяем текущие процессы luxon-bot..."
pm2 list | grep luxon-bot

echo ""
echo "🛑 Останавливаем и удаляем все процессы luxon-bot..."
pm2 delete luxon-bot 2>/dev/null || true

echo ""
echo "⏳ Небольшая пауза..."
sleep 2

echo ""
echo "✅ Проверяем, что все процессы удалены..."
pm2 list | grep luxon-bot || echo "✅ Все процессы luxon-bot удалены"

echo ""
echo "🚀 Запускаем один процесс luxon-bot правильно..."
cd /var/www/luxon/bot_simple
pm2 start python3 --name "luxon-bot" -- bot.py --cwd /var/www/luxon/bot_simple

echo ""
echo "💾 Сохраняем конфигурацию PM2..."
pm2 save

echo ""
echo "📊 Проверяем статус..."
pm2 list | grep luxon-bot

echo ""
echo "✅ Готово! Процесс luxon-bot запущен."
echo ""
echo "📝 Для просмотра логов используйте:"
echo "   pm2 logs luxon-bot"
echo ""
echo "📝 Для просмотра информации о процессе:"
echo "   pm2 show luxon-bot"

