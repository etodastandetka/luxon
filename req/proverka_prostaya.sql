-- Простые SQL команды для проверки таблицы
-- Скопируй и выполни в psql или Adminer

-- 1. Показать ВСЕ записи
SELECT * FROM payment_notifications ORDER BY created_at DESC;

-- 2. Показать только последние 20 записей
SELECT * FROM payment_notifications ORDER BY created_at DESC LIMIT 20;

-- 3. Подсчитать количество
SELECT COUNT(*) as total_records FROM payment_notifications;

-- 4. Статистика по банкам
SELECT 
    bank_name,
    COUNT(*) as count,
    SUM(amount) as total,
    currency
FROM payment_notifications
GROUP BY bank_name, currency
ORDER BY total DESC;

-- 5. Последние пополнения (форматированно)
SELECT 
    id,
    bank_name,
    amount,
    currency,
    TO_CHAR(transaction_date, 'DD.MM.YYYY HH24:MI') as date,
    LEFT(raw_text, 50) as text_preview
FROM payment_notifications 
ORDER BY created_at DESC 
LIMIT 10;

-- 6. Проверить есть ли записи за сегодня
SELECT COUNT(*) as today_count
FROM payment_notifications 
WHERE DATE(created_at) = CURRENT_DATE;

