# Использование NodeJS шаблона из Timeweb

## Если выберешь NodeJS в Timeweb:

### ШАГ 1: Скопируй NodeJS код из Timeweb

1. В панели выбери "NodeJS" как способ подключения
2. Скопируй код подключения - он будет содержать правильные данные

### ШАГ 2: Обнови api_server.js

В файле `api_server.js` замени секцию подключения на код из Timeweb:

```javascript
// Вместо старого кода:
const pool = new Pool({
    host: '89.23.117.61',  // <-- замени на хост из Timeweb
    port: 5432,
    database: 'default_db',
    user: 'gen_user',
    password: 'dastan10dz',
    // Возможно Timeweb требует SSL:
    ssl: {
        rejectUnauthorized: false  // если нужно
    }
});
```

### ШАГ 3: Запусти сервер

```bash
cd ~/payment-api  # или где у тебя api_server.js
node api_server.js
```

---

## Timeweb предоставит точные данные подключения!

Используй их вместо общих настроек - там уже будут правильные хосты, порты и возможно SSL настройки.

