# Быстрая инструкция: Как получить токены mob-cash

## Где искать токены в браузере

### 1. Откройте DevTools
- Нажмите `F12` или `Ctrl+Shift+I`
- Перейдите на вкладку **Network** (Сеть)

### 2. Найдите запросы к API
**ВАЖНО:** Нужны запросы к `admin.mob-cash.com/api/`, а НЕ к `app.mob-cash.com`

Ищите запросы типа:
- `mobile.login`
- `user.profile`
- `mobile.payerNickname`
- `mobile.deposit`

### 3. Откройте запрос и найдите токены

#### Bearer Token (MOBCASH_BEARER_TOKEN)
1. Откройте запрос к API
2. Вкладка **Headers** → **Request Headers**
3. Найдите `Authorization: Bearer ory_at_...`
4. Скопируйте только часть после `Bearer ` (без слова "Bearer")

Пример:
```
Authorization: Bearer ory_at_mlFJjo6xzmE0sz23113z5p5ZVmGP5ZnJydoMOMDkOjQo.joX3zGJzfOTxEkVwGVLv2Di5nafJxfCuMCKOMVnOqZk
```
→ Скопируйте: `ory_at_mlFJjo6xzmE0sz23113z5p5ZVmGP5ZnJydoMOMDkOjQo.joX3zGJzfOTxEkVwGVLv2Di5nafJxfCuMCKOMVnOqZk`

#### User ID (MOBCASH_USER_ID) и Session ID (MOBCASH_SESSION_ID)
1. Откройте запрос к API
2. Вкладка **Payload** или **Request** → **Payload**
3. Найдите JSON с параметрами:

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "mobile.login",
  "params": {
    "userID": "1955911305411895296",     ← это MOBCASH_USER_ID
    "sessionID": "1986068554788577280",   ← это MOBCASH_SESSION_ID
    "location": {...},
    "cashboxCode": 1001098
  }
}
```

### 4. Добавьте в .env

```env
MOBCASH_BEARER_TOKEN="ваш_bearer_token_здесь"
MOBCASH_USER_ID="ваш_user_id_здесь"
MOBCASH_SESSION_ID="ваш_session_id_здесь"
```

### 5. Перезапустите приложение

```bash
pm2 restart admin_nextjs
```

## Если не видите запросы к API

1. Убедитесь, что вы вошли в систему на https://app.mob-cash.com
2. Выполните какое-либо действие (например, проверку аккаунта или пополнение)
3. В DevTools → Network обновите список запросов (может быть фильтр)
4. Ищите запросы к домену `admin.mob-cash.com`, а не `app.mob-cash.com`

## Проверка

После добавления токенов попробуйте выполнить пополнение баланса. Если токены валидны, ошибка "No CSRF value available" должна исчезнуть.

