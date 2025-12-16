#!/bin/bash
# Полный OAuth2 flow через curl
# Использование: bash scripts/test-curl-full-oauth.sh

set -e  # Остановка при ошибке

echo "🧪 Полный OAuth2 flow через curl"
echo "============================================================"
echo ""

# Шаг 1.1: Получение LoginChallenge
echo "🔐 Шаг 1.1: Получение LoginChallenge..."
echo ""

RESPONSE1=$(curl -s -i -X POST 'https://admin.mob-cash.com/hydra/oauth2/auth' \
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
  -L)

# Извлекаем cookies
COOKIES=$(echo "$RESPONSE1" | grep -i "set-cookie" | sed 's/Set-Cookie: //' | head -1 | cut -d';' -f1 | tr -d '\r')
if [ -z "$COOKIES" ]; then
  # Пробуем из cookie jar
  COOKIES=$(cat /tmp/mobcash_cookies.txt 2>/dev/null | grep -v "^#" | awk '{print $6"="$7}' | tr '\n' '; ' | sed 's/; $//')
fi

# Извлекаем login_challenge из Location header
LOCATION=$(echo "$RESPONSE1" | grep -i "^location:" | head -1 | cut -d' ' -f2- | tr -d '\r')
LOGIN_CHALLENGE=$(echo "$LOCATION" | grep -oP 'login_challenge=\K[^&]*' || echo "")

if [ -z "$LOGIN_CHALLENGE" ]; then
  echo "❌ Ошибка: не удалось получить LoginChallenge"
  echo "Ответ:"
  echo "$RESPONSE1" | head -30
  exit 1
fi

echo "✅ LoginChallenge: $LOGIN_CHALLENGE"
echo "✅ Cookies: ${COOKIES:0:80}..."
echo ""

# Шаг 1.2: Получение ConsentChallenge через логин
echo "🔐 Шаг 1.2: Получение ConsentChallenge (логин)..."
echo ""

RESPONSE2=$(curl -s -i -X POST "https://admin.mob-cash.com/authentication/login?login_challenge=${LOGIN_CHALLENGE}" \
  --header 'Accept: application/json, text/plain, */*' \
  --header 'Accept-Language: en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7' \
  --header 'Connection: keep-alive' \
  --header 'Origin: https://app.mob-cash.com/' \
  --header 'Referer: https://app.mob-cash.com/login' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --header "Cookie: ${COOKIES}" \
  --data-urlencode "nickname=burgoevk" \
  --data-urlencode "password=Kanat312###" \
  --data-urlencode "state=547f6922-61ec-47f8-8718-c7928dd8f6eb" \
  --data-urlencode "remember_me=true" \
  --cookie-jar /tmp/mobcash_cookies.txt \
  --cookie /tmp/mobcash_cookies.txt \
  -L)

# Обновляем cookies
COOKIES=$(cat /tmp/mobcash_cookies.txt 2>/dev/null | grep -v "^#" | awk '{print $6"="$7}' | tr '\n' '; ' | sed 's/; $//')

# Извлекаем login_verifier и consent_challenge
LOCATION2=$(echo "$RESPONSE2" | grep -i "^location:" | head -1 | cut -d' ' -f2- | tr -d '\r')
LOGIN_VERIFIER=$(echo "$LOCATION2" | grep -oP 'login_verifier=\K[^&]*' || echo "")

if [ -n "$LOGIN_VERIFIER" ]; then
  echo "✅ Login Verifier: $LOGIN_VERIFIER"
  
  # Следуем редиректу для получения consent_challenge
  RESPONSE2B=$(curl -s -i -L "$LOCATION2" \
    --header 'Accept: application/json, text/plain, */*' \
    --header "Cookie: ${COOKIES}" \
    --cookie-jar /tmp/mobcash_cookies.txt \
    --cookie /tmp/mobcash_cookies.txt)
  
  LOCATION2B=$(echo "$RESPONSE2B" | grep -i "^location:" | head -1 | cut -d' ' -f2- | tr -d '\r')
  CONSENT_CHALLENGE=$(echo "$LOCATION2B" | grep -oP 'consent_challenge=\K[^&]*' || echo "")
else
  CONSENT_CHALLENGE=$(echo "$RESPONSE2" | grep -oP 'consent_challenge=\K[^&]*' || echo "")
fi

if [ -z "$CONSENT_CHALLENGE" ]; then
  echo "❌ Ошибка: не удалось получить ConsentChallenge"
  echo "Ответ:"
  echo "$RESPONSE2" | head -30
  exit 1
fi

echo "✅ ConsentChallenge: $CONSENT_CHALLENGE"
echo ""

# Шаг 1.3: Получение Access Token
echo "🔐 Шаг 1.3: Получение Access Token..."
echo ""

RESPONSE3=$(curl -s -i -X POST "https://admin.mob-cash.com/authentication/consent?consent_challenge=${CONSENT_CHALLENGE}" \
  --header 'Accept: application/json, text/plain, */*' \
  --header 'Accept-Language: en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7' \
  --header 'Connection: keep-alive' \
  --header 'Origin: https://app.mob-cash.com' \
  --header 'Referer: https://app.mob-cash.com' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --header "Cookie: ${COOKIES}" \
  --data-urlencode 'client_id=4e779103-d67b-42ef-bc9d-ab5ecdec40f8' \
  --data-urlencode 'grant_scope=offline' \
  --data-urlencode 'state=547f6922-61ec-47f8-8718-c7928dd8f6eb' \
  --cookie-jar /tmp/mobcash_cookies.txt \
  --cookie /tmp/mobcash_cookies.txt \
  -L)

# Извлекаем authorization code из редиректа
LOCATION3=$(echo "$RESPONSE3" | grep -i "^location:" | head -1 | cut -d' ' -f2- | tr -d '\r')
AUTH_CODE=$(echo "$LOCATION3" | grep -oP 'code=\K[^&]*' || echo "")

if [ -z "$AUTH_CODE" ]; then
  echo "❌ Ошибка: не удалось получить authorization code"
  echo "Ответ:"
  echo "$RESPONSE3" | head -30
  exit 1
fi

echo "✅ Authorization Code: ${AUTH_CODE:0:50}..."
echo ""

# Обмениваем код на токен
echo "🔐 Шаг 1.4: Обмен authorization code на access token..."
echo ""

TOKEN_RESPONSE=$(curl -s -X POST 'https://admin.mob-cash.com/hydra/oauth2/token' \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=${AUTH_CODE}" \
  --data-urlencode "client_id=4e779103-d67b-42ef-bc9d-ab5ecdec40f8" \
  --data-urlencode "redirect_uri=https://app.mob-cash.com")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -oP '"access_token":"\K[^"]*' || echo "")

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Ошибка: не удалось получить access token"
  echo "Ответ: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Access Token: ${ACCESS_TOKEN:0:50}..."
echo ""

# Шаг 1.5: Получение User ID
echo "🔐 Шаг 1.5: Получение User ID..."
echo ""

USER_PROFILE_RESPONSE=$(curl -s -X POST 'https://admin.mob-cash.com/api/' \
  --header 'Accept: application/json, text/plain, */*' \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --header 'Content-Type: application/json' \
  --header 'Origin: https://app.mob-cash.com' \
  --header 'Referer: https://app.mob-cash.com/' \
  --header 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' \
  --header 'x-request-source: pwa' \
  --data '[{"jsonrpc":"2.0","id":11,"method":"user.profile","params":{}}]')

USER_ID=$(echo "$USER_PROFILE_RESPONSE" | grep -oP '"id":"\K[^"]*' | head -1 || echo "")

if [ -z "$USER_ID" ]; then
  echo "❌ Ошибка: не удалось получить User ID"
  echo "Ответ: $USER_PROFILE_RESPONSE"
  exit 1
fi

echo "✅ User ID: $USER_ID"
echo ""

# Шаг 1.6: Логин на кассу (Session ID)
echo "🔐 Шаг 1.6: Логин на кассу (получение Session ID)..."
echo ""

LOGIN_RESPONSE=$(curl -s -X POST 'https://admin.mob-cash.com/api/' \
  --header 'Accept: application/json, text/plain, */*' \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --header 'Content-Type: application/json' \
  --header 'Origin: https://app.mob-cash.com' \
  --header 'Referer: https://app.mob-cash.com/' \
  --header 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' \
  --header 'x-request-source: pwa' \
  --data "[{\"jsonrpc\":\"2.0\",\"id\":12,\"method\":\"mobile.login\",\"params\":{\"location\":{\"lat\":42.845778,\"lon\":74.568778},\"cashboxCode\":1001098,\"userID\":\"${USER_ID}\"}}]")

SESSION_ID=$(echo "$LOGIN_RESPONSE" | grep -oP '"sessionID":"\K[^"]*' || echo "$LOGIN_RESPONSE" | grep -oP '"session_id":"\K[^"]*' || echo "$LOGIN_RESPONSE" | grep -oP '"id":"\K[^"]*' | head -1 || echo "")

if [ -z "$SESSION_ID" ]; then
  echo "⚠️  Session ID не найден, но запрос может быть успешным"
  echo "Ответ: $LOGIN_RESPONSE"
else
  echo "✅ Session ID: $SESSION_ID"
fi

echo ""
echo "============================================================"
echo "✅ АВТОРИЗАЦИЯ УСПЕШНА!"
echo "============================================================"
echo ""
echo "📋 Полученные токены:"
echo "   Bearer Token: ${ACCESS_TOKEN}"
echo "   User ID: ${USER_ID}"
echo "   Session ID: ${SESSION_ID:-не найден}"
echo ""
echo "📝 Добавьте в .env файл:"
echo "MOBCASH_BEARER_TOKEN=\"${ACCESS_TOKEN}\""
echo "MOBCASH_USER_ID=\"${USER_ID}\""
if [ -n "$SESSION_ID" ]; then
  echo "MOBCASH_SESSION_ID=\"${SESSION_ID}\""
fi
echo ""
echo "============================================================"

