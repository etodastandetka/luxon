#!/bin/bash
# Скрипт для проверки настроек геолокации

echo "🔍 Проверка настроек геолокации"
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

echo "1️⃣ Проверка .env файла:"
if [ -f ".env" ]; then
    echo "  ✅ Файл .env существует"
    echo ""
    echo "  📋 Переменные геолокации:"
    if grep -q "ALLOWED_LATITUDE" .env; then
        ALLOWED_LATITUDE=$(grep "^ALLOWED_LATITUDE=" .env | cut -d'=' -f2)
        echo "    ✅ ALLOWED_LATITUDE=$ALLOWED_LATITUDE"
    else
        echo "    ❌ ALLOWED_LATITUDE не найдено"
    fi
    
    if grep -q "ALLOWED_LONGITUDE" .env; then
        ALLOWED_LONGITUDE=$(grep "^ALLOWED_LONGITUDE=" .env | cut -d'=' -f2)
        echo "    ✅ ALLOWED_LONGITUDE=$ALLOWED_LONGITUDE"
    else
        echo "    ❌ ALLOWED_LONGITUDE не найдено"
    fi
    
    if grep -q "ALLOWED_RADIUS_METERS" .env; then
        ALLOWED_RADIUS_METERS=$(grep "^ALLOWED_RADIUS_METERS=" .env | cut -d'=' -f2)
        echo "    ✅ ALLOWED_RADIUS_METERS=$ALLOWED_RADIUS_METERS метров"
        
        # Проверяем, не слишком ли маленький радиус
        if [ "$ALLOWED_RADIUS_METERS" -lt 50 ]; then
            echo ""
            echo "    ⚠️  ВНИМАНИЕ: Радиус слишком маленький ($ALLOWED_RADIUS_METERS м)!"
            echo "    📍 Точность GPS обычно 10-100 метров"
            echo "    💡 Рекомендуется установить радиус минимум 100 метров"
            echo "    🔧 Запустите: ./scripts/fix-geolocation-radius.sh"
        fi
    else
        echo "    ❌ ALLOWED_RADIUS_METERS не найдено"
    fi
else
    echo "  ❌ Файл .env не найден!"
fi

echo ""
echo "2️⃣ Проверка кэша приложения:"
echo "  💡 Если вы изменили .env, нужно перезапустить приложение:"
echo "     pm2 restart luxon-admin"
echo ""

echo "3️⃣ Проверка логов (последние 20 строк):"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "luxon-admin"; then
        echo "  📋 Последние логи geolocation:"
        pm2 logs luxon-admin --lines 50 --nostream 2>/dev/null | grep -iE "(geolocation|location|denied|approved|distance)" | tail -10 || echo "    (логи geolocation не найдены)"
        echo ""
        echo "  💡 Для подробных логов запустите: ./scripts/check-geolocation-logs.sh"
    else
        echo "  ⚠️  Процесс luxon-admin не найден в PM2"
    fi
else
    echo "  ⚠️  PM2 не установлен, проверьте логи вручную"
fi

echo ""
echo "4️⃣ Рекомендации:"
echo "  • Минимальный радиус: 50-100 метров (для учета погрешности GPS)"
echo "  • Для города: 500-2000 метров"
echo "  • Для региона: 5000-10000 метров"
echo "  • После изменения .env ОБЯЗАТЕЛЬНО перезапустите: pm2 restart luxon-admin"
echo ""

