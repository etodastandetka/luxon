#!/bin/bash
# Быстрый тест генерации QR кода для 2FA

echo "🔐 Тест генерации QR кода для 2FA"
echo ""

# Проверяем наличие Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не найден"
    exit 1
fi

# Проверяем зависимости
echo "📦 Проверка зависимостей..."
python3 -c "import psycopg2, qrcode, pyotp" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Не все зависимости установлены"
    echo "Установите: pip install -r scripts/requirements-2fa.txt"
    exit 1
fi

echo "✅ Зависимости установлены"
echo ""

# Проверяем DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL не установлен"
    echo "Установите: export DATABASE_URL='postgresql://user:password@localhost:5432/dbname'"
    echo "Или добавьте в .env файл"
    exit 1
fi

echo "✅ DATABASE_URL установлен"
echo ""

# Запускаем скрипт
if [ -z "$1" ]; then
    echo "Использование: ./scripts/test-2fa-qr.sh <username>"
    exit 1
fi

python3 admin_nextjs/scripts/generate-2fa-qr.py "$1"

