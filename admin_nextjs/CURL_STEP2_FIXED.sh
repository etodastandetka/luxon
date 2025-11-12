#!/bin/bash
# Шаг 1.2: Получение ConsentChallenge
# Используйте login_challenge из последнего ответа шага 1.1

LOGIN_CHALLENGE="78a7ed3ce0854a7d84cd5224454f852f"

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

