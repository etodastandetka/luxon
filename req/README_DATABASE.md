# Настройка PostgreSQL базы данных

## Данные подключения
- **Host:** 89.23.117.61
- **Port:** 5432
- **Database:** default_db
- **User:** gen_user
- **Password:** dastan10dz
- **Full URL:** postgresql://gen_user:dastan10dz@89.23.117.61:5432/default_db

## Шаги настройки:

### 1. Создание таблицы в PostgreSQL

Выполните SQL скрипт `database_setup.sql` в вашей базе данных:

```bash
psql -h 89.23.117.61 -p 5432 -U gen_user -d default_db -f database_setup.sql
```

Или подключитесь к базе и выполните команды из файла `database_setup.sql`.

### 2. Запуск API сервера (Node.js)

Сервер принимает данные от Android приложения и сохраняет их в PostgreSQL.

```bash
# Установка зависимостей
npm install express pg

# Запуск сервера
node api_server.js
```

Сервер будет слушать на порту 3000: `http://89.23.117.61:3000`

### 3. Настройка Android приложения

Приложение автоматически отправляет данные о пополнениях в PostgreSQL через API endpoint:
- URL: `http://89.23.117.61:3000/api/payments`
- Method: POST
- Content-Type: application/json

### 4. Структура данных

Таблица `payment_notifications` содержит следующие поля:
- `id` - уникальный идентификатор (автоинкремент)
- `bank_name` - название банка
- `package_name` - package name приложения
- `amount` - сумма пополнения
- `currency` - валюта (KGS, USD, EUR, RUB)
- `card_number` - номер карты (если указан)
- `account_number` - номер счета (если указан)
- `transaction_date` - дата транзакции из уведомления
- `raw_text` - исходный текст уведомления
- `parsed_at` - дата парсинга
- `created_at` - дата создания записи в БД

### 5. Проверка работы

После запуска сервера проверьте:
```bash
curl http://89.23.117.61:3000/health
```

Должен вернуть: `{"status":"ok","database":"connected"}`

### 6. Альтернативный вариант (если нет API сервера)

Если API сервер не запущен, можно настроить прямое подключение через JDBC в Android приложении (требует дополнительной настройки).

