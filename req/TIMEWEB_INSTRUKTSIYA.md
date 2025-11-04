# Пошаговая инструкция для Timeweb PostgreSQL

## Что нужно сделать:

### ШАГ 1: Проверь данные БД в панели Timeweb

1. Зайди в панель управления Timeweb
2. Найди свою PostgreSQL базу данных
3. Посмотри и сохрани:
   - **Хост (Host)** - обычно что-то вроде `pgsqlXXX.timeweb.ru` или IP
   - **Порт (Port)** - обычно `5432`
   - **База данных (Database)** - название БД
   - **Пользователь (User)**
   - **Пароль (Password)**

---

### ШАГ 2: Выбери вариант API

#### Вариант A: Node.js API (РЕКОМЕНДУЮ) ⭐

**Если есть доступ к серверу (VPS/хостинг):**

1. Установи Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. Создай папку:
```bash
mkdir ~/payment-api
cd ~/payment-api
```

3. Скопируй туда `api_server.js` из проекта

4. Отредактируй данные подключения в `api_server.js`:
```javascript
const pool = new Pool({
    host: 'ТВОЙ_ХОСТ_ИЗ_TIMEWEB',  // например: pgsql123.timeweb.ru
    port: 5432,
    database: 'default_db',
    user: 'gen_user',
    password: 'dastan10dz',
    ssl: false  // или true если требуется
});
```

5. Установи зависимости:
```bash
npm install express pg
```

6. Запусти:
```bash
node api_server.js
```

7. Проверь:
```bash
curl http://localhost:3000/health
```

8. Для автозапуска:
```bash
npm install -g pm2
pm2 start api_server.js --name payment-api
pm2 save
pm2 startup
```

9. Открой порт:
```bash
sudo ufw allow 3000/tcp
```

10. В Android приложении измени URL в `DatabaseConfig.kt`:
```kotlin
const val API_BASE_URL = "http://ТВОЙ_СЕРВЕР:3000"
```

---

#### Вариант B: Использовать PHP на Timeweb хостинге

Если у тебя хостинг в Timeweb (не только БД):

1. Создай файл `api/payments.php` как показывал ранее
2. В `api.php` данные подключения уже правильные (проверь хост)
3. В панели Timeweb разреши подключение к БД с IP хостинга

---

### ШАГ 3: Настрой доступ к БД в панели Timeweb

**Важно!** Если используешь внешний сервер (не Timeweb хостинг):

1. В панели Timeweb найди свою PostgreSQL БД
2. Открой настройки доступа
3. Добавь IP адрес твоего веб-сервера в белый список
4. Или разреши подключения с нужного IP адреса

---

### ШАГ 4: Проверь подключение

```bash
# Проверка через psql (если установлен)
psql -h ХОСТ_ИЗ_TIMEWEB -p 5432 -U gen_user -d default_db

# Или через Node.js тест
cd ~/payment-api
node -e "const { Pool } = require('pg'); const p = new Pool({host: 'ХОСТ', port: 5432, database: 'default_db', user: 'gen_user', password: 'dastan10dz'}); p.query('SELECT 1').then(() => console.log('✅ Подключение OK')).catch(e => console.log('❌ Ошибка:', e.message));"
```

---

### ШАГ 5: Тестирование API

```bash
curl -X POST http://ТВОЙ_СЕРВЕР:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "bank_name": "Test Bank",
    "package_name": "com.test",
    "amount": 100.50,
    "currency": "KGS",
    "raw_text": "Test payment"
  }'
```

---

## Проблемы и решения:

### Ошибка "Connection refused"
- Проверь что IP сервера добавлен в белый список Timeweb
- Проверь что порт 5432 не заблокирован firewall

### Ошибка "SSL required"
- В `api_server.js` измени `ssl: false` на `ssl: true`
- Или добавь SSL сертификат

### Ошибка "Database does not exist"
- Проверь правильность названия БД в настройках Timeweb

---

## Готов помочь настроить любой вариант!

Какой вариант выбираешь? Node.js API или PHP на Timeweb хостинге?

