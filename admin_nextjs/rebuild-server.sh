#!/bin/bash
# Скрипт для полной пересборки проекта на сервере
# Исправляет проблему с потерей символа @ в импортах
# Использование: ./rebuild-server.sh

set -e  # Остановить при ошибке

echo "🔄 Начинаю полную пересборку проекта..."
echo ""

# Перейти в директорию проекта
PROJECT_DIR="/var/www/luxon/admin_nextjs"
cd "$PROJECT_DIR" || exit 1

echo "📋 Проверяю конфигурационные файлы..."

# Проверка tsconfig.json
if [ ! -f "tsconfig.json" ]; then
    echo "❌ ОШИБКА: tsconfig.json не найден!"
    exit 1
fi

# Проверка jsconfig.json
if [ ! -f "jsconfig.json" ]; then
    echo "❌ ОШИБКА: jsconfig.json не найден!"
    exit 1
fi

# Проверка next.config.js
if [ ! -f "next.config.js" ]; then
    echo "❌ ОШИБКА: next.config.js не найден!"
    exit 1
fi

echo "✅ Все конфигурационные файлы найдены"
echo ""

echo "📥 Получаю последние изменения из git..."
git pull origin main
echo ""

echo "🧹 Очищаю ВСЕ кеши и артефакты сборки..."
echo "   Удаляю .next..."
rm -rf .next

echo "   Удаляю node_modules/.cache..."
rm -rf node_modules/.cache

echo "   Удаляю tsconfig.tsbuildinfo..."
rm -rf tsconfig.tsbuildinfo

echo "   Удаляю .swc..."
rm -rf .swc

echo "   Удаляю .turbo..."
rm -rf .turbo

echo "✅ Кеши очищены"
echo ""

echo "🔍 Проверяю версии Node.js и npm..."
node -v
npm -v
echo ""

echo "📦 Проверяю зависимости..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo "⚠️  node_modules отсутствует или поврежден, переустанавливаю зависимости..."
    rm -rf node_modules
    npm install
else
    echo "✅ Зависимости установлены"
fi
echo ""

echo "🔍 Проверяю конфигурацию алиасов..."
echo "   Проверяю tsconfig.json..."
if grep -q '"@/\*":\s*\["./\*"\]' tsconfig.json; then
    echo "   ✅ tsconfig.json: алиас @ настроен правильно"
else
    echo "   ⚠️  tsconfig.json: возможно проблема с алиасом @"
fi

echo "   Проверяю jsconfig.json..."
if grep -q '"@/\*":\s*\["./\*"\]' jsconfig.json; then
    echo "   ✅ jsconfig.json: алиас @ настроен правильно"
else
    echo "   ⚠️  jsconfig.json: возможно проблема с алиасом @"
fi

echo "   Проверяю next.config.js..."
if grep -q "'@':" next.config.js || grep -q '"@":' next.config.js; then
    echo "   ✅ next.config.js: webpack alias @ настроен"
else
    echo "   ⚠️  next.config.js: webpack alias @ не найден"
fi
echo ""

echo "🔨 Пересобираю проект..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Сборка успешна!"
    echo ""
    echo "🔄 Перезапускаю PM2 процесс..."
    pm2 restart luxon-admin
    
    echo ""
    echo "📊 Статус PM2 процессов:"
    pm2 list
    
    echo ""
    echo "✅ Готово! Проект пересобран и перезапущен."
else
    echo ""
    echo "❌ ОШИБКА: Сборка не удалась!"
    echo "Проверьте вывод выше для деталей."
    exit 1
fi

