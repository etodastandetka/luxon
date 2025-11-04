# ПРОСТАЯ УСТАНОВКА - 2 ШАГА

## Шаг 1: Создай таблицу в PostgreSQL

Зайди в свою PostgreSQL базу и выполни:

```sql
CREATE TABLE IF NOT EXISTS payment_notifications (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(255) NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KGS',
    card_number VARCHAR(50),
    account_number VARCHAR(50),
    transaction_date TIMESTAMP NOT NULL,
    raw_text TEXT NOT NULL,
    parsed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Готово! Таблица создана.

## Шаг 2: Загрузи файл api.php на сервер

1. Открой файл `api.php` который я создал
2. Загрузи его на свой сервер (любая папка, например `/var/www/html/api/payments.php`)
3. Убедись что на сервере установлен PHP и расширение `pdo_pgsql`

Проверь что файл доступен по адресу: `http://89.23.117.61/api/payments.php`

## ВСЁ! 

Приложение само будет отправлять все пополнения в базу данных автоматически.

Если у тебя нет веб-сервера с PHP, могу создать простой Node.js сервер на один файл.

