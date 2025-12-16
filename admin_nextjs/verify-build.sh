#!/bin/bash
# Скрипт для проверки сборки проекта

set -e

echo "🔨 Проверяю сборку проекта..."
echo ""

# Очищаем кеш
echo "🧹 Очищаю кеш..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf tsconfig.tsbuildinfo
rm -rf .swc
echo "✅ Кеш очищен"
echo ""

# Запускаем сборку
echo "📦 Запускаю сборку..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Сборка успешна!"
    echo ""
    echo "🔄 Перезапускаю PM2 процесс..."
    pm2 restart luxon-admin
    echo ""
    echo "📊 Статус PM2:"
    pm2 list
    echo ""
    echo "🎉 Всё готово!"
else
    echo ""
    echo "❌ Ошибка сборки!"
    exit 1
fi

