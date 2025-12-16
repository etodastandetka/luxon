# Автоматическое обновление токенов MobCash через Python скрипт

## Описание

Python скрипт `update_mobcash_tokens.py` автоматически выполняет полный OAuth2 flow для получения токенов MobCash API и сохраняет их в файл `.mobcash_tokens.json`. Админка автоматически читает эти токены из файла.

## Установка

1. Создайте виртуальное окружение Python:
```bash
cd /var/www/luxon/admin_nextjs
python3 -m venv venv
```

2. Активируйте виртуальное окружение:
```bash
source venv/bin/activate
```

3. Установите необходимые библиотеки:
```bash
pip install requests
```

4. Установите переменные окружения в `.env` файле:
```env
MOBCASH_LOGIN=ваш_логин
MOBCASH_PASSWORD=ваш_пароль
MOBCASH_CASHDESK_ID=1001098
MOBCASH_DEFAULT_LAT=42.845778
MOBCASH_DEFAULT_LON=74.568778
```

## Использование

### Ручной запуск

**Важно:** Сначала убедитесь, что код обновлен на сервере:
```bash
cd /var/www/luxon/admin_nextjs
git pull origin main
```

Затем запустите скрипт:
```bash
cd /var/www/luxon/admin_nextjs
source venv/bin/activate
python3 scripts/update_mobcash_tokens.py
```

### Автоматическое обновление через cron (каждые 20 часов)

Добавьте в crontab:
```bash
crontab -e
```

Добавьте строку:
```
0 */20 * * * cd /var/www/luxon/admin_nextjs && /var/www/luxon/admin_nextjs/venv/bin/python3 scripts/update_mobcash_tokens.py >> /var/log/mobcash_tokens.log 2>&1
```

Или используйте активацию venv:
```
0 */20 * * * cd /var/www/luxon/admin_nextjs && source venv/bin/activate && python3 scripts/update_mobcash_tokens.py >> /var/log/mobcash_tokens.log 2>&1
```

Это будет запускать скрипт каждые 20 часов.

### Проверка токенов

Для просмотра текущих токенов:
```bash
cd /var/www/luxon/admin_nextjs
source venv/bin/activate
python3 scripts/read_mobcash_tokens.py
```

## Как это работает

1. Скрипт выполняет 5 шагов OAuth2 авторизации:
   - Шаг 1.1: Получение LoginChallenge
   - Шаг 1.2: Получение ConsentChallenge (с логином и паролем)
   - Шаг 1.3: Получение access_token
   - Шаг 1.4: Получение userID
   - Шаг 1.5: Получение sessionID (логин на кассу)

2. Токены сохраняются в файл `.mobcash_tokens.json`:
```json
{
  "bearer_token": "ory_at_...",
  "user_id": "1955911305411895296",
  "session_id": "1986068554788577280",
  "updated_at": "2025-01-20T12:00:00",
  "expires_at": 1737374400
}
```

3. Админка автоматически читает токены из этого файла при каждом запросе к MobCash API.

## Автоматический запуск каждые 20 часов

### Вариант 1: Через PM2 (рекомендуется)

1. Установите PM2, если еще не установлен:
```bash
npm install -g pm2
```

2. Запустите скрипт через PM2:
```bash
cd /var/www/luxon/admin_nextjs
pm2 start ecosystem.mobcash.config.js
pm2 save
```

3. PM2 будет запускать скрипт каждые 20 часов автоматически.

4. Проверьте статус:
```bash
pm2 status
pm2 logs mobcash-token-updater
```

### Вариант 2: Через Cron

1. Сделайте wrapper скрипт исполняемым:
```bash
chmod +x /var/www/luxon/admin_nextjs/scripts/run_mobcash_update.sh
```

2. Добавьте в crontab:
```bash
crontab -e
```

3. Добавьте строку (запуск каждые 20 часов):
```cron
0 */20 * * * /var/www/luxon/admin_nextjs/scripts/run_mobcash_update.sh >> /var/log/mobcash_tokens.log 2>&1
```

4. Или используйте более точное расписание (например, в 00:00, 20:00):
```cron
0 0,20 * * * /var/www/luxon/admin_nextjs/scripts/run_mobcash_update.sh >> /var/log/mobcash_tokens.log 2>&1
```

## Интеграция с админкой

Админка автоматически использует токены из файла `.mobcash_tokens.json`, если он существует. Если файла нет или токены истекли, админка использует токены из переменных окружения или выполняет OAuth2 flow (если указаны логин и пароль).

Приоритет использования токенов:
1. Токены из файла `.mobcash_tokens.json` (созданного Python скриптом)
2. Токены из переменных окружения (`MOBCASH_BEARER_TOKEN`, `MOBCASH_USER_ID`, `MOBCASH_SESSION_ID`)
3. OAuth2 flow с логином и паролем (если указаны `MOBCASH_LOGIN` и `MOBCASH_PASSWORD`)

## Логи

Скрипт выводит подробные логи в консоль. При запуске через cron логи сохраняются в `/var/log/mobcash_tokens.log`.

## Устранение неполадок

### Ошибка "MOBCASH_LOGIN и MOBCASH_PASSWORD должны быть установлены"
Убедитесь, что переменные окружения установлены в `.env` файле.

### Ошибка "LoginChallenge не найден"
Проверьте подключение к интернету и доступность `https://admin.mob-cash.com`.

### Токены не обновляются
Проверьте права доступа к файлу `.mobcash_tokens.json`:
```bash
chmod 644 .mobcash_tokens.json
```

### Cron не запускает скрипт
Проверьте логи cron:
```bash
grep CRON /var/log/syslog
```

Убедитесь, что путь к Python правильный:
```bash
which python3
```

