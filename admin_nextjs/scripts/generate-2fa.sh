#!/bin/bash
# Обертка для генерации QR кода 2FA с автоматической активацией venv

set -e

cd /var/www/luxon/admin_nextjs || exit 1

# Проверяем наличие виртуального окружения
if [ ! -d "venv-2fa" ]; then
    echo "❌ Виртуальное окружение не найдено"
    echo "   Запустите сначала: ./scripts/setup-2fa-env.sh"
    exit 1
fi

# Проверяем аргументы
if [ -z "$1" ]; then
    echo "Использование: ./scripts/generate-2fa.sh <username> [--save]"
    echo ""
    echo "Примеры:"
    echo "  ./scripts/generate-2fa.sh admin          # Только показать QR код"
    echo "  ./scripts/generate-2fa.sh admin --save    # Сохранить в БД"
    exit 1
fi

# Активируем виртуальное окружение и запускаем скрипт
source venv-2fa/bin/activate
python3 scripts/generate-2fa-qr.py "$@"

