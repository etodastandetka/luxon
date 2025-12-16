#!/bin/bash
# Безопасный скрипт для получения mob-cash токенов
# НЕ прерывает SSH сессию при ошибках
# Использование: bash scripts/get-mobcash-tokens.sh

# Отключаем немедленный выход при ошибках
set +e
# Игнорируем ошибки в pipe
set +o pipefail

# Trap для обработки ошибок - не выходим из скрипта
trap 'echo "⚠️  Ошибка на строке $LINENO, но продолжаем..."; true' ERR

echo "🧪 Получение mob-cash токенов через OAuth2"
echo "============================================================"
echo ""

# Очищаем старые cookies
rm -f /tmp/mobcash_cookies.txt 2>/dev/null || true

# Шаг 1.1: Получение LoginChallenge
echo "🔐 Шаг 1.1: Получение LoginChallenge..."
echo ""

RESPONSE1=$(curl -s --max-time 30 -i -X POST 'https://admin.mob-cash.com/hydra/oauth2/auth' \
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
  -L 2>&1) || true

# Извлекаем login_challenge
LOCATION1=$(echo "$RESPONSE1" | grep -i "^location:" | head -1 | cut -d' ' -f2- | tr -d '\r' 2>/dev/null || echo "")
LOGIN_CHALLENGE=$(echo "$LOCATION1" | grep -oP 'login_challenge=\K[^&]*' 2>/dev/null || echo "")

if [ -z "$LOGIN_CHALLENGE" ]; then
  echo "❌ Ошибка: не удалось получить LoginChallenge"
  echo "Попробуйте еще раз или используйте токены из браузера"
  echo ""
  echo "Для получения токенов через браузер:"
  echo "1. Откройте https://app.mob-cash.com"
  echo "2. Войдите (логин: burgoevk, пароль: Kanat312###)"
  echo "3. F12 → Network → найдите запрос 'mobile.login'"
  echo "4. Скопируйте токены из Headers и Payload"
  echo ""
  # НЕ выходим - просто завершаем скрипт
  true
else
  echo "✅ LoginChallenge получен: $LOGIN_CHALLENGE"
  echo ""

  # Шаг 1.2: Получение ConsentChallenge через логин
  echo "🔐 Шаг 1.2: Получение ConsentChallenge (логин)..."
  echo ""

  RESPONSE2=$(curl -s --max-time 30 -i -X POST "https://admin.mob-cash.com/authentication/login?login_challenge=${LOGIN_CHALLENGE}" \
    --header 'Accept: application/json, text/plain, */*' \
    --header 'Accept-Language: en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7' \
    --header 'Cache-Control: no-cache' \
    --header 'Connection: keep-alive' \
    --header 'Origin: https://app.mob-cash.com/' \
    --header 'Pragma: no-cache' \
    --header 'Referer: https://app.mob-cash.com/login' \
    --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36' \
    --header 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'nickname=burgoevk' \
    --data-urlencode 'password=Kanat312###' \
    --data-urlencode 'state=547f6922-61ec-47f8-8718-c7928dd8f6eb' \
    --data-urlencode 'remember_me=true' \
    --cookie-jar /tmp/mobcash_cookies.txt \
    --cookie /tmp/mobcash_cookies.txt \
    -L 2>&1) || true

  # Проверяем статус
  STATUS2=$(echo "$RESPONSE2" | head -1 | grep -oP 'HTTP/\d+ \K\d+' 2>/dev/null || echo "")

  if [ "$STATUS2" = "302" ] || [ "$STATUS2" = "301" ]; then
    # Извлекаем Location с login_verifier
    LOCATION2=$(echo "$RESPONSE2" | grep -i "^location:" | head -1 | cut -d' ' -f2- | tr -d '\r' 2>/dev/null || echo "")
    LOGIN_VERIFIER=$(echo "$LOCATION2" | grep -oP 'login_verifier=\K[^&]*' 2>/dev/null || echo "")
    
    # Исправляем URL - убираем дублирующийся grant_type и добавляем redirect_uri
    # В URL может быть grant_type=refresh_token&grant_type=authorization_code - нужно оставить только authorization_code
    if [ -n "$LOCATION2" ]; then
      echo "🔧 Оригинальный URL: ${LOCATION2:0:150}..."
      # Убираем grant_type=refresh_token& если он есть
      LOCATION2=$(echo "$LOCATION2" | sed 's/grant_type=refresh_token&//g')
      # Убираем дубликаты grant_type=authorization_code
      LOCATION2=$(echo "$LOCATION2" | sed 's/grant_type=authorization_code&grant_type=authorization_code/grant_type=authorization_code/g')
      # Убираем &grant_type=authorization_code если он дублируется в середине
      LOCATION2=$(echo "$LOCATION2" | sed 's/&grant_type=authorization_code&/&/g')
      # Убираем дубликаты в начале после ?
      LOCATION2=$(echo "$LOCATION2" | sed 's/?grant_type=authorization_code&grant_type=authorization_code/?grant_type=authorization_code&/g')
      
      # НЕ добавляем redirect_uri - он должен быть в оригинальном URL от сервера
      # Если его нет, значит сервер не требует его для этого запроса
      # Ошибка "redirect_uri does not match" означает, что мы пытаемся использовать неправильный redirect_uri
      
      echo "🔧 Исправленный URL: ${LOCATION2:0:150}..."
      echo ""
    fi

    if [ -n "$LOGIN_VERIFIER" ]; then
      echo "✅ Login Verifier получен: $LOGIN_VERIFIER"
      echo ""

      # Следуем редиректу для получения ConsentChallenge
      # Согласно документации, после login_verifier нужно получить ConsentChallenge из JSON ответа
      echo "🔐 Шаг 1.3: Получение ConsentChallenge..."
      echo "Следуем редиректу с login_verifier: $LOCATION2"
      echo ""

      # Следуем редиректу с login_verifier (НЕ используем -L, чтобы получить промежуточный ответ)
      RESPONSE3=$(curl -s --max-time 30 -i "$LOCATION2" \
        --header 'Accept: application/json, text/plain, */*' \
        --cookie-jar /tmp/mobcash_cookies.txt \
        --cookie /tmp/mobcash_cookies.txt 2>&1) || true

      # Проверяем статус
      STATUS3=$(echo "$RESPONSE3" | head -1 | grep -oP 'HTTP/\d+ \K\d+' 2>/dev/null || echo "")
      
      # Если есть редирект, следуем ему
      if [ "$STATUS3" = "302" ] || [ "$STATUS3" = "301" ]; then
        LOCATION3=$(echo "$RESPONSE3" | grep -i "^location:" | head -1 | cut -d' ' -f2- | tr -d '\r' 2>/dev/null || echo "")
        if [ -n "$LOCATION3" ]; then
          echo "📍 Следуем редиректу: ${LOCATION3:0:150}..."
          RESPONSE3B=$(curl -s --max-time 30 "$LOCATION3" \
            --header 'Accept: application/json, text/plain, */*' \
            --cookie-jar /tmp/mobcash_cookies.txt \
            --cookie /tmp/mobcash_cookies.txt 2>&1) || true
          
          # Пробуем извлечь ConsentChallenge из JSON ответа
          CONSENT_CHALLENGE=$(echo "$RESPONSE3B" | grep -oP '"ConsentChallenge":"\K[^"]*' 2>/dev/null || echo "")
        fi
      else
        # Если нет редиректа, пробуем извлечь ConsentChallenge из JSON ответа
        CONSENT_CHALLENGE=$(echo "$RESPONSE3" | grep -oP '"ConsentChallenge":"\K[^"]*' 2>/dev/null || echo "")
      fi

      if [ -z "$CONSENT_CHALLENGE" ]; then
        echo "❌ Не удалось получить ConsentChallenge"
        echo "Ответ:"
        echo "$RESPONSE3" | head -20
        echo ""
        true
      else
        echo "✅ ConsentChallenge получен: $CONSENT_CHALLENGE"
        echo ""

        # Шаг 1.4: Получение токена авторизации (согласно документации, токен приходит ПРЯМО в ответе!)
        echo "🔐 Шаг 1.4: Получение access_token через /authentication/consent..."
        echo ""

        # Согласно документации, используем --form (multipart/form-data), а не --data-urlencode!
        RESPONSE4=$(curl -s --max-time 30 -X POST "https://admin.mob-cash.com/authentication/consent?consent_challenge=${CONSENT_CHALLENGE}" \
          --header 'Accept: application/json, text/plain, */*' \
          --header 'Accept-Language: en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7' \
          --header 'Cache-Control: no-cache' \
          --header 'Connection: keep-alive' \
          --header 'Origin: https://app.mob-cash.com' \
          --header 'Pragma: no-cache' \
          --header 'Referer: https://app.mob-cash.com' \
          --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36' \
          --header 'Cookie: ory_hydra_consent_csrf_1521278011=MTc2MjI3MTUyNXxzVmRWUml2VUREZHRuVmk2dVBMbURqNk5xZ3h6UFRiZnAtY1BTV2dYYWVZd3RVQzRnczBVeFdVVlc5MzlqM3lIMmNFaVF4SFdFNGQ1WWpCVnkxc3Q1cU5mRkoxY3I0czA2NzBTNV82YjNENVA5amNFby1JVzB3WHNvNUFvOFE9PXyqLwxOujCbHHBa_TTm5wIbE8x2V3XppyHnIVWB4w93ZA==; ory_hydra_login_csrf_1521278011=MTc2MjI3MTEyOXxCVkFwT3pnSmxlZEw5VHNCN3JzeTdGcmd1akhJblc1UlhIZHZ1S3V4c2pEQmNCa1BpZGJZZ3Z6bG13YXlQeE9neUNOaXJsd0tmT1N4YmZpejIyOTdsQkVRTDVRQ1VHRlQxelBwemRHaHFGRERlXzk3dXhzT3FlUXFXaURDS1E9PXx39A7O9Re1dWdd1LKMFIE5rTwmmYJVk5vbDCg-6rjBRg==; ory_hydra_session=MTc2MjI3MTUyNXw2LW9JQmIyVWRuNEEwTnViSkdVaEcxMUd0X0E1bjk0MGV1b19uQnJKV0lOZDcwem9CT0lQcGlEVlRKaHR6bk1mTnAtcGpoRkh6c0FBLXJXYVpqT0o4NE44bFJFcHRRb2xxdDhpQTBkSWRPNHpWVjdPOEpicEpSQTB5c1lVTmFfelVBPT18553Pt2hMtIcoR9gFre5n-u2bghLYaa53pbRAN5vaIJc=' \
          --form 'client_id="4e779103-d67b-42ef-bc9d-ab5ecdec40f8"' \
          --form 'grant_scope="offline"' \
          --form 'state="547f6922-61ec-47f8-8718-c7928dd8f6eb"' \
          --cookie-jar /tmp/mobcash_cookies.txt \
          --cookie /tmp/mobcash_cookies.txt 2>&1) || true

        echo "📊 Ответ от /authentication/consent:"
        echo "$RESPONSE4" | head -20
        echo ""

        # Согласно документации, токен приходит ПРЯМО в ответе, а не через обмен кода!
        ACCESS_TOKEN=$(echo "$RESPONSE4" | grep -oP '"access_token":"\K[^"]*' 2>/dev/null || echo "")

        if [ -n "$ACCESS_TOKEN" ]; then
          echo "✅ Access Token получен напрямую из ответа: ${ACCESS_TOKEN:0:50}..."
          echo ""

          # Шаг 1.5: Получение User ID (согласно документации, шаг 1.4)
          echo "🔐 Шаг 1.5: Получение профиля пользователя (user.profile)..."
          echo ""

          USER_PROFILE_RESPONSE=$(curl -s --max-time 30 -X POST 'https://admin.mob-cash.com/api/' \
            --header 'Accept: application/json, text/plain, */*' \
            --header "Authorization: Bearer ${ACCESS_TOKEN}" \
            --header 'Content-Type: application/json' \
            --header 'Origin: https://app.mob-cash.com' \
            --header 'Referer: https://app.mob-cash.com/' \
            --header 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' \
            --header 'x-request-source: pwa' \
            --data '[{"jsonrpc":"2.0","id":11,"method":"user.profile","params":{}}]' 2>&1) || true

          USER_ID=$(echo "$USER_PROFILE_RESPONSE" | grep -oP '"id":"\K[^"]*' | head -1 2>/dev/null || echo "")

          if [ -n "$USER_ID" ]; then
            echo "✅ User ID: $USER_ID"
            echo ""

            # Шаг 1.6: Логин на кассу (Session ID) - согласно документации, шаг 1.5
            echo "🔐 Шаг 1.6: Логин на кассу (mobile.login)..."
            echo ""

            LOGIN_RESPONSE=$(curl -s --max-time 30 -X POST 'https://admin.mob-cash.com/api/' \
              --header 'Accept: application/json, text/plain, */*' \
              --header "Authorization: Bearer ${ACCESS_TOKEN}" \
              --header 'Content-Type: application/json' \
              --header 'Origin: https://app.mob-cash.com' \
              --header 'Referer: https://app.mob-cash.com/' \
              --header 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' \
              --header 'x-request-source: pwa' \
              --data "[{\"jsonrpc\":\"2.0\",\"id\":12,\"method\":\"mobile.login\",\"params\":{\"location\":{\"lat\":42.845778,\"lon\":74.568778},\"cashboxCode\":1001098,\"userID\":\"${USER_ID}\"}}]" 2>&1) || true

            SESSION_ID=$(echo "$LOGIN_RESPONSE" | grep -oP '"sessionID":"\K[^"]*' 2>/dev/null || echo "$LOGIN_RESPONSE" | grep -oP '"session_id":"\K[^"]*' 2>/dev/null || echo "$LOGIN_RESPONSE" | grep -oP '"id":"\K[^"]*' | head -1 2>/dev/null || echo "")

            if [ -n "$SESSION_ID" ]; then
              echo "✅ Session ID: $SESSION_ID"
            else
              echo "⚠️  Session ID не найден"
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
          else
            echo "❌ Не удалось получить User ID"
          fi
        else
          echo "❌ Не удалось получить Access Token"
          echo "Ответ: $TOKEN_RESPONSE"
        fi
      else
        echo "❌ Не удалось получить authorization code или consent_challenge"
        echo "Попробуйте еще раз или используйте токены из браузера"
      fi
    else
      echo "❌ Не удалось получить login_verifier"
    fi
  else
    echo "❌ Неожиданный статус: $STATUS2"
  fi
fi

echo ""
echo "============================================================"
echo "✅ Скрипт завершен безопасно"
echo "============================================================"

# Явно завершаем с успехом
true

