-- Проверка входящих платежей в базе данных
-- База: postgresql://gen_user:dastan10dz@89.23.117.61:5432/default_db

-- Показать все платежи
SELECT 
    id,
    amount,
    bank,
    payment_date,
    notification_text,
    request_id,
    is_processed,
    created_at
FROM incoming_payments
ORDER BY created_at DESC
LIMIT 20;

-- Показать последние 10 платежей с деталями
SELECT 
    id,
    amount,
    bank,
    payment_date,
    LEFT(notification_text, 100) as text_preview,
    request_id,
    is_processed,
    created_at
FROM incoming_payments
ORDER BY created_at DESC
LIMIT 10;

-- Подсчитать количество платежей по банкам
SELECT 
    bank,
    COUNT(*) as count,
    SUM(amount) as total_amount
FROM incoming_payments
GROUP BY bank
ORDER BY count DESC;

-- Показать платежи за последний час
SELECT 
    id,
    amount,
    bank,
    payment_date,
    created_at
FROM incoming_payments
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

