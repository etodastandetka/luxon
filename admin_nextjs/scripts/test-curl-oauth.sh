#!/bin/bash
# Исправленный curl запрос для OAuth2 flow
# Использование: bash scripts/test-curl-oauth.sh

echo "🧪 Тестирование OAuth2 flow через curl"
echo "============================================================"
echo ""

# Шаг 1.1: Получение LoginChallenge
echo "🔐 Шаг 1.1: Получение LoginChallenge..."
echo ""

# ИСПРАВЛЕННАЯ КОМАНДА:
# Используем --data-urlencode вместо --form
# Используем -L для следования редиректам
# Используем -i для показа заголовков ответа
# Используем -v для подробного вывода (опционально)

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

echo ""
echo "============================================================"
echo "⚠️  ВАЖНО: Этот запрос может не сработать без cookies"
echo "   OAuth2 flow требует CSRF токены, которые устанавливаются"
echo "   только в браузере при первом посещении."
echo ""
echo "   Для работы API используйте готовые токены из браузера!"
echo "   См. ENV_MOBCASH_ADD.txt для инструкций"
echo "============================================================"

