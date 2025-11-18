#!/bin/bash
# Скрипт для настройки виртуального окружения для MobCash Python скриптов

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$PROJECT_DIR/venv"

echo "🔧 Настройка виртуального окружения для MobCash скриптов..."
echo ""

# Проверка Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 не найден. Установите Python 3.6 или выше."
    exit 1
fi

echo "✅ Python 3 найден: $(python3 --version)"
echo ""

# Создание venv
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Создание виртуального окружения..."
    python3 -m venv "$VENV_DIR"
    echo "✅ Виртуальное окружение создано: $VENV_DIR"
else
    echo "✅ Виртуальное окружение уже существует: $VENV_DIR"
fi

echo ""

# Активация venv и установка зависимостей
echo "📥 Установка зависимостей..."
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install requests

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "Для использования:"
echo "  source $VENV_DIR/bin/activate"
echo "  python3 scripts/update_mobcash_tokens.py"
echo ""

