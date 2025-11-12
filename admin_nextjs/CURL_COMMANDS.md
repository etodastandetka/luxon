# Исправленные curl команды для mob-cash OAuth2

## Проблема в оригинальной команде

❌ **Неправильно:**
```bash
--form 'response_type="code"'
```

✅ **Правильно:**
```bash
--data-urlencode 'response_type=code'
```

Разница:
- `--form` используется для `multipart/form-data`
- `--data-urlencode` используется для `application/x-www-form-urlencoded`

---

## Исправленная команда (Шаг 1.1: LoginChallenge)

```bash
curl -i -L -X POST 'https://admin.mob-cash.com/hydra/oauth2/auth' \
  --header 'Accept: application/json, text/plain, */*' \
  --header 'Accept-Language: en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7' \
  --header 'Connection: keep-alive' \
  --header 'Origin: https://app.mob-cash.com/' \
  --header 'Referer: https://app.mob-cash.com/login' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'response_type=code' \
  --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode 'scope=offline' \
  --data-urlencode 'client_id=4e779103-d67b-42ef-bc9d-ab5ecdec40f8' \
  --data-urlencode 'prompt=consent' \
  --data-urlencode 'state=Qm2WdqqCf0sUyqaiCOWWDrGOOKcYdvOV' \
  --cookie-jar /tmp/mobcash_cookies.txt \
  --cookie /tmp/mobcash_cookies.txt
```

**Изменения:**
1. `--form` → `--data-urlencode`
2. Убраны кавычки вокруг значений
3. Добавлен `-i` для показа заголовков ответа
4. Добавлен `-L` для следования редиректам
5. Добавлены `--cookie-jar` и `--cookie` для сохранения cookies

---

## Шаг 1.2: ConsentChallenge (после получения LoginChallenge)

```bash
# Сначала получите login_challenge из предыдущего запроса
LOGIN_CHALLENGE="ваш_login_challenge_здесь"

curl -i -L -X POST "https://admin.mob-cash.com/authentication/login?login_challenge=${LOGIN_CHALLENGE}" \
  --header 'Accept: application/json, text/plain, */*' \
  --header 'Accept-Language: en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7' \
  --header 'Connection: keep-alive' \
  --header 'Origin: https://app.mob-cash.com/' \
  --header 'Referer: https://app.mob-cash.com/login' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "nickname=burgoevk" \
  --data-urlencode "password=Kanat312###" \
  --data-urlencode "state=547f6922-61ec-47f8-8718-c7928dd8f6eb" \
  --data-urlencode "remember_me=true" \
  --cookie /tmp/mobcash_cookies.txt \
  --cookie-jar /tmp/mobcash_cookies.txt
```

---

## ⚠️ ВАЖНОЕ ПРЕДУПРЕЖДЕНИЕ

**OAuth2 flow через curl может не работать**, потому что:

1. **CSRF токены**: Требуются cookies с CSRF токенами, которые устанавливаются только при первом посещении в браузере
2. **Client Secret**: API требует `client_secret` для обмена authorization code на access token, но его нет в документации
3. **Сложность**: Полный OAuth2 flow требует множества редиректов и cookies

## ✅ РЕКОМЕНДУЕМОЕ РЕШЕНИЕ

**Используйте готовые токены из браузера:**

1. Откройте https://app.mob-cash.com в браузере
2. Войдите (логин: `burgoevk`, пароль: `Kanat312###`)
3. F12 → Network → найдите запрос `mobile.login`
4. Скопируйте токены из Headers и Payload
5. Добавьте в `.env` файл (см. `ENV_MOBCASH_ADD.txt`)

Это единственный надежный способ работы с API!

