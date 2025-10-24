#!/bin/bash

echo "🔧 ИСПРАВЛЕНИЕ ОШИБКИ NEXT.JS НА СЕРВЕРЕ"
echo "========================================"

# 1. Перейти в папку проекта
cd /var/www/luxon

# 2. Обновить код
echo "📥 Обновление кода..."
git pull origin main

# 3. Перейти в папку Next.js
cd bot2/mini_app_site

# 4. Очистить кэш Next.js
echo "🧹 Очистка кэша..."
rm -rf .next
rm -rf node_modules/.cache

# 5. Переустановить зависимости
echo "📦 Переустановка зависимостей..."
npm install

# 6. Собрать проект
echo "🔨 Сборка проекта..."
npm run build

# 7. Остановить старые процессы
echo "⏹️ Остановка старых процессов..."
pm2 stop luxon-nextjs 2>/dev/null || true
pm2 stop luxon-nextjs-client 2>/dev/null || true
pm2 delete luxon-nextjs 2>/dev/null || true
pm2 delete luxon-nextjs-client 2>/dev/null || true

# 8. Запустить новый процесс
echo "🚀 Запуск нового процесса..."
pm2 start npm --name "luxon-nextjs" --cwd /var/www/luxon/bot2/mini_app_site -- start

# 9. Проверить статус
echo "📊 Проверка статуса..."
pm2 status

# 10. Показать логи
echo "📋 Последние логи:"
pm2 logs luxon-nextjs --lines 10

echo "✅ Готово!"
