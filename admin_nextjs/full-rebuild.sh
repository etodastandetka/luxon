#!/bin/bash
# ПОЛНАЯ ПЕРЕУСТАНОВКА - сбрасывает ВСЁ
set -e

cd /var/www/luxon/admin_nextjs || exit 1

echo "🔥 ПОЛНАЯ ПЕРЕУСТАНОВКА - сбрасываю ВСЁ"
echo ""

echo "1️⃣ Удаляю ВСЕ кеши и артефакты..."
rm -rf .next
rm -rf node_modules
rm -rf node_modules/.cache
rm -rf tsconfig.tsbuildinfo
rm -rf .swc
rm -rf .turbo
rm -rf .npm
echo "✅ Очищено"
echo ""

echo "2️⃣ Обновляю файлы из git..."
git fetch origin main
git reset --hard origin/main
echo "✅ Файлы обновлены"
echo ""

echo "3️⃣ Переустанавливаю зависимости..."
npm install
echo "✅ Зависимости установлены"
echo ""

echo "4️⃣ Проверяю конфигурацию..."
echo "tsconfig.json:"
grep -A 2 '"paths"' tsconfig.json || echo "❌ paths не найден"
echo ""
echo "jsconfig.json:"
grep -A 2 '"paths"' jsconfig.json || echo "❌ paths не найден"
echo ""
echo "next.config.js webpack:"
grep -A 5 "webpack:" next.config.js | head -6 || echo "❌ webpack не найден"
echo ""

echo "5️⃣ Пересобираю проект..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ СБОРКА УСПЕШНА!"
    echo ""
    echo "6️⃣ Перезапускаю PM2..."
    pm2 restart luxon-admin
    pm2 list
    echo ""
    echo "✅ ГОТОВО!"
else
    echo ""
    echo "❌ СБОРКА ПРОВАЛИЛАСЬ!"
    exit 1
fi

