#!/bin/bash

# Тестирование разных вариантов Mostbet API
# API credentials
API_KEY="api-key:62e9da4c-52e3-4d0f-b579-c9e7805f711d"
SECRET="Kana312"
CASHPOINT_ID_FULL="C131864"
CASHPOINT_ID_NUMERIC="131864"

# Base URL
BASE_URL="https://apimb.com/mbc/gateway/v1/api"

# Получаем текущее время в UTC
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S")

echo "=========================================="
echo "Testing Mostbet API with different variants"
echo "Timestamp: $TIMESTAMP"
echo "=========================================="
echo ""

# Функция для генерации подписи SHA3-256
generate_signature() {
    local sign_string="$1"
    local secret="$2"
    
    # Пробуем разные способы генерации SHA3-256
    # Вариант 1: openssl (если поддерживает)
    if command -v openssl &> /dev/null; then
        echo -n "$sign_string" | openssl dgst -sha3-256 -hmac "$secret" -binary | xxd -p -c 256 2>/dev/null
        if [ $? -eq 0 ]; then
            return 0
        fi
    fi
    
    # Вариант 2: Python (более надежный)
    python3 -c "
import hmac
import hashlib
import sys

try:
    # Пробуем sha3_256
    sha3_func = hashlib.sha3_256
except AttributeError:
    try:
        import sha3
        sha3_func = sha3.sha3_256
    except ImportError:
        print('SHA3-256 not available', file=sys.stderr)
        sys.exit(1)

sign_string = sys.argv[1]
secret = sys.argv[2]

signature = hmac.new(
    secret.encode('utf-8'),
    sign_string.encode('utf-8'),
    sha3_func
).hexdigest()

print(signature)
" "$sign_string" "$secret"
}

# Вариант 1: Полный cashpoint_id в URL и path для подписи (C131864)
echo "=== Variant 1: Full cashpoint_id in URL and path (C131864) ==="
PATH1="/mbc/gateway/v1/api/cashpoint/C131864/balance"
URL1="${BASE_URL}/cashpoint/C131864/balance"
SIGN_STRING1="${API_KEY}${PATH1}${TIMESTAMP}"
SIGNATURE1=$(generate_signature "$SIGN_STRING1" "$SECRET")

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

# Вариант 2: Числовой cashpoint_id в URL и path для подписи (131864)
echo "=== Variant 2: Numeric cashpoint_id in URL and path (131864) ==="
PATH2="/mbc/gateway/v1/api/cashpoint/131864/balance"
URL2="${BASE_URL}/cashpoint/131864/balance"
SIGN_STRING2="${API_KEY}${PATH2}${TIMESTAMP}"
SIGNATURE2=$(generate_signature "$SIGN_STRING2" "$SECRET")

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

# Вариант 3: Полный cashpoint_id в path для подписи, числовой в URL
echo "=== Variant 3: Full cashpoint_id in path for signature, numeric in URL ==="
PATH3="/mbc/gateway/v1/api/cashpoint/C131864/balance"
URL3="${BASE_URL}/cashpoint/131864/balance"
SIGN_STRING3="${API_KEY}${PATH3}${TIMESTAMP}"
SIGNATURE3=$(generate_signature "$SIGN_STRING3" "$SECRET")

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

# Вариант 4: Числовой cashpoint_id в path для подписи, полный в URL (маловероятно, но проверим)
echo "=== Variant 4: Numeric cashpoint_id in path for signature, full in URL ==="
PATH4="/mbc/gateway/v1/api/cashpoint/131864/balance"
URL4="${BASE_URL}/cashpoint/C131864/balance"
SIGN_STRING4="${API_KEY}${PATH4}${TIMESTAMP}"
SIGNATURE4=$(generate_signature "$SIGN_STRING4" "$SECRET")

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
echo "=========================================="
echo "Testing completed"
echo "=========================================="

