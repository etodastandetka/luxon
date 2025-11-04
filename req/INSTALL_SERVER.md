# Инструкция по установке на сервере

## Вариант 1: PHP скрипт (САМЫЙ ПРОСТОЙ)

### Шаг 1: Создайте таблицу в PostgreSQL

Подключитесь к вашей базе данных и выполните SQL из файла `database_setup.sql`:

```sql
CREATE TABLE IF NOT EXISTS payment_notifications (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(255) NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KGS',
    card_number VARCHAR(50),
    account_number VARCHAR(50),
    transaction_date TIMESTAMP NOT NULL,
    raw_text TEXT NOT NULL,
    parsed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_name ON payment_notifications(bank_name);
CREATE INDEX IF NOT EXISTS idx_transaction_date ON payment_notifications(transaction_date DESC);
```

### Шаг 2: Загрузите файл api.php на сервер

1. Загрузите файл `api.php` на ваш сервер
2. Разместите его в любой папке, например: `http://89.23.117.61/api/payments.php`
3. Убедитесь что PHP подключен к PostgreSQL (расширение `pdo_pgsql`)

### Шаг 3: Настройте URL в Android приложении

В файле `app/src/main/java/com/req/notificationreader/util/DatabaseConfig.kt` измените:

```kotlin
const val API_BASE_URL = "http://89.23.117.61"  // Без порта, если используете стандартный 80
```

И в `PostgresApiClient.kt` endpoint будет: `http://89.23.117.61/api/payments.php`

---

## Вариант 2: Node.js сервер (если есть Node.js)

```bash
npm install express pg
node api_server.js
```

Сервер запустится на порту 3000: `http://89.23.117.61:3000/api/payments`

---

## Вариант 3: Python Flask сервер (если есть Python)

Создайте файл `api_server.py`:

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from datetime import datetime

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    'host': '89.23.117.61',
    'port': 5432,
    'database': 'default_db',
    'user': 'gen_user',
    'password': 'dastan10dz'
}

@app.route('/api/payments', methods=['POST'])
def save_payment():
    try:
        data = request.json
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO payment_notifications 
            (bank_name, package_name, amount, currency, card_number, account_number, 
             transaction_date, raw_text, parsed_at, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING id
        """, (
            data['bank_name'],
            data['package_name'],
            float(data['amount']),
            data.get('currency', 'KGS'),
            data.get('card_number'),
            data.get('account_number'),
            data.get('transaction_date', datetime.now().isoformat()),
            data['raw_text'],
            data.get('parsed_at', datetime.now().isoformat())
        ))
        
        payment_id = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'data': {'id': payment_id}})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
```

Запуск:
```bash
pip install flask flask-cors psycopg2-binary
python api_server.py
```

---

## Проверка работы

После настройки проверьте endpoint:

```bash
curl -X POST http://89.23.117.61/api/payments.php \
  -H "Content-Type: application/json" \
  -d '{"bank_name":"Test Bank","package_name":"test.app","amount":100.50,"currency":"KGS","raw_text":"Test payment"}'
```

Должен вернуть: `{"success":true,"data":{"id":1,...}}`

