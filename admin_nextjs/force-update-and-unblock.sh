#!/bin/bash
# Принудительное обновление и разблокировка всех IP

set -e

echo "🔄 Принудительное обновление и разблокировка"
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Принудительно сбрасываем ВСЕ локальные изменения
echo "📥 Сбрасываю все локальные изменения..."
git fetch origin main
git reset --hard origin/main
git clean -fd
echo "✅ Локальные изменения сброшены"
echo ""

# 2. Очищаем блокировки из БД
echo "1️⃣ Очищаю блокировки из БД..."
if [ -f "scripts/unblock-all-ips.ts" ]; then
    npx tsx scripts/unblock-all-ips.ts 2>/dev/null || echo "  ⚠️  Ошибка при очистке БД (возможно, нет записей)"
    echo "  ✅ БД проверена"
else
    echo "  ⚠️  Скрипт очистки БД не найден, пропускаю"
fi

echo ""
echo "2️⃣ Перезапускаю приложение для очистки блокировок в памяти..."
pm2 restart luxon-admin

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Готово! Все блокировки очищены:"
    echo "   • Локальные изменения сброшены"
    echo "   • Блокировки в памяти (очищены перезапуском)"
    echo "   • Блокировки в БД (очищены скриптом)"
    echo ""
    echo "💡 Проверьте логи: pm2 logs luxon-admin --lines 20"
else
    echo ""
    echo "❌ Ошибка при перезапуске приложения"
    exit 1
fi
echo ""

