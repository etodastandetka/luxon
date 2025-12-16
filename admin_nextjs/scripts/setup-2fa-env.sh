#!/bin/bash
# Скрипт для настройки виртуального окружения Python для 2FA

set -e

echo "🐍 Настройка виртуального окружения Python для 2FA"
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# Проверяем наличие Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не найден. Установите: apt install python3 python3-venv"
    exit 1
fi

echo "✅ Python3 найден: $(python3 --version)"
echo ""

# Создаем виртуальное окружение если его нет
if [ ! -d "venv-2fa" ]; then
    echo "📦 Создаю виртуальное окружение..."
    python3 -m venv venv-2fa
    echo "✅ Виртуальное окружение создано"
else
    echo "✅ Виртуальное окружение уже существует"
fi

echo ""
echo "📦 Устанавливаю зависимости..."
source venv-2fa/bin/activate
pip install --upgrade pip
pip install -r scripts/requirements-2fa.txt

echo ""
echo "✅ Готово! Виртуальное окружение настроено"
echo ""
echo "💡 Для использования скрипта 2FA:"
echo "   source venv-2fa/bin/activate"
echo "   python3 scripts/generate-2fa-qr.py admin --save"
echo ""

