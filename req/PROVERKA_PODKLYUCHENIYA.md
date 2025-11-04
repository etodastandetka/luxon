# Проверка подключения к внешней PostgreSQL базе данных

## Ситуация:
- Веб-сервер с PHP: один сервер (где api.php)
- PostgreSQL база данных: отдельный сервер (89.23.117.61:5432)

## Что проверить:

### 1. Проверка PHP расширения PostgreSQL

```bash
# Проверить установлено ли расширение
php -m | grep pdo_pgsql

# Если нет - установить:
# Ubuntu/Debian:
sudo apt-get update
sudo apt-get install php-pgsql
sudo systemctl restart apache2  # или nginx

# CentOS/RHEL:
sudo yum install php-pgsql
sudo systemctl restart httpd  # или nginx
```

### 2. Проверка подключения к БД из PHP скрипта

Создай тестовый файл для проверки:

```bash
sudo nano /var/www/html/api/test_db.php
```

Вставь этот код:

```php
<?php
$host = '89.23.117.61';
$port = '5432';
$dbname = 'default_db';
$user = 'gen_user';
$password = 'dastan10dz';

try {
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
    $pdo = new PDO($dsn, $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo json_encode([
        'success' => true,
        'message' => 'Подключение к PostgreSQL успешно!',
        'host' => $host,
        'database' => $dbname
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Ошибка подключения: ' . $e->getMessage()
    ]);
}
?>
```

Проверь в браузере: `http://ТВОЙ_СЕРВЕР/api/test_db.php`

### 3. Проверка доступности БД с веб-сервера

```bash
# Проверить подключение через telnet
telnet 89.23.117.61 5432

# Или через nc (netcat)
nc -zv 89.23.117.61 5432

# Если нет - установить:
sudo apt-get install telnet  # или netcat
```

### 4. Важно: Настройки PostgreSQL для внешних подключений

Если PostgreSQL не принимает подключения, нужно проверить:

#### A) postgresql.conf
Должно быть:
```
listen_addresses = '*'  # или конкретный IP
```

#### B) pg_hba.conf
Добавить строку для разрешения подключений с IP веб-сервера:
```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    default_db      gen_user        IP_ВЕБ_СЕРВЕРА/32       md5
```

Или для всех IP:
```
host    default_db      gen_user        0.0.0.0/0               md5
```

После изменений:
```bash
sudo systemctl restart postgresql
```

### 5. Проверка firewall

На сервере с PostgreSQL убедись что порт 5432 открыт:

```bash
# Проверить
sudo ufw status
sudo iptables -L -n | grep 5432

# Если нужно открыть
sudo ufw allow 5432/tcp
```

## Проверка работы api.php

После настройки проверь POST запрос:

```bash
curl -X POST http://ТВОЙ_СЕРВЕР/api/payments.php \
  -H "Content-Type: application/json" \
  -d '{
    "bank_name": "Test Bank",
    "package_name": "com.test.app",
    "amount": 100.50,
    "currency": "KGS",
    "raw_text": "Test payment"
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

