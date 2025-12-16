#!/bin/bash
# Скрипт для принудительного обновления и настройки 2FA для админов

set -e

echo "🔄 Принудительное обновление и настройка 2FA"
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Сохраняем локальные изменения и обновляем из git
echo "📥 Сохраняю локальные изменения и обновляю из git..."
git fetch origin main

# Проверяем, есть ли локальные изменения
if ! git diff-index --quiet HEAD --; then
    echo "  💾 Сохраняю локальные изменения в stash..."
    git stash push -m "Local changes before 2FA setup $(date +%Y-%m-%d_%H:%M:%S)"
    echo "  ✅ Локальные изменения сохранены"
fi

# Обновляем из git
echo "  📥 Обновляю из git..."
git pull origin main || {
    echo "  ⚠️  Конфликты при merge, принудительно обновляю..."
    git reset --hard origin/main
    git clean -fd
}

echo "✅ Код обновлен"
echo ""

# 2. Обновляем схему БД для 2FA
echo "🗄️  Обновляю схему базы данных для 2FA..."
if [ -f "scripts/update-db-2fa.sh" ]; then
    chmod +x scripts/update-db-2fa.sh
    ./scripts/update-db-2fa.sh
    echo ""
else
    echo "⚠️  Скрипт обновления БД не найден, обновляю вручную..."
    npm run db:push
    npm run db:generate
    echo "✅ Схема БД обновлена"
    echo ""
fi

# 3. Настраиваем виртуальное окружение Python (если нужно)
if [ ! -d "venv-2fa" ]; then
    echo "🐍 Настраиваю виртуальное окружение Python..."
    if [ -f "scripts/setup-2fa-env.sh" ]; then
        chmod +x scripts/setup-2fa-env.sh
        ./scripts/setup-2fa-env.sh
    else
        echo "⚠️  Скрипт настройки venv не найден, создаю вручную..."
        python3 -m venv venv-2fa
        source venv-2fa/bin/activate
        pip install --upgrade pip
        pip install -r scripts/requirements-2fa.txt
        deactivate
    fi
    echo ""
fi

# 4. Запускаем настройку 2FA для админов
echo "🔐 Настраиваю 2FA для админов..."
chmod +x scripts/setup-2fa-for-admins.sh
./scripts/setup-2fa-for-admins.sh

echo ""
echo "🎉 Готово! Все обновлено и 2FA настроена."

