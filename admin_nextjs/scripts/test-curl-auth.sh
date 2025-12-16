#!/bin/bash
# Тестовый скрипт для проверки OAuth2 flow через curl
# Использование: bash scripts/test-curl-auth.sh

echo "🧪 Тестирование OAuth2 flow через curl"
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
  -L)

echo "Ответ:"
echo "$RESPONSE1" | head -20
echo ""

# Извлекаем cookies
COOKIES=$(echo "$RESPONSE1" | grep -i "set-cookie" | sed 's/Set-Cookie: //' | head -1 | cut -d';' -f1)
echo "Cookies: $COOKIES"
echo ""

# Извлекаем login_challenge из Location header
LOCATION=$(echo "$RESPONSE1" | grep -i "location:" | head -1 | cut -d' ' -f2- | tr -d '\r')
echo "Location: $LOCATION"
echo ""

if [ -z "$LOCATION" ]; then
  echo "❌ Ошибка: не удалось получить Location header"
  echo "Полный ответ:"
  echo "$RESPONSE1"
  exit 1
fi

# Извлекаем login_challenge из URL
LOGIN_CHALLENGE=$(echo "$LOCATION" | grep -oP 'login_challenge=\K[^&]*' || echo "")
echo "Login Challenge: $LOGIN_CHALLENGE"
echo ""

if [ -z "$LOGIN_CHALLENGE" ]; then
  echo "❌ Ошибка: не удалось извлечь login_challenge"
  exit 1
fi

echo "✅ LoginChallenge получен: $LOGIN_CHALLENGE"
echo ""
echo "============================================================"
echo "⚠️  ВАЖНО: OAuth2 flow требует cookies с CSRF токенами,"
echo "   которые устанавливаются только в браузере."
echo ""
echo "   Для работы API необходимо получить токены через браузер:"
echo "   1. Откройте https://app.mob-cash.com в браузере"
echo "   2. Войдите (логин: burgoevk, пароль: Kanat312###)"
echo "   3. F12 → Network → найдите запрос 'mobile.login'"
echo "   4. Скопируйте токены из Headers и Payload"
echo ""
echo "   См. MOBCASH_SETUP.md для подробных инструкций"
echo "============================================================"

