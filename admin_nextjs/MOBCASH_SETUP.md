# Настройка Mob-Cash API

## Проблема с авторизацией

API mob-cash требует cookies с CSRF токенами для авторизации, которые устанавливаются только в браузере. Для работы через API необходимо получить токены один раз через браузер и сохранить их в `.env` файле.

## Как получить токены через браузер

### Шаг 1: Откройте браузер и войдите в систему

1. Откройте https://app.mob-cash.com в браузере
2. Войдите в систему с вашими учетными данными:
   - Логин: `burgoevk`
   - Пароль: `Kanat312###`

### Шаг 2: Откройте DevTools

1. Нажмите `F12` или `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (Mac)
2. Перейдите на вкладку **Network** (Сеть)
3. Обновите страницу (`F5`)

### Шаг 3: Найдите запросы к API

1. В списке запросов найдите запросы к `admin.mob-cash.com/api/`
   - Это будут POST-запросы, не GET-запросы к HTML-страницам
   - Ищите запросы с методами: `mobile.login`, `user.profile`, `mobile.payerNickname`, `mobile.deposit` и т.д.
2. Откройте любой запрос к API (например, `mobile.login` или `user.profile`)
3. Перейдите на вкладку **Headers** (Заголовки)

### Шаг 4: Скопируйте токены

**В заголовках запроса (Request Headers) найдите:**

1. **Authorization**: `Bearer ory_at_mlFJjo6xzmE0sz23113z5p5ZVmGP5ZnJydoMOMDkOjQo...`
   - Это ваш `MOBCASH_BEARER_TOKEN`
   - Скопируйте только часть после `Bearer ` (без слова "Bearer")

**В теле запроса (Payload/Request Payload) найдите:**

2. Откройте вкладку **Payload** или **Request** → **Payload**
3. Найдите JSON с параметрами:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 12,
     "method": "mobile.login",
     "params": {
       "userID": "1955911305411895296",  ← это ваш MOBCASH_USER_ID
       "sessionID": "1986068554788577280", ← это ваш MOBCASH_SESSION_ID
       ...
     }
   }
   ```
   - `userID` → это ваш `MOBCASH_USER_ID`
   - `sessionID` → это ваш `MOBCASH_SESSION_ID`

### Шаг 5: Добавьте токены в .env

Добавьте в файл `.env` на сервере:

```env
# Mob-cash API токены (полученные через браузер)
# ВАЖНО: Замените значения на ваши реальные токены из браузера!

# Bearer token из заголовка Authorization (без слова "Bearer")
MOBCASH_BEARER_TOKEN="ory_at_mlFJjo6xzmE0sz23113z5p5ZVmGP5ZnJydoMOMDkOjQo.joX3zGJzfOTxEkVwGVLv2Di5nafJxfCuMCKOMVnOqZk"

# User ID из тела запроса (params.userID)
MOBCASH_USER_ID="1955911305411895296"

# Session ID из тела запроса (params.sessionID)
MOBCASH_SESSION_ID="1986068554788577280"
```

**Важно:** 
- Замените все значения на ваши реальные токены!
- Bearer token должен начинаться с `ory_at_`
- User ID и Session ID - это строки с цифрами

### Шаг 6: Перезапустите приложение

```bash
pm2 restart admin_nextjs
# или
sudo systemctl restart luxon-admin
```

## Альтернативный способ: использование готовых токенов

Если у вас уже есть рабочие токены, просто добавьте их в `.env`:

```env
MOBCASH_LOGIN="burgoevk"
MOBCASH_PASSWORD="Kanat312###"
MOBCASH_CASHDESK_ID="1001098"
MOBCASH_BEARER_TOKEN="ваш_токен_здесь"
MOBCASH_USER_ID="ваш_user_id_здесь"
MOBCASH_SESSION_ID="ваш_session_id_здесь"
```

## Проверка работы

После добавления токенов попробуйте выполнить пополнение баланса. Если токены валидны, авторизация будет пропущена и будут использованы готовые токены.

## Обновление токенов

Токены могут истечь. В этом случае:
1. Повторите шаги 1-5 для получения новых токенов
2. Обновите значения в `.env`
3. Перезапустите приложение

