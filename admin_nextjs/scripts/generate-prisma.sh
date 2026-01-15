#!/bin/bash
# Скрипт для генерации Prisma клиента после изменений в schema.prisma

echo "🔄 Генерирую Prisma клиент..."
cd /var/www/luxon/admin_nextjs
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma клиент успешно сгенерирован"
    echo "🔄 Перезапускаю админку..."
    pm2 restart luxon-admin
    echo "✅ Готово!"
else
    echo "❌ Ошибка при генерации Prisma клиента"
    exit 1
fi

