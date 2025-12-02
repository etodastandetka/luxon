#!/bin/bash
# Скрипт для увеличения радиуса геолокации и диагностики

echo "🗺️  Исправление радиуса геолокации"
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# Проверяем текущие значения
echo "📊 Текущие значения в .env:"
if [ -f ".env" ]; then
    grep -E "ALLOWED_(LATITUDE|LONGITUDE|RADIUS)" .env || echo "  ⚠️  Переменные не найдены в .env"
else
    echo "  ❌ Файл .env не найден!"
fi
echo ""

# Рекомендуемый радиус (минимум 100 метров для учета погрешности GPS)
RECOMMENDED_RADIUS=100

read -p "Введите новый радиус в метрах [рекомендуется: $RECOMMENDED_RADIUS, минимум: 50]: " new_radius
new_radius=${new_radius:-$RECOMMENDED_RADIUS}

# Валидация
if ! [[ "$new_radius" =~ ^[0-9]+$ ]] || [ "$new_radius" -lt 50 ]; then
    echo "❌ Ошибка: Радиус должен быть числом не менее 50 метров"
    exit 1
fi

echo ""
echo "📝 Обновляю радиус в .env файле..."

# Функция для обновления переменной
update_env_var() {
    local key=$1
    local value=$2
    local file=".env"
    
    if [ ! -f "$file" ]; then
        touch "$file"
    fi
    
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
        else
            sed -i "s|^${key}=.*|${key}=${value}|" "$file"
        fi
        echo "  ✅ Обновлено: ${key}=${value}"
    else
        echo "${key}=${value}" >> "$file"
        echo "  ✅ Добавлено: ${key}=${value}"
    fi
}

# Обновляем радиус
update_env_var "ALLOWED_RADIUS_METERS" "$new_radius"

echo ""
echo "✅ Радиус обновлен до ${new_radius} метров"
echo ""
echo "⚠️  ВАЖНО: Перезапустите приложение для применения изменений:"
echo "  pm2 restart luxon-admin"
echo ""
echo "📋 Текущие настройки геолокации:"
grep -E "ALLOWED_(LATITUDE|LONGITUDE|RADIUS)" .env
echo ""

