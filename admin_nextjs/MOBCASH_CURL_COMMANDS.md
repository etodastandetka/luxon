# Mob-Cash OAuth2 Flow - Готовые curl команды

## Шаг 1.1: Получение LoginChallenge

```bash
# Сохраняем cookies в файл
curl -i --location 'https://admin.mob-cash.com/hydra/oauth2/auth' \
  --header 'Accept: application/json, text/plain, */*' \
  --header 'Origin: https://app.mob-cash.com/' \
  --header 'Referer: https://app.mob-cash.com/login' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
  --form 'response_type="code"' \
  --form 'grant_type="refresh_token"' \
  --form 'scope="offline"' \
  --form 'client_id="4e779103-d67b-42ef-bc9d-ab5ecdec40f8"' \
  --form 'prompt="consent"' \
  --form 'state="Qm2WdqqCf0sUyqaiCOWWDrGOOKcYdvOV"' \
  --cookie-jar /tmp/mobcash_cookies.txt \
  -L | grep -oP 'login_challenge=\K[^&]*' | head -1
```

**Или проще (сохраните login_challenge из Location header):**

```bash
curl -i 'https://admin.mob-cash.com/hydra/oauth2/auth' \
  --header 'Accept: application/json, text/plain, */*' \
  --header 'Origin: https://app.mob-cash.com/' \
  --header 'Referer: https://app.mob-cash.com/login' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
  --form 'response_type="code"' \
  --form 'grant_type="refresh_token"' \
  --form 'scope="offline"' \
  --form 'client_id="4e779103-d67b-42ef-bc9d-ab5ecdec40f8"' \
  --form 'prompt="consent"' \
  --form 'state="Qm2WdqqCf0sUyqaiCOWWDrGOOKcYdvOV"' \
  --cookie-jar /tmp/mobcash_cookies.txt
```

**Ответ:** Редирект на `/authentication/login?login_challenge=XXXXX` - сохраните `login_challenge` из Location header. Cookies сохранены в `/tmp/mobcash_cookies.txt`.

---

## Шаг 1.2: Получение ConsentChallenge

**ВАЖНО: Используйте cookies из шага 1.1!**

```bash
LOGIN_CHALLENGE="ВАШ_LOGIN_CHALLENGE_ИЗ_ШАГА_1.1"

curl -i --location "https://admin.mob-cash.com/authentication/login?login_challenge=${LOGIN_CHALLENGE}" \
  --header 'Accept: application/json, text/plain, */*' \
  --header 'Origin: https://app.mob-cash.com/' \
  --header 'Referer: https://app.mob-cash.com/login' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
  --form "nickname=\"burgoevk\"" \
  --form "password=\"Kanat312###\"" \
  --form "state=\"547f6922-61ec-47f8-8718-c7928dd8f6eb\"" \
  --form "remember_me=\"true\"" \
  --cookie /tmp/mobcash_cookies.txt \
  --cookie-jar /tmp/mobcash_cookies.txt
```

**Ответ:** JSON с `ConsentChallenge` - сохраните его. Cookies обновлены.

---

## Шаг 1.3: Получение access_token

**ВАЖНО: Используйте cookies из предыдущих шагов!**

```bash
CONSENT_CHALLENGE="ВАШ_CONSENT_CHALLENGE_ИЗ_ШАГА_1.2"

curl --location "https://admin.mob-cash.com/authentication/consent?consent_challenge=${CONSENT_CHALLENGE}" \
  --header 'Accept: application/json, text/plain, */*' \
  --header 'Origin: https://app.mob-cash.com' \
  --header 'Referer: https://app.mob-cash.com' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
  --form 'client_id="4e779103-d67b-42ef-bc9d-ab5ecdec40f8"' \
  --form 'grant_scope="offline"' \
  --form 'state="547f6922-61ec-47f8-8718-c7928dd8f6eb"' \
  --cookie /tmp/mobcash_cookies.txt \
  --cookie-jar /tmp/mobcash_cookies.txt
```

**Ответ:** JSON с `access_token` - сохраните его!

---

## Шаг 1.4: Получение User ID

**Замените `ACCESS_TOKEN` на токен из шага 1.3**

```bash
ACCESS_TOKEN="ВАШ_ACCESS_TOKEN_ИЗ_ШАГА_1.3"

curl 'https://admin.mob-cash.com/api/' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json' \
  -H 'origin: https://app.mob-cash.com' \
  -H 'referer: https://app.mob-cash.com/' \
  -H 'user-agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' \
  -H 'x-request-source: pwa' \
  --data-raw '[{"jsonrpc":"2.0","id":11,"method":"user.profile","params":{}}]'
```

**Ответ:** JSON с `id` пользователя - сохраните его.

---

## Шаг 1.5: Логин на кассу (получение Session ID)

**Замените `ACCESS_TOKEN`, `USER_ID`, `CASHDESK_ID`, `LAT`, `LON`**

```bash
ACCESS_TOKEN="ВАШ_ACCESS_TOKEN_ИЗ_ШАГА_1.3"
USER_ID="ВАШ_USER_ID_ИЗ_ШАГА_1.4"
CASHDESK_ID="1001098"
LAT="42.845778"
LON="74.568778"

curl 'https://admin.mob-cash.com/api/' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json' \
  -H 'origin: https://app.mob-cash.com' \
  -H 'referer: https://app.mob-cash.com/' \
  -H 'user-agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' \
  -H 'x-request-source: pwa' \
  --data-raw "[{\"jsonrpc\":\"2.0\",\"id\":12,\"method\":\"mobile.login\",\"params\":{\"location\":{\"lat\":${LAT},\"lon\":${LON}},\"cashboxCode\":${CASHDESK_ID},\"userID\":\"${USER_ID}\"}}]"
```

**Ответ:** JSON с данными кассы, включая `sessionId` - сохраните его.

---

## Итоговые переменные для .env

После выполнения всех шагов добавьте в `.env`:

```env
MOBCASH_BEARER_TOKEN="ory_at_XXXXX"
MOBCASH_USER_ID="1955911305411895206"
MOBCASH_SESSION_ID="sessionId_из_шага_1.5"
```

