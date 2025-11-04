# Варианты интеграции с PostgreSQL Timeweb

## Ваша ситуация:
- База данных PostgreSQL куплена в Timeweb (отдельно)
- Нужно отправлять данные из Android приложения

## Вариант 1: Node.js API на вашем веб-сервере ⭐ РЕКОМЕНДУЮ

Если у вас есть доступ к серверу (VPS/хостинг) - используйте Node.js API.

### Преимущества:
- ✅ Проще настройка чем PHP
- ✅ Быстрее работает
- ✅ Уже есть готовый код в проекте (`api_server.js`)

### Шаги:

1. **Проверь что Node.js установлен:**
```bash
node --version
npm --version
```

2. **Если нет - установи:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Создай папку и скопируй api_server.js:**
```bash
mkdir ~/api-server
cd ~/api-server
# Скопируй туда api_server.js из проекта
```

4. **Установи зависимости:**
```bash
npm install express pg
```

5. **Настрой подключение к Timeweb:**
В файле `api_server.js` уже указаны данные, но проверь что они правильные:
- host: IP адрес базы Timeweb (обычно в панели Timeweb указан)
- port: обычно 5432
- database: название БД
- user: пользователь БД
- password: пароль БД

6. **Запусти сервер:**
```bash
node api_server.js
```

7. **Проверь работу:**
```bash
curl http://localhost:3000/health
```

8. **Настрой автозапуск (PM2):**
```bash
npm install -g pm2
pm2 start api_server.js --name payment-api
pm2 save
pm2 startup
```

9. **Открой порт в firewall:**
```bash
sudo ufw allow 3000/tcp
```

10. **В Android приложении измени URL:**
В `DatabaseConfig.kt`:
```kotlin
const val API_BASE_URL = "http://ВАШ_СЕРВЕР:3000"
```

---

## Вариант 2: Python Flask API

Аналогично Node.js, но на Python.

### Шаги:
```bash
# Установи Python и зависимости
sudo apt-get install python3 python3-pip

# Создай файл app.py (скопируй из проекта)
pip3 install flask flask-cors psycopg2-binary

# Запусти
python3 app.py
```

---

## Вариант 3: Использовать PHP на Timeweb

Если у вас хостинг в Timeweb - можешь использовать PHP скрипт.

### Важно:
В панели Timeweb нужно разрешить подключение к БД с IP адреса вашего хостинга.

---

## Вариант 4: Supabase (самый простой) ⭐⭐⭐

Если не хочешь настраивать сервер - используй Supabase:

1. Экспортируй данные из Timeweb в Supabase
2. Supabase даст готовый REST API
3. Никаких настроек сервера не нужно

---

## Настройка доступа в панели Timeweb

### Если используешь внешний сервер:

1. Войди в панель Timeweb
2. Найди свою БД PostgreSQL
3. Добавь IP адрес веб-сервера в список разрешенных IP
4. Или разреши подключения с `0.0.0.0/0` (все IP) для теста

### Проверка доступности БД:

```bash
# С твоего веб-сервера проверь подключение
psql -h IP_TIMEWEB -p 5432 -U username -d database_name
```

---

## Какой вариант выбрать?

| Вариант | Сложность | Время | Где работает |
|---------|-----------|-------|--------------|
| **Node.js API** | ⭐⭐ Средне | 15 мин | На твоем сервере |
| **Python Flask** | ⭐⭐ Средне | 15 мин | На твоем сервере |
| **PHP на Timeweb** | ⭐⭐⭐ Сложно | 1 час | На Timeweb хостинге |
| **Supabase** | ⭐ Очень просто | 5 мин | Облако Supabase |

---

## Рекомендация: Node.js API

Самый простой и надежный вариант если есть доступ к серверу.

Могу помочь настроить любой вариант! Какой выбираешь?

