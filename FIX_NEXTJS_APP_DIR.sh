#!/bin/bash
# Исправление структуры Next.js - создание папки app для роутинга

cd /var/www/luxon/app

echo "🔧 Исправление структуры Next.js..."

# Создаем папку app если её нет
mkdir -p app

# Перемещаем файлы роутинга в папку app
echo "Перемещение файлов роутинга в папку app..."

# Перемещаем основные файлы
mv page.tsx app/ 2>/dev/null || true
mv layout.tsx app/ 2>/dev/null || true
mv not-found.tsx app/ 2>/dev/null || true
mv globals.css app/ 2>/dev/null || true

# Перемещаем папки с роутами
mv blocked app/ 2>/dev/null || true
mv deposit app/ 2>/dev/null || true
mv faq app/ 2>/dev/null || true
mv history app/ 2>/dev/null || true
mv instruction app/ 2>/dev/null || true
mv language app/ 2>/dev/null || true
mv privacy app/ 2>/dev/null || true
mv profile app/ 2>/dev/null || true
mv rating app/ 2>/dev/null || true
mv referral app/ 2>/dev/null || true
mv support app/ 2>/dev/null || true
mv withdraw app/ 2>/dev/null || true

# Перемещаем API роуты
mv api app/ 2>/dev/null || true

echo "✅ Структура исправлена!"
echo ""
echo "Проверка:"
ls -la app/

echo ""
echo "Теперь попробуйте собрать:"
echo "npm run build"

