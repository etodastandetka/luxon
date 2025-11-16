# Быстрая настройка MobCash API (Гибридный режим - Рекомендуется)

## ⚠️ Важно: MobCash API требует client_secret

MobCash API требует `client_secret` для обмена authorization code на access token, который недоступен публично. 

**Решение**: Используйте **готовые токены из браузера** + **логин/пароль для автоматического обновления**.

Система будет:
- Использовать готовые токены из `.env` (быстро)
- Автоматически обновлять их через OAuth2 flow при истечении (если настроены логин/пароль)

## 📋 Требуемые переменные в .env:

```env
# MobCash API - Готовые токены (обязательно)
MOBCASH_BEARER_TOKEN="ory_at_..."
MOBCASH_USER_ID="1985621306577461248"
MOBCASH_SESSION_ID="1988638502723461120"

# MobCash API - Логин/пароль для автоматического обновления (рекомендуется)
MOBCASH_LOGIN="burgoevk"
MOBCASH_PASSWORD="Kanat312###"
MOBCASH_CASHDESK_ID="1001098"
MOBCASH_DEFAULT_LAT=42.845778
MOBCASH_DEFAULT_LON=74.568778
```

## 🔧 Как получить токены из браузера:

1. Откройте https://app.mob-cash.com в браузере
2. Войдите в систему
3. Откройте DevTools (F12) → Network
4. Найдите запрос к `/api/` с методом `mobile.login`
5. В заголовках запроса найдите:
   - `Authorization: Bearer ory_at_...` → это `MOBCASH_BEARER_TOKEN`
   - В теле запроса найдите `userID` → это `MOBCASH_USER_ID`
   - В теле запроса найдите `sessionID` → это `MOBCASH_SESSION_ID`

## ✅ Как это работает:

- **Сначала**: Используются готовые токены из `.env` (быстро)
- **При истечении (401)**: Автоматически выполняется OAuth2 flow с логином/паролем
- **Новые токены**: Кешируются и используются дальше

## 🚀 После настройки:

1. **Проверьте конфигурацию:**
   ```bash
   cd admin_nextjs
   npm run check-mobcash-config
   ```
   
   Или используйте `npx`:
   ```bash
   npx tsx scripts/check-mobcash-config.ts
   ```

2. **Перезапустите сервис:**
   ```bash
   pm2 restart luxon-email-watcher
   ```

3. **Проверьте логи:**
   ```bash
   pm2 logs luxon-email-watcher --lines 100
   ```

4. **Ожидаемый результат:**
   - При первом запросе: `[MobCash Auth] 🔄 Starting OAuth2 flow with login: burgoevk`
   - При успешной авторизации: `[MobCash Auth] ✅ OAuth2 flow completed successfully`
   - При истечении токенов: автоматическое обновление через OAuth2

## ✅ Готово!

Система теперь будет автоматически обновлять токены при истечении. Никаких ручных действий не требуется!

