#!/bin/bash
# Скрипт для проверки логов геолокации

echo "📋 Проверка логов геолокации"
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# Проверяем, какой процесс отвечает за админку
APP_NAME="luxon-admin"

# Проверяем PM2
if command -v pm2 &> /dev/null; then
    echo "🔍 Ищем процесс в PM2..."
    if pm2 list | grep -q "$APP_NAME"; then
        echo "  ✅ Процесс $APP_NAME найден в PM2"
        echo ""
        
        echo "📊 Последние 50 строк логов (все):"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        pm2 logs "$APP_NAME" --lines 50 --nostream 2>/dev/null | tail -50
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        
        echo "🗺️  Логи геолокации (фильтр):"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        pm2 logs "$APP_NAME" --lines 100 --nostream 2>/dev/null | grep -iE "(geolocation|location|latitude|longitude|radius|zone|denied|approved|distance)" | tail -20
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        
        echo "❌ Ошибки геолокации:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        pm2 logs "$APP_NAME" --lines 100 --nostream 2>/dev/null | grep -iE "(geolocation.*denied|outside.*zone|not.*region)" | tail -10
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        
        echo "✅ Успешные проверки геолокации:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        pm2 logs "$APP_NAME" --lines 100 --nostream 2>/dev/null | grep -iE "(geolocation.*approved|location.*verified|within.*zone)" | tail -10
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        
    else
        echo "  ⚠️  Процесс $APP_NAME не найден в PM2"
        echo "  📋 Доступные процессы:"
        pm2 list | grep -E "name|online|stopped"
    fi
else
    echo "❌ PM2 не установлен"
    echo ""
    echo "Проверьте логи вручную:"
    echo "  • Если используете systemd: journalctl -u luxon-admin -n 50"
    echo "  • Если используете docker: docker logs <container_name>"
    echo "  • Если используете npm: проверьте файлы логов в проекте"
fi

echo ""
echo "💡 Полезные команды:"
echo "  • pm2 logs $APP_NAME --lines 100          # Последние 100 строк"
echo "  • pm2 logs $APP_NAME --err                # Только ошибки"
echo "  • pm2 logs $APP_NAME --out                # Только вывод"
echo "  • pm2 logs $APP_NAME --lines 0            # Все логи (с начала)"
echo "  • pm2 flush $APP_NAME                     # Очистить логи"
echo ""

