# Что делать дальше после создания api/payments.php

## Текущая ситуация:
- ✅ Файл api.php создан через nano
- ✅ База данных PostgreSQL на отдельном сервере (89.23.117.61)

## Шаги для проверки и настройки:

### 1. Проверить PHP расширение PostgreSQL

```bash
php -m | grep pdo_pgsql
```

**Если нет** - установить:
```bash
sudo apt-get update
sudo apt-get install php-pgsql
sudo systemctl restart apache2  # или nginx/php-fpm
```

---

### 2. Создать тестовый файл для проверки подключения

```bash
sudo nano /var/www/html/api/test_db.php
```

Скопируй туда содержимое из файла `test_db_connection.php` (он в проекте).

Открой в браузере: `http://ТВОЙ_СЕРВЕР/api/test_db.php`

Это покажет:
- ✅ Установлено ли расширение PHP PostgreSQL
- ✅ Может ли PHP подключиться к внешней БД
- ✅ Существует ли таблица payment_notifications
- ❌ Если ошибка - что именно не работает

---

### 3. Проверить доступность PostgreSQL с веб-сервера

```bash
# Проверить порт 5432
nc -zv 89.23.117.61 5432

# Если команда не найдена:
sudo apt-get install netcat

# Или через telnet:
telnet 89.23.117.61 5432
```

Должно показать "Connection successful" или "Connected".

**Если ошибка "Connection refused"** - значит:
- PostgreSQL не принимает внешние подключения
- Или firewall блокирует порт 5432

---

### 4. Настроить PostgreSQL для внешних подключений

Если PostgreSQL не принимает подключения, нужно на сервере БД:

#### A) Отредактировать postgresql.conf:
```bash
sudo nano /etc/postgresql/14/main/postgresql.conf  # версия может отличаться
```

Найти и изменить:
```
listen_addresses = '*'
```

#### B) Отредактировать pg_hba.conf:
```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Добавить в конец:
```
# Разрешить подключения с любого IP (для теста)
host    default_db      gen_user        0.0.0.0/0               md5
```

#### C) Перезапустить PostgreSQL:
```bash
sudo systemctl restart postgresql
```

---

### 5. Проверить firewall на сервере БД

```bash
# Проверить правила
sudo ufw status
sudo iptables -L -n | grep 5432

# Если порт закрыт - открыть:
sudo ufw allow 5432/tcp
sudo iptables -A INPUT -p tcp --dport 5432 -j ACCEPT
```

---

### 6. Тестировать api.php

После всех проверок, протестируй:

```bash
curl -X POST http://ТВОЙ_СЕРВЕР/api/payments.php \
  -H "Content-Type: application/json" \
  -d '{
    "bank_name": "Test Bank",
    "package_name": "com.test",
    "amount": 100.50,
    "currency": "KGS",
    "raw_text": "Test payment notification"
  }'
```

Должен вернуть:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "message": "Payment saved successfully"
  }
}
```

---

### 7. Проверить в браузере

Открой: `http://ТВОЙ_СЕРВЕР/api/payments.php`

Должен вернуть: `{"success":false,"error":"Method not allowed"}`

Это нормально - значит файл работает, просто нужно POST запрос (не GET).

---

## Если что-то не работает:

1. **Проверь логи PHP:**
   ```bash
   sudo tail -f /var/log/apache2/error.log  # для Apache
   sudo tail -f /var/log/nginx/error.log     # для Nginx
   ```

2. **Проверь логи PostgreSQL:**
   На сервере БД:
   ```bash
   sudo tail -f /var/log/postgresql/postgresql-14-main.log
   ```

3. **Проверь доступность из Android приложения:**
   - Открой раздел "Логи" в приложении
   - Там будут детальные сообщения об ошибках

---

## Важно!

Если PostgreSQL куплен отдельно (например, у хостинг-провайдера):
- Возможно нужно разрешить IP адрес веб-сервера в панели управления
- Или добавить IP в whitelist базы данных
- Проверь документацию провайдера БД

