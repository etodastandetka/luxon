# Быстрая настройка MobCash API (Вариант 2 - Автоматический OAuth2)

## ✅ Вариант 2 настроен и готов к работе!

Система теперь использует **только логин/пароль** для автоматического OAuth2 flow.

## 📋 Требуемые переменные в .env:

```env
# MobCash API - Автоматический OAuth2 (Вариант 2)
MOBCASH_LOGIN="burgoevk"
MOBCASH_PASSWORD="Kanat312###"
MOBCASH_CASHDESK_ID="1001098"
MOBCASH_DEFAULT_LAT=42.845778
MOBCASH_DEFAULT_LON=74.568778
```

## 🔧 Важно:

**Закомментируйте или удалите старые токены** в `.env` для "чистого" варианта 2:

```env
# Старые токены - ЗАКОММЕНТИРОВАТЬ для варианта 2
# MOBCASH_BEARER_TOKEN="ory_at_..."
# MOBCASH_USER_ID="1985621306577461248"
# MOBCASH_SESSION_ID="1988638502723461120"
```

**Если оставить токены** - система будет работать в гибридном режиме:
- Сначала использует готовые токены (быстрее)
- При истечении автоматически обновляет через OAuth2

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

