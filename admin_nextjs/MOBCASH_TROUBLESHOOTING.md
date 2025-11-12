# Решение проблем с Mob-Cash API

## Ошибка: "Failed to get consent challenge: 403 Forbidden"

Эта ошибка означает, что OAuth2 flow не может пройти из-за проблем с cookies.

### Решение 1: Использовать готовые токены (рекомендуется)

Добавьте в `.env` на сервере токены, полученные через браузер:

```env
MOBCASH_BEARER_TOKEN="ory_at_ваш_токен_здесь"
MOBCASH_USER_ID="ваш_user_id_здесь"
MOBCASH_SESSION_ID="ваш_session_id_здесь"
```

**Как получить токены:**
1. Откройте https://app.mob-cash.com в браузере
2. Войдите в систему
3. Откройте DevTools (F12) → Network
4. Найдите запрос `mobile.login` к `admin.mob-cash.com/api/`
5. Скопируйте:
   - `Authorization: Bearer ory_at_...` → `MOBCASH_BEARER_TOKEN`
   - Из Payload: `userID` → `MOBCASH_USER_ID`
   - Из Payload: `sessionID` → `MOBCASH_SESSION_ID`

### Решение 2: Установить fetch-cookie на сервере

Если хотите использовать OAuth2 flow (автоматическую авторизацию):

```bash
cd /var/www/luxon/admin_nextjs
npm install fetch-cookie tough-cookie
npm run build
pm2 restart admin_nextjs
```

### Проверка

После добавления токенов в `.env` и перезапуска, в логах должно появиться:

```
[MobCash Auth] Using provided tokens from config (skipping OAuth2 flow)
[MobCash Auth] Bearer token: ory_at_...
[MobCash Auth] User ID: ...
[MobCash Auth] Session ID: ...
```

Если видите:
```
[MobCash Auth] Tokens not provided, attempting OAuth2 flow...
```

Это означает, что токены не передаются из `.env`. Проверьте:
1. Файл `.env` существует в `admin_nextjs/`
2. Переменные названы правильно: `MOBCASH_BEARER_TOKEN`, `MOBCASH_USER_ID`, `MOBCASH_SESSION_ID`
3. После изменения `.env` перезапущен процесс: `pm2 restart admin_nextjs`

## Ошибка: "fetch-cookie not available"

Это предупреждение означает, что `fetch-cookie` не установлен. Это нормально, если вы используете готовые токены из `.env`.

Если хотите использовать OAuth2 flow, установите зависимости (см. Решение 2 выше).

## Координаты

Если получаете ошибку "cashbox out of work area", используйте координаты из браузера:

```env
MOBCASH_DEFAULT_LAT="42.845778"
MOBCASH_DEFAULT_LON="74.568778"
```

Текущие дефолтные координаты уже установлены на эти значения.

