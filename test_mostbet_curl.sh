#!/bin/bash

# Тестирование разных вариантов Mostbet API через curl
# Запустите на сервере: bash test_mostbet_curl.sh

API_KEY="api-key:62e9da4c-52e3-4d0f-b579-c9e7805f711d"
SECRET="94f63f7e-b7ff-4ef9-bccc-d05efa22301d"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S")

echo "=========================================="
echo "Testing Mostbet API - Variant 1"
echo "Full cashpoint_id in URL and path (C131864)"
echo "=========================================="
echo "Timestamp: $TIMESTAMP"
echo ""

# Вариант 1: Полный cashpoint_id C131864 в URL и path
PATH1="/mbc/gateway/v1/api/cashpoint/C131864/balance"
URL1="https://apimb.com/mbc/gateway/v1/api/cashpoint/C131864/balance"
SIGN_STRING1="${API_KEY}${PATH1}${TIMESTAMP}"

# Генерируем подпись через Python
SIGNATURE1=$(python3 -c "
import hmac
import hashlib
import sys
try:
    sha3_func = hashlib.sha3_256
except AttributeError:
    import sha3
    sha3_func = sha3.sha3_256
sign_string = sys.argv[1]
secret = sys.argv[2]
signature = hmac.new(secret.encode('utf-8'), sign_string.encode('utf-8'), sha3_func).hexdigest()
print(signature)
" "$SIGN_STRING1" "$SECRET")

echo "Path: $PATH1"
echo "URL: $URL1"
echo "Sign String: $SIGN_STRING1"
echo "Signature: $SIGNATURE1"
echo ""

curl -X GET "$URL1" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE1" \
  -H "Accept: */*" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo ""
echo "=========================================="
echo "Testing Mostbet API - Variant 2"
echo "Numeric cashpoint_id in URL and path (131864)"
echo "=========================================="
echo ""

# Вариант 2: Числовой cashpoint_id 125160 в URL и path (касса в INR)
PATH2="/mbc/gateway/v1/api/cashpoint/125160/balance"
URL2="https://apimb.com/mbc/gateway/v1/api/cashpoint/125160/balance"
SIGN_STRING2="${API_KEY}${PATH2}${TIMESTAMP}"

SIGNATURE2=$(python3 -c "
import hmac
import hashlib
import sys
try:
    sha3_func = hashlib.sha3_256
except AttributeError:
    import sha3
    sha3_func = sha3.sha3_256
sign_string = sys.argv[1]
secret = sys.argv[2]
signature = hmac.new(secret.encode('utf-8'), sign_string.encode('utf-8'), sha3_func).hexdigest()
print(signature)
" "$SIGN_STRING2" "$SECRET")

echo "Path: $PATH2"
echo "URL: $URL2"
echo "Sign String: $SIGN_STRING2"
echo "Signature: $SIGNATURE2"
echo ""

curl -X GET "$URL2" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE2" \
  -H "Accept: */*" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo ""
echo "=========================================="
echo "Testing Mostbet API - Variant 3"
echo "Full cashpoint_id in path for signature, numeric in URL"
echo "=========================================="
echo ""

# Вариант 3: Полный cashpoint_id C131864 в path для подписи, числовой 131864 в URL
PATH3="/mbc/gateway/v1/api/cashpoint/C131864/balance"
URL3="https://apimb.com/mbc/gateway/v1/api/cashpoint/131864/balance"

# Вариант 4: Полный cashpoint_id C131864 в path для подписи, числовой 125160 в URL
PATH4="/mbc/gateway/v1/api/cashpoint/C131864/balance"
URL4="https://apimb.com/mbc/gateway/v1/api/cashpoint/125160/balance"
SIGN_STRING3="${API_KEY}${PATH3}${TIMESTAMP}"

SIGNATURE3=$(python3 -c "
import hmac
import hashlib
import sys
try:
    sha3_func = hashlib.sha3_256
except AttributeError:
    import sha3
    sha3_func = sha3.sha3_256
sign_string = sys.argv[1]
secret = sys.argv[2]
signature = hmac.new(secret.encode('utf-8'), sign_string.encode('utf-8'), sha3_func).hexdigest()
print(signature)
" "$SIGN_STRING3" "$SECRET")

echo "Path for signature: $PATH3"
echo "URL: $URL3"
echo "Sign String: $SIGN_STRING3"
echo "Signature: $SIGNATURE3"
echo ""

curl -X GET "$URL3" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE3" \
  -H "Accept: */*" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo ""
echo "=========================================="
echo "Testing Mostbet API - Variant 4"
echo "Full cashpoint_id C131864 in path for signature, numeric 125160 in URL"
echo "=========================================="
echo ""

SIGN_STRING4="${API_KEY}${PATH4}${TIMESTAMP}"

SIGNATURE4=$(python3 -c "
import hmac
import hashlib
import sys
try:
    sha3_func = hashlib.sha3_256
except AttributeError:
    import sha3
    sha3_func = sha3.sha3_256
sign_string = sys.argv[1]
secret = sys.argv[2]
signature = hmac.new(secret.encode('utf-8'), sign_string.encode('utf-8'), sha3_func).hexdigest()
print(signature)
" "$SIGN_STRING4" "$SECRET")

echo "Path for signature: $PATH4"
echo "URL: $URL4"
echo "Sign String: $SIGN_STRING4"
echo "Signature: $SIGNATURE4"
echo ""

curl -X GET "$URL4" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE4" \
  -H "Accept: */*" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo ""
echo "=========================================="
echo "Testing completed"
echo "=========================================="

