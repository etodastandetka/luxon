#!/bin/bash
# Скрипт для проверки структуры проектов на сервере

echo "🔍 Проверка структуры проектов..."
echo ""

# Проверяем админку
echo "=== АДМИНКА ==="
if [ -d "/var/www/ls/admin_nextjs" ]; then
    echo "✅ Найдена: /var/www/ls/admin_nextjs"
    cd /var/www/ls/admin_nextjs
    echo "   Git remote:"
    git remote -v 2>/dev/null || echo "   ⚠️  Не git репозиторий"
    echo "   PM2 процесс: luxon-admin"
elif [ -d "/var/www/luxon/admin_nextjs" ]; then
    echo "✅ Найдена: /var/www/luxon/admin_nextjs"
    cd /var/www/luxon/admin_nextjs
    echo "   Git remote:"
    git remote -v 2>/dev/null || echo "   ⚠️  Не git репозиторий"
    echo "   PM2 процесс: luxon-admin"
else
    echo "❌ Админка не найдена"
fi

echo ""
echo "=== МИНИ-ПРИЛОЖЕНИЕ ==="
if [ -d "/var/www/luxon/app/app" ]; then
    echo "✅ Найдена: /var/www/luxon/app/app"
    cd /var/www/luxon/app/app
    echo "   Git remote:"
    git remote -v 2>/dev/null || echo "   ⚠️  Не git репозиторий"
    echo "   PM2 процесс: luxon-mini-app"
elif [ -d "/var/www/ls/app/app" ]; then
    echo "✅ Найдена: /var/www/ls/app/app"
    cd /var/www/ls/app/app
    echo "   Git remote:"
    git remote -v 2>/dev/null || echo "   ⚠️  Не git репозиторий"
    echo "   PM2 процесс: luxon-mini-app"
else
    echo "❌ Мини-приложение не найдено"
fi

echo ""
echo "=== КОРНЕВОЙ РЕПОЗИТОРИЙ ==="
if [ -d "/var/www/luxon/.git" ]; then
    echo "✅ Найден: /var/www/luxon (git репозиторий)"
    cd /var/www/luxon
    echo "   Git remote:"
    git remote -v
elif [ -d "/var/www/ls/.git" ]; then
    echo "✅ Найден: /var/www/ls (git репозиторий)"
    cd /var/www/ls
    echo "   Git remote:"
    git remote -v
else
    echo "❌ Корневой git репозиторий не найден"
fi

echo ""
echo "📊 Статус PM2:"
pm2 list

