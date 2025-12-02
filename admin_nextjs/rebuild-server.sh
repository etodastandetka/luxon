#!/bin/bash
# Скрипт для полной пересборки проекта на сервере
# Использование: ./rebuild-server.sh

set -e  # Остановить при ошибке

echo "🔄 Начинаю полную пересборку проекта..."

# Перейти в директорию проекта
cd /var/www/luxon/admin_nextjs

echo "📥 Получаю последние изменения из git..."
git pull origin main

echo "🧹 Очищаю все кеши..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf tsconfig.tsbuildinfo
rm -rf .swc
rm -rf .turbo

echo "🔨 Пересобираю проект..."
npm run build

echo "🔄 Перезапускаю PM2 процесс..."
pm2 restart luxon-admin

echo "✅ Готово! Проект пересобран и перезапущен."

