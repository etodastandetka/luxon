#!/bin/bash
# Шаг 1.2: Получение ConsentChallenge через логин
# Использование: bash scripts/curl-login-step2.sh [LOGIN_CHALLENGE]

LOGIN_CHALLENGE="${1:-67ce26c66ea24e6a8f3c11ad82b2ddf0}"

echo "🔐 Шаг 1.2: Получение ConsentChallenge (логин)..."
echo "Login Challenge: $LOGIN_CHALLENGE"
echo ""

curl -i -L -X POST "https://admin.mob-cash.com/authentication/login?login_challenge=${LOGIN_CHALLENGE}" \
  --header 'Accept: application/json, text/plain, */*' \
  --header 'Accept-Language: en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7' \
  --header 'Cache-Control: no-cache' \
  --header 'Connection: keep-alive' \
  --header 'Origin: https://app.mob-cash.com/' \
  --header 'Pragma: no-cache' \
  --header 'Referer: https://app.mob-cash.com/login' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --header 'Cookie: ory_hydra_consent_csrf_1521278011=MTc2MjI3MTUyNXxzVmRWUml2VUREZHRuVmk2dVBMbURqNk5xZ3h6UFRiZnAtY1BTV2dYYWVZd3RVQzRnczBVeFdVVlc5MzlqM3lIMmNFaVF4SFdFNGQ1WWpCVnkxc3Q1cU5mRkoxY3I0czA2NzBTNV82YjNENVA5amNFby1JVzB3WHNvNUFvOFE9PXyqLwxOujCbHHBa_TTm5wIbE8x2V3XppyHnIVWB4w93ZA==; ory_hydra_login_csrf_1521278011=MTc2MjI3MTEyOXxCVkFwT3pnSmxlZEw5VHNCN3JzeTdGcmd1akhJblc1UlhIZHZ1S3V4c2pEQmNCa1BpZGJZZ3Z6bG13YXlQeE9neUNOaXJsd0tmT1N4YmZpejIyOTdsQkVRTDVRQ1VHRlQxelBwemRHaHFGRERlXzk3dXhzT3FlUXFXaURDS1E9PXx39A7O9Re1dWdd1LKMFIE5rTwmmYJVk5vbDCg-6rjBRg==; ory_hydra_session=MTc2MjI3MTUyNXw2LW9JQmIyVWRuNEEwTnViSkdVaEcxMUd0X0E1bjk0MGV1b19uQnJKV0lOZDcwem9CT0lQcGlEVlRKaHR6bk1mTnAtcGpoRkh6c0FBLXJXYVpqT0o4NE44bFJFcHRRb2xxdDhpQTBkSWRPNHpWVjdPOEpicEpSQTB5c1lVTmFfelVBPT18553Pt2hMtIcoR9gFre5n-u2bghLYaa53pbRAN5vaIJc=' \
  --data-urlencode 'nickname=burgoevk' \
  --data-urlencode 'password=Kanat312###' \
  --data-urlencode 'state=547f6922-61ec-47f8-8718-c7928dd8f6eb' \
  --data-urlencode 'remember_me=true' \
  --cookie-jar /tmp/mobcash_cookies.txt \
  --cookie /tmp/mobcash_cookies.txt

echo ""
echo "============================================================"
echo "✅ Команда выполнена!"
echo "Ищите в ответе:"
echo "  - Location header с login_verifier"
echo "  - Затем consent_challenge в следующем редиректе"
echo "============================================================"

