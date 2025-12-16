# Проблема подключения к серверу PostgreSQL API

## Ошибка:
```
failed to connect to /89.23.117.61 (port 80) from /192.168.1.215 (port 38036) after 10000ms
```

## Возможные причины:

### 1. PHP скрипт не загружен на сервер
- Убедитесь, что файл `api.php` загружен на сервер
- Путь должен быть: `/api/payments.php` (или `/var/www/html/api/payments.php` на Linux)
- Проверьте права доступа: `chmod 644 api.php`

### 2. Веб-сервер не запущен или не слушает порт 80
```bash
# Проверка Apache/Nginx
sudo systemctl status apache2  # или nginx
sudo systemctl start apache2
sudo netstat -tlnp | grep :80
```

### 3. PHP расширение PDO PostgreSQL не установлено
```bash
# Проверка расширения
php -m | grep pdo_pgsql

# Установка (Ubuntu/Debian)
sudo apt-get install php-pgsql
sudo systemctl restart apache2
```

### 4. Firewall блокирует порт 80
```bash
# Проверка firewall
sudo ufw status
sudo iptables -L -n | grep 80

# Разрешить порт 80
sudo ufw allow 80/tcp
```

### 5. Неправильный путь к скрипту
- Проверьте в браузере: `http://89.23.117.61/api/payments.php`
- Должен вернуться JSON ответ (даже если с ошибкой)
- Если 404 - скрипт не по тому пути

## Проверка доступности:

### Из браузера:
Откройте: `http://89.23.117.61/api/payments.php`

Должен вернуться JSON (даже с ошибкой, например):
```json
{"success":false,"error":"Method not allowed"}
```

Это нормально - значит скрипт работает, просто нужно отправить POST запрос.

### Из командной строки (Linux):
```bash
curl -X POST http://89.23.117.61/api/payments.php \
  -H "Content-Type: application/json" \
  -d '{"bank_name":"test","package_name":"test","amount":100,"raw_text":"test"}'
```

### Проверка из Android:
В логах приложения будет видно:
- "Попытка подключения к API: http://89.23.117.61/api/payments.php"
- Если успешно - "Платеж успешно отправлен"
- Если ошибка - детальное описание проблемы

## Решение:

1. **Загрузите api.php на сервер:**
   ```bash
   scp api.php user@89.23.117.61:/var/www/html/api/payments.php
   ```

2. **Убедитесь что веб-сервер работает:**
   ```bash
   sudo systemctl status apache2
   sudo systemctl status nginx
   ```

3. **Проверьте PHP и PostgreSQL:**
   ```bash
   php -v
   php -m | grep pdo_pgsql
   ```

4. **Тестируйте через curl или браузер** перед использованием из приложения

