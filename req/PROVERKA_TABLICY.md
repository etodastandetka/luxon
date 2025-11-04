# Как проверить содержимое таблицы payment_notifications

## Вариант 1: Через psql (командная строка)

### Подключись к базе:
```bash
psql -h 89.23.117.61 -p 5432 -U gen_user -d default_db
```
Пароль: `dastan10dz`

### Показать все записи:
```sql
SELECT * FROM payment_notifications ORDER BY created_at DESC;
```

### Показать последние 10 записей:
```sql
SELECT * FROM payment_notifications ORDER BY created_at DESC LIMIT 10;
```

### Подсчитать количество записей:
```sql
SELECT COUNT(*) FROM payment_notifications;
```

### Показать записи по конкретному банку:
```sql
SELECT * FROM payment_notifications WHERE bank_name = 'Kompanion Bank' ORDER BY created_at DESC;
```

### Показать только нужные поля:
```sql
SELECT 
    id,
    bank_name,
    amount,
    currency,
    transaction_date,
    created_at
FROM payment_notifications 
ORDER BY created_at DESC;
```

### Выйти из psql:
```
\q
```

---

## Вариант 2: Через Adminer (веб-интерфейс)

1. Открой Adminer (как на твоем скриншоте)
2. Выбери таблицу `payment_notifications` в левом меню
3. Нажми вкладку **"Выбрать"** (Select) вместо "Показать структуру"
4. Там увидишь все записи в таблице

---

## Вариант 3: Одна команда из терминала (быстро)

```bash
PGPASSWORD='dastan10dz' psql -h 89.23.117.61 -p 5432 -U gen_user -d default_db -c "SELECT * FROM payment_notifications ORDER BY created_at DESC LIMIT 10;"
```

---

## Вариант 4: Экспорт в файл

```bash
PGPASSWORD='dastan10dz' psql -h 89.23.117.61 -p 5432 -U gen_user -d default_db -c "SELECT * FROM payment_notifications ORDER BY created_at DESC;" -o payments.txt
```

---

## Полезные SQL запросы для анализа:

### Статистика по банкам:
```sql
SELECT 
    bank_name,
    COUNT(*) as total_payments,
    SUM(amount) as total_amount,
    currency
FROM payment_notifications
GROUP BY bank_name, currency
ORDER BY total_amount DESC;
```

### Последние пополнения сегодня:
```sql
SELECT * 
FROM payment_notifications 
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;
```

### Самые большие пополнения:
```sql
SELECT 
    bank_name,
    amount,
    currency,
    transaction_date,
    created_at
FROM payment_notifications
ORDER BY amount DESC
LIMIT 20;
```

