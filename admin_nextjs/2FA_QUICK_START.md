# 🚀 Быстрый старт: Двухфакторная аутентификация

## Шаг 1: Установка зависимостей

```bash
cd admin_nextjs
npm install otplib qrcode @types/qrcode
```

## Шаг 2: Обновление базы данных

```bash
npm run db:push
```

Это применит изменения схемы Prisma и добавит поля для 2FA в таблицу `admin_users`.

## Шаг 3: Генерация Prisma Client

```bash
npm run db:generate
```

## Шаг 4: Готово! 🎉

Теперь 2FA доступна в системе. Пользователи могут:

1. **Настроить 2FA** через API `/api/auth/2fa/setup`
2. **Включить 2FA** через API `/api/auth/2fa/enable`
3. **Войти с 2FA** - система автоматически запросит токен, если 2FA включена
4. **Отключить 2FA** через API `/api/auth/2fa/disable`

## Тестирование

### 1. Настройка 2FA

```bash
# Получите токен авторизации сначала
curl -X GET http://localhost:3001/api/auth/2fa/setup \
  -H "Cookie: auth_token=YOUR_TOKEN"
```

### 2. Включение 2FA

```bash
curl -X POST http://localhost:3001/api/auth/2fa/enable \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "SECRET_FROM_SETUP",
    "token": "123456",
    "backupCodes": ["ABC12345", "DEF67890"]
  }'
```

### 3. Логин с 2FA

```bash
# Шаг 1: Логин (вернет requires2FA: true)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Шаг 2: Проверка 2FA токена
curl -X POST http://localhost:3001/api/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "token": "123456"
  }'
```

## Приложения-аутентификаторы

Рекомендуемые приложения:
- ✅ Google Authenticator (iOS/Android)
- ✅ Microsoft Authenticator (iOS/Android)
- ✅ Authy (iOS/Android/Desktop)
- ✅ 1Password (iOS/Android/Desktop)
- ✅ LastPass Authenticator (iOS/Android)

## Безопасность

- ✅ Секреты хранятся в БД
- ✅ Резервные коды одноразовые
- ✅ TOTP токены действительны 30 секунд
- ✅ Все API endpoints защищены rate limiting

## Важно

⚠️ **После обновления схемы БД обязательно запустите:**
```bash
npm run db:push
npm run db:generate
```

Иначе TypeScript будет выдавать ошибки о отсутствующих полях.

