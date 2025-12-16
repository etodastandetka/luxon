# Использование PHP шаблона из Timeweb

## В панели Timeweb:

### ШАГ 1: Скопируй PHP код из Timeweb

1. В панели Timeweb выбери "PHP" как способ подключения
2. Скопируй весь PHP код который там показан
3. Он будет содержать правильные данные подключения к твоей БД

### ШАГ 2: Используй в api.php

В файле `/var/www/html/api/payments.php` используй подключение из Timeweb:

```php
<?php
// В начале файла используй код подключения из Timeweb
// Например, он может выглядеть так:

$host = 'pgsql123.timeweb.ru';  // из панели Timeweb
$port = '5432';
$dbname = 'default_db';
$user = 'gen_user';
$password = 'dastan10dz';

// Остальной код из api.php оставь без изменений
```

### ШАГ 3: Проверь работу

После обновления файла проверь:
```bash
curl -X POST http://ТВОЙ_СЕРВЕР/api/payments.php \
  -H "Content-Type: application/json" \
  -d '{"bank_name":"Test","package_name":"test","amount":100,"raw_text":"test"}'
```

---

## Или используй готовый код из Timeweb полностью

Timeweb может предоставить готовый пример кода подключения - используй его как основу для api.php!

