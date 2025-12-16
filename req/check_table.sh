#!/bin/bash
# Скрипт для быстрой проверки таблицы payment_notifications

echo "════════════════════════════════════════════════════"
echo "  ПРОВЕРКА ТАБЛИЦЫ payment_notifications"
echo "════════════════════════════════════════════════════"
echo ""

# Показать количество записей
echo "📊 Общее количество записей:"
PGPASSWORD='dastan10dz' psql -h 89.23.117.61 -p 5432 -U gen_user -d default_db -t -c "SELECT COUNT(*) FROM payment_notifications;"

echo ""
echo "📋 Последние 10 записей:"
echo "────────────────────────────────────────────────────"
PGPASSWORD='dastan10dz' psql -h 89.23.117.61 -p 5432 -U gen_user -d default_db -c "
SELECT 
    id,
    bank_name,
    amount,
    currency,
    TO_CHAR(transaction_date, 'YYYY-MM-DD HH24:MI:SS') as transaction_date,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM payment_notifications 
ORDER BY created_at DESC 
LIMIT 10;
"

echo ""
echo "💰 Статистика по банкам:"
echo "────────────────────────────────────────────────────"
PGPASSWORD='dastan10dz' psql -h 89.23.117.61 -p 5432 -U gen_user -d default_db -c "
SELECT 
    bank_name,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    currency
FROM payment_notifications
GROUP BY bank_name, currency
ORDER BY total_amount DESC;
"

echo ""
echo "✅ Готово!"

