#!/bin/bash
# Скрипт для автоматической настройки 2FA для админов Bishkek и dastan

set -e

echo "🔐 Настройка 2FA для админов"
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# Проверяем наличие виртуального окружения
if [ ! -d "venv-2fa" ]; then
    echo "❌ Виртуальное окружение не найдено"
    echo "   Запускаю настройку..."
    chmod +x scripts/setup-2fa-env.sh
    ./scripts/setup-2fa-env.sh
    echo ""
fi

# Активируем виртуальное окружение
source venv-2fa/bin/activate

# Массив админов
admins=("Bishkek" "dastan")

echo "📋 Настройка 2FA для следующих админов:"
for admin in "${admins[@]}"; do
    echo "   - $admin"
done
echo ""

# Генерируем 2FA для каждого админа
for admin in "${admins[@]}"; do
    echo "============================================================"
    echo "🔐 Настройка 2FA для: $admin"
    echo "============================================================"
    echo ""
    
    # Запускаем скрипт генерации с сохранением в БД
    python3 scripts/generate-2fa-qr.py "$admin" --save
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ 2FA успешно настроена для $admin"
    else
        echo ""
        echo "❌ Ошибка при настройке 2FA для $admin"
    fi
    
    echo ""
    echo "============================================================"
    echo ""
done

echo "🎉 Готово! 2FA настроена для всех админов"
echo ""
echo "📄 Файлы с информацией сохранены:"
for admin in "${admins[@]}"; do
    if [ -f "2fa-${admin}.txt" ]; then
        echo "   - 2fa-${admin}.txt"
    fi
done
echo ""
echo "⚠️  ВАЖНО: Сохраните файлы 2fa-*.txt в безопасном месте!"
echo "   Они содержат резервные коды для восстановления доступа."
echo ""

